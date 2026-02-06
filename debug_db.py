import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "minimalmod"

async def check_db():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    print(f"Connected to {DATABASE_NAME}")
    
    # Check Warehouses
    warehouses = await db.warehouses.find().to_list(100)
    print(f"\nWarehouses count: {len(warehouses)}")
    for wh in warehouses:
        print(f" - {wh.get('name')} (ID: {wh.get('id')}, _id: {wh.get('_id')})")
        
    # Check Users
    users = await db.users.find().to_list(100)
    print(f"\nUsers count: {len(users)}")
    for user in users:
        print(f" - {user.get('email')} (ID: {user.get('_id')})")

    # Check Profiles (API Keys)
    profiles = await db.seller_profiles.find().to_list(100)
    print(f"\nProfiles count: {len(profiles)}")
    for p in profiles:
        print(f" - User: {p.get('user_id')}, API Keys: {len(p.get('api_keys', []))}")

    # Check Collections Discrepancy
    products_count = await db.products.count_documents({})
    catalog_count = await db.product_catalog.count_documents({})
    print(f"\n[CRITICAL CHECK]")
    print(f"Collection 'products' count: {products_count}")
    print(f"Collection 'product_catalog' count: {catalog_count}")
    
    if products_count > 0:
        print("SAMPLE 'products' item:")
        print(await db.products.find_one())
        
    if catalog_count > 0:
        print("SAMPLE 'product_catalog' item:")
        print(await db.product_catalog.find_one())

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())
