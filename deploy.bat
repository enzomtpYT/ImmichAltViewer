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
echo Access the app at: http://127.0.0.1:8000
cd back
:: Install backend deps if needed (optional check)
:: pip install -r requirements.txt

:: Run with production settings (0.0.0.0 to allow network access)
uvicorn main:app --host 0.0.0.0 --port 8000
pause
