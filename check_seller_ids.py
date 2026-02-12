import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_seller_ids():
    try:
        db = await get_database()
        
        # Проверяем seller_id в inventory
        items = await db.inventory.find({}).limit(5).to_list(None)
        print('Seller ID в inventory:')
        for item in items:
            print(f'  {item.get("seller_id")} (тип: {type(item.get("seller_id"))})')
        
        # Проверяем текущего user_id
        print(f'Текущий user_id: 6974099198874d5e82417822')
        
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_seller_ids())
