"""
Скрипт для создания тестовых пользователей в локальной БД
Запустить: python create_test_users.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_users():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["minimalmod"]
    
    # Проверяем и создаём seller
    seller_exists = await db.users.find_one({"email": "seller@test.com"})
    if not seller_exists:
        seller = {
            "email": "seller@test.com",
            "password_hash": pwd_context.hash("password123"),
            "full_name": "Test Seller",
            "role": "seller",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login_at": None
        }
        await db.users.insert_one(seller)
        print("✅ Created seller: seller@test.com / password123")
        
        # Создаём seller profile
        seller_id = seller["_id"] if "_id" in seller else (await db.users.find_one({"email": "seller@test.com"}))["_id"]
        
        profile_exists = await db.seller_profiles.find_one({"user_id": seller_id})
        if not profile_exists:
            await db.seller_profiles.insert_one({
                "user_id": seller_id,
                "api_keys": []
            })
            print("✅ Created seller profile")
    else:
        print("ℹ️  Seller already exists")
    
    # Проверяем и создаём admin
    admin_exists = await db.users.find_one({"email": "admin@minimalmod.com"})
    if not admin_exists:
        admin = {
            "email": "admin@minimalmod.com",
            "password_hash": pwd_context.hash("admin123"),
            "full_name": "Administrator",
            "role": "admin",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login_at": None
        }
        await db.users.insert_one(admin)
        print("✅ Created admin: admin@minimalmod.com / admin123")
    else:
        print("ℹ️  Admin already exists")
    
    print("\n🎉 Setup complete!")
    print("\nТестовые аккаунты:")
    print("  Seller: seller@test.com / password123")
    print("  Admin: admin@minimalmod.com / admin123")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_users())
