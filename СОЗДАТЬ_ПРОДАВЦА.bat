@echo off
chcp 65001 >nul
echo ================================================
echo   Создание учетной записи продавца
echo ================================================
echo.

REM Проверка Python
py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    goto :python_ok
)

python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
    goto :python_ok
)

python3 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python3
    goto :python_ok
)

echo [❌] Python не найден!
pause
exit /b 1

:python_ok
echo [✓] Python найден
echo.

REM Проверка MongoDB
sc query MongoDB | findstr "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo [⚠] MongoDB не запущен. Пытаюсь запустить...
    net start MongoDB >nul 2>&1
    if errorlevel 1 (
        echo [❌] Не удалось запустить MongoDB!
        echo Запустите MongoDB вручную: net start MongoDB
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
)
echo [✓] MongoDB запущен
echo.

REM Запуск скрипта
echo Запуск скрипта создания продавца...
echo.
cd /d "%~dp0backend"
%PYTHON_CMD% scripts\create_seller.py

echo.
pause
