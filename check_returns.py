import asyncio
import os
import sys
sys.path.insert(0, '/app/backend')

from database import get_database

async def check_returns():
    db = await get_database()
    
    # Ищем операции, связанные с возвратами
    operations = await db.ozon_operations.find({
        "operation_type": {"$regex": "Return", "$options": "i"}
    }).to_list(50)
    
    print(f"\n=== НАЙДЕНО ВОЗВРАТНЫХ ОПЕРАЦИЙ: {len(operations)} ===\n")
    
    for op in operations[:10]:
        print(f"Тип: {op.get('operation_type')}")
        print(f"Название: {op.get('operation_type_name')}")
        print(f"Сумма: {op.get('amount')} руб")
        print(f"Товары: {op.get('items')}")
        print(f"Posting: {op.get('posting_number')}")
        print("-" * 50)
    
    # Посмотрим типы операций с Return в названии
    pipeline = [
        {"$match": {"operation_type": {"$regex": "Return", "$options": "i"}}},
        {"$group": {
            "_id": "$operation_type",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "sample_name": {"$first": "$operation_type_name"}
        }},
        {"$sort": {"total_amount": 1}}
    ]
    
    stats = await db.ozon_operations.aggregate(pipeline).to_list(100)
    
    print(f"\n=== СТАТИСТИКА ПО ТИПАМ ВОЗВРАТОВ ===\n")
    for s in stats:
        print(f"Тип: {s['_id']}")
        print(f"  Название: {s.get('sample_name')}")
        print(f"  Количество: {s['count']}")
        print(f"  Сумма: {s['total_amount']} руб")
        print()

asyncio.run(check_returns())
