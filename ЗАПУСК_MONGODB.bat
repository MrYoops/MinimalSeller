@echo off
chcp 65001 >nul
echo ================================================
echo   Запуск MongoDB
echo ================================================
echo.

REM Проверка прав администратора
net session >nul 2>&1
if errorlevel 1 (
    echo [⚠] ВНИМАНИЕ: Нужны права администратора!
    echo.
    echo Запустите этот файл от имени администратора:
    echo   1. Правый клик на файл
    echo   2. "Запуск от имени администратора"
    echo.
    pause
    exit /b 1
)

echo [1/3] Проверка установки MongoDB...
REM Используем sc query для проверки службы (работает в cmd)
sc query MongoDB >nul 2>&1
if errorlevel 1 (
    REM Попробуем через PowerShell
    powershell -Command "Get-Service MongoDB -ErrorAction SilentlyContinue" >nul 2>&1
    if errorlevel 1 (
        echo [❌] MongoDB не найден как служба Windows
        echo.
        echo Возможно MongoDB установлен, но служба имеет другое имя
        echo Попробуйте запустить MongoDB вручную или проверьте имя службы
        echo.
        echo Проверка всех служб MongoDB:
        powershell -Command "Get-Service | Where-Object {$_.Name -like '*mongo*' -or $_.DisplayName -like '*mongo*'}"
        echo.
        pause
        exit /b 1
    )
)

echo [✓] MongoDB найден
echo.

echo [2/3] Проверка статуса MongoDB...
REM Проверяем статус через sc query
sc query MongoDB | findstr "RUNNING" >nul 2>&1
if not errorlevel 1 (
    echo [✓] MongoDB уже запущен!
    goto :check_connection
)

echo [3/3] Запуск MongoDB...
net start MongoDB

if errorlevel 1 (
    echo.
    echo [❌] Не удалось запустить MongoDB
    echo.
    echo Возможные причины:
    echo   1. MongoDB не установлен как служба
    echo   2. Служба повреждена
    echo   3. Порт 27017 занят другим процессом
    echo.
    echo Решение:
    echo   1. Переустановите MongoDB с опцией "Install as a Service"
    echo   2. Или запустите MongoDB вручную:
    echo      "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db"
    echo.
    pause
    exit /b 1
)

:check_connection
echo.
echo [✓] MongoDB успешно запущен!
echo.
echo Проверка подключения...
timeout /t 3 /nobreak >nul

REM Проверка порта
netstat -ano | findstr :27017 >nul 2>&1
if errorlevel 1 (
    echo [⚠] Порт 27017 не слушается. Подождите несколько секунд...
    timeout /t 3 /nobreak >nul
)

echo.
echo ================================================
echo   ✅ MongoDB готов к работе!
echo ================================================
echo.
echo   URI для подключения: mongodb://localhost:27017/
echo.
echo   Теперь можно:
echo   1. Подключиться в MongoDB Compass
echo   2. Запустить Backend
echo.
pause
