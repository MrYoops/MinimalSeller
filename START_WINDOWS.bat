@echo off
echo ================================================
echo   MinimalMod Backend Starter (Windows)
echo ================================================
echo.

cd /d "%~dp0backend"

echo [1/5] Checking virtual environment...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo [2/5] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/5] Installing dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo [4/5] Creating test users...
python create_test_users.py

echo [5/5] Starting backend server...
echo.
echo ================================================
echo   Backend starting on http://localhost:8001
echo   Press Ctrl+C to stop
echo ================================================
echo.

python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload

pause
