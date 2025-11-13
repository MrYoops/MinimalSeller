"""
Database connection module
"""
from motor.motor_asyncio import AsyncIOMotorClient
import os

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongodb:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.minimalseller

async def get_database():
    """Get database instance"""
    return db

def get_db_sync():
    """Get database instance for sync operations"""
    return db
