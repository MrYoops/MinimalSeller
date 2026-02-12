import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_warehouses():
    try:
        db = await get_database()
        
        # Проверяем склады
        warehouses = await db.warehouses.find({}).to_list(None)
        print(f'Всего складов: {len(warehouses)}')
        
        for wh in warehouses:
            print(f'Склад: {wh.get("name")} (ID: {wh.get("_id")})')
            print(f'  Тип: {wh.get("type")}')
            print(f'  Активен: {wh.get("active")}')
            print(f'  Поля: {list(wh.keys())}')
            print(f'  Есть user_id: {"user_id" in wh}')
            print(f'  user_id: {wh.get("user_id")}')
            print()
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_warehouses())
