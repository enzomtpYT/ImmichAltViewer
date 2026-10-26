# Immich Viewer - AI Agent Guide (`agents.md`)

This repository contains **Immich Viewer (Date Uploaded Timeline)**, a lightweight web application that allows users to view their Immich photos and videos sorted strictly by upload date rather than capture date.

---

## 🏗️ Architecture & Technology Stack

The project is split into two primary layers:

1. **Backend (`/back`)**:
   - **Framework**: FastAPI (Python 3.11+) with Uvicorn.
   - **Database**: PostgreSQL (direct connection to Immich's Postgres instance using `asyncpg`).
   - **Endpoints**:
     - `GET /library/assets`: Direct database query for all non-deleted assets across the entire library ordered by `createdAt DESC` (upload date).
     - `GET /albums/{album_id}/assets`: Single album query ordered by `createdAt DESC`.
     - `GET /albums/assets?ids=...`: Combined multi-album query.
     - `GET /proxy/*`: Streaming proxy endpoints with chunked transfer and HTTP range seek support for videos.
   - **Proxy Engine**: `httpx.AsyncClient` streaming media from Immich's REST endpoints (`/api/assets/{id}/thumbnail`, `/original`, `/video/playback`).
   - **Caching**: In-memory LRU cache (`asset_cache`) with a 60-second TTL and 500-entry capacity.
   - **Static Serving**: Production build of the frontend (`/front-react/dist`) is mounted at `/` when available.

2. **Frontend (`/front-react`)**:
   - **Framework**: React 19 + Vite 7.
   - **Styling**: Tailwind CSS + PostCSS (dark mode, glassmorphism theme).
   - **Virtualization**: `@tanstack/react-virtual` for virtualized infinite grid rendering and timeline scrubber.
   - **Slideshow & Shuffle**: Fullscreen slideshow with Fisher-Yates non-repeating shuffle deck, backward/forward navigation memory, configurable interval/directions, and video autoplay controls.
   - **Animations & Icons**: `framer-motion`, `lucide-react`.
   - **Persistence**: Browser `localStorage` holds the user's Immich API key, browse mode (`library` vs `albums`), album UUIDs, bookmarks, and slideshow preferences.

---

## 📁 Repository Structure

```
.
├── back/
│   ├── main.py                # Core FastAPI application, database queries, proxy logic, cache
│   ├── requirements.txt       # Python dependencies (fastapi, uvicorn, asyncpg, httpx, pydantic, python-dotenv)
│   └── venv/                  # Local Python virtual environment
├── front-react/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AlbumViewer.jsx        # Main controller, header, bookmarks, search/filter, dialogs
│   │   │   ├── DateSlider.jsx         # Virtualized timeline scrubber on the right rail
│   │   │   ├── FullscreenViewer.jsx   # Modal media viewer, slideshow engine, touch swipe, gestures
│   │   │   ├── ImageCard.jsx          # Individual grid thumbnail with skeleton loading & retry
│   │   │   └── ImageGallery.jsx       # Virtualized multi-column masonry grid with date section headers
│   │   ├── utils/
│   │   │   └── dates.js               # Date formatting utility (formatDateKey)
│   │   ├── App.jsx                    # Root app component wrapper
│   │   ├── main.jsx                   # React DOM entry point
│   │   └── index.css                  # Tailwind styles and custom scrollbar rules
│   ├── package.json                   # React dependencies and scripts
│   └── vite.config.js                 # Vite build config with relative base './'
├── docker-compose.yml         # Single-container docker service definition
├── Dockerfile                 # Multi-stage build (Node 18 frontend build -> Python 3.11 backend)
├── deploy.bat                 # Windows script to build frontend and run backend in production
├── start_dev.bat              # Windows script to launch backend and frontend dev servers
├── install_immich_viewer.sh   # Proxmox LXC install script
├── update_immich_viewer.sh    # Proxmox LXC update script
└── README.md                  # Project overview and deployment guide
```

---

## 🛠️ Development & Operational Commands

### Backend (`/back`)
- **Activate Virtual Environment** (Windows):
  ```powershell
  .\back\venv\Scripts\Activate.ps1
  ```
- **Install Dependencies**:
  ```bash
  pip install -r requirements.txt
  ```
- **Run Dev Server**:
  ```bash
  fastapi dev main.py
  # or: uvicorn main:app --reload --port 8000
  ```

### Frontend (`/front-react`)
- **Install Dependencies**:
  ```bash
  npm install
  ```
- **Run Dev Server**:
  ```bash
  npm run dev
  # Default port: http://localhost:5173
  ```
- **Lint Code**:
  ```bash
  npm run lint
  ```
- **Production Build**:
  ```bash
  npm run build
  # Outputs to /front-react/dist
  ```

---

## 🛡️ Key Code Conventions & Safety Rules

1. **Security & Secrets**:
   - Never commit raw passwords, tokens, or IP addresses into scripts (`install_immich_viewer.sh`), documentation, or code.
   - Use `.env` variables (`DATABASE_URL`, `IMMICH_URL`, `CORS_ORIGINS`).
   - Validate UUIDs on all incoming album parameters before passing them to SQL queries.

2. **Database Querying**:
   - Always use parameterized queries (`$1`, `$2`, etc.) with `asyncpg` to prevent SQL injection.
   - Maintain index compatibility when adding queries to `album_asset` and `asset`.

3. **Proxy & Streaming**:
   - Stream media chunks (`fetch_stream` with `StreamingResponse` and `stream_immich_bytes`) to keep memory footprint flat.
   - Forward `Range` headers for video streaming to support playback seeking.

4. **React & UI Performance**:
   - Ensure virtualized components (`@tanstack/react-virtual`) properly measure dynamic DOM elements.
   - Use `useDeferredValue` or debouncing for search inputs across large datasets to prevent layout thrashing.
   - Preserve keyboard navigation accessibility (`onKeyDown` instead of deprecated `onKeyPress`).
