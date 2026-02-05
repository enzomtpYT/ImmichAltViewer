# Immich Viewer - Date Uploaded Timeline

A modern, high-performance external viewer for [Immich](https://immich.app/) that focuses on browsing your library by **Date Uploaded** rather than Date Taken.

Repository: [ImmichAltViewer](https://github.com/enzomtpYT/ImmichAltViewer)

> [!CAUTION]
> **⚠️ VIBECODED WARNING**
> This project was "vibecoded" (generated largely by AI). While it looks great and works well, it may contain weird bugs, unoptimized patterns, or security risks. **Use at your own risk.** Do not expose this publicly to the internet without proper authentication/security layers (like a VPN or Authelia).

## ✨ Features

*   **📅 Sort by Date Uploaded**: The missing feature from the official web UI. See your most recently uploaded photos first, regardless of when they were taken.
*   **🚀 High Performance**: 
    *   Virtual scrolling (handles 10,000+ items smoothly).
    *   Aggressive caching & preloading.
    *   Instant navigation in fullscreen.
*   **🎨 Premium UI**: Dark mode with "Glassmorphism" aesthetics, smooth animations, and a responsive grid.
*   **⏱️ Timeline Scrubber**: Quickly jump to specific dates using the interactive timeline on the right.
*   **📱 Responsive**: Works great on desktop and mobile.

## 🛠️ Deployment

### 🐳 Docker (Recommended)

1.  Clone the repo.
2.  Edit `.env` (or `docker-compose.yml`) with your Immich details:
    ```env
    IMMICH_URL=http://your-immich-ip:2283
    DATABASE_URL=postgresql://immich:pass@your-immich-ip:5432/immich
    ```
3.  Run:
    ```bash
    docker-compose up -d
    ```
    Access at `http://localhost:8090`

### 🖥️ Proxmox LXC "Addon"

Easily install on a standard Debian/Ubuntu LXC container:

1.  Copy the `install_immich_viewer.sh` script to your container.
2.  Run it:
    ```bash
    chmod +x install_immich_viewer.sh
    ./install_immich_viewer.sh
    ```
3.  Follow the prompts.

### 💻 Local Development

1.  **Backend**:
    ```bash
    cd back
    python -m venv venv
    ./venv/Scripts/activate
    pip install -r requirements.txt
    fastapi dev main.py
    ```
2.  **Frontend**:
    ```bash
    cd front-react
    npm install
    npm run dev
    ```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```ini
# URL to your Immich Server
IMMICH_URL=http://192.168.1.110:2283

# Connection string to Immich's Postgres Database
# (Needed to fetch Date Uploaded, which isn't in the API yet)
DATABASE_URL=postgresql://immich:yourpassword@192.168.1.110:5432/immich
```
