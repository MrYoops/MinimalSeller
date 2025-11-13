"""
Database initialization script
Creates test users and initial data
"""
import asyncio
from datetime import datetime
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def init_database():
    # Connect to MongoDB
    mongo_url = os.getenv("MONGO_URL", "mongodb://mongodb:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.minimalseller
    
    print("🔄 Initializing database...")
    
    # Create test seller user
    seller_email = "seller@test.com"
    seller_exists = await db.users.find_one({"email": seller_email})
    
    if not seller_exists:
        hashed_password = pwd_context.hash("password123")
        seller_user = {
            "email": seller_email,
            "hashed_password": hashed_password,
            "full_name": "Test Seller",
            "role": "seller",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login_at": None
        }
        result = await db.users.insert_one(seller_user)
        seller_id = str(result.inserted_id)
        
        # Create seller profile
        seller_profile = {
            "user_id": seller_id,
            "company_name": "Test Company LLC",
            "inn": "1234567890",
            "commission_rate": 0.15,
            "api_keys": [],
            "created_at": datetime.utcnow()
        }
        await db.seller_profiles.insert_one(seller_profile)
        print(f"✅ Created seller user: {seller_email} / password123")
    else:
        print(f"ℹ️  Seller user already exists: {seller_email}")
    
    # Create test admin user
    admin_email = "admin@minimalmod.com"
    admin_exists = await db.users.find_one({"email": admin_email})
    
    if not admin_exists:
        hashed_password = pwd_context.hash("admin123")
        admin_user = {
            "email": admin_email,
            "hashed_password": hashed_password,
            "full_name": "Admin User",
            "role": "admin",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login_at": None
        }
        await db.users.insert_one(admin_user)
        print(f"✅ Created admin user: {admin_email} / admin123")
    else:
        print(f"ℹ️  Admin user already exists: {admin_email}")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("seller_id")
    await db.orders.create_index("seller_id")
    await db.inventory.create_index([("seller_id", 1), ("product_id", 1)])
    print("✅ Created database indexes")
    
    print("✅ Database initialization complete!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(init_database())
