"""
Скрипт для удаления дубликатов заказов FBS

Проблема: При множественной загрузке заказов создавались дубликаты.
Решение: 
1. Удалить дубликаты (оставить самый старый по created_at)
2. Создать уникальный индекс на (external_order_id + seller_id)
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from collections import defaultdict
from datetime import datetime

async def fix_duplicates():
    mongo_url = os.getenv('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['account_clarity']
    
    print('=' * 60)
    print('🔧 ИСПРАВЛЕНИЕ ДУБЛИКАТОВ ЗАКАЗОВ FBS')
    print('=' * 60)
    print()
    
    # ШАГ 1: Найти дубликаты
    print('ШАГ 1: Поиск дубликатов...')
    orders = await db.orders_fbs.find({}).to_list(length=100000)
    
    print(f'Всего заказов FBS: {len(orders)}')
    
    if len(orders) == 0:
        print('✅ База пустая, дубликатов нет')
        client.close()
        return
    
    # Группировать по (external_order_id + seller_id)
    groups = defaultdict(list)
    for order in orders:
        external_id = order.get('external_order_id', 'unknown')
        seller_id = order.get('seller_id', 'unknown')
        key = f"{seller_id}:{external_id}"
        groups[key].append(order)
    
    # Найти дубликаты
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}
    
    if not duplicates:
        print('✅ Дубликатов не найдено!')
        print()
    else:
        print(f'❗ Найдено {len(duplicates)} групп дубликатов')
        print()
        
        total_to_delete = sum(len(v) - 1 for v in duplicates.values())
        print(f'Будет удалено записей: {total_to_delete}')
        print()
        
        # ШАГ 2: Удалить дубликаты
        print('ШАГ 2: Удаление дубликатов...')
        deleted_count = 0
        
        for key, orders_list in duplicates.items():
            # Сортировать по дате создания (оставить самый старый)
            sorted_orders = sorted(orders_list, key=lambda x: x.get('created_at', datetime.min))
            
            # Оставить первый (самый старый)
            keep_order = sorted_orders[0]
            to_delete = sorted_orders[1:]
            
            print(f'Заказ {keep_order.get("external_order_id")}:')
            print(f'  ✅ Оставляем: {keep_order["_id"]} (создан: {keep_order.get("created_at")})')
            
            # Удалить остальные
            for dup in to_delete:
                result = await db.orders_fbs.delete_one({"_id": dup["_id"]})
                if result.deleted_count > 0:
                    print(f'  ❌ Удалён: {dup["_id"]} (создан: {dup.get("created_at")})')
                    deleted_count += 1
            print()
        
        print(f'✅ Удалено {deleted_count} дубликатов')
        print()
    
    # ШАГ 3: Создать уникальный индекс
    print('ШАГ 3: Создание уникального индекса...')
    
    try:
        # Удалить существующие индексы (кроме _id)
        existing_indexes = await db.orders_fbs.list_indexes().to_list(length=100)
        for idx in existing_indexes:
            idx_name = idx.get('name')
            if idx_name != '_id_':
                print(f'Удаляю индекс: {idx_name}')
                await db.orders_fbs.drop_index(idx_name)
        
        # Создать уникальный составной индекс
        result = await db.orders_fbs.create_index(
            [("external_order_id", 1), ("seller_id", 1)],
            unique=True,
            name="unique_order_per_seller"
        )
        
        print(f'✅ Создан уникальный индекс: {result}')
        print('   - Теперь дубликаты невозможны на уровне БД')
    except Exception as e:
        print(f'❌ Ошибка создания индекса: {e}')
    
    print()
    
    # ШАГ 4: Проверить результат
    print('ШАГ 4: Проверка результата...')
    final_count = await db.orders_fbs.count_documents({})
    print(f'Итого заказов FBS: {final_count}')
    
    # Показать индексы
    print()
    print('Индексы на orders_fbs:')
    indexes = await db.orders_fbs.list_indexes().to_list(length=100)
    for idx in indexes:
        print(f'  - {idx.get("name")}: {idx.get("key")}')
    
    print()
    print('=' * 60)
    print('✅ ГОТОВО!')
    print('=' * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_duplicates())
