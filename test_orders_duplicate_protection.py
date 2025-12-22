"""
Тестовый сценарий: Проверка защиты от дубликатов заказов
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
import random

async def test_duplicate_protection():
    mongo_url = os.getenv('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['account_clarity']
    
    print('=' * 70)
    print('🧪 ТЕСТ: Защита от дубликатов заказов')
    print('=' * 70)
    print()
    
    # Тестовые данные
    test_seller_id = "test_seller_001"
    test_external_id = f"TEST-ORDER-{random.randint(100000, 999999)}"
    
    order_template = {
        "seller_id": test_seller_id,
        "external_order_id": test_external_id,
        "order_number": f"FBS-TEST-{test_external_id[-8:]}",
        "marketplace": "test",
        "warehouse_id": "test_warehouse",
        "status": "imported",
        "customer": {
            "full_name": "Тестовый покупатель",
            "phone": "+79001234567",
            "address": "Тестовый адрес"
        },
        "items": [
            {
                "product_id": "",
                "article": "TEST-001",
                "name": "Тестовый товар",
                "price": 1000,
                "quantity": 1,
                "total": 1000
            }
        ],
        "totals": {
            "subtotal": 1000,
            "shipping_cost": 0,
            "marketplace_commission": 0,
            "seller_payout": 1000,
            "total": 1000
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    print(f'Тестовый продавец: {test_seller_id}')
    print(f'Тестовый external_order_id: {test_external_id}')
    print()
    
    # ТЕСТ 1: Первая вставка (должна пройти)
    print('ТЕСТ 1: Первая вставка заказа...')
    try:
        result = await db.orders_fbs.insert_one(order_template.copy())
        print(f'✅ УСПЕХ: Заказ создан с ID: {result.inserted_id}')
        first_id = result.inserted_id
    except Exception as e:
        print(f'❌ ОШИБКА: {e}')
        client.close()
        return
    
    print()
    
    # ТЕСТ 2: Вторая вставка (должна быть отклонена)
    print('ТЕСТ 2: Попытка создать дубликат...')
    try:
        result = await db.orders_fbs.insert_one(order_template.copy())
        print(f'❌ ПРОВАЛ: Дубликат был создан! ID: {result.inserted_id}')
        print('⚠️  Защита от дубликатов НЕ работает!')
        
        # Удалить дубликат
        await db.orders_fbs.delete_one({"_id": result.inserted_id})
    except Exception as e:
        error_msg = str(e)
        if "duplicate key error" in error_msg.lower() or "E11000" in error_msg:
            print(f'✅ УСПЕХ: Дубликат отклонён уникальным индексом')
            print(f'   Сообщение: {error_msg[:100]}...')
        else:
            print(f'❌ НЕОЖИДАННАЯ ОШИБКА: {e}')
    
    print()
    
    # ТЕСТ 3: Попытка создать заказ с тем же external_id, но другим seller_id (должно пройти)
    print('ТЕСТ 3: Заказ с тем же external_id, но другим seller_id...')
    order_different_seller = order_template.copy()
    order_different_seller["seller_id"] = "test_seller_002"
    order_different_seller["order_number"] = f"FBS-TEST-{test_external_id[-8:]}-SELLER2"
    
    try:
        result = await db.orders_fbs.insert_one(order_different_seller)
        print(f'✅ УСПЕХ: Заказ создан (разные продавцы - это разные заказы)')
        second_id = result.inserted_id
    except Exception as e:
        print(f'❌ ОШИБКА: {e}')
    
    print()
    
    # ТЕСТ 4: Проверка итогового состояния
    print('ТЕСТ 4: Проверка итогового состояния БД...')
    count_seller1 = await db.orders_fbs.count_documents({"seller_id": test_seller_id})
    count_seller2 = await db.orders_fbs.count_documents({"seller_id": "test_seller_002"})
    
    print(f'Заказов у {test_seller_id}: {count_seller1} (ожидается: 1)')
    print(f'Заказов у test_seller_002: {count_seller2} (ожидается: 1)')
    
    if count_seller1 == 1 and count_seller2 == 1:
        print('✅ Итоговое состояние БД: КОРРЕКТНО')
    else:
        print('❌ Итоговое состояние БД: НЕКОРРЕКТНО')
    
    print()
    
    # Очистка тестовых данных
    print('Очистка тестовых данных...')
    result = await db.orders_fbs.delete_many({"seller_id": {"$in": [test_seller_id, "test_seller_002"]}})
    print(f'Удалено: {result.deleted_count} тестовых заказов')
    
    print()
    print('=' * 70)
    print('🎯 ТЕСТЫ ЗАВЕРШЕНЫ')
    print('=' * 70)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_duplicate_protection())
