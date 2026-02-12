import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database
from bson import ObjectId
from datetime import datetime

async def create_test_ozon_key():
    try:
        db = await get_database()
        
        # Получаем seller_id
        seller = await db.users.find_one({"email": "seller@test.com"})
        if not seller:
            print("❌ Пользователь seller@test.com не найден!")
            return
        
        # Создаем тестовый API ключ для Ozon
        api_key = {
            "_id": ObjectId(),
            "name": "Test Ozon Key",
            "marketplace": "ozon",
            "client_id": "1020005000742525",
            "api_key": "test_api_key_12345",
            "seller_id": str(seller["_id"]),
            "active": True,
            "test_access": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.api_keys.insert_one(api_key)
        print(f"✅ Создан тестовый API ключ для Ozon: {result.inserted_id}")
        
        # Проверяем
        keys_after = await db.api_keys.count_documents({"marketplace": "ozon", "active": True})
        print(f"Всего активных ключей Ozon: {keys_after}")
        
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(create_test_ozon_key())
