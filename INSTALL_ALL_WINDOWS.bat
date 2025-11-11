@echo off
echo ================================================
echo   MinimalMod FULL INSTALLATION (Windows)
echo ================================================
echo.

echo This will:
echo 1. Create virtual environment
echo 2. Install all Python dependencies
echo 3. Install all Node.js dependencies
echo 4. Create test users
echo.
pause

echo.
echo [BACKEND] Creating virtual environment...
cd /d "%~dp0backend"
python -m venv venv

echo [BACKEND] Activating venv...
call venv\Scripts\activate.bat

echo [BACKEND] Upgrading pip...
python -m pip install --upgrade pip

echo [BACKEND] Installing dependencies one by one (to avoid errors)...
python -m pip install fastapi==0.104.1
python -m pip install uvicorn==0.24.0
python -m pip install pydantic==2.5.0
python -m pip install motor==3.3.2
python -m pip install httpx==0.25.2
python -m pip install passlib[bcrypt]==1.7.4
python -m pip install python-jose[cryptography]==3.3.0
python -m pip install python-dotenv==1.0.0

echo [BACKEND] Creating test users...
python create_test_users.py

echo.
echo [FRONTEND] Installing dependencies...
cd /d "%~dp0frontend"
call yarn install

echo.
echo ================================================
echo   INSTALLATION COMPLETE!
echo ================================================
echo.
echo To start the application:
echo 1. Run START_WINDOWS.bat (for backend)
echo 2. Run START_FRONTEND_WINDOWS.bat (for frontend)
echo 3. Open http://localhost:3000 in browser
echo.
pause
