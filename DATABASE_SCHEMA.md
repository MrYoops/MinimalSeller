# 🗄️ MongoDB Database Schema - Полное Описание

## База данных: `minimalmod`

[Полная схема БД - см. предыдущий вывод команды]

## Ключевые коллекции:

1. **users** - Пользователи
2. **seller_profiles** - Профили + API ключи
3. **product_catalog** - Товары
4. **inventory** - Остатки
5. **inventory_history** - История операций
6. **warehouses** - Склады
7. **warehouse_links** - Связи со складами МП
8. **orders_fbs** - FBS заказы (со склада продавца)
9. **orders_fbo** - FBO заказы (со склада МП)
10. **ozon_sales_reports** - Финансовые отчеты Ozon
11. **ozon_operations** - Операции из Finance API

## Уникальные индексы (защита от дубликатов):

- `orders_fbs`: (external_order_id + seller_id)
- `orders_fbo`: (external_order_id + seller_id)
- `product_catalog`: (seller_id + article)
- `users`: email
- `seller_profiles`: user_id
