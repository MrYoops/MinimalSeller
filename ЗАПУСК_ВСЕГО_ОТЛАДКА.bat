@echo off
chcp 65001
REM Включаем отображение всех команд для отладки
@echo on
setlocal enabledelayedexpansion

echo ================================================
echo   MinimalSeller - Запуск (РЕЖИМ ОТЛАДКИ)
echo ================================================
echo.
echo Текущая директория: %CD%
echo Директория скрипта: %~dp0
echo.

REM Проверка Python
echo [0/3] Проверка Python...
python --version
if errorlevel 1 (
    echo Python не найден через "python"
    python3 --version
    if errorlevel 1 (
        echo Python не найден через "python3"
        py --version
        if errorlevel 1 (
            echo Python не найден через "py"
            echo.
            echo [❌] Python не найден!
            pause
            exit /b 1
        ) else (
            set PYTHON_CMD=py
            echo [✓] Python найден через py
        )
    ) else (
        set PYTHON_CMD=python3
        echo [✓] Python найден через python3
    )
) else (
    set PYTHON_CMD=python
    echo [✓] Python найден через python
)

echo.
echo Используется команда: !PYTHON_CMD!
echo.

REM Проверка Node.js
echo Проверка Node.js...
node --version
if errorlevel 1 (
    echo [❌] Node.js не найден!
    pause
    exit /b 1
)
echo [✓] Node.js найден
echo.

REM Запуск MongoDB
echo [1/3] Запуск MongoDB...
sc query MongoDB | findstr "RUNNING"
if errorlevel 1 (
    echo MongoDB не запущен, пытаюсь запустить...
    net start MongoDB
    if errorlevel 1 (
        echo [⚠] Не удалось запустить MongoDB
    ) else (
        echo [✓] MongoDB запущен
    )
) else (
    echo [✓] MongoDB уже запущен
)
echo.

REM Проверка .env
echo Проверка файла .env...
if not exist "backend\.env" (
    echo [⚠] Файл .env не найден, создаю...
    (
        echo MONGO_URL=mongodb://localhost:27017
        echo DATABASE_NAME=minimalmod
        echo SECRET_KEY=your-secret-key-min-32-chars-long-change-me-please
        echo ACCESS_TOKEN_EXPIRE_MINUTES=1440
    ) > backend\.env
    echo [✓] Файл .env создан
) else (
    echo [✓] Файл .env существует
)
echo.

REM Запуск Backend
echo [2/3] Запуск Backend...
echo Переход в директорию: %~dp0backend
cd /d "%~dp0backend"
echo Текущая директория: %CD%
echo Команда: !PYTHON_CMD! -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
echo.
start "MinimalSeller Backend" cmd /k "cd /d %~dp0backend && echo Запуск Backend... && !PYTHON_CMD! -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload"
echo [✓] Команда запуска Backend выполнена
echo.

REM Запуск Frontend
echo [3/3] Запуск Frontend...
cd /d "%~dp0frontend"
echo Текущая директория: %CD%
echo Команда: npm run dev
echo.
start "MinimalSeller Frontend" cmd /k "cd /d %~dp0frontend && echo Запуск Frontend... && npm run dev"
echo [✓] Команда запуска Frontend выполнена
echo.

echo ================================================
echo   ✅ Команды запуска выполнены
echo ================================================
echo.
echo Проверьте открывшиеся окна с Backend и Frontend
echo.
pause
