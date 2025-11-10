# MinimalMod - Локальный Запуск

## 🚀 Быстрый старт

### Шаг 1: Исправить bcrypt (ВАЖНО!)

```bash
cd backend
pip uninstall bcrypt -y
pip install bcrypt==4.1.2
pip install passlib[bcrypt]==1.7.4
```

### Шаг 2: Создать seller пользователя

**Вариант А: Через скрипт (быстрее)**

Создайте файл `backend/create_seller.py`:
```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_seller():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["minimalmod"]
    
    seller = {
        "email": "seller@test.com",
        "password_hash": pwd_context.hash("test123"),
        "full_name": "Test Seller",
        "role": "seller",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "last_login_at": None
    }
    result = await db.users.insert_one(seller)
    
    await db.seller_profiles.insert_one({
        "user_id": result.inserted_id,
        "company_name": "Test LLC",
        "inn": "",
        "api_keys": [],
        "commission_rate": 0.15
    })
    
    print("✅ Seller создан!")
    client.close()

asyncio.run(create_seller())
```

Запустите:
```bash
python create_seller.py
```

**Вариант Б: Через интерфейс**
1. Войдите как admin
2. Откройте http://localhost:3000/register
3. Зарегистрируйте seller
4. В admin панели одобрите пользователя

### Шаг 3: Создать тестовые данные

```bash
python seed_data.py
python seed_finance.py
python seed_marketing.py
python create_categories_with_attributes.py
```

### Шаг 4: Готово!

Войдите:
- Seller: seller@test.com / test123
- Admin: admin@minimalmod.com / admin123

---

## 🔄 СИНХРОНИЗАЦИЯ С PREVIEW

### Как обновить локальную версию:

**1. Сохраните изменения из preview в GitHub:**
- Нажмите "Save to Github" в чате Emergent

**2. Обновите локальный код:**
```bash
cd /path/to/MinimalSeller
git pull origin main
```

**3. Установите новые зависимости (если были изменения):**
```bash
cd backend
pip install -r requirements.txt

cd ../frontend
npm install
```

**4. Перезапустите сервисы:**
```bash
# Остановите backend (Ctrl+C)
# Остановите frontend (Ctrl+C)

# Запустите заново
python backend/server.py
npm run dev --prefix frontend
```

---

## 🆘 Частые проблемы:

### Frontend не запускается
```bash
cd frontend
rm -rf node_modules
npm install
npm run dev
```

### Backend ошибка bcrypt
```bash
pip uninstall bcrypt passlib -y
pip install bcrypt==4.1.2 passlib[bcrypt]==1.7.4
```

### MongoDB не запущена
```bash
# Windows
net start MongoDB

# Mac
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

---

## 🎯 Учетные данные:

- **Admin:** admin@minimalmod.com / admin123
- **Seller:** seller@test.com / test123 (после создания)

---

## 🔗 Полезные ссылки:

- Backend API: http://localhost:8001
- Frontend: http://localhost:3000
- API Docs: http://localhost:8001/docs
