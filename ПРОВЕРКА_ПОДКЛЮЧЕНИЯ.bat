@echo off
chcp 65001 >nul
echo ================================================
echo   Проверка подключения Frontend к Backend
echo ================================================
echo.

echo [1/4] Проверка Backend на порту 8001...
curl -s http://localhost:8001/api/health >nul 2>&1
if errorlevel 1 (
    echo [❌] Backend НЕ отвечает на http://localhost:8001
    echo.
    echo Возможные причины:
    echo   1. Backend не запущен
    echo   2. Backend запущен на другом порту
    echo   3. Firewall блокирует подключение
    echo.
    echo Решение:
    echo   Запустите Backend в отдельном терминале:
    echo   cd backend
    echo   python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
    echo.
) else (
    echo [✓] Backend отвечает!
    curl -s http://localhost:8001/api/health
    echo.
)

echo [2/4] Проверка Frontend на порту 3000...
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo [❌] Frontend НЕ отвечает на http://localhost:3000
    echo.
    echo Решение:
    echo   Запустите Frontend в отдельном терминале:
    echo   cd frontend
    echo   npm run dev
    echo.
) else (
    echo [✓] Frontend отвечает!
)

echo [3/4] Проверка MongoDB...
net start MongoDB >nul 2>&1
if errorlevel 1 (
    echo [❌] MongoDB не запущен
    echo.
    echo Решение:
    echo   net start MongoDB
    echo.
) else (
    echo [✓] MongoDB запущен
)

echo [4/4] Проверка процессов...
echo.
echo Процессы Python (Backend):
tasklist | findstr /i python
echo.
echo Процессы Node (Frontend):
tasklist | findstr /i node

echo.
echo ================================================
echo   Диагностика завершена
echo ================================================
echo.
echo Если Backend не запущен:
echo   1. Откройте новый терминал
echo   2. cd backend
echo   3. python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
echo.
echo Если Frontend не запущен:
echo   1. Откройте новый терминал
echo   2. cd frontend
echo   3. npm run dev
echo.
pause
