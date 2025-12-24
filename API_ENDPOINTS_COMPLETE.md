# 🔌 API Endpoints - Полный Справочник

## Base URL: `/api`

**Аутентификация:** Все endpoints (кроме auth) требуют JWT токен в заголовке:
```
Authorization: Bearer {token}
```

---

## 🔐 Authentication

### POST /auth/register
Регистрация нового пользователя

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Иван Иванов",
  "company_name": "ООО Компания",
  "inn": "1234567890"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "role": "seller"
  }
}
```

### POST /auth/login
Вход в систему

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

---

## 📦 Products

### GET /products
Список товаров

**Query Parameters:**
- `page` (int, default: 1)
- `limit` (int, default: 50)
- `search` (string) - поиск по названию/артикулу
- `category` (string) - фильтр по категории

**Response 200:**
```json
{
  "products": [...],
  "total": 150,
  "page": 1,
  "pages": 3
}
```

### POST /products/import
Импорт товаров с маркетплейса

**Body:**
```json
{
  "integration_id": "uuid",
  "marketplace": "ozon"
}
```

### PUT /products/{product_id}
Обновить товар

**Body:**
```json
{
  "name": "Новое название",
  "purchase_price": 500,
  "category": "Категория 1"
}
```

---

## 🛒 Orders - FBS

### GET /orders/fbs
Список FBS заказов

**Query Parameters:**
- `marketplace` - фильтр по МП
- `status` - фильтр по статусу
- `date_from` - дата от (ISO)
- `date_to` - дата до (ISO)

**Response 200:**
```json
[
  {
    "id": "...",
    "order_number": "48036500-0150-2",
    "marketplace": "ozon",
    "status": "delivering",
    "created_at": "2024-12-15T10:30:00",
    "customer": {...},
    "items": [...],
    "totals": {...}
  }
]
```

### POST /orders/fbs/import
Ручной импорт FBS заказов

**Body:**
```json
{
  "integration_id": "uuid",
  "date_from": "2024-12-01",
  "date_to": "2024-12-31",
  "update_stock": true
}
```

**Response 200:**
```json
{
  "message": "Загружено 50 новых заказов, пропущено 10 дубликатов",
  "imported": 50,
  "updated": 10,
  "skipped": 0,
  "stock_updated": 50
}
```

### PUT /orders/fbs/{order_id}/status
Изменить статус заказа

**Body:**
```json
{
  "status": "delivering",
  "comment": "Передано в СДЭК"
}
```

### POST /orders/fbs/{order_id}/split
Разделить заказ на несколько коробов (Ozon only)

**Body:**
```json
{
  "boxes": [
    {
      "box_number": 1,
      "items": [
        {"article": "ART-001", "quantity": 2}
      ]
    },
    {
      "box_number": 2,
      "items": [
        {"article": "ART-002", "quantity": 1}
      ]
    }
  ]
}
```

### GET /orders/fbs/{order_id}/label
Получить этикетку для заказа

**Response 200:**
```json
{
  "label_url": "https://cdn-ru.ozon.ru/...",
  "cached": false
}
```

### POST /orders/fbs/refresh-statuses
Обновить статусы заказов с МП

**Body:**
```json
{
  "integration_id": "uuid"  // Опционально
}
```

---

## 📦 Orders - FBO

### GET /orders/fbo
Список FBO заказов

**Query Parameters:** Аналогично FBS

### POST /orders/fbo/import
Импорт FBO заказов (только аналитика)

**Body:**
```json
{
  "integration_id": "uuid",
  "date_from": "2024-12-01",
  "date_to": "2024-12-31"
}
```

---

## 🏭 Warehouses

### GET /warehouses
Список складов

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name": "Основной склад",
    "address": "Москва, ул. Ленина, 1",
    "priority": 1,
    "use_for_orders": true,
    "sends_stock": true,
    "return_on_cancel": true
  }
]
```

### POST /warehouses
Создать склад

**Body:**
```json
{
  "name": "Новый склад",
  "address": "Адрес",
  "priority": 2,
  "use_for_orders": true,
  "sends_stock": true,
  "return_on_cancel": true
}
```

---

## 🔗 Warehouse Links

### GET /warehouse-links/{warehouse_id}/links
Получить связи склада

**Response 200:**
```json
[
  {
    "id": "uuid",
    "warehouse_id": "uuid",
    "marketplace_name": "ozon",
    "marketplace_warehouse_id": "123456",
    "marketplace_warehouse_name": "Склад Ozon FBS"
  }
]
```

### POST /warehouse-links/{warehouse_id}/links
Создать связь

**Body:**
```json
{
  "integration_id": "uuid",
  "marketplace_name": "ozon",
  "marketplace_warehouse_id": "123456",
  "marketplace_warehouse_name": "Склад Ozon FBS"
}
```

---

## 📊 Business Analytics

### GET /business-analytics/economics
Общая финансовая статистика

**Query Parameters:**
- `month` - месяц в формате "YYYY-MM"

**Response 200:**
```json
{
  "period": "2024-12",
  "revenue": 1500000,
  "returns_amount": 50000,
  "net_revenue": 1450000,
  "cogs": 800000,
  "commission": 200000,
  "logistics": 0,
  "tax": 87000,
  "net_profit": 363000,
  "margin": 25.0,
  "roi": 45.4
}
```

### GET /business-analytics/products-economics
Прибыль по товарам

**Query Parameters:**
- `month` - месяц

**Response 200:**
```json
[
  {
    "article": "ART-001",
    "name": "Товар 1",
    "quantity_sold": 100,
    "quantity_returned": 5,
    "revenue": 50000,
    "cogs": 20000,
    "commission": 10000,
    "tax": 2400,
    "net_profit": 17600,
    "margin": 35.2
  }
]
```

### POST /business-analytics/sync-sales-report
Синхронизация отчета о реализации Ozon

**Body:**
```json
{
  "month": "2024-12"
}
```

---

## 🔄 Stock Synchronization

### POST /stock-sync/warehouse/{warehouse_id}/product/{product_id}
Синхронизировать остатки одного товара

**Response 200:**
```json
{
  "success": true,
  "synced_to": ["ozon", "wildberries"],
  "stock_sent": 100,
  "errors": []
}
```

### POST /stock-sync/warehouse/{warehouse_id}/bulk
Массовая синхронизация

**Body:**
```json
{
  "product_ids": ["id1", "id2", "id3"]
}
```

---

## 🏪 Marketplace Warehouses

### GET /marketplace/{marketplace}/warehouses
Получить склады с маркетплейса

**Path Parameters:**
- `marketplace`: "ozon" | "wb" | "yandex"

**Response 200:**
```json
{
  "marketplace": "ozon",
  "warehouses": [
    {
      "id": "123456",
      "name": "Склад FBS Москва",
      "type": "FBS",
      "is_fbs": true,
      "address": "Москва"
    }
  ]
}
```

---

## 🔧 Integrations

### GET /seller/api-keys
Получить список интеграций

**Response 200:**
```json
[
  {
    "id": "uuid",
    "marketplace": "ozon",
    "client_id": "123456",
    "name": "Ozon Main",
    "created_at": "2024-12-01T10:00:00"
  }
]
```

### POST /seller/api-keys
Добавить интеграцию

**Body:**
```json
{
  "marketplace": "ozon",
  "client_id": "123456",
  "api_key": "secret-key",
  "name": "Ozon Main"
}
```

### DELETE /seller/api-keys/{integration_id}
Удалить интеграцию

---

## 📈 Analytics Routes

### GET /analytics/dashboard
Общая статистика дашборда

### GET /analytics/sales-by-marketplace
Продажи по маркетплейсам

### GET /analytics/top-products
Топ товаров по прибыли

---

## 🔍 Search & Filters

### GET /products/search
Поиск товаров

**Query:**
- `q` - поисковый запрос
- `category` - категория
- `min_price`, `max_price` - диапазон цен

---

## 📊 Коды статусов

**Success:**
- `200 OK` - Успешный запрос
- `201 Created` - Ресурс создан

**Client Errors:**
- `400 Bad Request` - Неверные параметры
- `401 Unauthorized` - Нет токена или токен невалиден
- `403 Forbidden` - Нет прав доступа
- `404 Not Found` - Ресурс не найден

**Server Errors:**
- `500 Internal Server Error` - Ошибка сервера
- `503 Service Unavailable` - Сервис недоступен

---

*API Reference для MinimalMod Hub*
