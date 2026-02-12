#!/usr/bin/env python3

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

async def create_user():
    client = AsyncIOMotorClient("mongodb://mongodb:27017")
    db = client.minimalseller
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password = "seller123"
    hashed_password = pwd_context.hash(password)
    
    print(f"Generated hash: {hashed_password}")
    
    # Delete existing user
    await db.users.delete_many({"email": "seller@test.com"})
    
    # Create new user
    user_data = {
        "email": "seller@test.com",
        "password_hash": hashed_password,
        "hashed_password": hashed_password,
        "role": "SELLER",
        "is_active": True,
        "created_at": asyncio.get_event_loop().time(),
        "updated_at": asyncio.get_event_loop().time()
    }
    
    result = await db.users.insert_one(user_data)
    print(f"User created with ID: {result.inserted_id}")
    
    # Verify user was created
    created_user = await db.users.find_one({"email": "seller@test.com"})
    print(f"User in DB: {created_user['email']}")
    print(f"Hash in DB: {created_user['password_hash']}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_user())
