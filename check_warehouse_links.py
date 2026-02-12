import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_warehouse_links():
    try:
        db = await get_database()
        
        # Проверяем ID складов
        warehouses = await db.warehouses.find({}).to_list(None)
        print('ID складов в базе:')
        for wh in warehouses:
            print(f'  Имя: {wh.get("name")}')
            print(f'  _id: {wh.get("_id")}')
            print(f'  id: {wh.get("id")}')
            print()
        
        # Проверяем связи складов с МП
        links = await db.warehouse_links.find({}).to_list(None)
        print(f'Связей складов с МП: {len(links)}')
        
        for link in links:
            print(f"  Склад {link.get('warehouse_id')} -> {link.get('marketplace')} ({link.get('marketplace_warehouse_id')})")
        
        # Проверяем есть ли у нашего склада связи
        warehouse_id = "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
        warehouse_links = await db.warehouse_links.find({"warehouse_id": warehouse_id}).to_list(None)
        print(f"\nСвязей для нашего склада: {len(warehouse_links)}")
        
        if not warehouse_links:
            print("❌ У склада нет связей с маркетплейсами!")
            print("Нужно создать связи в warehouse_links")
            
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(check_warehouse_links())
