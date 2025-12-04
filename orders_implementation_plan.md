# 📦 СИСТЕМА УПРАВЛЕНИЯ ЗАКАЗАМИ - ПЛАН РЕАЛИЗАЦИИ

**Дата начала:** 20.01.2025
**Статус:** 🚀 В РАБОТЕ  
**Архитектура:** FastAPI (Python) + React + MongoDB

---

## 🎯 ЦЕЛЬ

Реализовать полную автоматизацию работы с заказами со всех маркетплейсов:
1. **FBS** - заказы со своего склада (с резервами и автосписанием)
2. **FBO** - заказы со складов МП (только аналитика, без влияния на inventory)
3. **Retail** - розничные заказы (ручное создание с выбором склада)

---

## 📋 ФАЗЫ РАЗРАБОТКИ

### 🔄 ФАЗА 1: МОДЕЛИ И БАЗА ДАННЫХ
**Статус:** ⏳ Pending  
**Время:** 30 минут

**Задачи:**
- [ ] Обновить `/app/backend/models.py`:
  - [ ] OrderFBS (заказ со своего склада)
  - [ ] OrderFBO (заказ со склада МП)
  - [ ] OrderRetail (розничный заказ)
  - [ ] OrderItem (товар в заказе)
  - [ ] OrderStatusHistory (история статусов)
- [ ] Добавить настройку `return_on_cancel` в Warehouse model
- [ ] Создать коллекции в MongoDB:
  - [ ] `orders_fbs`
  - [ ] `orders_fbo`
  - [ ] `orders_retail`

**Ключевые поля:**
```python
OrderFBS:
  - marketplace: str (ozon/wb/yandex)
  - external_order_id: str
  - status: str (new, awaiting_shipment, delivering, delivered, cancelled)
  - warehouse_id: str (use_for_orders=True)
  - items: List[OrderItem]
  - reserve_status: str (reserved, deducted, returned)

OrderFBO:
  - marketplace: str
  - external_order_id: str
  - status: str
  - warehouse_name: str (название склада МП)
  - items: List[OrderItem]
  - # НЕТ влияния на inventory!

OrderRetail:
  - source: str ("retail")
  - warehouse_id: str (выбор вручную)
  - customer: dict
  - items: List[OrderItem]
  - reserve_status: str
```

---

### 🔄 ФАЗА 2: КОННЕКТОРЫ МАРКЕТПЛЕЙСОВ
**Статус:** ⏳ Pending  
**Время:** 1 час

**Задачи:**
- [ ] Обновить `/app/backend/connectors.py`:
  - [ ] **OzonConnector:**
    - [ ] `get_fbs_orders(date_from, date_to)` → /v3/posting/fbs/list
    - [ ] `get_fbo_orders(date_from, date_to)` → /v3/posting/fbo/list
    - [ ] `get_order_status(posting_number)` → /v3/posting/fbs/get
  - [ ] **WildberriesConnector:**
    - [ ] `get_orders(date_from, date_to)` → /api/v3/orders/new
    - [ ] `get_order_status(order_id)` → /api/v3/orders/status
  - [ ] **YandexMarketConnector:**
    - [ ] `get_orders(date_from, date_to)` → /campaigns/{id}/orders
    - [ ] `get_order_status(order_id)` → /campaigns/{id}/orders/{order_id}

**Маппинг статусов:**
```python
# Ozon
"awaiting_packaging" → "new"
"awaiting_deliver" → "awaiting_shipment"
"delivering" → "delivering"  # ← СПИСАНИЕ!
"delivered" → "delivered"
"cancelled" → "cancelled"  # ← ВОЗВРАТ (если return_on_cancel)

# Wildberries
"new" → "new"
"confirm" → "awaiting_shipment"
"complete" → "delivering"  # ← СПИСАНИЕ!
"cancel" → "cancelled"

# Yandex
"PROCESSING" → "new"
"DELIVERY" → "delivering"  # ← СПИСАНИЕ!
"DELIVERED" → "delivered"
"CANCELLED" → "cancelled"
```

---

### 🔄 ФАЗА 3: BACKEND API ROUTES
**Статус:** ⏳ Pending  
**Время:** 1.5 часа

**Задачи:**
- [ ] Создать `/app/backend/fbs_orders_routes.py`:
  - [ ] `GET /api/orders/fbs` - список FBS заказов
  - [ ] `POST /api/orders/fbs/sync` - ручная синхронизация
  - [ ] `GET /api/orders/fbs/{id}` - детали заказа
  - [ ] `PUT /api/orders/fbs/{id}/status` - обновление статуса
  
- [ ] Создать `/app/backend/fbo_orders_routes.py`:
  - [ ] `GET /api/orders/fbo` - список FBO заказов (read-only)
  - [ ] `POST /api/orders/fbo/sync` - синхронизация с МП
  - [ ] `GET /api/orders/fbo/{id}` - детали заказа
  
- [ ] Создать `/app/backend/retail_orders_routes.py`:
  - [ ] `GET /api/orders/retail` - список розничных заказов
  - [ ] `POST /api/orders/retail` - создать заказ
  - [ ] `GET /api/orders/retail/{id}` - детали заказа
  - [ ] `PUT /api/orders/retail/{id}/status` - обновление статуса
  - [ ] `DELETE /api/orders/retail/{id}` - отменить заказ

**Логика резервов (FBS и Retail):**
```python
def create_order(items, warehouse_id):
    # 1. Проверить доступность
    for item in items:
        inventory = find_inventory(item.sku)
        if inventory.available < item.quantity:
            raise HTTPException(400, "Недостаточно остатка")
    
    # 2. Зарезервировать
    for item in items:
        inventory.reserved += item.quantity
        inventory.available -= item.quantity
        # quantity БЕЗ изменений!
    
    # 3. Создать заказ
    order = OrderFBS(reserve_status="reserved", ...)
    return order

def update_order_status(order_id, new_status):
    order = find_order(order_id)
    
    if new_status == "delivering":
        # СПИСАНИЕ
        for item in order.items:
            inventory = find_inventory(item.sku)
            inventory.quantity -= item.quantity
            inventory.reserved -= item.quantity
            # available БЕЗ изменений (уже уменьшен при резерве)
        
        order.reserve_status = "deducted"
        
        # Синхронизировать остатки на МП
        sync_stocks_to_marketplaces(order.items)
    
    elif new_status == "cancelled":
        warehouse = find_warehouse(order.warehouse_id)
        
        if warehouse.return_on_cancel:
            # ВОЗВРАТ
            for item in order.items:
                inventory = find_inventory(item.sku)
                inventory.reserved -= item.quantity
                inventory.available += item.quantity
            
            order.reserve_status = "returned"
            
            # Синхронизировать остатки на МП
            sync_stocks_to_marketplaces(order.items)
```

---

### 🔄 ФАЗА 4: ФОНОВАЯ СИНХРОНИЗАЦИЯ
**Статус:** ⏳ Pending  
**Время:** 45 минут

**Задачи:**
- [ ] Создать `/app/backend/order_sync_scheduler.py`:
  - [ ] Класс OrderSyncScheduler
  - [ ] Метод sync_all_marketplaces()
  - [ ] Метод sync_ozon_orders()
  - [ ] Метод sync_wb_orders()
  - [ ] Метод sync_yandex_orders()
  - [ ] Метод update_order_statuses()
  
- [ ] Интегрировать в `/app/backend/server.py`:
  - [ ] @app.on_event("startup") → запустить планировщик
  - [ ] Использовать APScheduler (каждые 5 минут)

**Логика синхронизации:**
```python
async def sync_all_marketplaces():
    """Вызывается каждые 5 минут"""
    
    # Получить всех продавцов с API ключами
    sellers = await db.seller_profiles.find({
        "api_keys": {"$exists": True, "$ne": []}
    }).to_list(None)
    
    for seller in sellers:
        for api_key in seller["api_keys"]:
            marketplace = api_key["marketplace"]
            
            # Получить заказы за последние 24 часа
            date_from = datetime.utcnow() - timedelta(days=1)
            date_to = datetime.utcnow()
            
            # FBS заказы
            fbs_orders = await connector.get_fbs_orders(date_from, date_to)
            for order_data in fbs_orders:
                existing = await db.orders_fbs.find_one({
                    "external_order_id": order_data["external_id"],
                    "seller_id": seller["user_id"]
                })
                
                if not existing:
                    # Создать новый заказ + зарезервировать
                    await create_fbs_order(seller["user_id"], order_data)
                    # 🔔 Уведомление: "Новый заказ"
                else:
                    # Обновить статус
                    await update_order_status_from_mp(existing, order_data)
            
            # FBO заказы (только чтение)
            fbo_orders = await connector.get_fbo_orders(date_from, date_to)
            for order_data in fbo_orders:
                await upsert_fbo_order(seller["user_id"], order_data)
```

---

### 🔄 ФАЗА 5: FRONTEND UI
**Статус:** ⏳ Pending  
**Время:** 2 часа

**Задачи:**
- [ ] Обновить `/app/frontend/src/pages/OrdersPage.jsx`:
  - [ ] Добавить табы: FBS / FBO / Retail
  - [ ] Состояние activeTab
  - [ ] Условный рендер компонентов
  
- [ ] Создать `/app/frontend/src/components/orders/FBSOrdersList.jsx`:
  - [ ] Таблица заказов FBS
  - [ ] Колонки: №, Дата, МП, Товары, Сумма, Статус, Резерв
  - [ ] Фильтры: дата, статус, МП
  - [ ] Кнопка "Синхронизировать"
  
- [ ] Создать `/app/frontend/src/components/orders/FBOOrdersList.jsx`:
  - [ ] Таблица заказов FBO (read-only)
  - [ ] Колонки: №, Дата, МП, Склад МП, Товары, Сумма, Статус
  - [ ] Фильтры: дата, МП
  - [ ] Кнопка "Синхронизировать"
  
- [ ] Создать `/app/frontend/src/components/orders/RetailOrderForm.jsx`:
  - [ ] Форма создания розничного заказа
  - [ ] Выбор склада (dropdown)
  - [ ] Поиск товаров
  - [ ] Добавление в корзину
  - [ ] Данные клиента
  - [ ] Кнопка "Создать заказ"
  
- [ ] Создать `/app/frontend/src/components/orders/RetailOrdersList.jsx`:
  - [ ] Таблица розничных заказов
  - [ ] Кнопка "Создать заказ" → открывает форму

**Примерный UI:**
```jsx
<OrdersPage>
  <Tabs>
    <Tab label="FBS (со своего склада)">
      <FBSOrdersList />
    </Tab>
    <Tab label="FBO (со склада МП)">
      <FBOOrdersList />
    </Tab>
    <Tab label="Розничные заказы">
      <RetailOrdersList />
      <RetailOrderForm />
    </Tab>
  </Tabs>
</OrdersPage>
```

---

### 🔄 ФАЗА 6: УВЕДОМЛЕНИЯ
**Статус:** ⏳ Pending  
**Время:** 30 минут

**Задачи:**
- [ ] Backend: функция `send_notification(type, order)`:
  - [ ] При создании FBS заказа → "🆕 Новый заказ от {marketplace}"
  - [ ] При доставке → "✅ Заказ {order_number} доставлен"
  - [ ] При отмене → "❌ Заказ {order_number} отменён"
  
- [ ] Frontend: toast уведомления (уже есть sonner)
  - [ ] Подключить WebSocket или polling для real-time
  - [ ] Показать toast с деталями заказа

---

### 🔄 ФАЗА 7: НАСТРОЙКИ СКЛАДОВ
**Статус:** ⏳ Pending  
**Время:** 15 минут

**Задачи:**
- [ ] Обновить `/app/frontend/src/pages/WarehousesPageV2.jsx`:
  - [ ] Добавить чекбокс "Возвращать остаток при отмене заказа"
  - [ ] Привязать к полю `return_on_cancel`
  
- [ ] Обновить `/app/backend/warehouse_routes.py`:
  - [ ] Обработка поля `return_on_cancel` в PUT запросе

---

## 🔑 КЛЮЧЕВЫЕ КОНЦЕПЦИИ

### Логика резервов
```
┌─────────────────┐
│  СОЗДАНИЕ ЗАКАЗА │
│  (FBS / Retail)  │
└────────┬─────────┘
         │
         ▼
  reserved += N
  available -= N
  quantity = quantity  (БЕЗ изменений)
  
┌─────────────────┐
│ СТАТУС =        │
│ "delivering"    │
└────────┬─────────┘
         │
         ▼
  quantity -= N
  reserved -= N
  available = available  (БЕЗ изменений, уже уменьшен)
  → Отправка остатка на МП
  
┌─────────────────┐
│ ОТМЕНА ЗАКАЗА   │
│ (если настройка)│
└────────┬─────────┘
         │
         ▼
  reserved -= N
  available += N
  quantity = quantity  (БЕЗ изменений)
  → Отправка остатка на МП
```

### Типы заказов

| Тип | Склад | Резервы | Влияние на inventory | Автосинхронизация |
|-----|-------|---------|---------------------|------------------|
| **FBS** | use_for_orders=true | ✅ Да | ✅ Полное (reserved → deducted) | ✅ Каждые 5 мин |
| **FBO** | Склад МП | ❌ Нет | ❌ Нет (отдельная таблица) | ✅ Каждые 5 мин |
| **Retail** | Выбор вручную | ✅ Да | ✅ Полное (reserved → deducted) | ❌ Нет |

### Статусы заказов

```
FBS/Retail:
  new → awaiting_shipment → delivering → delivered
                              │
                              └─→ cancelled

FBO (read-only):
  Статусы только для отображения
```

### Синхронизация
- **Частота:** каждые 5 минут
- **Источники:** API Ozon, Wildberries, Yandex Market
- **Процесс:**
  1. Получить новые заказы (за последние 24 часа)
  2. Создать в БД + зарезервировать товары
  3. Обновить статусы существующих заказов
  4. При статусе "delivering" → списать со склада
  5. Отправить обновлённые остатки на МП
  6. Уведомить пользователя

---

## 📊 ПРОГРЕСС

- **ФАЗА 1:** ⏳ 0% - Модели и БД
- **ФАЗА 2:** ⏳ 0% - Коннекторы МП
- **ФАЗА 3:** ⏳ 0% - Backend Routes
- **ФАЗА 4:** ⏳ 0% - Фоновая синхронизация
- **ФАЗА 5:** ⏳ 0% - Frontend UI
- **ФАЗА 6:** ⏳ 0% - Уведомления
- **ФАЗА 7:** ⏳ 0% - Настройки складов

**ОБЩИЙ ПРОГРЕСС: 0% (0/7 фаз)**

---

## 📦 API ENDPOINTS

### FBS Orders
```
GET    /api/orders/fbs              - Список FBS заказов
POST   /api/orders/fbs/sync         - Ручная синхронизация
GET    /api/orders/fbs/{id}         - Детали заказа
PUT    /api/orders/fbs/{id}/status  - Обновление статуса
```

### FBO Orders
```
GET    /api/orders/fbo              - Список FBO заказов (read-only)
POST   /api/orders/fbo/sync         - Синхронизация с МП
GET    /api/orders/fbo/{id}         - Детали заказа
```

### Retail Orders
```
GET    /api/orders/retail           - Список розничных заказов
POST   /api/orders/retail           - Создать заказ
GET    /api/orders/retail/{id}      - Детали заказа
PUT    /api/orders/retail/{id}/status - Обновление статуса
DELETE /api/orders/retail/{id}      - Отменить заказ
```

---

## 🧪 ТЕСТИРОВАНИЕ

После завершения всех фаз:
1. Тестирование создания FBS заказа (резерв)
2. Тестирование списания при статусе "delivering"
3. Тестирование отмены с возвратом
4. Тестирование фоновой синхронизации
5. Тестирование розничных заказов
6. Тестирование FBO заказов (read-only)

---

**Последнее обновление:** 20.01.2025
