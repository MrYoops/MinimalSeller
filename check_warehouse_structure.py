import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_warehouse_structure():
    try:
        db = await get_database()
        
        # Проверяем структуру склада
        warehouse = await db.warehouses.find_one({})
        if warehouse:
            print("Структура склада:")
            for key, value in warehouse.items():
                print(f"  {key}: {value}")
        
        # Проверяем есть ли user_id
        warehouse_with_user_id = await db.warehouses.find_one({"user_id": {"$exists": True}})
        print(f"\nСкладов с user_id: {warehouse_with_user_id is not None}")
        
        # Проверяем все склады
        warehouses = await db.warehouses.find({}).to_list(None)
        print(f"\nВсего складов: {len(warehouses)}")
        
        for wh in warehouses:
            print(f"  Склад: {wh.get('name')} (ID: {wh.get('id')}, _id: {wh.get('_id')})")
            print(f"    user_id: {wh.get('user_id', 'MISSING')}")
            
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(check_warehouse_structure())
