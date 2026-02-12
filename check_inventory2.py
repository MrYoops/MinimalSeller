import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def test_inventory():
    try:
        db = await get_database()
        
        # Проверяем inventory коллекцию
        count = await db.inventory.count_documents({})
        print(f'Всего записей в inventory: {count}')
        
        # Проверяем несколько записей
        items = await db.inventory.find({}).limit(3).to_list(None)
        print('Примеры записей:')
        for item in items:
            print(f'  product_id: {item.get("product_id")}, quantity: {item.get("quantity")}')
        
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(test_inventory())
