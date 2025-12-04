# ПЛАН РЕАЛИЗАЦИИ: СИСТЕМА ЗАКАЗОВ SELSUP

**Дата начала:** 04.12.2024  
**Вариант:** MVP (1-2 недели)  
**Статус:** НАЧАЛАСЬ РЕАЛИЗАЦИЯ

---

## ЧТО ДЕЛАЕМ (MVP)

### ✅ Фаза 1: Критические функции

1. **РАЗДЕЛЕНИЕ ЗАКАЗОВ** ⭐⭐⭐ КРИТИЧНО
   - [ ] Backend: API для разделения заказа на коробы
   - [ ] Backend: Отправка разделения на Ozon API
   - [ ] Backend: Отправка разделения на Yandex API
   - [ ] Frontend: Вкладка "Разделение заказа" в карточке
   - [ ] Frontend: UI для добавления коробов и перераспределения товаров
   
2. **ПЕЧАТЬ ЭТИКЕТОК** ⭐⭐⭐ КРИТИЧНО
   - [ ] Backend: API для получения этикеток с МП
   - [ ] Backend: Хранение URL этикеток в БД
   - [ ] Frontend: Кнопка "Печать этикетки"
   - [ ] Frontend: Массовая печать этикеток
   - [ ] Frontend: Кнопка "Обновить этикетку"

3. **ОБНОВЛЕНИЕ ОСТАТКОВ** ⭐⭐⭐
   - [X] Backend: УЖЕ РЕАЛИЗОВАНО в fbs_orders_routes.py
   - [ ] Frontend: Отображение статуса "Остаток обновлён"
   - [ ] Frontend: Чекбокс "Обновить остатки" при импорте

4. **ИСТОРИЯ ИЗМЕНЕНИЙ** ⭐⭐
   - [ ] Backend: Расширение поля status_history
   - [ ] Frontend: Вкладка "История" в карточке заказа
   - [ ] Frontend: Таблица с историей изменений

5. **МАССОВЫЕ ДЕЙСТВИЯ** ⭐⭐
   - [ ] Frontend: Чекбоксы для выбора заказов
   - [ ] Frontend: Панель массовых действий
   - [ ] Backend: API для массовых операций

---

## ЧТО НЕ ДЕЛАЕМ (ПОКА)

- ❌ Маркировка "Честный знак" (пользователь сказал НЕ НУЖНА)
- ❌ ТСД режим / Задания для сканеров
- ❌ Лист сборки (PDF генерация)
- ❌ Поставки
- ❌ Видеофиксация
- ❌ Раздел "Покупатели"
- ❌ Раздел "Короба"

---

## ДЕТАЛЬНЫЙ ПЛАН РАЗРАБОТКИ

### ЭТАП 1: КАРТОЧКА ЗАКАЗА С ВКЛАДКАМИ

**Цель:** Создать детальную карточку заказа с 3 вкладками

**Файлы:**
- `frontend/src/components/orders/OrderDetailModal.jsx` - НОВЫЙ
- `frontend/src/components/orders/OrderInfoTab.jsx` - НОВЫЙ
- `frontend/src/components/orders/OrderSplitTab.jsx` - НОВЫЙ
- `frontend/src/components/orders/OrderHistoryTab.jsx` - НОВЫЙ

**Структура компонента:**
```jsx
<OrderDetailModal order={selectedOrder}>
  <Tabs>
    <Tab label="Основная информация">
      <OrderInfoTab order={order} />
    </Tab>
    <Tab label="Разделение заказа">
      <OrderSplitTab order={order} onSplit={handleSplit} />
    </Tab>
    <Tab label="История изменений">
      <OrderHistoryTab history={order.status_history} />
    </Tab>
  </Tabs>
</OrderDetailModal>
```

**API endpoints нужные:**
- `GET /api/orders/fbs/{id}` - получить заказ (УЖЕ ЕСТЬ)
- `POST /api/orders/fbs/{id}/split` - разделить заказ (СОЗДАТЬ)
- `PUT /api/orders/fbs/{id}/status` - обновить статус (УЖЕ ЕСТЬ)

---

### ЭТАП 2: РАЗДЕЛЕНИЕ ЗАКАЗОВ (BACKEND)

**Цель:** Реализовать API для разделения заказов

**Новый endpoint:**
```python
@router.post("/{order_id}/split")
async def split_fbs_order(
    order_id: str,
    split_data: OrderSplitRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Разделить заказ на несколько коробов
    
    Body: {
        boxes: [
            {box_number: 1, items: [{article: "123", quantity: 2}]},
            {box_number: 2, items: [{article: "456", quantity: 1}]}
        ]
    }
    """
```

**Логика разделения:**

1. **Для Ozon:**
   - API: `POST /v1/posting/fbs/package`
   - Создаются новые заказы на Ozon
   - В нашей БД создаются новые записи orders_fbs с external_order_id новых заказов
   - Старый заказ помечается как `split_into: [new_id1, new_id2]`

2. **Для Yandex/МегаМаркет:**
   - API: `POST /campaigns/{id}/orders/{orderId}/boxes`
   - Заказ остаётся один, но добавляются короба
   - В БД обновляется поле `split_info: {boxes: [...]}`

**Модель данных:**
```python
class OrderSplitRequest(BaseModel):
    boxes: List[OrderBoxSplit]

class OrderBoxSplit(BaseModel):
    box_number: int
    items: List[OrderItemSplit]

class OrderItemSplit(BaseModel):
    article: str
    quantity: int
```

**Файлы:**
- `backend/fbs_orders_routes.py` - ДОБАВИТЬ новый endpoint
- `backend/models.py` - ДОБАВИТЬ новые модели
- `backend/connectors.py` - ДОБАВИТЬ методы split_order в OzonConnector и YandexConnector

---

### ЭТАП 3: РАЗДЕЛЕНИЕ ЗАКАЗОВ (FRONTEND)

**Цель:** UI для разделения заказов

**Компонент OrderSplitTab.jsx:**

```jsx
function OrderSplitTab({ order, onSplit }) {
  const [boxes, setBoxes] = useState([
    {box_number: 1, items: order.items}
  ])

  const addBox = () => {
    setBoxes([...boxes, {
      box_number: boxes.length + 1,
      items: []
    }])
  }

  const moveItem = (fromBox, toBox, itemArticle, quantity) => {
    // Логика перемещения товара между коробами
  }

  const handleSave = async () => {
    await api.post(`/api/orders/fbs/${order.id}/split`, { boxes })
    onSplit()
  }

  return (
    <div>
      {boxes.map((box, idx) => (
        <BoxCard 
          key={idx}
          box={box}
          allItems={order.items}
          onItemChange={(items) => updateBox(idx, items)}
        />
      ))}
      <button onClick={addBox}>+ ДОБАВИТЬ КОРОБ</button>
      <button onClick={handleSave}>СОХРАНИТЬ РАЗДЕЛЕНИЕ</button>
    </div>
  )
}
```

**Файлы:**
- `frontend/src/components/orders/OrderSplitTab.jsx` - СОЗДАТЬ
- `frontend/src/components/orders/BoxCard.jsx` - СОЗДАТЬ

---

### ЭТАП 4: ПЕЧАТЬ ЭТИКЕТОК (BACKEND)

**Цель:** Получение и хранение этикеток

**Новые endpoints:**
```python
@router.get("/{order_id}/label")
async def get_order_label(order_id: str, ...):
    """Получить этикетку заказа"""

@router.post("/{order_id}/label/refresh")
async def refresh_order_label(order_id: str, ...):
    """Обновить этикетку"""

@router.post("/labels/bulk")
async def get_bulk_labels(order_ids: List[str], ...):
    """Массовая загрузка этикеток"""
```

**Логика получения этикеток:**

1. **Ozon:**
   - API: `POST /v2/posting/fbs/package-label`
   - Возвращает PDF в base64
   - Сохраняем URL в `order.label_url`

2. **Wildberries:**
   - API: `GET /api/v3/files/orders/external-stickers`
   - Возвращает PDF
   - Сохраняем URL

3. **Yandex:**
   - API: `GET /campaigns/{id}/orders/{orderId}/delivery/labels`
   - Возвращает PDF

**Модель данных:**
```python
# Добавить в OrderFBS:
label_url: Optional[str] = None
label_updated_at: Optional[datetime] = None
```

**Файлы:**
- `backend/fbs_orders_routes.py` - ДОБАВИТЬ endpoints
- `backend/connectors.py` - ДОБАВИТЬ методы get_label() в коннекторы
- `backend/models.py` - ОБНОВИТЬ OrderFBS

---

### ЭТАП 5: ПЕЧАТЬ ЭТИКЕТОК (FRONTEND)

**Цель:** UI для работы с этикетками

**Кнопки в FBSOrdersList:**
```jsx
<button onClick={() => printLabel(order.id)}>
  <FiPrinter /> ПЕЧАТЬ
</button>

<button onClick={() => refreshLabel(order.id)}>
  <FiRefreshCw /> ОБНОВИТЬ
</button>

<button onClick={() => printBulkLabels(selectedOrders)}>
  ПЕЧАТЬ ВЫБРАННЫХ
</button>
```

**Логика:**
1. Получить URL этикетки через API
2. Открыть PDF в новом окне
3. Автоматический вызов window.print()

**Файлы:**
- `frontend/src/components/orders/FBSOrdersList.jsx` - ОБНОВИТЬ
- `frontend/src/utils/printLabel.js` - СОЗДАТЬ

---

### ЭТАП 6: МАССОВЫЕ ДЕЙСТВИЯ

**Цель:** Выбор и массовые операции

**UI изменения:**
```jsx
<table>
  <thead>
    <tr>
      <th><input type="checkbox" onChange={selectAll} /></th>
      ...
    </tr>
  </thead>
  <tbody>
    {orders.map(order => (
      <tr>
        <td><input type="checkbox" checked={selected.includes(order.id)} /></td>
        ...
      </tr>
    ))}
  </tbody>
</table>

{selectedOrders.length > 0 && (
  <div className="fixed bottom-4 right-4 card-neon p-4">
    <p>Выбрано: {selectedOrders.length}</p>
    <button onClick={printBulkLabels}>ПЕЧАТЬ ЭТИКЕТОК</button>
    <button onClick={bulkStatusUpdate}>ИЗМЕНИТЬ СТАТУС</button>
    <button onClick={exportToExcel}>ЭКСПОРТ В EXCEL</button>
  </div>
)}
```

**Backend endpoints:**
```python
@router.post("/bulk/status")
async def bulk_update_status(...):
    """Массовое обновление статусов"""

@router.post("/bulk/export")
async def bulk_export_excel(...):
    """Экспорт в Excel"""
```

**Файлы:**
- `frontend/src/components/orders/FBSOrdersList.jsx` - ОБНОВИТЬ
- `frontend/src/components/orders/BulkActionsPanel.jsx` - СОЗДАТЬ
- `backend/fbs_orders_routes.py` - ДОБАВИТЬ bulk endpoints

---

### ЭТАП 7: ИСТОРИЯ ИЗМЕНЕНИЙ

**Цель:** Аудит логирование

**Расширение status_history:**
```python
class OrderStatusHistory(BaseModel):
    timestamp: datetime
    action: str  # "status_changed", "split", "label_printed", "note_added"
    user_id: str
    details: Dict[str, Any]  # {"old_status": "new", "new_status": "shipped"}
    comment: Optional[str] = None
```

**UI OrderHistoryTab:**
```jsx
<table>
  <thead>
    <tr>
      <th>Дата</th>
      <th>Действие</th>
      <th>Пользователь</th>
      <th>Детали</th>
    </tr>
  </thead>
  <tbody>
    {history.map(entry => (
      <tr>
        <td>{formatDate(entry.timestamp)}</td>
        <td>{getActionLabel(entry.action)}</td>
        <td>{entry.user_id}</td>
        <td>{formatDetails(entry.details)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**Файлы:**
- `frontend/src/components/orders/OrderHistoryTab.jsx` - СОЗДАТЬ
- `backend/models.py` - ОБНОВИТЬ OrderStatusHistory

---

## ИНТЕГРАЦИЯ С МАРКЕТПЛЕЙСАМИ

### Ozon API

**Эндпоинты которые НУЖНЫ:**
```
POST /v1/posting/fbs/package - Разделение заказа
POST /v2/posting/fbs/package-label - Получение этикетки
GET /v3/posting/fbs/list - Список заказов (УЖЕ ЕСТЬ)
```

**Добавить в OzonConnector:**
```python
async def split_order(self, posting_number: str, packages: List[Dict]) -> Dict:
    """Разделить заказ на несколько отправлений"""
    
async def get_label(self, posting_number: str) -> str:
    """Получить этикетку (возвращает URL или base64)"""
```

### Wildberries API

**Эндпоинты:**
```
GET /api/v3/files/orders/external-stickers - Этикетки
```

### Yandex API

**Эндпоинты:**
```
POST /campaigns/{id}/orders/{orderId}/boxes - Разделение
GET /campaigns/{id}/orders/{orderId}/delivery/labels - Этикетки
```

---

## ТЕСТИРОВАНИЕ

### Backend тесты
- [ ] Тест разделения заказа Ozon
- [ ] Тест разделения заказа Yandex
- [ ] Тест получения этикетки
- [ ] Тест массового обновления статусов

### Frontend тесты
- [ ] Тест открытия модалки заказа
- [ ] Тест добавления короба
- [ ] Тест перемещения товаров между коробами
- [ ] Тест сохранения разделения
- [ ] Тест массового выбора заказов

### E2E тесты
- [ ] Полный флоу: импорт → просмотр → разделение → печать этикетки

---

## TIMELINE

### День 1-2: Карточка заказа + вкладки
- Создать OrderDetailModal
- Создать OrderInfoTab
- Создать заглушки для OrderSplitTab и OrderHistoryTab

### День 3-4: Разделение заказов (Backend)
- API endpoint для разделения
- Интеграция с Ozon API
- Интеграция с Yandex API

### День 4-5: Разделение заказов (Frontend)
- UI для добавления коробов
- Логика перемещения товаров
- Сохранение разделения

### День 6-7: Печать этикеток
- Backend: получение этикеток с МП
- Frontend: кнопки печати
- Массовая печать

### День 8-9: Массовые действия
- Чекбоксы выбора
- Панель массовых действий
- Экспорт в Excel

### День 10: История изменений
- OrderHistoryTab
- Логирование всех действий

### День 11-12: Тестирование + багфиксы
- Testing agent
- Исправление багов
- Финальная проверка

---

## КРИТЕРИИ ГОТОВНОСТИ

✅ **MVP считается готовым когда:**
1. Можно открыть карточку заказа
2. Можно разделить заказ на коробы
3. Можно сохранить разделение на МП (Ozon, Yandex)
4. Можно скачать/распечатать этикетку
5. Можно выбрать несколько заказов и распечатать все этикетки
6. Можно посмотреть историю изменений заказа
7. Все функции протестированы

---

## НАЧИНАЕМ РЕАЛИЗАЦИЮ

**Сейчас:** ЭТАП 1 - Карточка заказа с вкладками

**Следующий файл:** `frontend/src/components/orders/OrderDetailModal.jsx`
