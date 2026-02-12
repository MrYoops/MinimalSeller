"""
Fix password hash in database
"""
from passlib.context import CryptContext
from pymongo import MongoClient
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Connect to MongoDB
mongo_url = os.getenv("MONGO_URL", "mongodb://mongodb:27017")
client = MongoClient(mongo_url)
db = client.minimalseller

# Generate new hash for password123
password = "password123"
new_hash = pwd_context.hash(password)

print(f"Generated hash: {new_hash}")
print(f"Verifying hash works: {pwd_context.verify(password, new_hash)}")

# Update user
result = db.users.update_one(
    {"email": "seller@test.com"},
    {"$set": {"password_hash": new_hash}}
)

if result.matched_count > 0:
    print(f"✅ Password updated for seller@test.com")
    
    # Verify
    user = db.users.find_one({"email": "seller@test.com"})
    if user:
        stored_hash = user.get("password_hash")
        print(f"✅ Hash stored in database")
        print(f"✅ Verification test: {pwd_context.verify(password, stored_hash)}")
else:
    print(f"❌ User not found")

client.close()
