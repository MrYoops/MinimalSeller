# Структура данных заказа Yandex Market

Согласно документации API: https://yandex.ru/dev/market/partner-api/doc/ru/reference/orders/getOrders

## Ответ API GET /campaigns/{campaignId}/orders

```json
{
  "orders": [
    {
      "id": 12345,  // ID заказа
      "status": "PROCESSING",  // Статус заказа
      "substatus": "STARTED",  // Подстатус
      "creationDate": "02-02-2023",  // Дата создания
      "itemsTotal": 1500.00,  // Стоимость товаров
      "paymentType": "PREPAID",  // Тип оплаты
      "paymentMethod": "YANDEX",  // Метод оплаты
      "delivery": {
        "type": "DELIVERY",  // Тип доставки
        "serviceName": "Яндекс.Доставка",
        "address": {
          "country": "Россия",
          "postcode": "123456",
          "city": "Москва",
          "street": "Ленина",
          "house": "1",
          "apartment": "10"
        },
        "dates": {
          "fromDate": "05-02-2023",
          "toDate": "07-02-2023"
        }
      },
      "buyer": {
        "id": "67890",
        "lastName": "Иванов",
        "firstName": "Иван",
        "middleName": "Иванович",
        "phone": "+79001234567",
        "email": "ivan@example.com"
      },
      "items": [
        {
          "id": 1,  // ID позиции в заказе
          "offerId": "ARTICLE-001",  // Артикул продавца
          "offerName": "Товар 1",
          "price": 1000.00,  // Цена за единицу
          "count": 1,  // Количество
          "subsidy": 0,  // Субсидия
          "vat": "VAT_20",  // НДС
          "shopSku": "123456"  // SKU Яндекса
        }
      ]
    }
  ],
  "pager": {
    "currentPage": 1,
    "from": 1,
    "to": 50,
    "pagesCount": 3,
    "total": 150
  }
}
```

## Статусы заказов Yandex

- `RESERVED` - Зарезервирован
- `PROCESSING` - В обработке (ключевой статус для резервирования)
- `DELIVERY` - Передан в доставку (ключевой для списания)
- `PICKUP` - Готов к выдаче
- `DELIVERED` - Доставлен
- `CANCELLED` - Отменён
- `RETURNED` - Возвращён

## Mapping для парсинга

```python
external_id = str(order.get("id"))
order_number = str(order.get("id"))  # Используем ID как номер
created_at_str = order.get("creationDate")  # Формат: "02-02-2023"
status = order.get("status")
substatus = order.get("substatus")

# Покупатель
buyer = order.get("buyer", {})
customer_full_name = f"{buyer.get('lastName', '')} {buyer.get('firstName', '')} {buyer.get('middleName', '')}".strip()
customer_phone = buyer.get("phone", "")

# Адрес
delivery = order.get("delivery", {})
address_obj = delivery.get("address", {})
address = f"{address_obj.get('city', '')}, {address_obj.get('street', '')}, д.{address_obj.get('house', '')}, кв.{address_obj.get('apartment', '')}".strip()

# Товары
items = order.get("items", [])
for item in items:
    article = item.get("offerId")  # Артикул продавца
    name = item.get("offerName")
    price = float(item.get("price", 0))
    quantity = int(item.get("count", 1))
```
