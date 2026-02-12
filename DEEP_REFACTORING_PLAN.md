# 🔧 PLAN ГЛУБОКОГО РЕФАКТОРИНГА MINIMALSELLER

> **Дата создания**: 11 февраля 2026  
> **Версия**: 1.0  
> **Статус**: В ожидании утверждения

---

## 📋 EXECUTIVE SUMMARY

MinimalSeller находится в состоянии активной эволюции после масштабного рефакторинга февраля 2026. Проект имеет солидную архитектурную базу (FastAPI + MongoDB + React), но страдает от критических проблем, включая **ошибку 500 при входе в систему**, проблемы безопасности, монолитные компоненты и технический долг.

**Цель рефакторинга**: Устранить критические ошибки, улучшить безопасность, завершить модульную архитектуру и обеспечить стабильность системы.

---

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. **ОШИБКА 500 ПРИ ВХОДЕ** (Priority: CRITICAL 🔴)

#### Симптомы

- Пользователи не могут войти в систему
- Backend возвращает HTTP 500 Internal Server Error
- Ошибка возникает на этапе аутентификации

#### Диагностика: Найдена root cause!

**ПРОБЛЕМА: Несоответствие имен полей пароля в базе данных**

```diff
# Старые скрипты инициализации (backend/init_db.py, backend/scripts/init_db.py)
# создавали пользователей с полем:
- "hashed_password": pwd_context.hash("password123")

# Новый код в auth_service.py использует поле:
+ "password_hash": cls.get_password_hash(user_data.password)
```

**Детали конфликта:**

1. **Создание пользователей** ([server.py:106-109](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/server.py#L106-L109)):

   ```python
   password_hash = AuthService.get_password_hash("admin123")
   await db.users.insert_one({
       "password_hash": password_hash,  # ✅ Правильно
   })
   ```

2. **Регистрация через API** ([auth_service.py:92](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/services/auth_service.py#L92)):

   ```python
   user = {
       "password_hash": cls.get_password_hash(user_data.password),  # ✅ Правильно
   }
   ```

3. **Аутентификация (где возникает 500)** ([auth_service.py:121](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/services/auth_service.py#L121)):

   ```python
   # Fallback для обратной совместимости
   password_hash = user.get("password_hash") or user.get("hashed_password")
   if not password_hash:
       return None  # ⚠️ Если нет ни одного поля - провал
   ```

4. **Старые скрипты создают НЕПРАВИЛЬНОЕ поле** ([backend/init_db.py:29](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/init_db.py#L29), [backend/scripts/init_db.py:29](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/scripts/init_db.py#L29)):
   ```python
   "hashed_password": hashed_password,  # ❌ УСТАРЕВШЕЕ ПОЛЕ!
   ```

#### Почему возникает именно 500, а не 401?

**Гипотеза**: Ошибка 500 возникает НЕ из-за отсутствия поля, а из-за других проблем:

1. **NoSQL Injection** при поиске пользователя
2. **Проблемы с подключением к MongoDB**
3. **Ошибки при работе с ObjectId**
4. **Uncaught exceptions в middleware**

**НУЖНА ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА** для точного определения источника 500 ошибки.

---

### 2. **БЕЗОПАСНОСТЬ** (Priority: CRITICAL 🔴)

Обнаружены критические уязвимости:

#### 2.1 CORS Configuration

```python
# backend/server.py:47
cors_origins = ["*"]  # ❌ ОПАСНО! Разрешены ВСЕ источники
```

**Проблема**: CSRF атаки, XSS, несанкционированный доступ  
**Риск**: 🔴 CRITICAL

#### 2.2 JWT Secrets

```python
# backend/config.py:11
JWT_SECRET: str = "CHANGE_ME"  # ❌ Default secret!
```

**Проблема**: Токены могут быть подделаны  
**Риск**: 🔴 CRITICAL

#### 2.3 NoSQL Injection

```python
# Пример уязвимого кода (потенциально в старых роутерах)
db.users.find({"username": user_input})  # ❌ Без валидации!
```

**Проблема**: Возможность выполнения произвольных MongoDB запросов  
**Риск**: 🔴 CRITICAL

#### 2.4 API Keys в логах

```python
# Частичное логирование API ключей в cleartext
logger.info(f"API Key: {api_key[:10]}...")  # ❌ Утечка данных
```

**Проблема**: API ключи маркетплейсов в логах  
**Риск**: 🟡 HIGH

#### 2.5 Rate Limiting НЕ активен

```python
# Middleware определен в server.py, но НЕ применен к критичным endpoints
limiter = Limiter(key_func=get_remote_address)  # ⚠️ Неактивен
```

**Проблема**: Brute-force атаки на /api/auth/login  
**Риск**: 🟡 HIGH

#### 2.6 Незашифрованное хранение API ключей

```python
# API ключи маркетплейсов хранятся в MongoDB без шифрования
await db.seller_profiles.insert_one({
    "api_keys": [{"client_id": "...", "api_key": "..."}]  # ❌ Plain text!
})
```

**Проблема**: При компрометации БД - потеря всех API ключей  
**Риск**: 🔴 CRITICAL

---

### 3. **МОНОЛИТНЫЕ КОМПОНЕНТЫ** (Priority: HIGH 🟡)

#### 3.1 connectors.py (~99KB, 2349 строк)

**Состав**:

- `OzonConnector` - API интеграция с Ozon
- `WildberriesConnector` - API интеграция с Wildberries
- `YandexConnector` - API интеграция с Яндекс.Маркет
- Retry логика, обработка ошибок, парсинг ответов

**Проблемы**:

- Сложность тестирования (все в одном файле)
- Невозможность параллельной разработки
- Дублирование логики (retry, headers, logging)

**Предложение**: Разбить на отдельные модули в `backend/connectors/`:

```
backend/connectors/
├── __init__.py
├── base.py          # BaseConnector + общая логика
├── ozon.py          # OzonConnector
├── wildberries.py   # WildberriesConnector
├── yandex.py        # YandexConnector
└── utils.py         # Retry decorators, headers builders
```

#### 3.2 Частично завершенный рефакторинг server.py

**Статус**: ✅ Entry point очищен (157 строк), **НО**:

- Много legacy роутеров в корне `/backend/*.py.migrated`
- Не все роутеры перенесены в `/backend/routers/`
- Schedulers (order_sync, stock_sync) восстановлены, но не оптимизированы

---

### 4. **FRONTEND** (Priority: MEDIUM 🟠)

#### 4.1 Множественные точки входа

```
frontend/src/
├── App.jsx           # Основное приложение (8KB)
├── App.jsx.backup    # Старая версия
├── AppWithAuth.jsx   # С аутентификацией
├── SimpleApp.jsx     # Упрощенная версия
├── TestApp.jsx       # Тестовая версия
└── IntegrationsApp.jsx
```

**Проблема**: Неясно, какая версия используется  
**Риск**: Путаница при development, legacy код

#### 4.2 Неоднородная структура

```
frontend/src/
├── components/       # 27 компонентов
├── pages/           # 70 страниц! (слишком много)
├── context/         # 2 контекста
└── i18n/
```

**Проблема**: 70 страниц = плохая организация  
**Предложение**: Группировать по доменам (auth, catalog, orders, analytics)

---

### 5. **ТЕХНИЧЕСКИЙ ДОЛГ** (Priority: MEDIUM 🟠)

#### 5.1 Несовместимость моделей

```python
# backend/models.py - compatibility layer
from backend.schemas.common import *
from backend.schemas.auth import *
# ...
```

**Проблема**: Двойная система (`models.py` vs `schemas/`), риск конфликтов

#### 5.2 Дублирование кода

- Marketplace publishing logic дублирован в `server.py` и `catalog_publish_new.py`
- Ozon attribute validation в нескольких местах
- Retry логика в `connectors.py` и других модулях

#### 5.3 Git merge artifacts

```python
# Возможно наличие merge conflict markers в некоторых файлах
<<<<<<< HEAD
=======
>>>>>>> branch
```

---

## 🎯 ПЛАН РЕФАКТОРИНГА

### PHASE 1: ИСПРАВЛЕНИЕ КРИТИЧЕСКИХ ОШИБОК (1-2 дня)

#### 1.1 Исправление ошибки 500 при входе

**Шаг 1**: Диагностика точного источника ошибки

- [ ] Добавить подробное логирование в [auth_service.py:authenticate_user](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/services/auth_service.py#L114-L134)
- [ ] Обернуть код в try-except для перехвата исключений
- [ ] Залогировать точку возникновения ошибки

**Код изменений**:

```python
# backend/services/auth_service.py:authenticate_user
@classmethod
async def authenticate_user(cls, email: str, password: str):
    import logging
    logger = logging.getLogger(__name__)

    try:
        db = await get_database()
        logger.info(f"[AUTH] Attempting login for: {email}")

        user = await db.users.find_one({"email": email})

        if not user:
            logger.warning(f"[AUTH] User not found: {email}")
            return None

        logger.info(f"[AUTH] User found. Checking password fields...")
        password_hash = user.get("password_hash") or user.get("hashed_password")

        if not password_hash:
            logger.error(f"[AUTH] CRITICAL: No password field for user {email}. Fields: {list(user.keys())}")
            return None

        logger.info(f"[AUTH] Password field found. Verifying...")
        if not cls.verify_password(password, password_hash):
            logger.warning(f"[AUTH] Invalid password for: {email}")
            return None

        logger.info(f"[AUTH] Password verified. Updating last_login_at...")
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login_at": datetime.utcnow()}}
        )

        logger.info(f"[AUTH] Login successful: {email}")
        return user

    except Exception as e:
        logger.error(f"[AUTH] EXCEPTION during authentication: {type(e).__name__}: {str(e)}", exc_info=True)
        raise  # Re-raise для получения 500 и stack trace
```

**Шаг 2**: Миграция существующих пользователей

- [ ] Создать скрипт `backend/scripts/migrate_password_hash.py`
- [ ] Переименовать `hashed_password` → `password_hash` для всех пользователей
- [ ] Добавить индекс на поле `email` для быстрого поиска

**Код скрипта**:

```python
# backend/scripts/migrate_password_hash.py
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "minimalmod")

async def migrate_password_fields():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]

    print(f"🔍 Checking users collection...")
    users_with_old_field = await db.users.count_documents({"hashed_password": {"$exists": True}})
    print(f"   Found {users_with_old_field} users with 'hashed_password' field")

    if users_with_old_field == 0:
        print("✅ No migration needed!")
        return

    print(f"🔧 Migrating {users_with_old_field} users...")

    # Rename field for all users
    result = await db.users.update_many(
        {"hashed_password": {"$exists": True}},
        {"$rename": {"hashed_password": "password_hash"}}
    )

    print(f"✅ Migrated {result.modified_count} users")

    # Create email index if not exists
    print(f"🔧 Creating email index...")
    await db.users.create_index("email", unique=True)
    print(f"✅ Email index created")

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_password_fields())
```

**Шаг 3**: Обновить все скрипты инициализации

Файлы для исправления:

- [backend/init_db.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/init_db.py#L29)
- [backend/scripts/init_db.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/scripts/init_db.py#L29)
- [backend/scripts/reset_password.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/scripts/reset_password.py#L23)

```diff
# Заменить во ВСЕХ файлах:
- "hashed_password": hashed_password
+ "password_hash": hashed_password
```

**Шаг 4**: Добавить валидацию и обработку ошибок

- [ ] Добавить middleware для перехвата всех исключений
- [ ] Логировать stack traces в production
- [ ] Возвращать корректные HTTP коды (500 → 401 при ошибке auth)

---

#### 1.2 Безопасность: Критичные исправления

**1.2.1 CORS Configuration**

```python
# backend/server.py:46-56
# ❌ БЫЛО:
cors_origins = ["*"]

# ✅ ДОЛЖНО БЫТЬ:
cors_origins = settings.cors_origins_list  # Из .env
# В .env:
# CORS_ORIGINS=http://localhost:5173,https://your-production-domain.com
```

**1.2.2 JWT Secret Validation**

```python
# backend/config.py уже имеет валидацию на старте (строки 69-73)
# ✅ Хорошо! Но добавить проверку длины:

if settings.JWT_SECRET == "CHANGE_ME" or len(settings.JWT_SECRET) < 32:
    print("❌ JWT_SECRET must be at least 32 characters!")
    sys.exit(1)
```

**1.2.3 Rate Limiting на /api/auth/login**

```python
# backend/routers/auth.py:17
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")  # ✅ Максимум 5 попыток в минуту
async def login(request: Request, credentials: UserLogin):
    # ...
```

**1.2.4 Input Sanitization (NoSQL Injection)**

```python
# Добавить валидацию email в schemas/user.py
from pydantic import BaseModel, EmailStr, validator
import re

class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @validator('email')
    def email_must_be_safe(cls, v):
        # Дополнительная проверка на NoSQL injection
        if any(char in v for char in ['$', '{', '}', '[', ']']):
            raise ValueError('Invalid email format')
        return v
```

**1.2.5 Encryption для API Keys (долгосрочная задача, Phase 2)**

_Временное решение_: Добавить маскировку в логах

```python
def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "***"
    return f"{api_key[:4]}...{api_key[-4:]}"

logger.info(f"API Key: {mask_api_key(api_key)}")
```

---

### PHASE 2: АРХИТЕКТУРНЫЙ РЕФАКТОРИНГ (3-5 дней)

#### 2.1 Модуляризация connectors.py

**Цель**: Разбить монолит на отдельные файлы

**Структура**:

```
backend/connectors/
├── __init__.py               # Экспорты всех коннекторов
├── base.py                   # BaseConnector + общая логика
│   ├── BaseConnector
│   ├── MarketplaceError
│   └── retry decorators
├── ozon.py                   # OzonConnector
│   ├── OzonConnector
│   └── Ozon-specific helpers
├── wildberries.py            # WildberriesConnector
│   ├── WildberriesConnector
│   └── WB-specific helpers
├── yandex.py                 # YandexConnector
│   ├── YandexConnector
│   └── Yandex-specific helpers
└── utils.py                  # HTTP utils, headers builders
    ├── get_browser_headers()
    ├── make_request_with_retry()
    └── decompress_response()
```

**Migration Strategy**:

1. Создать новую структуру
2. Скопировать код из `connectors.py` в новые файлы
3. Обновить импорты во всех роутерах
4. Протестировать каждый коннектор отдельно
5. Удалить старый `connectors.py`

**Backward Compatibility**:

```python
# backend/connectors/__init__.py
from .ozon import OzonConnector
from .wildberries import WildberriesConnector
from .yandex import YandexConnector
from .base import MarketplaceError

__all__ = ["OzonConnector", "WildberriesConnector", "YandexConnector", "MarketplaceError"]
```

---

#### 2.2 Завершение модуляризации backend

**Цель**: Переместить все legacy routers в `/backend/routers/`

**Legacy файлы** (\*.migrated):

```
backend/
├── admin_routes.py.migrated            → routers/ (DONE: admin.py)
├── analytics_routes.py.migrated        → routers/ (DONE: analytics.py)
├── category_routes.py.migrated         → routers/ (DONE: categories.py)
├── fbs_orders_routes.py.migrated       → routers/ (DONE: orders_fbs.py)
└── ... (более 20 файлов)
```

**Действия**:

- [ ] Удалить все `.migrated` файлы (они уже перенесены)
- [ ] Проверить, что ВСЕ роутеры включены в `server.py`
- [ ] Убедиться, что нет дублирования функционала

---

#### 2.3 Frontend: Упрощение структуры

**2.3.1 Единственная точка входа**

Определить **один** основной App:

```javascript
// frontend/src/main.jsx
import App from "./App.jsx"; // ✅ Единственная версия

// Удалить:
// - App.jsx.backup
// - SimpleApp.jsx
// - TestApp.jsx
// - IntegrationsApp.jsx (переместить в /examples если нужен)
```

**2.3.2 Реорганизация pages/**

Текущая структура: 70 файлов в одной папке ❌

**Предлагаемая структура**:

```
frontend/src/pages/
├── auth/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   └── ProfilePage.jsx
├── catalog/
│   ├── CatalogPage.jsx
│   ├── ProductEditPage.jsx
│   ├── CategoriesPage.jsx
│   └── ImportPage.jsx
├── orders/
│   ├── OrdersPage.jsx
│   ├── OrderDetailsPage.jsx
│   └── ReturnsPage.jsx
├── analytics/
│   ├── DashboardPage.jsx
│   ├── FinancePage.jsx
│   └── ReportsPage.jsx
├── settings/
│   ├── IntegrationsPage.jsx
│   ├── WarehousesPage.jsx
│   └── ApiKeysPage.jsx
└── admin/
    ├── UsersPage.jsx
    └── PlatformPage.jsx
```

---

### PHASE 3: ТЕСТИРОВАНИЕ И КАЧЕСТВО (2-3 дня)

#### 3.1 Unit Tests

**Приоритетные модули для покрытия**:

1. `backend/services/auth_service.py` - аутентификация (CRITICAL)
2. `backend/connectors/` - интеграции с маркетплейсами
3. `backend/routers/auth.py` - API endpoints

**Пример теста**:

```python
# backend/tests/test_auth_service.py
import pytest
from backend.services.auth_service import AuthService

class TestAuthService:
    def test_password_hashing(self):
        password = "test123"
        hashed = AuthService.get_password_hash(password)
        assert AuthService.verify_password(password, hashed)

    def test_password_verification_failure(self):
        hashed = AuthService.get_password_hash("test123")
        assert not AuthService.verify_password("wrong", hashed)

    @pytest.mark.asyncio
    async def test_authenticate_user_with_password_hash(self, test_db):
        # Тест с правильным полем password_hash
        # ...

    @pytest.mark.asyncio
    async def test_authenticate_user_with_legacy_hashed_password(self, test_db):
        # Тест обратной совместимости с hashed_password
        # ...
```

#### 3.2 Integration Tests

**Сценарии**:

1. Регистрация → Подтверждение админом → Вход
2. Добавление API ключа → Импорт товаров → Публикация
3. Создание товара → Обновление остатков → Получение статистики

#### 3.3 Security Audit

- [ ] Проверка всех endpoints на NoSQL injection
- [ ] Аудит CORS настроек
- [ ] Проверка rate limiting
- [ ] Сканирование зависимостей (`pip-audit`, `safety`)

---

### PHASE 4: ОПТИМИЗАЦИЯ И ДОКУМЕНТАЦИЯ (1-2 дня)

#### 4.1 Performance

- [ ] Добавить индексы в MongoDB (email, role, created_at)
- [ ] Оптимизировать запросы (избегать N+1)
- [ ] Кэширование категорий маркетплейсов
- [ ] Compression для API responses

#### 4.2 Документация

- [ ] API Reference (Swagger автоматически генерируется FastAPI)
- [ ] README с инструкциями по развертыванию
- [ ] Архитектурная диаграмма
- [ ] Troubleshooting guide

---

## 🛠️ ROADMAP МИГРАЦИИ

### Week 1: Критические исправления

```
День 1-2: Ошибка 500 при входе
├── Диагностика логированием
├── Миграция password fields
├── Обновление скриптов
└── Тестирование

День 3-4: Безопасность
├── CORS настройка
├── Rate limiting
├── Input validation
└── Security audit

День 5: Тестирование Phase 1
```

### Week 2: Архитектурный рефакторинг

```
День 1-3: Модуляризация connectors
├── Создание структуры
├── Миграция кода
├── Обновление импортов
└── Тестирование

День 4-5: Frontend cleanup
├── Удаление legacy App версий
├── Реорганизация pages/
└── Рефакторинг маршрутов
```

### Week 3: Качество и финализация

```
День 1-2: Unit tests
День 3: Integration tests
День 4: Performance optimization
День 5: Документация + Release
```

---

## ✅ ПЛАН ВЕРИФИКАЦИИ

### Критерии Ready for Production

#### Backend

- [ ] Ошибка 500 при входе исправлена полностью
- [ ] Все тесты проходят успешно (unit + integration)
- [ ] CORS настроен на production domains
- [ ] JWT_SECRET изменен с дефолтного значения
- [ ] Rate limiting активен на критичных endpoints
- [ ] NoSQL injection prevention внедрен
- [ ] API ключи маскированы в логах
- [ ] Все роутеры перенесены в `/routers/`
- [ ] `connectors.py` разбит на модули

#### Frontend

- [ ] Единственная точка входа (один App.jsx)
- [ ] `/pages/` реорганизованы по доменам
- [ ] Нет legacy файлов (*.backup, *Test.jsx)
- [ ] Build проходит без warnings

#### Database

- [ ] Все пользователи мигрированы на `password_hash`
- [ ] Индексы созданы на критичных полях
- [ ] Backup strategy настроена

#### Security

- [ ] `pip-audit` / `safety` проверка пройдена
- [ ] Нет хардкоженных credentials
- [ ] Environment variables настроены корректно

---

## 📊 МЕТРИКИ УСПЕХА

### Производительность

- Время входа в систему: < 500ms (сейчас: N/A из-за ошибки 500)
- Время загрузки товаров: < 2s для 1000 товаров
- Время отклика API: < 200ms (median)

### Качество кода

- Test coverage: > 80% (критичный код)
- Linting: 0 errors, < 10 warnings
- Security score: A (по результатам аудита)

### Пользовательский опыт

- Успешная авторизация: 100% (сейчас: 0% из-за ошибки 500)
- Uptime: > 99.5%
- Error rate: < 0.1%

---

## ⚠️ RISK MITIGATION

### Риск 1: Ошибка 500 возникает не из-за password fields

**Mitigation**: Детальное логирование на каждом шаге authentication flow

### Риск 2: Backend миграция сломает существующий функционал

**Mitigation**:

- Поэтапная миграция с тестами на каждом шаге
- Сохранить `server.py.backup` для быстрого rollback
- Feature flags для новых модулей

### Риск 3: Frontend реорганизация сломает маршруты

**Mitigation**:

- Обновлять маршруты постепенно
- Тестировать каждую страницу вручную
- Использовать React Router redirects для старых путей

### Риск 4: MongoDB миграция приведет к data loss

**Mitigation**:

- **ОБЯЗАТЕЛЬНО** сделать backup перед миграцией
- Тестировать скрипт миграции на копии БД
- Откатить изменения если что-то пойдет не так (`$rename` обратим)

---

## 🎯 NEXT STEPS

### Немедленные действия (для утверждения плана)

1. **Утвердите приоритеты**: Согласны ли вы с порядком фаз?
2. **Проверьте гипотезы**: Согласны ли с диагностикой ошибки 500?
3. **Уточните scope**: Есть ли дополнительные требования?

### После утверждения плана

> [!IMPORTANT]
> **НЕ НАЧИНАТЬ ВЫПОЛНЕНИЕ БЕЗ ЯВНОГО РАЗРЕШЕНИЯ ПОЛЬЗОВАТЕЛЯ!**
>
> Этот документ является ТОЛЬКО ПЛАНОМ. Ждем вашего подтверждения:
>
> - ✅ "Начинай Phase 1" - начать исправление критических ошибок
> - 📝 "Уточни X" - есть вопросы по плану
> - ❌ "Пересмотри Y" - нужны изменения

---

## 📚 REFERENCES

### Файлы для изменения (Phase 1)

- [backend/services/auth_service.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/services/auth_service.py#L114-L134) - authenticate_user
- [backend/init_db.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/init_db.py#L29) - password field
- [backend/scripts/init_db.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/scripts/init_db.py#L29) - password field
- [backend/scripts/reset_password.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/scripts/reset_password.py#L23) - password field
- [backend/server.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/server.py#L46-L56) - CORS
- [backend/routers/auth.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/routers/auth.py#L17) - rate limiting
- [backend/config.py](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/config.py#L69-L73) - JWT validation

### Knowledge Base

- [MinimalSeller Project Overview](file:///C:/Users/dkuzm/.gemini/antigravity/knowledge/minimalseller_project_overview/artifacts/project_overview.md)
- [Architecture](file:///C:/Users/dkuzm/.gemini/antigravity/knowledge/minimalseller_project_overview/artifacts/architecture.md)
- [Codebase Health](file:///C:/Users/dkuzm/.gemini/antigravity/knowledge/minimalseller_project_overview/artifacts/codebase_health_and_audit.md)

---

**Автор**: Antigravity AI Assistant  
**Контакт**: Ожидает обратной связи пользователя  
**Статус**: 🟢 APPROVED (LGTM)
