"""
Database connection module
"""
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

# Global client and db instances
client = AsyncIOMotorClient(settings.get_mongo_url())
db = client[settings.DATABASE_NAME]

async def get_database():
    """Get database instance"""
    return db

def get_db_sync():
    """Get database instance for sync operations"""
    return db
