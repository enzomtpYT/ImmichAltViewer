@echo off
echo Starting Development Environment...

:: Start Backend in a new window
start "Immich Backend" cmd /k "cd back && fastapi dev main.py"

:: Start Frontend in a new window
start "Immich Frontend" cmd /k "cd front-react && npm run dev"

echo servers started!
echo Frontend: http://localhost:5173
echo Backend: http://127.0.0.1:8000
