@echo off
echo ================================================
echo   MinimalMod Frontend Starter (Windows)
echo ================================================
echo.

cd /d "%~dp0frontend"

echo [1/3] Installing dependencies...
call yarn install

echo [2/3] Starting frontend server...
echo.
echo ================================================
echo   Frontend starting on http://localhost:3000
echo   Press Ctrl+C to stop
echo ================================================
echo.

call yarn dev

pause
