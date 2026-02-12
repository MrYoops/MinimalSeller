import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_users_warehouses():
    try:
        db = await get_database()
        
        # Проверяем пользователей
        users = await db.users.find({}).to_list(None)
        print(f'Всего пользователей: {len(users)}')
        
        for user in users:
            print(f'Пользователь: {user.get("email")} (ID: {user.get("_id")})')
        
        print()
        
        # Проверяем склады
        warehouses = await db.warehouses.find({}).to_list(None)
        print(f'Всего складов: {len(warehouses)}')
        
        for wh in warehouses:
            print(f'Склад: {wh.get("name")} (ID: {wh.get("_id")})')
            print(f'  user_id: {wh.get("user_id")}')
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_users_warehouses())
