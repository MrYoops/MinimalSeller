#!/usr/bin/env python3

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

async def create_test_data():
    client = AsyncIOMotorClient("mongodb://mongodb:27017")
    db = client.minimalseller
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # 1. Создаем пользователя
    password = "seller123"
    hashed_password = pwd_context.hash(password)
    
    await db.users.delete_many({"email": "seller@test.com"})
    
    user_data = {
        "email": "seller@test.com",
        "password_hash": hashed_password,
        "hashed_password": hashed_password,
        "full_name": "Test Seller",
        "role": "SELLER",
        "is_active": True,
        "created_at": asyncio.get_event_loop().time(),
        "updated_at": asyncio.get_event_loop().time(),
        "last_login_at": None
    }
    
    user_result = await db.users.insert_one(user_data)
    print(f"User created: {user_result.inserted_id}")
    
    # 2. Создаем тестовый API ключ Ozon
    api_key_data = {
        "name": "Test Ozon Integration",
        "marketplace": "ozon",
        "client_id": "test_client_id",
        "api_key": "encrypted_api_key_here",
        "seller_id": str(user_result.inserted_id),
        "is_active": True,
        "created_at": asyncio.get_event_loop().time(),
        "updated_at": asyncio.get_event_loop().time()
    }
    
    await db.api_keys.delete_many({"seller_id": str(user_result.inserted_id)})
    api_result = await db.api_keys.insert_one(api_key_data)
    print(f"API key created: {api_result.inserted_id}")
    
    # 3. Создаем тестовый товар
    product_data = {
        "article": "nikedunklow-hemp-wearstudio",
        "name": "Nike Dunk Low Hemp",
        "brand": "Nike",
        "price": 15000,
        "created_at": asyncio.get_event_loop().time(),
        "updated_at": asyncio.get_event_loop().time()
    }
    
    await db.products.delete_many({"article": "nikedunklow-hemp-wearstudio"})
    product_result = await db.products.insert_one(product_data)
    print(f"Product created: {product_result.inserted_id}")
    
    # 4. Создаем тестовый склад
    warehouse_data = {
        "name": "Test Warehouse",
        "seller_id": str(user_result.inserted_id),
        "is_active": True,
        "created_at": asyncio.get_event_loop().time(),
        "updated_at": asyncio.get_event_loop().time()
    }
    
    await db.warehouses.delete_many({"seller_id": str(user_result.inserted_id)})
    warehouse_result = await db.warehouses.insert_one(warehouse_data)
    print(f"Warehouse created: {warehouse_result.inserted_id}")
    
    print("\n✅ Test data created successfully!")
    print("📧 Email: seller@test.com")
    print("🔑 Password: seller123")
    print("🛍️ Product: nikedunklow-hemp-wearstudio")
    print("🔌 API Key: Test Ozon Integration")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_data())
