# 🔒 ЖЕСТКАЯ КОНФИГУРАЦИЯ MinimalSeller

## ⚠️ ЭТО КРИТИЧЕСКИ ВАЖНО! НИКОГДА НЕ МЕНЯТЬ!

### 📋 ЕДИНАЯ КОНФИГУРАЦИЯ:

#### **🔥 ПОРТЫ (ЗАФИКСИРОВАНЫ НАВСЕГДА):**
```
Backend: http://localhost:8001
Frontend: http://localhost:3002
MongoDB: localhost:27017
```

#### **🔥 БАЗА ДАННЫХ (ЗАФИКСИРОВАНА НАВСЕГДА):**
```
Database name: "test"
MongoDB URL: "mongodb://mongodb:27017"
```

#### **🔥 ПОЛЬЗОВАТЕЛЬ (ЗАФИКСИРОВАН НАВСЕГДА):**
```
Email: "seller@test.com"
Password: "admin123"
Role: "SELLER"
```

---

## 📁 ФАЙЛЫ КОНФИГУРАЦИИ (НЕ ТРОГАТЬ!):

### 1. docker-compose.yml
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: minimalmod-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db  # 🔒 ПОСТОЯННОЕ ХРАНИЛИЩЕ!
    networks:
      - minimalmod-network
    environment:
      - MONGO_INITDB_DATABASE=test

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: minimalmod-backend
    ports:
      - "8001:8001"  # 🔒 ЗАФИКСИРОВАННЫЙ ПОРТ!
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DATABASE_NAME=test  # 🔒 ЗАФИКСИРОВАНА БАЗА!
      - SECRET_KEY=your-secret-key-min-32-chars-long-change-me-please
      - ACCESS_TOKEN_EXPIRE_MINUTES=1440
      - MOCK_MODE=false
    depends_on:
      - mongodb
    networks:
      - minimalmod-network
    volumes:
      - ./backend:/app

  frontend:
    image: node:18
    container_name: minimalmod-frontend
    working_dir: /app
    ports:
      - "3000:3000"
    environment:
      - VITE_BACKEND_URL=http://localhost:8001  # 🔒 ЗАФИКСИРОВАННЫЙ БЭКЕНД!
    command: sh -c "yarn install && yarn dev --host"
    networks:
      - minimalmod-network
    volumes:
      - ./frontend:/app

networks:
  minimalmod-network:
    driver: bridge

volumes:
  mongodb_data:  # 🔒 ПОСТОЯННОЕ ХРАНИЛИЩЕ ДАННЫХ!
    driver: local
```

### 2. backend/core/config.py
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import sys

class Settings(BaseSettings):
    # 🔒 MongoDB - НЕ МЕНЯТЬ!
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "test"  # 🔒 ЗАФИКСИРОВАНО!
    
    # 🔒 JWT - НЕ МЕНЯТЬ!
    JWT_SECRET: str = "your-secret-key-min-32-chars-long-change-me-please"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Ozon
    OZON_CLIENT_ID: str = ""
    OZON_API_KEY: str = ""
    
    # CORS - 🔒 ЗАФИКСИРОВАНЫЕ ORIGINS!
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3002"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    def get_mongo_url(self) -> str:
        return self.MONGODB_URL
    
    def get_secret_key(self) -> str:
        return self.JWT_SECRET
    
    def get_token_expire_minutes(self) -> int:
        return self.JWT_EXPIRATION_HOURS * 60

settings = Settings()

def validate_settings() -> bool:
    """🔒 Валидация критических настроек"""
    if settings.DATABASE_NAME != "test":
        print("❌ ERROR: DATABASE_NAME must be 'test'!")
        return False
    if "8001" not in settings.CORS_ORIGINS:
        print("❌ ERROR: Port 8001 not in CORS origins!")
        return False
    return True
```

### 3. frontend/vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3002,  // 🔒 ЗАФИКСИРОВАННЫЙ ПОРТ!
    allowedHosts: [
      "admin-center-9.preview.emergentagent.com",
      ".emergentagent.com",
      "localhost",
      "127.0.0.1",
    ],
    // 🔒 ЗАФИКСИРОВАННЫЙ ПРОКСИ!
    proxy: {
      "/api": {
        target: "http://localhost:8001",  # 🔒 ЗАФИКСИРОВАННЫЙ БЭКЕНД!
        changeOrigin: true,
      },
    },
  },
})
```

### 4. frontend/src/context/AuthContext.jsx
```javascript
import axios from 'axios'
import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 🔒 ЗАФИКСИРОВАННАЯ ФУНКЦИЯ ОПРЕДЕЛЕНИЯ URL!
function getBackendURL() {
  const hostname = window.location.hostname
  
  // Если мы на localhost или 127.0.0.1, используем прокси
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('🔧 Using proxy for localhost')
    return ''  // Пустая строка для использования прокси
  }
  
  // 🔒 ЗАФИКСИРОВАННЫЙ URL ДЛЯ ВСЕХ ОСТАЛЬНЫХ!
  console.log('🔧 Using direct URL for:', hostname)
  return 'http://localhost:8001'  # 🔒 ЗАФИКСИРОВАНО!
}

const API_URL = getBackendURL()

console.log('🔧 Backend URL:', API_URL, '| Hostname:', window.location.hostname)

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
})

// ... остальной код
```

---

## 🚪 ПОРЯДОК ЗАПУСКА (СЛЕДОВАТЬ ТОЧНО!):

### Шаг 1: Проверка файлов
```bash
# 🔒 Проверить критические настройки
grep -n "DATABASE_NAME=test" docker-compose.yml
grep -n "target: \"http://localhost:8001\"" frontend/vite.config.js
grep -n "return 'http://localhost:8001'" frontend/src/context/AuthContext.jsx
```

### Шаг 2: Очистка и запуск
```bash
# 🔒 Полная очистка
docker-compose down -v
docker system prune -f

# 🔒 Запуск с правильной конфигурацией
docker-compose up --build -d
```

### Шаг 3: Проверка
```bash
# 🔒 Проверить стату
docker-compose ps
docker-compose logs backend

# 🔒 Проверить базу
docker-compose exec mongodb mongosh --eval "use test; db.users.count()"
```

### Шаг 4: Фронтенд
```bash
cd frontend
npm install
npm start
```

---

## 🔒 КРИТИЧЕСКИЕ ПРАВИЛА (НИКОГДА НЕ НАРУШАТЬ!):

1. **DATABASE_NAME=test** - всегда!
2. **Backend port: 8001** - всегда!
3. **Frontend port: 3002** - всегда!
4. **MongoDB volume: mongodb_data** - всегда!
5. **API URL: http://localhost:8001** - всегда!
6. **Пользователь: seller@test.com / admin123** - всегда!

---

## 🚨 ПРОВЕРКА РАБОТОСПОСОБНОСТИ:

### ✅ Чеклист перед работой:
- [ ] docker-compose.yml имеет DATABASE_NAME=test
- [ ] vite.config.js имеет target: "http://localhost:8001"
- [ ] AuthContext.jsx имеет return 'http://localhost:8001'
- [ ] Бэкенд запущен на порту 8001
- [ ] Фронтенд запущен на порту 3002
- [ ] MongoDB использует volume mongodb_data
- [ ] Пользователь seller@test.com существует в базе test

### ✅ Тестовые запросы:
```bash
# Проверить бэкенд
curl http://localhost:8001/api/auth/me

# Проверить фронтенд
curl http://localhost:3002

# Проверить базу
docker-compose exec mongodb mongosh --eval "use test; db.users.find()"
```

---

## 🔥 ЧТО ДЕЛАТЬ ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ:

1. **НЕ МЕНЯТЬ КОНФИГУРАЦИЮ!**
2. **Остановить все:** `docker-compose down -v`
3. **Очистить:** `docker system prune -f`
4. **Запустить по инструкции выше**
5. **Проверить чеклист**

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ:

- **12.02.2026:** Создана жесткая конфигурация после потери данных
- **Причина:** Временные Docker volumes и отсутствующая фиксация настроек
- **Решение:** Постоянные volumes и зафиксированные параметры

---

*⚠️ Этот файл - КРИТИЧЕСКИ ВАЖЕН! Любые изменения должны быть согласованы!*
