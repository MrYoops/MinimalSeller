@echo off
chcp 65001 >nul
echo ================================================
echo   Установка зависимостей Backend
echo ================================================
echo.

cd /d "%~dp0backend"

REM Проверка Python
py --version >nul 2>&1
if errorlevel 1 (
    python --version >nul 2>&1
    if errorlevel 1 (
        echo [❌] Python не найден!
        pause
        exit /b 1
    ) else (
        set PYTHON_CMD=python
    )
) else (
    set PYTHON_CMD=py
)

echo Используется: %PYTHON_CMD%
echo.

echo [1/2] Проверка зависимостей...
%PYTHON_CMD% check_dependencies.py

echo.
echo [2/2] Установка всех зависимостей из requirements.txt...
%PYTHON_CMD% -m pip install -r requirements.txt

echo.
echo ================================================
echo   ✅ Готово!
echo ================================================
pause
