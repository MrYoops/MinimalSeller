import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database
from backend.services.auth_service import AuthService
from bson import ObjectId

async def debug_users():
    try:
        db = await get_database()
        
        # Проверяем всех пользователей
        users = await db.users.find({}).to_list(None)
        print(f'Всего пользователей в БД: {len(users)}')
        
        for i, user in enumerate(users):
            print(f'\n=== Пользователь {i+1} ===')
            print(f'ID: {user["_id"]} (тип: {type(user["_id"])})')
            print(f'Email: {user.get("email")}')
            print(f'Role: {user.get("role")}')
            print(f'Password hash field: {user.get("password_hash", "MISSING")}')
            print(f'Hashed password field: {user.get("hashed_password", "MISSING")}')
        
        # Проверяем seller_id из товаров
        print(f'\n\n=== Проверка соответствия seller_id ===')
        products = await db.products.find({}).to_list(None)
        
        for product in products:
            seller_id = product.get("seller_id")
            print(f'Товар {product.get("article")}: seller_id={seller_id}')
            
            # Ищем пользователя с таким ID
            if isinstance(seller_id, ObjectId):
                user = await db.users.find_one({"_id": seller_id})
                if user:
                    print(f'  ✅ Найден пользователь: {user.get("email")}')
                else:
                    print(f'  ❌ Пользователь не найден!')
            else:
                print(f'  ⚠️ Неверный тип seller_id: {type(seller_id)}')
                    
    except Exception as e:
        print(f'Ошибка: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_users())
