#!/bin/bash

# Update Script for Immich Viewer
set -e

INSTALL_DIR="/opt/immich-viewer"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Updating Immich Viewer...${NC}"

if [ ! -d "$INSTALL_DIR" ]; then
    echo "Error: installation directory $INSTALL_DIR not found."
    exit 1
fi

cd "$INSTALL_DIR"

# 1. Pull latest code
echo "Pulling latest changes..."
git pull

# 2. Rebuild Frontend
echo "Rebuilding frontend..."
cd front-react
npm install
npm run build
cd ..

# 3. Update Backend Deps
echo "Updating backend dependencies..."
cd back
./venv/bin/pip install -r requirements.txt
cd ..

# 4. Restart Service
echo "Restarting service..."
systemctl restart immich-viewer

echo -e "${GREEN}Update Complete!${NC}"
