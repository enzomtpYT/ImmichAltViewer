from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, Response
import asyncpg
from pathlib import Path
import httpx

import os
from dotenv import load_dotenv
import mimetypes

# Fix MIME types for Windows
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / ".env")


app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration from Environment Variables
DATABASE_URL = os.getenv("DATABASE_URL")
IMMICH_URL = os.getenv("IMMICH_URL")

if not DATABASE_URL or not IMMICH_URL:
    print("WARNING: DATABASE_URL or IMMICH_URL not set in environment!")

print(f"Starting server with:")
print(f"IMMICH_URL: {IMMICH_URL}")
print(f"DATABASE_URL: {DATABASE_URL}")

# Persistent client and pool
http_client = None
db_pool = None

@app.on_event("startup")
async def startup_event():
    global http_client, db_pool
    # Create a shared client with connection pooling
    http_client = httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        timeout=httpx.Timeout(10.0)
    )
    # Create database connection pool
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    # Clear cache on reload
    asset_cache.clear()

@app.on_event("shutdown")
async def shutdown_event():
    global http_client, db_pool
    if http_client:
        await http_client.aclose()
    if db_pool:
        await db_pool.close()

# Simple in-memory cache
asset_cache = {}

@app.get("/albums/{album_id}/assets")
async def get_album_assets(album_id: str):
    # Check cache first
    if album_id in asset_cache:
        return asset_cache[album_id]
        
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            '''
            SELECT aa."assetId", aa."createdAt", a."type"
            FROM album_asset aa
            JOIN asset a ON a."id" = aa."assetId"
            WHERE aa."albumId" = $1
            ORDER BY aa."createdAt" DESC
            ''',
            album_id
        )
    
    result = [{"assetId": row["assetId"], "createdAt": row["createdAt"], "type": row["type"]} for row in rows]
    asset_cache[album_id] = result
    return result



@app.get("/proxy/thumbnail/{asset_id}")
async def proxy_thumbnail(asset_id: str, api_key: str):
    """Proxy endpoint to fetch Immich thumbnails with authentication"""
    
    # Sanitize API key to remove non-ASCII characters
    api_key_clean = api_key.encode('ascii', 'ignore').decode('ascii').strip()
    
    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/thumbnail"
    headers = {"x-api-key": api_key_clean}
    params = {"size": "thumbnail"}
    
    # Stream the response instead of loading all into memory
    response = await http_client.get(immich_url, headers=headers, params=params)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch thumbnail")
    
    # Return streaming response with caching headers
    return StreamingResponse(
        iter([response.content]),
        media_type=response.headers.get("content-type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "ETag": f'"{asset_id}-thumb"',
        }
    )

@app.get("/proxy/preview/{asset_id}")
async def proxy_preview(asset_id: str, api_key: str):
    """Proxy endpoint to fetch Immich preview images with authentication"""
    
    # Sanitize API key to remove non-ASCII characters
    api_key_clean = api_key.encode('ascii', 'ignore').decode('ascii').strip()
    
    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/thumbnail"
    headers = {"x-api-key": api_key_clean}
    params = {"size": "preview"}
    
    # Stream the response instead of loading all into memory
    response = await http_client.get(immich_url, headers=headers, params=params)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch preview")
    
    # Return streaming response with caching headers
    return StreamingResponse(
        iter([response.content]),
        media_type=response.headers.get("content-type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "ETag": f'"{asset_id}-preview"',
        }
    )

@app.get("/proxy/fullsize/{asset_id}")
async def proxy_fullsize(asset_id: str, api_key: str):
    """Proxy endpoint to fetch Immich full-size images with authentication"""
    
    # Sanitize API key to remove non-ASCII characters
    api_key_clean = api_key.encode('ascii', 'ignore').decode('ascii').strip()
    
    # Use /original endpoint for full-size images
    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/original"
    headers = {"x-api-key": api_key_clean}
    
    # Stream the response instead of loading all into memory
    response = await http_client.get(immich_url, headers=headers)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch fullsize image")
    
    # Return streaming response with caching headers
    return StreamingResponse(
        iter([response.content]),
        media_type=response.headers.get("content-type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "ETag": f'"{ asset_id}-fullsize"',
        }
    )

@app.get("/proxy/video/{asset_id}")
async def proxy_video(asset_id: str, api_key: str, request: Request):
    """Proxy endpoint to stream Immich videos with Range request support"""
    
    api_key_clean = api_key.encode('ascii', 'ignore').decode('ascii').strip()
    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/video/playback"
    headers = {"x-api-key": api_key_clean}
    
    # Forward Range header if present (needed for video seeking)
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header
    
    # Use a longer timeout for video
    video_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0))
    try:
        response = await video_client.get(immich_url, headers=headers)
    finally:
        await video_client.aclose()
    
    if response.status_code not in (200, 206):
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch video")
    
    response_headers = {
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
    }
    
    # Forward content headers from Immich
    for header in ["Content-Range", "Content-Length", "Content-Type"]:
        if header.lower() in response.headers:
            response_headers[header] = response.headers[header.lower()]
    
    content_type = response.headers.get("content-type", "video/mp4")
    
    return Response(
        content=response.content,
        status_code=response.status_code,
        headers=response_headers,
        media_type=content_type,
    )

# Mount frontend static files
frontend_dir = (Path(__file__).parent.parent / "front-react" / "dist").resolve()
print(f"Frontend directory: {frontend_dir}")
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="static")
else:
    @app.get("/")
    def read_root():
        return {"message": f"Backend is running. Frontend (dist) not found at {frontend_dir}. Build it with 'npm run build' in the frontend directory."}

