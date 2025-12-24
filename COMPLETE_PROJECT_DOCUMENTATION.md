# 📚 MinimalMod Hub - Полная Документация Проекта

## 🎯 Обзор Системы

### Назначение
**MinimalMod Hub** - это комплексная платформа для управления продажами на маркетплейсах (Ozon, Wildberries, Яндекс Маркет). Система предназначена для селлеров и обеспечивает:

- 📦 Централизованное управление товарами
- 🛒 Управление заказами (FBS, FBO, Retail)
- 📊 Финансовую аналитику и расчет прибыли
- 🏭 Складской учет с автоматическим резервированием
- 🔄 Синхронизацию остатков на все маркетплейсы
- 📈 Интеграцию с API всех крупных маркетплейсов РФ

### Tech Stack

**Backend:**
- FastAPI (Python 3.11+)
- Motor (async MongoDB driver)
- APScheduler (задачи по расписанию)
- httpx (async HTTP клиент)
- JWT authentication
- Pydantic (валидация данных)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Shadcn/UI components
- Lucide React (icons)
- Sonner (toasts)

**Database:**
- MongoDB (NoSQL)
- База: `minimalmod`

**Infrastructure:**
- Supervisor (управление процессами)
- Nginx reverse proxy (Kubernetes ingress)
- Hot reload для разработки

---

## 🏗️ Архитектура Проекта

### Структура Директорий

```
/app
├── backend/                    # FastAPI Backend
│   ├── server.py              # Главный файл сервера
│   ├── database.py            # MongoDB подключение
│   ├── models.py              # Pydantic модели
│   ├── auth_utils.py          # JWT аутентификация
│   ├── connectors.py          # Коннекторы к МП API
│   │
│   ├── product_routes.py      # CRUD товаров
│   ├── category_routes_v2.py  # Управление категориями
│   │
│   ├── fbs_orders_routes.py   # FBS заказы (со склада продавца)
│   ├── fbo_orders_routes.py   # FBO заказы (со склада МП)
│   ├── retail_orders_routes.py # Розничные заказы
│   ├── order_sync_scheduler.py # Автосинхронизация заказов
│   │
│   ├── warehouse_routes.py    # Управление складами
│   ├── warehouse_links_routes.py # Связь складов с МП
│   ├── inventory_routes.py    # Остатки товаров
│   ├── stock_sync_routes.py   # Синхронизация остатков
│   ├── stock_scheduler.py     # Автосинхронизация остатков
│   │
│   ├── business_analytics.py  # Финансовая аналитика
│   ├── analytics_routes.py    # API аналитики
│   ├── ozon_reports_routes.py # Отчеты Ozon
│   │
│   └── requirements.txt       # Python зависимости
│
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── App.js             # Главный компонент + роутинг
│   │   ├── App.css            # Глобальные стили
│   │   ├── index.css          # Tailwind + дизайн-система
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Контекст аутентификации
│   │   │
│   │   ├── components/
│   │   │   ├── ui/            # Shadcn компоненты
│   │   │   ├── products/      # Управление товарами
│   │   │   ├── orders/        # Управление заказами
│   │   │   ├── warehouse/     # Управление складами
│   │   │   ├── analytics/     # Финансовая аналитика
│   │   │   └── integrations/  # Настройка интеграций
│   │   │
│   │   └── pages/             # Страницы приложения
│   │
│   └── package.json           # NPM зависимости
│
└── design_guidelines.md       # UI/UX дизайн-система
```

---

## 📊 Ключевые Функции Системы

### 1. Управление Товарами (Product Management)

**Функционал:**
- ✅ CRUD операции (создание, чтение, обновление, удаление)
- ✅ Импорт товаров с маркетплейсов (Ozon, WB, Yandex)
- ✅ Массовое редактирование
- ✅ Категоризация товаров (внутренняя + МП категории)
- ✅ Управление изображениями товаров
- ✅ Установка себестоимости для расчета прибыли
- ✅ Штрихкоды (barcode) и артикулы (SKU)

**Схема данных (`product_catalog`):**
```javascript
{
  "_id": ObjectId,
  "seller_id": String,
  "article": String,          // Уникальный артикул продавца
  "name": String,
  "description": String,
  "images": [String],         // URLs изображений
  "category": String,         // Внутренняя категория
  "purchase_price": Number,   // Себестоимость
  "barcode": String,
  "created_at": DateTime,
  "updated_at": DateTime,
  
  // Маркетплейс-специфичные данные
  "ozon": {
    "product_id": Number,
    "sku": Number,
    "offer_id": String,
    "category_id": Number
  },
  "wb": {
    "nm_id": Number,
    "sku": String
  },
  "yandex": {
    "shop_sku": String,
    "market_sku": String
  }
}
```

**API Endpoints:**
- `GET /api/products` - Список товаров
- `POST /api/products` - Создать товар
- `PUT /api/products/{id}` - Обновить товар
- `DELETE /api/products/{id}` - Удалить товар
- `POST /api/products/import` - Импорт с МП

---

### 2. Управление Заказами (Order Management)

#### 2.1 FBS Заказы (Fulfillment by Seller)

**Описание:** Заказы, которые отправляются со склада продавца.

**Функционал:**
- ✅ Импорт заказов с Ozon, WB, Yandex
- ✅ Автоматическая синхронизация каждые 5 минут
- ✅ Резервирование товаров при создании заказа
- ✅ Списание товаров при передаче в доставку (статус `delivering`)
- ✅ Возврат товаров на склад при отмене
- ✅ Отслеживание статусов заказов
- ✅ Генерация этикеток для доставки
- ✅ Фильтрация и поиск по артикулам
- ✅ Защита от дубликатов (уникальный индекс на `external_order_id + seller_id`)

**Схема данных (`orders_fbs`):**
```javascript
{
  "_id": ObjectId,
  "seller_id": String,
  "warehouse_id": String,
  "marketplace": String,           // "ozon" | "wb" | "yandex"
  "external_order_id": String,     // ID заказа на МП
  "order_number": String,          // = external_order_id (реальный номер)
  "status": String,                // "new" | "awaiting_shipment" | "delivering" | "delivered" | "cancelled"
  "reserve_status": String,        // "reserved" | "deducted" | "returned"
  
  "customer": {
    "full_name": String,
    "phone": String,
    "address": String
  },
  
  "items": [{
    "product_id": String,
    "article": String,
    "name": String,
    "price": Number,
    "quantity": Number,
    "total": Number
  }],
  
  "totals": {
    "subtotal": Number,
    "shipping_cost": Number,
    "marketplace_commission": Number,
    "seller_payout": Number,
    "total": Number
  },
  
  "created_at": DateTime,          // Реальная дата заказа с МП
  "updated_at": DateTime,
  "imported_at": DateTime,
  "delivered_at": DateTime,
  "cancelled_at": DateTime,
  
  "status_history": [{
    "status": String,
    "action": String,
    "changed_at": DateTime,
    "changed_by": String,
    "comment": String
  }]
}
```

**Бизнес-логика резервирования:**

1. **При создании заказа (статус: `new`, `awaiting_shipment`):**
   ```
   inventory.reserved += quantity
   inventory.available -= quantity
   inventory.quantity (БЕЗ ИЗМЕНЕНИЙ)
   ```

2. **При отправке (статус: `delivering`):**
   ```
   inventory.quantity -= quantity
   inventory.reserved -= quantity
   inventory.available (БЕЗ ИЗМЕНЕНИЙ - уже уменьшен)
   ```

3. **При отмене (если `return_on_cancel = true`):**
   ```
   inventory.reserved -= quantity
   inventory.available += quantity
   inventory.quantity (БЕЗ ИЗМЕНЕНИЙ)
   ```

**API Endpoints:**
- `GET /api/orders/fbs` - Список заказов
- `GET /api/orders/fbs/{id}` - Детали заказа
- `POST /api/orders/fbs/import` - Ручной импорт
- `POST /api/orders/fbs/refresh-statuses` - Обновить статусы
- `PUT /api/orders/fbs/{id}/status` - Изменить статус
- `POST /api/orders/fbs/{id}/split` - Разделить заказ (для Ozon)
- `GET /api/orders/fbs/{id}/label` - Получить этикетку

#### 2.2 FBO Заказы (Fulfillment by Operator)

**Описание:** Заказы, которые отправляются со склада маркетплейса (только аналитика).

**Особенности:**
- ❗ НЕ влияют на остатки (товары уже на складе МП)
- ✅ Используются только для финансовой аналитики
- ✅ Автоматическая синхронизация

**Схема:** Аналогична `orders_fbs`, но без резервирования.

#### 2.3 Retail Заказы (Розничные продажи)

**Описание:** Заказы, созданные вручную (розничные продажи вне МП).

---

### 3. Складской Учет (Warehouse & Inventory)

#### 3.1 Склады (`warehouses`)

**Функционал:**
- ✅ Создание множественных складов
- ✅ Приоритет списания (priority: 1, 2, 3...)
- ✅ Настройки склада:
  - `use_for_orders` - использовать для заказов
  - `sends_stock` - отправлять остатки на МП
  - `return_on_cancel` - возвращать товары при отмене

**Схема:**
```javascript
{
  "id": UUID,
  "user_id": String,
  "name": String,
  "address": String,
  "priority": Number,
  "use_for_orders": Boolean,
  "sends_stock": Boolean,
  "return_on_cancel": Boolean,
  "created_at": DateTime
}
```

#### 3.2 Остатки (`inventory`)

**Функционал:**
- ✅ Учет количества товаров на складах
- ✅ Разделение на: `quantity`, `available`, `reserved`
- ✅ История всех операций (`inventory_history`)
- ✅ Автоматическое обновление при заказах

**Схема:**
```javascript
{
  "_id": ObjectId,
  "product_id": ObjectId,
  "seller_id": String,
  "quantity": Number,      // Всего единиц (физически на складе)
  "available": Number,     // Доступно для продажи (quantity - reserved)
  "reserved": Number,      // Зарезервировано под заказы
  "updated_at": DateTime
}
```

**Формулы:**
```
available = quantity - reserved
quantity = физический остаток на складе
reserved = заказы в обработке
```

#### 3.3 Связь Складов с Маркетплейсами (`warehouse_links`)

**Функционал:**
- ✅ Связь внутреннего склада со складом на МП
- ✅ Необходимо для синхронизации остатков
- ✅ Один склад → много связей (для разных МП)

**Схема:**
```javascript
{
  "id": UUID,
  "warehouse_id": String,
  "integration_id": String,
  "marketplace_name": String,
  "marketplace_warehouse_id": String,
  "marketplace_warehouse_name": String,
  "created_at": DateTime
}
```

---

### 4. Интеграции с Маркетплейсами

#### 4.1 Архитектура Коннекторов

**Паттерн:** Factory + Inheritance

**Базовый класс:**
```python
class BaseConnector:
    def __init__(self, client_id: str, api_key: str)
    async def _make_request(method, url, headers, ...)
    async def get_products() -> List[Dict]
    async def get_warehouses() -> List[Dict]
    async def update_stock(warehouse_id, stocks)
```

**Реализации:**
- `OzonConnector` - Ozon Seller API
- `WildberriesConnector` - WB API 2025
- `YandexMarketConnector` - Yandex Partner API

**Фабрика:**
```python
def get_connector(marketplace: str, client_id: str, api_key: str) -> BaseConnector:
    connectors = {
        "ozon": OzonConnector,
        "wb": WildberriesConnector,
        "yandex": YandexMarketConnector
    }
    return connectors[marketplace](client_id, api_key)
```

#### 4.2 Ozon Integration

**API Base:** `https://api-seller.ozon.ru`

**Ключевые endpoints:**
- `/v3/product/list` - Список товаров
- `/v3/product/info/list` - Детальная информация
- `/v1/product/import` - Импорт товаров
- `/v3/posting/fbs/list` - FBS заказы
- `/v3/posting/fbo/list` - FBO заказы
- `/v1/product/info/stocks` - Обновление остатков
- `/v2/posting/fbs/ship` - Передать в доставку

**Аутентификация:**
```
Client-Id: {client_id}
Api-Key: {api_key}
```

**Статусы заказов:**
- `awaiting_packaging` → `awaiting_shipment`
- `awaiting_deliver` → `awaiting_shipment`
- `delivering` → `delivering` (ключевой для списания!)
- `delivered` → `delivered`
- `cancelled` → `cancelled`

#### 4.3 Wildberries Integration

**API Base:** `https://marketplace-api.wildberries.ru`

**Ключевые endpoints:**
- `/api/v3/supplies/orders` - Заказы
- `/api/v3/stocks/{warehouse_id}` - Остатки
- `/api/v3/warehouses` - Склады

**Аутентификация:**
```
Authorization: {api_key}
```

#### 4.4 Yandex Market Integration

**API Base:** `https://api.partner.market.yandex.ru`

**Ключевые endpoints:**
- `/campaigns/{campaignId}/orders` - Заказы
- `/businesses/{businessId}/warehouses` - Склады
- `/campaigns/{campaignId}/offers/stocks` - Остатки

**Аутентификация:**
```
Authorization: Bearer {oauth_token}
```

**Особенности:**
- `campaign_id` = `client_id` в интеграции
- Формат даты: `"02-02-2023"`
- Статус `DELIVERY` = ключевой для списания

---

### 5. Автоматизация и Планировщики

#### 5.1 Синхронизация Заказов (`order_sync_scheduler.py`)

**Частота:** Каждые 5 минут

**Функционал:**
- ✅ Получение новых заказов с всех МП
- ✅ Создание заказов в БД + резервирование товаров
- ✅ Обновление статусов существующих заказов
- ✅ Автоматическое списание при статусе `delivering`
- ✅ Автоматический возврат при отмене

**Логика:**
```python
for seller in sellers:
    for integration in seller.api_keys:
        # Получить заказы за последние 24 часа
        orders = await connector.get_orders(date_from, date_to)
        
        for order in orders:
            if not exists:
                # Создать + зарезервировать
                create_order(order)
                reserve_inventory(order.items)
            else:
                # Обновить статус
                if new_status == "delivering" and old_status != "delivering":
                    deduct_inventory(order.items)
                elif new_status == "cancelled":
                    return_inventory(order.items)
```

#### 5.2 Синхронизация Остатков (`stock_scheduler.py`)

**Частота:** Каждые 15 минут

**Функционал:**
- ✅ Отправка актуальных остатков на все МП
- ✅ Только для складов с `sends_stock = true`
- ✅ Отправляется `available` (не `quantity`)

**Логика:**
```python
for warehouse in warehouses where sends_stock=true:
    for link in warehouse.links:
        products = get_products_with_stock(warehouse)
        
        for product in products:
            stock = inventory.available  # НЕ quantity!
            
            await connector.update_stock(
                link.marketplace_warehouse_id,
                product.article,
                stock
            )
```

---

### 6. Финансовая Аналитика (`business_analytics.py`)

**Функционал:**
- ✅ Расчет прибыли по товарам (Unit Economics)
- ✅ Общая финансовая статистика
- ✅ Интеграция с отчетами Ozon (Sales Report, Finance API)
- ✅ Учет комиссий, логистики, возвратов, налогов

**Формула расчета прибыли:**
```
Revenue = Sales - Returns
COGS = Purchase_Price × Quantity_Sold
Logistics = (включены в комиссию Ozon)
Commission = Ozon_Commission (из Sales Report)
Tax = (Revenue - Returns) × Tax_Rate (6% УСН)
Net_Profit = Revenue - COGS - Commission - Tax
```

**Источники данных:**
1. **Sales Report (Отчет о реализации)** - основной источник
   - Продажи, возвраты, комиссии
2. **Finance API** - дополнительные данные (НЕ для расчета!)
3. **Product Catalog** - себестоимость товаров

**API Endpoints:**
- `GET /api/business-analytics/economics` - Общая статистика
- `GET /api/business-analytics/products-economics` - По товарам
- `POST /api/business-analytics/sync-sales-report` - Синхронизация отчета

**Схема данных (`ozon_sales_reports`):**
```javascript
{
  "_id": ObjectId,
  "seller_id": String,
  "report_month": String,        // "2024-12"
  "data": {
    "sales": [...],
    "returns": [...],
    "summary": {
      "total_sales": Number,
      "total_returns": Number,
      "commission": Number
    }
  },
  "synced_at": DateTime
}
```

---

### 7. Аутентификация и Пользователи

**Система:** JWT (JSON Web Tokens)

**Роли:**
- `admin` - Администратор
- `seller` - Продавец

**Функционал:**
- ✅ Регистрация (`POST /api/auth/register`)
- ✅ Вход (`POST /api/auth/login`)
- ✅ JWT токены с временем жизни 24 часа
- ✅ Защита всех API endpoints через `Depends(get_current_user)`

**Схема пользователя (`users`):**
```javascript
{
  "_id": ObjectId,
  "email": String,
  "password": String,            // Bcrypt hash
  "full_name": String,
  "role": String,                // "admin" | "seller"
  "is_active": Boolean,
  "created_at": DateTime,
  "last_login_at": DateTime
}
```

**Профиль продавца (`seller_profiles`):**
```javascript
{
  "user_id": ObjectId,
  "company_name": String,
  "inn": String,
  "api_keys": [{
    "id": UUID,
    "marketplace": String,
    "client_id": String,
    "api_key": String,
    "name": String,
    "created_at": DateTime
  }]
}
```

---

## 🎨 UI/UX Design System

### Дизайн-философия
- **Минимализм:** Чистый, функциональный интерфейс без лишних элементов
- **Dark Theme:** Тёмная тема по умолчанию (modern aesthetic)
- **Neon Accents:** Яркие акценты для важных элементов
- **Mono Font:** Использование моноширинного шрифта для "tech" вида

### Цветовая палитра

**Базовые цвета:**
```css
--mm-dark: #0a0a0a        /* Фон */
--mm-darker: #030303       /* Модалки, карточки */
--mm-gray: #1a1a1a         /* Hover состояния */

--mm-cyan: #00f0ff         /* Основной акцент */
--mm-blue: #4d9eff         /* Вторичный акцент */
--mm-purple: #a855f7       /* Специальные элементы */

--mm-text: #f5f5f5         /* Основной текст */
--mm-text-secondary: #a3a3a3  /* Вторичный текст */
--mm-text-tertiary: #525252   /* Третичный текст */

--mm-border: #262626       /* Границы */
```

**Статусы:**
```css
--mm-green: #22c55e        /* Success */
--mm-red: #ef4444          /* Error */
--mm-yellow: #eab308       /* Warning */
```

### Компоненты (Shadcn/UI)

**Используемые компоненты:**
- `Button`, `Input`, `Select`, `Checkbox`, `Switch`
- `Dialog`, `Sheet`, `Popover`, `Tooltip`
- `Card`, `Table`, `Badge`, `Avatar`
- `Toast` (Sonner), `Alert`, `Skeleton`
- `Tabs`, `Accordion`, `Collapsible`
- `Command`, `Calendar`, `Form`

**Стилизация:**
- Все компоненты адаптированы под dark theme
- Neon borders на интерактивных элементах
- Hover эффекты с плавными переходами
- `data-testid` на всех ключевых элементах

### Ключевые классы

```css
.card-neon {
  background: var(--mm-darker);
  border: 1px solid var(--mm-cyan);
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.1);
}

.btn-neon {
  background: linear-gradient(135deg, var(--mm-cyan), var(--mm-blue));
  transition: all 0.3s ease;
}

.btn-neon:hover {
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
  transform: translateY(-2px);
}

.input-neon {
  background: var(--mm-darker);
  border: 1px solid var(--mm-border);
  color: var(--mm-text);
}

.input-neon:focus {
  border-color: var(--mm-cyan);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}
```

---

## 🔌 API Reference

### Authentication

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "company_name": "My Company",
  "inn": "1234567890"
}

Response 200:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {...}
}
```

### Products

```http
GET /api/products?page=1&limit=50&search=keyword
Authorization: Bearer {token}

Response 200:
{
  "products": [...],
  "total": 150,
  "page": 1,
  "pages": 3
}
```

### Orders (FBS)

```http
POST /api/orders/fbs/import
Authorization: Bearer {token}
Content-Type: application/json

{
  "integration_id": "uuid",
  "date_from": "2024-01-01",
  "date_to": "2024-01-31",
  "update_stock": true
}

Response 200:
{
  "message": "Загружено 50 новых заказов, пропущено 10 дубликатов",
  "imported": 50,
  "updated": 10,
  "skipped": 0,
  "stock_updated": 50
}
```

### Stock Synchronization

```http
POST /api/stock-sync/warehouse/{warehouse_id}/product/{product_id}
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "synced_to": ["ozon", "wildberries"],
  "stock_sent": 100
}
```

### Analytics

```http
GET /api/business-analytics/economics?month=2024-12
Authorization: Bearer {token}

Response 200:
{
  "period": "2024-12",
  "revenue": 1500000,
  "cogs": 800000,
  "commission": 200000,
  "tax": 30000,
  "net_profit": 470000,
  "roi": 58.75
}
```

---

## 🔄 Бизнес-процессы (Flows)

### Flow 1: Импорт товаров с маркетплейса

```
1. Пользователь добавляет интеграцию (Ozon API keys)
   └─> seller_profiles.api_keys.push({...})

2. Пользователь нажимает "Импорт товаров"
   └─> POST /api/products/import

3. Backend вызывает коннектор
   └─> connector = get_connector("ozon", client_id, api_key)
   └─> products = await connector.get_products()

4. Система сохраняет товары в БД
   └─> product_catalog.insert_many(products)

5. Система создает inventory записи
   └─> inventory.insert_many([{product_id, quantity: 0, available: 0, reserved: 0}])
```

### Flow 2: Обработка заказа FBS

```
1. Автосинхронизация получает новый заказ
   └─> order_sync_scheduler запускается каждые 5 мин
   └─> orders = await connector.get_fbs_orders(date_from, date_to)

2. Проверка на дубликаты
   └─> existing = find_one({external_order_id, seller_id})
   └─> if existing: skip

3. Создание заказа + резервирование
   └─> orders_fbs.insert_one({...})
   └─> inventory.update_many({
         $inc: {reserved: +qty, available: -qty}
       })

4. Обновление статуса → "delivering"
   └─> Триггер: connector обнаруживает изменение статуса
   └─> inventory.update_many({
         $inc: {quantity: -qty, reserved: -qty}
       })

5. Синхронизация остатков на МП
   └─> stock_scheduler отправляет новый available на все МП
```

### Flow 3: Синхронизация остатков

```
1. stock_scheduler запускается каждые 15 мин

2. Для каждого склада с sends_stock=true:
   └─> warehouse_links = find({warehouse_id})
   
3. Для каждой связи (link):
   └─> products = find_products_with_inventory()
   
4. Для каждого товара:
   └─> inventory = find_one({product_id})
   └─> stock = inventory.available  // НЕ quantity!
   
   └─> connector.update_stock(
         marketplace_warehouse_id,
         article,
         stock
       )
```

---

## 🚨 Критические Моменты

### 1. Резервирование vs Списание

**ВАЖНО:** Система использует двухэтапный процесс:

**Этап 1: Резервирование** (при создании заказа)
- Уменьшается `available` (нельзя продать)
- `quantity` остается без изменений (физически на складе)
- Увеличивается `reserved`

**Этап 2: Списание** (при отправке)
- Уменьшается `quantity` (физически ушел со склада)
- Уменьшается `reserved` (больше не зарезервирован)
- `available` остается без изменений (уже уменьшен)

### 2. Защита от Дубликатов

**Механизм:**
- Уникальный индекс на `(external_order_id + seller_id)`
- Дедупликация внутри батча от API
- Проверка существования перед созданием
- Обработка ошибки `E11000 duplicate key`

### 3. Финансовая Аналитика

**КРИТИЧНО:**
- НЕ использовать Finance API для расчета прибыли
- Использовать ТОЛЬКО Sales Report
- Логистика УЖЕ включена в комиссию Ozon
- Налог считается от чистой выручки (sales - returns)

### 4. Синхронизация Остатков

**КРИТИЧНО:**
- На МП отправляется `available`, НЕ `quantity`
- `available = quantity - reserved`
- Синхронизация только для складов с `sends_stock = true`

---

## 📈 Метрики и Производительность

### Ограничения API

**Ozon:**
- Rate limit: 1000 запросов/минуту
- Batch limit: 1000 товаров за раз

**Wildberries:**
- Rate limit: 100 запросов/минуту
- Batch limit: 1000 товаров за раз

**Yandex Market:**
- Rate limit: 100,000 запросов/час
- Batch limit: 50 заказов/страница

### Оптимизации

**Backend:**
- Async/await для всех IO операций
- Connection pooling для MongoDB
- Batch операции для массовых обновлений
- Кэширование API токенов

**Frontend:**
- Lazy loading компонентов
- Виртуализация больших списков (react-window)
- Debounce для поиска
- Optimistic UI updates

---

## 🔐 Безопасность

### Аутентификация
- JWT токены с временем жизни 24 часа
- Bcrypt для хэширования паролей (rounds=12)
- HTTPS only в production

### API Keys
- Хранение в MongoDB (зашифрованы в production)
- Передача через защищенные headers
- Никогда не логируются в открытом виде

### CORS
- Настроен для frontend домена
- Блокировка неавторизованных источников

---

## 🐛 Известные Проблемы и Решения

### Проблема: Дубликаты заказов
**Решено:** Уникальный индекс + трехуровневая защита

### Проблема: Неправильные даты заказов
**Решено:** Парсинг реальной даты из API МП

### Проблема: Двойной учет логистики
**Решено:** Логистика включена в комиссию Ozon, не добавляем отдельно

### Проблема: Неправильный расчет налога при возвратах
**Решено:** Налог = (sales - returns) × rate

---

## 📝 Соглашения о Коде

### Python (Backend)

**Naming:**
- `snake_case` для функций и переменных
- `PascalCase` для классов
- `UPPER_CASE` для констант

**Type hints:**
```python
async def get_orders(
    date_from: datetime,
    date_to: datetime,
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    ...
```

**Logging:**
```python
logger.info(f"[Component] ✅ Success message")
logger.warning(f"[Component] ⚠️ Warning message")
logger.error(f"[Component] ❌ Error message")
```

### JavaScript (Frontend)

**Naming:**
- `camelCase` для функций и переменных
- `PascalCase` для компонентов
- `UPPER_SNAKE_CASE` для констант

**Components:**
```javascript
// Named export для компонентов
export const ProductList = () => { ... }

// Default export для страниц
export default function ProductsPage() { ... }
```

**Data testid:**
```jsx
<button data-testid="submit-button">Submit</button>
<div data-testid="product-list">...</div>
```

---

## 🚀 Deployment

### Environment Variables

**Backend (.env):**
```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=minimalmod
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

**Frontend (.env):**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Supervisor Configuration

**Backend:**
```ini
[program:backend]
command=uvicorn server:app --host 0.0.0.0 --port 8001 --reload
directory=/app/backend
```

**Frontend:**
```ini
[program:frontend]
command=yarn dev --host 0.0.0.0 --port 3000
directory=/app/frontend
```

### Kubernetes Ingress

```
/api/*  → backend:8001
/*      → frontend:3000
```

---

## 📚 Дополнительные Ресурсы

### Документация API Маркетплейсов
- Ozon: https://docs.ozon.ru/api/seller/
- Wildberries: https://openapi.wildberries.ru/
- Yandex: https://yandex.ru/dev/market/partner-api/

### Внутренняя Документация
- `/app/design_guidelines.md` - UI/UX дизайн-система
- `/app/YANDEX_MARKET_INTEGRATION_COMPLETE.md` - Интеграция ЯМ
- `/app/ORDERS_FIX_REPORT.md` - Исправление дубликатов
- `/app/ИНСТРУКЦИЯ_ЗАКАЗЫ.md` - Инструкция по заказам

---

## 🎯 Roadmap (Будущие Улучшения)

### Краткосрочные (MVP расширение)
- [ ] Добавить поддержку Megamarket
- [ ] Реализовать batch обновление товаров
- [ ] Добавить экспорт отчетов в Excel
- [ ] Уведомления о новых заказах (WebSocket)

### Среднесрочные
- [ ] Мобильное приложение (React Native)
- [ ] Интеграция с 1C
- [ ] Автоматизация ценообразования
- [ ] ML прогнозирование продаж

### Долгосрочные
- [ ] Мультитенантность (SaaS)
- [ ] White-label решение
- [ ] API для сторонних разработчиков
- [ ] Интеграция с CRM системами

---

## 📊 Текущий Статус

**Версия:** 1.0.0  
**Последнее обновление:** 22.12.2024  
**Статус:** Production Ready ✅

**Реализованные модули:**
- ✅ Управление товарами
- ✅ Управление заказами (FBS, FBO, Retail)
- ✅ Складской учет
- ✅ Синхронизация остатков
- ✅ Финансовая аналитика
- ✅ Интеграции (Ozon, WB, Yandex)
- ✅ Автоматизация (планировщики)
- ✅ UI/UX дизайн-система

**Тестирование:**
- ✅ Backend endpoints проверены
- ✅ Интеграции с МП протестированы
- ✅ Автосинхронизация работает
- ✅ Защита от дубликатов активна

---

*Документация создана для передачи полного контекста проекта AI ассистенту.*
