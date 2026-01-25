@echo off
chcp 65001 >nul
echo ================================================
echo   Проверка установки Python
echo ================================================
echo.

echo Проверка различных способов запуска Python...
echo.

REM Проверка python
echo [1/4] Проверка: python
python --version >nul 2>&1
if not errorlevel 1 (
    python --version
    echo [✓] Python найден через команду "python"
    echo.
    goto :found
)

REM Проверка python3
echo [2/4] Проверка: python3
python3 --version >nul 2>&1
if not errorlevel 1 (
    python3 --version
    echo [✓] Python найден через команду "python3"
    echo.
    goto :found
)

REM Проверка py launcher
echo [3/4] Проверка: py (Python Launcher)
py --version >nul 2>&1
if not errorlevel 1 (
    py --version
    echo [✓] Python найден через команду "py"
    echo.
    goto :found
)

REM Поиск в стандартных местах
echo [4/4] Поиск Python в стандартных местах...
if exist "C:\Python311\python.exe" (
    echo [✓] Найден: C:\Python311\python.exe
    C:\Python311\python.exe --version
    echo.
    echo Используйте полный путь или добавьте в PATH
    goto :found
)

if exist "C:\Python312\python.exe" (
    echo [✓] Найден: C:\Python312\python.exe
    C:\Python312\python.exe --version
    echo.
    echo Используйте полный путь или добавьте в PATH
    goto :found
)

REM Не найден
echo [❌] Python не найден!
echo.
echo ================================================
echo   Решение:
echo ================================================
echo.
echo 1. Установите Python 3.11+:
echo    https://www.python.org/downloads/
echo.
echo 2. ВАЖНО при установке:
echo    ✅ Отметьте "Add Python to PATH"
echo.
echo 3. После установки:
echo    - Закройте все окна терминала
echo    - Откройте новый терминал
echo    - Запустите этот скрипт снова
echo.
echo 4. Если Python уже установлен, но не в PATH:
echo    - Найдите путь к Python (обычно C:\Python311\)
echo    - Добавьте его в PATH вручную
echo    - Или используйте полный путь: C:\Python311\python.exe
echo.
pause
exit /b 1

:found
echo ================================================
echo   ✅ Python установлен и доступен!
echo ================================================
echo.
echo Теперь можно запускать Backend
echo.
pause
