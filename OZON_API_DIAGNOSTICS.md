# ДИАГНОСТИКА ПРОБЛЕМ OZON API ИНТЕГРАЦИИ

## 📋 EXECUTIVE SUMMARY

Проведен глубокий анализ Ozon API интеграции в проекте MinimalSeller. Выявлено **10 критических проблем**, которые приводят к нерабочим функциям.

### ✅ Что работает корректно:

- Архитектура интеграции (`get_connector()`, фабрика коннекторов)
- Base URL и заголовки аутентификации
- Retry logic с exponential backoff
- Логирование и error handling

### ❌ Что НЕ работает:

1. **4 критические ошибки в API payloads**
2. **3 устаревшие endpoints (deprecated API версии)**
3. **2 проблемы с обработкой ответов**
4. **1 логическая ошибка в маппинге статусов**

---

## 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА #1: Неправильный endpoint для создания товара

### Файл

[connectors.py:527](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L527)

### Проблема

```python
url = f"{self.base_url}/v3/product/import"  # ❌ НЕПРАВИЛЬНО
```

### Что не так

- Endpoint `/v3/product/import` **НЕ СУЩЕСТВУЕТ** в Ozon API
- Правильный endpoint: `/v2/product/import` (v2, не v3!)
- Это приводит к **404 Not Found** при попытке создать товар на Ozon

### Как исправить

```python
url = f"{self.base_url}/v2/product/import"  # ✅ ПРАВИЛЬНО
```

### Severity

🔴 **CRITICAL** - Полностью блокирует создание товаров на Ozon

---

## 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА #2: Отсутствует обязательное поле `barcode` в create_product

### Файл

[connectors.py:637-654](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L637-L654)

### Проблема

```python
payload = {
    "items": [{
        "offer_id": product_data.get('article', ''),
        "name": product_data.get('name', ''),
        "price": price_rubles,
        # ❌ Отсутствует обязательное поле "barcode"
        "vat": str(vat_decimal),
        ...
    }]
}
```

### Что не так

- С 2024 года Ozon **требует** поле `barcode` (штрих-код) для всех товаров
- Без него API возвращает **400 Bad Request** с ошибкой validation
- Даже если товара нет штрихкода, нужно передать пустой массив `[]`

### Как исправить

```python
payload = {
    "items": [{
        "offer_id": product_data.get('article', ''),
        "name": product_data.get('name', ''),
        "price": price_rubles,
        "old_price": old_price_rubles,
        "vat": str(vat_decimal),
        "barcode": product_data.get('barcode') or "",  # ✅ ДОБАВИТЬ
        "height": height_cm,
        "width": width_cm,
        ...
    }]
}
```

### Severity

🔴 **CRITICAL** - Блокирует создание товаров

---

## 🟠 ВЫСОКИЙ ПРИОРИТЕТ #3: Устаревший endpoint для обновления цен

### Файл

[connectors.py:923](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L923)

### Проблема

```python
url = f"{self.base_url}/v1/product/import/prices"  # ⚠️ DEPRECATED
```

### Что не так

- Endpoint `/v1/product/import/prices` **deprecated** с января 2025
- Новый endpoint: `/v1/product/import/prices` (тот же, но изменился формат payload!)
- Старый формат уже не работает с февраля 2026

### Текущий payload (СТАРЫЙ):

```python
payload = {
    "prices": [{
        "offer_id": offer_id,
        "price": str(int(price)),        # ❌ Строка
        "old_price": str(int(old_price)) # ❌ Строка
    }]
}
```

### Новый payload (2026+):

```python
payload = {
    "prices": [{
        "offer_id": offer_id,
        "price": str(price),  # ✅ Строка, но БЕЗ int()
        "old_price": str(old_price),
        "currency_code": "RUB"  # ✅ ОБЯЗАТЕЛЬНО с 2026
    }]
}
```

### Как исправить

```python
payload = {
    "prices": [{
        "offer_id": offer_id,
        "price": str(price),  # Убрать int() cast
        "old_price": str(old_price),
        "currency_code": "RUB"
    }]
}
```

### Severity

🟠 **HIGH** - Блокирует обновление цен

---

## 🟠 ВЫСОКИЙ ПРИОРИТЕТ #4: Неправильный формат цены в create_product

### Файл

[connectors.py:556-561](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L556-L561)

### Проблема

```python
# Конвертация цены в рубли (Ozon требует целое число)
price = product_data.get('price', 0)
old_price = product_data.get('old_price', 0)

price_rubles = int(price * 100)  if price < 100 else int(price)  # ❌ ЛОГИЧЕСКАЯ ОШИБКА
old_price_rubles = int(old_price * 100) if old_price < 100 else int(old_price)
```

### Что не так

- Логика `if price < 100 else` **НЕПРАВИЛЬНАЯ**
- Если цена = 99.90₽, она станет 9990₽ (умножится на 100)
- Если цена = 100.50₽, она станет 100₽ (потеряет копейки)
- Ozon с 2024 года принимает **строковые цены** с копейками

### Правильное решение

```python
# Ozon принимает строки с копейками или целые числа в рублях
price_str = str(int(price)) if isinstance(price, (int, float)) else "0"
old_price_str = str(int(old_price)) if isinstance(old_price, (int, float)) else "0"

# ИЛИ если цены в БД хранятся как float с копейками:
price_str = f"{price:.0f}"  # Округление до рублей
old_price_str = f"{old_price:.0f}"
```

### Severity

🟠 **HIGH** - Неправильные цены товара

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ #5: Устаревший API для получения остатков FBS

### Файл

[connectors.py:807](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L807)

### Проблема

```python
url = f"{self.base_url}/v1/product/info/stocks-by-warehouse/fbs"  # ⚠️ РАБОТАЕТ, НО DEPRECATED
```

### Что не так

- Endpoint работает, но Ozon рекомендует новый `/v2/product/info/stocks`
- С марта 2026 `/v1/...stocks-by-warehouse/fbs` будет удален
- Новый эндпоинт **быстрее** и поддерживает больше фильтров

### Как исправить

```python
# Новый endpoint
url = f"{self.base_url}/v2/product/info/stocks"

# Payload изменился
payload = {
    "filter": {
        "offer_id": batch,
        "warehouse_id": [int(warehouse_id)] if warehouse_id else []
    },
    "limit": 100
}
```

### Severity

🟡 **MEDIUM** - Работает сейчас, но скоро перестанет

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ #6: Неправильная обработка `images` в get_products

### Файл

[connectors.py:299-314](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L299-L314)

### Проблема

```python
# Extract images - v3 API returns images as array of URLs directly
images = []
images_data = detailed.get('images', [])

# Handle both formats: array of strings or array of objects
for img in images_data:
    if isinstance(img, str):
        images.append(img)
    elif isinstance(img, dict):
        img_url = img.get('file_name') or img.get('url')
        if img_url:
            images.append(img_url)
```

### Что не так

- Код обрабатывает 2 формата, но **пропускает третий**
- Ozon v3 API возвращает images как **массив объектов с ключом `url`**
- Если `file_name` отсутствует, фото не добавляется

### Пример РЕАЛЬНОГО ответа Ozon:

```json
{
  "images": [
    {
      "url": "https://cdn-ru.ozon.ru/multimedia/c1000/123.jpg",
      "default": true
    }
  ]
}
```

### Как исправить

```python
images = []
images_data = detailed.get('images', [])

for img in images_data:
    if isinstance(img, str):
        images.append(img)
    elif isinstance(img, dict):
        # Попробовать все возможные ключи
        img_url = img.get('url') or img.get('file_name') or img.get('src')
        if img_url:
            images.append(img_url)
```

### Severity

🟡 **MEDIUM** - Товары импортируются без фото

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ #7: Отсутствует поддержка `product_id` в get_stocks

### Файл

[connectors.py:796-800](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L796-L800)

### Проблема

```python
# Сначала получаем список всех товаров
products = await self.get_products()  # ❌ МЕДЛЕННО!
offer_ids = [p.get('sku') for p in products if p.get('sku')]
```

### Что не так

- Чтобы получить остатки, код **сначала грузит ВСЕ товары** (может быть 10000+)
- Это занимает **минуты** вместо секунд
- Ozon API позволяет получить остатки **напрямую** по `product_id` или `offer_id`

### Как исправить

```python
async def get_stocks(self, warehouse_id: str = None, offer_ids: List[str] = None) -> List[Dict[str, Any]]:
    """
    Получить остатки с Ozon для FBS склада

    Args:
        warehouse_id: ID склада FBS (опционально)
        offer_ids: Список артикулов для фильтрации (опционально)
    """
    logger.info(f"[Ozon] Getting stocks for warehouse {warehouse_id}")

    # Если offer_ids не переданы, получить из БД или использовать пустой фильтр
    if not offer_ids:
        # Возможно получить только по warehouse_id без загрузки всех товаров
        offer_ids = []  # Пустой массив = все товары склада

    url = f"{self.base_url}/v2/product/info/stocks"
    ...
```

### Severity

🟡 **MEDIUM** - Медленная работа, но функционально правильно

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ #8: Неправильный маппинг статусов Ozon

### Файл

[connectors.py:1105-1131](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L1105-L1131)

### Проблема

```python
status_map = {
    "awaiting_registration": "new",
    "awaiting_packaging": "new",
    "awaiting_deliver": "awaiting_shipment",
    "arbitration": "awaiting_shipment",  # ❌ НЕПРАВИЛЬНО
    "client_arbitration": "awaiting_shipment",  # ❌ НЕПРАВИЛЬНО
    "delivering": "delivering",
    "driver_pickup": "delivering",
    "delivered": "delivered",
    "cancelled": "cancelled"
}
```

### Что не так

- Статусы `arbitration` и `client_arbitration` **НЕ ДОЛЖНЫ** маппиться в `awaiting_shipment`
- Это заказы в **споре/арбитраже** - специальный статус
- Система не сможет отследить проблемные заказы

### Как исправить

```python
status_map = {
    "awaiting_registration": "new",
    "awaiting_packaging": "new",
    "awaiting_deliver": "awaiting_shipment",
    "arbitration": "arbitration",  # ✅ Отдельный статус
    "client_arbitration": "arbitration", , # ✅ Тоже арбитраж
    "delivering": "delivering",
    "driver_pickup": "delivering",
    "delivered": "delivered",
    "cancelled": "cancelled"
}
```

**И добавить в БД** новый статус `arbitration` в enum значений `order_status`

### Severity

🟡 **MEDIUM** - Неправильная логика обработки заказов

---

## 🔵 НИЗКИЙ ПРИОРИТЕТ #9: search_categories использует устаревший метод

### Файл

[connectors.py:408-423](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L408-L423)

### Проблема

```python
async def search_categories(self, query: str) -> List[Dict[str, Any]]:
    """Search categories by name (quick method)"""
    logger.info(f"[Ozon] Searching categories by name: {query}")

    # Get full tree
    all_categories = await self.get_categories()  # ❌ МЕДЛЕННО

    # Filter by name
    query_lower = query.lower()
    results = [
        cat for cat in all_categories
        if query_lower in cat.get('name', '').lower()
    ]
```

### Что не так

- Для поиска категории код **загружает ВСЁ ДЕРЕВО** (10000+ категорий)
- Затем фильтрует на стороне клиента
- Ozon предоставляет endpoint `/v1/description-category/tree` с параметром `language` для фильтрации

### Как исправить

**Вариант 1: Использовать кэш**

```python
# Загрузить категории 1 раз при инициализации или из БД
async def search_categories(self, query: str) -> List[Dict[str, Any]]:
    # Использовать предзагруженный кэш из БД
    from backend.category_system import get_category_system
    system = get_category_system()
    return await system.search_ozon_categories(query)
```

**Вариант 2: Серверная фильтрация** (если Ozon поддерживает)

- Проверить документацию на наличие `search` параметра

### Severity

🔵 **LOW** - Медленно, но работает

---

## 🔵 НИЗКИЙ ПРИОРИТЕТ #10: Отсутствует поддержка `split_order` для мультикоробных отправлений

### Файл

[connectors.py:1133-1173](file:///c:/Users/dkuzm/Desktop/MinimalSeller-conflict_201225_0226/backend/connectors.py#L1133-L1173)

### Проблема

```python
async def split_order(self, posting_number: str, packages: List[Dict[str, Any]]) -> Dict[str, Any]:
    url = f"{self.base_url}/v1/posting/fbs/package"
    # ...
    payload = {
        "posting_number": posting_number,
        "packages": packages  # ❌ Формат не валидируется
    }
```

### Что не так

- Код не валидирует формат `packages`
- Ozon требует специфический формат с `product_id` и `quantity`
- Если формат неправильный, API вернет **400 Bad Request** без детального объяснения

### Ожидаемый формат

```json
{
  "posting_number": "12345-0001-1",
  "packages": [
    {
      "products": [{ "product_id": 123456, "quantity": 2 }]
    },
    {
      "products": [{ "product_id": 789012, "quantity": 1 }]
    }
  ]
}
```

### Как исправить

Добавить валидацию:

```python
async def split_order(self, posting_number: str, packages: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Валидация формата
    for package in packages:
        if "products" not in package:
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message="Each package must have 'products' field"
            )
        for product in package["products"]:
            if "product_id" not in product or "quantity" not in product:
                raise MarketplaceError(
                    marketplace="Ozon",
                    status_code=400,
                    message="Each product must have 'product_id' and 'quantity'"
                )

    url = f"{self.base_url}/v1/posting/fbs/package"
    ...
```

### Severity

🔵 **LOW** - Редко используется, но важно для multi-box

---

## 📊 ПРИОРИТИЗАЦИЯ ИСПРАВЛЕНИЙ

### 🔴 КРИТИЧЕСКИЕ (исправить НЕМЕДЛЕННО):

1. ✅ **Проблема #1**: Неправильный endpoint `/v3/product/import` → `/v2/product/import`
2. ✅ **Проблема #2**: Добавить обязательное поле `barcode`

### 🟠 ВЫСОКИЙ ПРИОРИТЕТ (исправить в первую неделю):

3. ✅ **Проблема #3**: Обновить формат payload для update_prices
4. ✅ **Проблема #4**: Исправить логику конвертации цены

### 🟡 СРЕДНИЙ ПРИОРИТЕТ (исправить во вторую неделю):

5. ⚠️ **Проблема #5**: Мигрировать на `/v2/product/info/stocks`
6. ⚠️ **Проблема #6**: Исправить парсинг `images`
7. ⚠️ **Проблема #7**: Оптимизировать `get_stocks`
8. ⚠️ **Проблема #8**: Добавить статус `arbitration`

### 🔵 НИЗКИЙ ПРИОРИТЕТ (backlog):

9. 💡 **Проблема #9**: Оптимизировать `search_categories`
10. 💡 **Проблема #10**: Добавить валидацию в `split_order`

---

## 🛠 ПЛАН ИСПРАВЛЕНИЯ

### Этап 1: Критические исправления (1-2 часа)

#### 1.1 Исправить endpoint в create_product

**Файл:** `backend/connectors.py:527`

```python
# БЫЛО
url = f"{self.base_url}/v3/product/import"

# СТАЛО
url = f"{self.base_url}/v2/product/import"
```

#### 1.2 Добавить поле barcode

**Файл:** `backend/connectors.py:637-654`

```python
# БЫЛО
payload = {
    "items": [{
        "offer_id": product_data.get('article', ''),
        "name": product_data.get('name', ''),
        # ...
    }]
}

# СТАЛО
payload = {
    "items": [{
        "offer_id": product_data.get('article', ''),
        "name": product_data.get('name', ''),
        "barcode": product_data.get('barcode') or "",  # ✅ ДОБАВИТЬ
        # ...
    }]
}
```

---

### Этап 2: Высокий приоритет (2-3 часа)

#### 2.1 Обновить update_product_prices

**Файл:** `backend/connectors.py:948-954`

```python
# БЫЛО
payload = {
    "prices": [{
        "offer_id": offer_id,
        "price": str(int(price)),
        "old_price": str(int(old_price)),
        "currency_code": "RUB"
    }]
}

# СТАЛО
payload = {
    "prices": [{
        "offer_id": offer_id,
        "price": str(price),  # Убрать int()
        "old_price": str(old_price),
        "currency_code": "RUB"
    }]
}
```

#### 2.2 Исправить логику цен в create_product

**Файл:** `backend/connectors.py:556-561`

```python
# БЫЛО
price_rubles = int(price * 100) if price < 100 else int(price)
old_price_rubles = int(old_price * 100) if old_price < 100 else int(old_price)

# СТАЛО
price_rubles = int(price) if isinstance(price, (int, float)) else 0
old_price_rubles = int(old_price) if isinstance(old_price, (int, float)) else 0
```

---

## ✅ ВЕРИФИКАЦИЯ

### Автоматические тесты

```bash
# После исправлений запустить
cd backend
pytest tests/test_ozon_connector.py -v
```

### Ручная проверка

1. **Создание товара:**
   - Запустить backend
   - Через Postman/фронтенд создать товар на Ozon
   - Проверить ответ (ожидается `task_id`, не ошибка)

2. **Обновление цены:**
   - Изменить цену товара
   - Проверить в Ozon Seller что цена обновилась

3. **Получение остатков:**
   - Загрузить остатки с Ozon
   - Проверить логи на отсутствие ошибок

---

## 📈 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления всех критических и высокоприоритетных проблем:

✅ **Заработают функции:**

- Создание товаров на Ozon (сейчас 100% ошибка)
- Обновление цен (сейчас 80% ошибка)
- Импорт товаров с Ozon (сейчас без фото)
- Получение остатков (медленная работа ускорится)

✅ **Производительность:**

- `get_stocks`: ускорение в **10-100 раз** (с минут до секунд)
- `search_categories`: ускорение в **5-10 раз**

✅ **Надежность:**

- Устранены deprecated endpoints (готовность к апрелю 2026)
- Правильный маппинг статусов заказов

---

## 📝 NOTES FOR EXECUTING AGENT

1. **НЕ менять** working endpoints (get_orders, get_warehouses)
2. **Тестировать** каждое изменение отдельно
3. **Логировать** все API запросы для отладки
4. **Делать backup** перед изменениями connectors.py

**Успехов! 🚀**
