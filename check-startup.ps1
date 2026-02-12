# Скрипт проверки перед запуском (Windows PowerShell)
# Запуск: .\check-startup.ps1

Write-Host "Проверка критических настроек..." -ForegroundColor Cyan

$ok = $true

# 1. DATABASE_NAME=test
if (Select-String -Path "docker-compose.yml" -Pattern "DATABASE_NAME=test" -Quiet) {
    Write-Host "[OK] DATABASE_NAME=test" -ForegroundColor Green
} else {
    Write-Host "[ОШИБКА] DATABASE_NAME не test в docker-compose.yml" -ForegroundColor Red
    $ok = $false
}

# 2. Backend port 8001 в vite.config.js
if (Select-String -Path "frontend/vite.config.js" -Pattern '8001' -Quiet) {
    Write-Host "[OK] Backend port 8001 в vite.config.js" -ForegroundColor Green
} else {
    Write-Host "[ОШИБКА] vite.config.js не содержит port 8001" -ForegroundColor Red
    $ok = $false
}

# 3. AuthContext localhost:8001
if (Select-String -Path "frontend/src/context/AuthContext.jsx" -Pattern "localhost:8001" -Quiet) {
    Write-Host "[OK] AuthContext.jsx - localhost:8001" -ForegroundColor Green
} else {
    Write-Host "[ОШИБКА] AuthContext.jsx - localhost:8001 не найден" -ForegroundColor Red
    $ok = $false
}

# 4. backend/.env существует
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match "JWT_SECRET=.{32,}") {
        Write-Host "[OK] backend/.env существует, JWT_SECRET >= 32 символа" -ForegroundColor Green
    } else {
        Write-Host "[ПРЕДУПРЕЖДЕНИЕ] backend/.env есть, но JWT_SECRET короткий или отсутствует" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ОШИБКА] backend/.env не найден! Бэкенд не запустится." -ForegroundColor Red
    $ok = $false
}

# 5. Rate limiting "5/minute" на login - не должно быть (вызывает 429)
$authContent = Get-Content "backend/routers/auth.py" -Raw
if ($authContent -match '5/minute') {
    Write-Host "[ПРЕДУПРЕЖДЕНИЕ] Найден limiter 5/minute в auth.py - может блокировать вход" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Rate limiting 5/minute не найден в auth.py" -ForegroundColor Green
}

if ($ok) {
    Write-Host "`nПроверка завершена. Можно запускать." -ForegroundColor Green
} else {
    Write-Host "`nЕсть ошибки! Исправьте перед запуском." -ForegroundColor Red
    exit 1
}
