@echo off
chcp 65001 >nul
REM Включаем расширенную обработку переменных
setlocal enabledelayedexpansion

echo ================================================
echo   MinimalSeller - Запуск всех сервисов
echo ================================================
echo.

REM Проверка Python
echo [0/3] Проверка Python...
set PYTHON_CMD=

REM Проверяем py первым (часто работает лучше на Windows)
py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    py --version
    echo [✓] Python найден через py launcher
    goto :python_found
)

python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
    python --version
    echo [✓] Python найден
    goto :python_found
)

python3 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python3
    python3 --version
    echo [✓] Python найден (python3)
    goto :python_found
)

echo [❌] Python не найден!
echo.
echo Решение:
echo   1. Установите Python 3.11+ с https://www.python.org/downloads/
echo   2. ВАЖНО: При установке отметьте "Add Python to PATH"
echo   3. После установки перезапустите этот скрипт
echo.
echo Или добавьте Python в PATH вручную:
echo   Путь обычно: C:\Python311\ или C:\Users\ВашеИмя\AppData\Local\Programs\Python\
echo.
echo Нажмите любую клавишу для выхода...
pause >nul
exit /b 1

:python_found
REM Используем delayed expansion для проверки переменной
if "!PYTHON_CMD!"=="" (
    echo [❌] Ошибка: не удалось определить команду Python
    echo Попробуйте запустить ПРОВЕРКА_PYTHON.bat для диагностики
    pause
    exit /b 1
)
echo Используется команда: !PYTHON_CMD!
echo.

REM Запуск MongoDB
echo [1/3] Запуск MongoDB...
REM Проверяем статус перед запуском
sc query MongoDB | findstr "RUNNING" >nul 2>&1
if not errorlevel 1 (
    echo [✓] MongoDB уже запущен
) else (
    net start MongoDB >nul 2>&1
    if errorlevel 1 (
        echo [⚠] Не удалось запустить MongoDB (возможно уже запущен или нужны права администратора)
    ) else (
        echo [✓] MongoDB запущен
    )
)
timeout /t 2 /nobreak >nul

REM Проверка .env файла
if not exist "backend\.env" (
    echo [⚠] Файл backend\.env не найден! Создаю...
    (
        echo MONGO_URL=mongodb://localhost:27017
        echo DATABASE_NAME=minimalmod
        echo SECRET_KEY=your-secret-key-min-32-chars-long-change-me-please
        echo ACCESS_TOKEN_EXPIRE_MINUTES=1440
    ) > backend\.env
    echo [✓] Файл .env создан
)

REM Запуск Backend
echo [2/3] Запуск Backend на http://localhost:8001
echo.
REM Используем delayed expansion для переменной
if "!PYTHON_CMD!"=="" (
    echo [❌] Ошибка: команда Python не определена
    pause
    exit /b 1
)
echo Запуск Backend с командой: !PYTHON_CMD!
REM Сохраняем команду Python в переменную окружения для использования в новом окне
set PYTHON_CMD_FINAL=!PYTHON_CMD!
start "MinimalSeller Backend" cmd /k "cd /d %~dp0backend && echo Запуск Backend... && echo Используется: %PYTHON_CMD_FINAL% && %PYTHON_CMD_FINAL% -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload"

REM Задержка для запуска Backend
echo Ожидание запуска Backend...
timeout /t 5 /nobreak >nul

REM Проверка что Backend запустился
curl -s http://localhost:8001/api/health >nul 2>&1
if errorlevel 1 (
    echo [⚠] Backend еще не отвечает, подождите несколько секунд...
) else (
    echo [✓] Backend отвечает!
)

REM Запуск Frontend
echo [3/3] Запуск Frontend на http://localhost:3000
echo.
start "MinimalSeller Frontend" cmd /k "cd /d %~dp0frontend && echo Запуск Frontend... && npm run dev"

echo.
echo ================================================
echo   ✅ Сервисы запускаются!
echo ================================================
echo.
echo   Подождите 10-15 секунд для полного запуска
echo.
echo   Затем откройте в браузере:
echo   → http://localhost:3000
echo.
echo   Учетные данные:
echo   → admin@minimalmod.com / admin123
echo.
echo   Окна с сервисами открыты отдельно
echo   Закройте их для остановки
echo.
echo ================================================
echo   Нажмите любую клавишу для закрытия этого окна
echo   (Сервисы продолжат работать в других окнах)
echo ================================================
pause >nul
