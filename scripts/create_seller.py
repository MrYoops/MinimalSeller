
import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.database import get_database
from backend.core.security import get_password_hash
from backend.models import User
from datetime import datetime

async def create_seller():
    db = await get_database()
    
    email = "Seller@test.com"
    password = "admin123"
    
    # Check if exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"User {email} already exists. Updating password...")
        await db.users.update_one(
            {"email": email},
            {"$set": {"hashed_password": get_password_hash(password)}}
        )
    else:
        print(f"Creating user {email}...")
        user = {
            "email": email,
            "hashed_password": get_password_hash(password),
            "role": "seller",
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user)
    
    # Ensure seller profile exists
    user_doc = await db.users.find_one({"email": email})
    profile = await db.seller_profiles.find_one({"user_id": user_doc["_id"]})
    
    if not profile:
        print("Creating seller profile...")
        await db.seller_profiles.insert_one({
            "user_id": user_doc["_id"],
            "email": email,
            "created_at": datetime.utcnow(),
            "api_keys": [],
            "subscription_plan": "free"
        })
    
    print("Done!")

if __name__ == "__main__":
    asyncio.run(create_seller())
