from fastapi import FastAPI, HTTPException, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
import asyncpg
from pathlib import Path
import httpx

import os
from dotenv import load_dotenv
import mimetypes
from uuid import UUID

# Fix MIME types for Windows
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / ".env")


app = FastAPI()

# CORS: explicit origins from env (comma-separated); fall back to "*" (no credentials).
# The frontend is served same-origin in production, so CORS is only needed for the dev server.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
allow_all = "*" in CORS_ORIGINS or not CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else CORS_ORIGINS,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compress JSON API responses (asset lists benefit greatly)
app.add_middleware(GZipMiddleware, minimum_size=1000)

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

# Simple in-memory cache with TTL and LRU eviction
import time
import asyncio
from contextlib import asynccontextmanager
asset_cache = {}  # {cache_key: (timestamp, data)}
CACHE_TTL = 60  # seconds
MAX_CACHE_ENTRIES = 500

def cache_put(key, value):
    """Insert into the cache, bumping LRU order and evicting oldest entries over the cap."""
    now = time.time()
    if key in asset_cache:
        del asset_cache[key]
    asset_cache[key] = (now, value)
    while len(asset_cache) > MAX_CACHE_ENTRIES:
        asset_cache.pop(next(iter(asset_cache)))


def cache_get(key):
    """Return cached data if fresh, else None. Refreshes LRU order on hit."""
    entry = asset_cache.get(key)
    if entry is None:
        return None
    timestamp, data = entry
    if time.time() - timestamp >= CACHE_TTL:
        asset_cache.pop(key, None)
        return None
    # Refresh LRU position
    del asset_cache[key]
    asset_cache[key] = entry
    return data


async def create_db_pool_with_retry(url, retries=10, delay=3.0):
    """Create the asyncpg pool, retrying with backoff so a momentarily-down DB
    doesn't crash-loop the container at startup."""
    for attempt in range(retries):
        try:
            return await asyncpg.create_pool(url)
        except Exception as e:  # noqa: BLE001 - retry any transient startup failure
            if attempt == retries - 1:
                raise
            print(f"DB connection failed (attempt {attempt + 1}/{retries}): {e}. Retrying in {delay}s...")
            await asyncio.sleep(delay)


@asynccontextmanager
async def lifespan(app):
    global http_client, db_pool
    http_client = httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        # Per-connection timeouts: generous read window for large originals/videos
        timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=10.0),
    )
    db_pool = await create_db_pool_with_retry(DATABASE_URL)
    # Clear cache on reload
    asset_cache.clear()
    try:
        yield
    finally:
        if http_client:
            await http_client.aclose()
        if db_pool:
            await db_pool.close()

app = FastAPI(lifespan=lifespan)

@app.get("/albums/{album_id}/assets")
async def get_album_assets(album_id: str):
    # Check cache first (with TTL + LRU eviction)
    cached = cache_get(album_id)
    if cached is not None:
        return cached

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            '''
            SELECT aa."assetId", aa."createdAt", a."type", a."originalFileName"
            FROM album_asset aa
            JOIN asset a ON a."id" = aa."assetId"
            WHERE aa."albumId" = $1
            ORDER BY aa."createdAt" DESC
            ''',
            album_id
        )

    result = [{"assetId": row["assetId"], "createdAt": row["createdAt"], "type": row["type"], "originalFileName": row["originalFileName"]} for row in rows]
    cache_put(album_id, result)
    return result


@app.get("/albums/assets")
async def get_multiple_albums_assets(ids: str = Query(..., description="Comma-separated album UUIDs")):
    album_ids_raw = [album_id.strip() for album_id in ids.split(",") if album_id.strip()]
    if not album_ids_raw:
        raise HTTPException(status_code=400, detail="No album IDs provided")

    valid_album_ids = []
    for album_id in album_ids_raw:
        try:
            UUID(album_id)
            valid_album_ids.append(album_id)
        except ValueError:
            continue

    if not valid_album_ids:
        raise HTTPException(status_code=400, detail="No valid album IDs provided")

    normalized_ids = sorted(set(valid_album_ids))
    cache_key = f"multi:{','.join(normalized_ids)}"

    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            '''
            SELECT DISTINCT ON (aa."assetId")
                aa."assetId",
                aa."createdAt",
                a."type",
                a."originalFileName"
            FROM album_asset aa
            JOIN asset a ON a."id" = aa."assetId"
            WHERE aa."albumId" = ANY($1::uuid[])
            ORDER BY aa."assetId", aa."createdAt" DESC
            ''',
            normalized_ids
        )

    result = [{"assetId": row["assetId"], "createdAt": row["createdAt"], "type": row["type"], "originalFileName": row["originalFileName"]} for row in rows]
    result.sort(key=lambda item: (item["createdAt"], item["assetId"]), reverse=True)

    cache_put(cache_key, result)
    return result


@app.get("/health")
async def health_check():
    """Health check endpoint for container / system monitoring"""
    db_status = "ok"
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception as e:
        db_status = f"error: {str(e)}"

    immich_status = "configured" if IMMICH_URL else "missing_url"

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "database": db_status,
        "immich": immich_status,
        "cached_albums": len(asset_cache)
    }


@app.get("/albums/{album_id}/stats")
async def get_album_stats(album_id: str):
    """Get total count, media types count, and upload date range for an album"""
    try:
        UUID(album_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid album UUID format")

    async with db_pool.acquire() as conn:
        stats = await conn.fetchrow(
            '''
            SELECT 
                COUNT(aa."assetId") AS total_count,
                COUNT(CASE WHEN a."type" = 'IMAGE' THEN 1 END) AS image_count,
                COUNT(CASE WHEN a."type" = 'VIDEO' THEN 1 END) AS video_count,
                MIN(aa."createdAt") AS earliest_upload,
                MAX(aa."createdAt") AS latest_upload
            FROM album_asset aa
            JOIN asset a ON a."id" = aa."assetId"
            WHERE aa."albumId" = $1
            ''',
            album_id
        )

    if not stats or stats["total_count"] == 0:
        return {
            "albumId": album_id,
            "totalCount": 0,
            "imageCount": 0,
            "videoCount": 0,
            "earliestUpload": None,
            "latestUpload": None
        }

    return {
        "albumId": album_id,
        "totalCount": stats["total_count"],
        "imageCount": stats["image_count"],
        "videoCount": stats["video_count"],
        "earliestUpload": stats["earliest_upload"],
        "latestUpload": stats["latest_upload"]
    }


@app.get("/albums/{album_id}/assets/search")
async def search_album_assets(
    album_id: str,
    query: str = Query(None, description="Filename query"),
    media_type: str = Query(None, description="IMAGE or VIDEO"),
    limit: int = Query(100, ge=1, le=1000)
):
    """Search/filter assets in an album by filename or type"""
    try:
        UUID(album_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid album UUID format")

    sql = '''
        SELECT aa."assetId", aa."createdAt", a."type", a."originalFileName"
        FROM album_asset aa
        JOIN asset a ON a."id" = aa."assetId"
        WHERE aa."albumId" = $1
    '''
    params = [album_id]

    if media_type and media_type.upper() in ("IMAGE", "VIDEO"):
        params.append(media_type.upper())
        sql += f' AND a."type" = ${len(params)}'

    if query and query.strip():
        params.append(f"%{query.strip()}%")
        sql += f' AND a."originalFileName" ILIKE ${len(params)}'

    sql += ' ORDER BY aa."createdAt" DESC'
    params.append(limit)
    sql += f' LIMIT ${len(params)}'

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return [{"assetId": row["assetId"], "createdAt": row["createdAt"], "type": row["type"], "originalFileName": row["originalFileName"]} for row in rows]


@app.get("/cache/stats")
async def get_cache_stats():
    """Returns in-memory asset cache statistics"""
    return {
        "cachedEntries": len(asset_cache),
        "maxEntries": MAX_CACHE_ENTRIES,
        "ttlSeconds": CACHE_TTL,
        "keys": list(asset_cache.keys())
    }


@app.post("/cache/clear")
async def clear_cache():
    """Clears in-memory asset cache"""
    count = len(asset_cache)
    asset_cache.clear()
    return {"message": "Cache cleared successfully", "clearedEntries": count}



def resolve_api_key(api_key: str | None, x_api_key: str | None) -> str:
    """Prefer the X-Api-Key header; fall back to the legacy query param.
    Sanitize to ASCII to avoid encoding issues in HTTP headers."""
    return (x_api_key or api_key or "").encode('ascii', 'ignore').decode('ascii').strip()


async def stream_immich_bytes(response):
    """Yield the upstream response body in chunks and always release the connection."""
    try:
        async for chunk in response.aiter_bytes():
            yield chunk
    finally:
        await response.aclose()


async def fetch_stream(url, headers=None, params=None, timeout=None):
    """Issue a streaming GET through the shared pooled client.

    Per-request timeout is applied via build_request (stored in request
    extensions, honored by the transport); send(stream=True) keeps the body
    off-heap so we can stream it to the client."""
    kwargs = {"headers": headers, "params": params}
    if timeout is not None:
        kwargs["timeout"] = timeout
    req = http_client.build_request("GET", url, **kwargs)
    return await http_client.send(req, stream=True)


VIDEO_TIMEOUT = httpx.Timeout(connect=5.0, read=300.0, write=30.0, pool=10.0)


@app.get("/proxy/thumbnail/{asset_id}")
async def proxy_thumbnail(asset_id: str, api_key: str = Query(None), x_api_key: str = Header(None, alias="X-Api-Key")):
    """Proxy endpoint to fetch Immich thumbnails with authentication"""
    key = resolve_api_key(api_key, x_api_key)
    if not key:
        raise HTTPException(status_code=401, detail="Missing API key")

    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/thumbnail"
    headers = {"x-api-key": key}
    params = {"size": "thumbnail"}

    response = await fetch_stream(immich_url, headers=headers, params=params)

    if response.status_code != 200:
        await response.aclose()
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch thumbnail")

    # Stream chunks instead of buffering the whole image in memory
    return StreamingResponse(
        stream_immich_bytes(response),
        media_type=response.headers.get("content-type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=604800, immutable",
            "ETag": f'"{asset_id}-thumb"',
        }
    )

@app.get("/proxy/preview/{asset_id}")
async def proxy_preview(asset_id: str, api_key: str = Query(None), x_api_key: str = Header(None, alias="X-Api-Key")):
    """Proxy endpoint to fetch Immich preview images with authentication"""
    key = resolve_api_key(api_key, x_api_key)
    if not key:
        raise HTTPException(status_code=401, detail="Missing API key")

    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/thumbnail"
    headers = {"x-api-key": key}
    params = {"size": "preview"}

    response = await fetch_stream(immich_url, headers=headers, params=params)

    if response.status_code != 200:
        await response.aclose()
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch preview")

    # Stream chunks instead of buffering the whole image in memory
    return StreamingResponse(
        stream_immich_bytes(response),
        media_type=response.headers.get("content-type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=604800, immutable",
            "ETag": f'"{asset_id}-preview"',
        }
    )

@app.get("/proxy/fullsize/{asset_id}")
async def proxy_fullsize(asset_id: str, api_key: str = Query(None), x_api_key: str = Header(None, alias="X-Api-Key")):
    """Proxy endpoint to fetch Immich full-size images with authentication"""
    key = resolve_api_key(api_key, x_api_key)
    if not key:
        raise HTTPException(status_code=401, detail="Missing API key")

    # Use /original endpoint for full-size images
    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/original"
    headers = {"x-api-key": key}

    response = await fetch_stream(immich_url, headers=headers)

    if response.status_code != 200:
        await response.aclose()
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch fullsize image")

    # Stream chunks instead of buffering the whole image in memory
    return StreamingResponse(
        stream_immich_bytes(response),
        media_type=response.headers.get("content-type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=604800, immutable",
            "ETag": f'"{asset_id}-fullsize"',
        }
    )

@app.get("/proxy/video/{asset_id}")
async def proxy_video(asset_id: str, request: Request, api_key: str = Query(None), x_api_key: str = Header(None, alias="X-Api-Key")):
    """Proxy endpoint to stream Immich videos with Range request support"""
    key = resolve_api_key(api_key, x_api_key)
    if not key:
        raise HTTPException(status_code=401, detail="Missing API key")

    immich_url = f"{IMMICH_URL}/api/assets/{asset_id}/video/playback"
    headers = {"x-api-key": key}

    # Forward Range header if present (needed for video seeking)
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    # Stream through the shared pooled client with a long read timeout for videos
    response = await fetch_stream(immich_url, headers=headers, timeout=VIDEO_TIMEOUT)

    if response.status_code not in (200, 206):
        await response.aclose()
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch video")

    response_headers = {
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
    }

    # Forward content headers from Immich
    for header in ["Content-Range", "Content-Length", "Content-Type"]:
        if header.lower() in response.headers:
            response_headers[header] = response.headers[header.lower()]

    return StreamingResponse(
        stream_immich_bytes(response),
        status_code=response.status_code,
        headers=response_headers,
        media_type=response.headers.get("content-type", "video/mp4"),
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

