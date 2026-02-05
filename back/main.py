from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
import asyncpg
from pathlib import Path
import httpx

import os
from dotenv import load_dotenv

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

# Persistent HTTP client for connection pooling (MUCH faster!)
http_client = None

@app.on_event("startup")
async def startup_event():
    global http_client
    # Create a shared client with connection pooling
    http_client = httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        timeout=httpx.Timeout(10.0)
    )

@app.on_event("shutdown")
async def shutdown_event():
    global http_client
    if http_client:
        await http_client.aclose()

@app.get("/albums/{album_id}/assets")
async def get_album_assets(album_id: str):
    conn = await asyncpg.connect(DATABASE_URL)
    rows = await conn.fetch(
        'SELECT "assetId", "createdAt" FROM album_asset WHERE "albumId" = $1 ORDER BY "createdAt" DESC',
        album_id
    )
    await conn.close()
    return [{"assetId": row["assetId"], "createdAt": row["createdAt"]} for row in rows]

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
            "ETag": f'"{asset_id}-fullsize"',
        }
    )

# Mount frontend static files
frontend_dir = Path(__file__).parent.parent / "front-react" / "dist"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="static")