"""
Reset password for a user
"""
from passlib.context import CryptContext
from pymongo import MongoClient
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Connect to MongoDB
mongo_url = os.getenv("MONGO_URL", "mongodb://mongodb:27017")
client = MongoClient(mongo_url)
db = client.minimalseller

# Reset seller password
email = "seller@test.com"
new_password = "password123"

hashed = pwd_context.hash(new_password)

result = db.users.update_one(
    {"email": email},
    {"$set": {"hashed_password": hashed}}
)

if result.matched_count > 0:
    print(f"✅ Password reset for {email}")
    print(f"   New password: {new_password}")
else:
    print(f"❌ User {email} not found")

client.close()
