#!/bin/bash

# Immich Viewer - Proxmox LXC Installer/"Addon"
# This script sets up the Immich Viewer (Frontend + Backend) on a Debian/Ubuntu LXC.

set -e

# Configuration
INSTALL_DIR="/opt/immich-viewer"
REPO_URL="https://github.com/enzomtp/ImmichAltViewer.git" # Replace if this is a real public repo, otherwise we assume local copy or user provides it. 
# Since we are generating this for the user to use LOCALLY likely, I will assume they might want to download the current state or clone. 
# For now, I will assume they might copy this script into the project root or curl it.
# If this is to be a standalone downloader, we need a valid git URL.
# I will make it assume the current directory IS the project if .git exists, otherwise clone.

APP_USER="root" # LXC containers often run as root, but we can create a user if preferred. Keeping root for "addon" simplicity unless requested otherwise.

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Immich Viewer Installer ===${NC}"

# 0. Check Root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root.${NC}"
   exit 1
fi

# 1. Smart Dependency Installation
echo -e "${YELLOW}Checking dependencies...${NC}"

PACKAGES_NEEDED="git curl python3 python3-venv python3-pip make g++"
PACKAGES_TO_INSTALL=""

for pkg in $PACKAGES_NEEDED; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL $pkg"
    fi
done

if [ ! -z "$PACKAGES_TO_INSTALL" ]; then
    echo -e "Installing missing system packages: $PACKAGES_TO_INSTALL"
    apt-get update
    apt-get install -y --no-install-recommends $PACKAGES_TO_INSTALL
else
    echo -e "${GREEN}System dependencies already met.${NC}"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js is already installed ($(node -v))${NC}"
fi

# 2. Setup Directory & Code
echo -e "${YELLOW}Setting up application files...${NC}"
mkdir -p "$INSTALL_DIR"

if [ -d ".git" ]; then
    echo "Installing from current directory..."
    cp -r . "$INSTALL_DIR/"
else
    if [ ! -d "$INSTALL_DIR/.git" ]; then
        echo "Cloning repository..."
        git clone "$REPO_URL" "$INSTALL_DIR"
    else
        echo "Updating existing repository..."
        cd "$INSTALL_DIR"
        git pull
    fi
fi

cd "$INSTALL_DIR"

# 3. Setup Backend (Python venv)
echo -e "${YELLOW}Setting up Backend (Python venv)...${NC}"
cd back

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Created virtual environment."
fi

# Upgrade pip and install deps
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 4. Setup Frontend (Build)
echo -e "${YELLOW}Setting up Frontend (React Build)...${NC}"
cd ../front-react

if [ ! -d "node_modules" ]; then
    npm ci || npm install
else
    echo "Node modules exist, skipping install (run 'npm install' manually if needed)."
fi

echo "Building frontend..."
# Ensure API_URL is empty for production build if not already handled by code changes
# The current code uses API_URL='' for production relative path, which is good.
npm run build

cd ..

# 5. Configuration (.env)
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating default .env file...${NC}"
    cat > .env <<EOL
IMMICH_URL=http://192.168.1.110:2283
DATABASE_URL=postgresql://immich:nP6yB6VT9A86uAtEcC@192.168.1.110:5432/immich
EOL
    echo -e "${RED}IMPORTANT: Please edit directory /.env with your actual Immich details!${NC}"
fi

# 6. Systemd Service setup
echo -e "${YELLOW}Configuring Systemd Service...${NC}"

SERVICE_FILE="/etc/systemd/system/immich-viewer.service"

cat > "$SERVICE_FILE" <<EOL
[Unit]
Description=Immich Viewer Web App
After=network.target

[Service]
User=root
WorkingDirectory=$INSTALL_DIR/back
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/back/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOL

systemctl daemon-reload
systemctl enable immich-viewer
systemctl restart immich-viewer

echo -e "${GREEN}=== Installation Complete! ===${NC}"
echo -e "App running at: http://$(hostname -I | awk '{print $1}'):8000"
echo -e "Edit config: nano $INSTALL_DIR/.env"
echo -e "View logs: journalctl -u immich-viewer -f"
