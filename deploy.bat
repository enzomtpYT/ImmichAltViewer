@echo off
echo Building and Deploying Immich Viewer...

:: Build Frontend
echo Building Frontend...
cd front-react
call npm install
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    pause
    exit /b %errorlevel%
)
cd ..

:: Start Backend (which serves the built frontend)
echo Starting Production Server...
echo Access the app at: http://127.0.0.1:8090
cd back
.\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8090
pause
