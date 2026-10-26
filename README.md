# Immich Viewer - Date Uploaded Timeline

A modern, high-performance external viewer for [Immich](https://immich.app/) that focuses on browsing your library by **Date Uploaded** rather than Date Taken.

Repository: [ImmichAltViewer](https://github.com/enzomtpYT/ImmichAltViewer)

> [!CAUTION]
> **⚠️ VIBECODED WARNING**
> This project was originally vibecoded. While fast, sleek, and feature-rich, it connects directly to your Immich PostgreSQL database and streams media via proxy. **Use at your own risk.** Do not expose this publicly to the internet without proper authentication/security layers (such as a VPN, Authelia, or Cloudflare Access).

---

## ✨ Features

*   **📅 Sort by Date Uploaded**: The missing view from the official Immich web UI. See recently added photos first, regardless of when they were taken.
*   **📚 Full Library Browsing**: Browse your entire Immich library sorted strictly by upload date without needing to select or know any album UUIDs.
*   **🔖 Multi-Album Bookmarks**: Save multiple album UUIDs with custom names. Toggle individual albums or select all to view a unified multi-album timeline with color-coded badges.
*   **🎲 Non-Repeating Random Shuffle**:
    *   Fisher-Yates shuffle engine ensuring every photo plays once before reshuffling.
    *   Full backward/forward history memory so you can return to previously viewed random photos.
    *   One-click shuffle toggle button + `S` keyboard shortcut.
*   **🔍 Search & Filters**: Instant filename and asset ID filtering with quick toggles for All, Photos, or Videos.
*   **🚀 High Performance**: 
    *   Virtual scrolling via `@tanstack/react-virtual` handling thousands of assets smoothly.
    *   In-memory LRU cache with TTL for album and full library queries.
    *   Chunked proxy streaming for thumbnails, previews, original full-size photos, and videos with HTTP byte-range seek support.
*   **🎨 Premium UI**: Dark mode glassmorphism aesthetics, responsive multi-column masonry grid, and smooth animations.
*   **⏱️ Timeline Scrubber**: Interactive virtualized date timeline rail (desktop side panel and mobile slide-up sheet) to jump directly to any date.
*   **🎬 Fullscreen Slideshow**:
    *   Configurable intervals (3s, 5s, 10s, 15s, 30s, or custom duration).
    *   Forward, backward, and random shuffle playback modes.
    *   Video advance options (advance immediately after video ends or follow the timer).
    *   Ambient video audio controls (muted by default with `M` toggle shortcut).
*   **⌨️ Keyboard Shortcuts & Touch Gestures**:
    *   `?` toggle shortcut help dialog.
    *   `Space` start / pause slideshow.
    *   `S` toggle random shuffle mode.
    *   `M` toggle video audio mute/unmute.
    *   `←` / `→` navigate assets.
    *   `↓` download current asset.
    *   `i` toggle EXIF and file details panel.
    *   Mobile touch gestures: swipe left/right to navigate, swipe down to download, swipe up to close.

---

## 🛠️ Deployment

### 🐳 Docker (Recommended)

1. Clone the repo.
2. Edit `.env` with your Immich instance details:
    ```env
    IMMICH_URL=http://your-immich-ip:2283
    DATABASE_URL=postgresql://immich:yourpassword@your-immich-ip:5432/immich
    # Optional: restrict CORS origins (comma-separated, default is *)
    # CORS_ORIGINS=http://localhost:5173,https://photos.example.com
    ```
3. Run:
    ```bash
    docker-compose up -d
    ```
    Access the viewer at `http://localhost:8090`.

### 🖥️ Proxmox LXC "Addon"

Install directly on a standard Debian/Ubuntu LXC container:

1. Copy `install_immich_viewer.sh` to your container.
2. Run:
    ```bash
    chmod +x install_immich_viewer.sh
    ./install_immich_viewer.sh
    ```
3. Edit the generated `/opt/immich-viewer/.env` with your Immich database credentials and restart the service (`systemctl restart immich-viewer`).

### 💻 Local Development

1. **Backend**:
    ```bash
    cd back
    python -m venv venv
    ./venv/Scripts/activate  # On Linux/macOS: source venv/bin/activate
    pip install -r requirements.txt
    fastapi dev main.py
    ```
2. **Frontend**:
    ```bash
    cd front-react
    npm install
    npm run dev
    ```

---

## ⚙️ Configuration Reference

Create a `.env` file in the root directory:

```ini
# URL to your Immich Server
IMMICH_URL=http://your-immich-ip:2283

# Direct connection string to Immich's Postgres Database
# (Required to fetch upload timestamps, bypassing API limitations)
DATABASE_URL=postgresql://immich:yourpassword@your-immich-ip:5432/immich

# Optional: Allowed CORS origins (comma-separated). Default is '*'
# CORS_ORIGINS=http://localhost:5173,https://photos.example.com
```

---

## 🌐 Reverse Proxy Subpath Setup (e.g., `photos.example.com/cim`)

The frontend assets use relative pathing (`base: './'`), allowing seamless hosting behind a subpath reverse proxy.

### Nginx Example
```nginx
location /cim/ {
    proxy_pass http://127.0.0.1:8090/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Caddy Example
```caddy
photos.example.com {
    handle_path /cim/* {
        reverse_proxy 127.0.0.1:8090
    }
}
```

---

## 🤖 AI Agent Guidelines

For AI coding assistants (Claude, Gemini, GitHub Copilot, Cursor), refer to [agents.md](file:///agents.md) (also hardlinked to `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`).
