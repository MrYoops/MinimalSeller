#!/usr/bin/env python3
"""
Migration script: hashed_password → password_hash
Fixes critical 500 error during login
"""

import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Add parent directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

try:
    from core.config import settings
except ImportError:
    # Fallback to direct env reading
    import dotenv
    dotenv.load_dotenv(os.path.join(parent_dir, '.env'))
    
    class Settings:
        def get_mongo_url(self):
            return os.getenv('MONGO_URL', 'mongodb://localhost:27017') or os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
        
        @property
        def DATABASE_NAME(self):
            return os.getenv('DATABASE_NAME', 'minimalmod')
    
    settings = Settings()

async def migrate_password_fields():
    """Migrate hashed_password → password_hash for all users"""
    print("🔍 Starting password fields migration...")
    
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(settings.get_mongo_url())
        db = client[settings.DATABASE_NAME]
        
        print(f"📊 Connected to: {settings.get_mongo_url()}")
        print(f"🗄️  Database: {settings.DATABASE_NAME}")
        
        # Check current state
        total_users = await db.users.count_documents({})
        users_with_old_field = await db.users.count_documents({"hashed_password": {"$exists": True}})
        users_with_new_field = await db.users.count_documents({"password_hash": {"$exists": True}})
        
        print(f"📈 Total users: {total_users}")
        print(f"🔴 Users with 'hashed_password': {users_with_old_field}")
        print(f"🟢 Users with 'password_hash': {users_with_new_field}")
        
        if users_with_old_field == 0:
            print("✅ No migration needed - all users already have 'password_hash'")
            return
        
        # Create backup before migration
        print("💾 Creating backup...")
        backup_data = []
        async for user in db.users.find({"hashed_password": {"$exists": True}}):
            backup_data.append({
                "user_id": str(user["_id"]),
                "email": user.get("email", "unknown"),
                "old_field": "hashed_password",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Save backup to file
        backup_file = f"password_migration_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        import json
        with open(backup_file, 'w') as f:
            json.dump(backup_data, f, indent=2)
        print(f"💾 Backup saved to: {backup_file}")
        
        # Perform migration
        print(f"🔧 Migrating {users_with_old_field} users...")
        
        result = await db.users.update_many(
            {"hashed_password": {"$exists": True}},
            {"$rename": {"hashed_password": "password_hash"}}
        )
        
        print(f"✅ Successfully migrated {result.modified_count} users")
        
        # Verify migration
        users_with_old_field_after = await db.users.count_documents({"hashed_password": {"$exists": True}})
        users_with_new_field_after = await db.users.count_documents({"password_hash": {"$exists": True}})
        
        print(f"📊 Post-migration state:")
        print(f"🔴 Users with 'hashed_password': {users_with_old_field_after}")
        print(f"🟢 Users with 'password_hash': {users_with_new_field_after}")
        
        # Create email index for performance
        print("🔧 Creating email index...")
        try:
            await db.users.create_index("email", unique=True)
            print("✅ Email index created")
        except Exception as e:
            if "duplicate key" in str(e):
                print("⚠️ Email index already exists or duplicate emails found")
            else:
                print(f"⚠️ Index creation warning: {e}")
        
        # Test migration with admin user
        print("🧪 Testing migration...")
        admin_user = await db.users.find_one({"role": "admin"})
        if admin_user:
            if "password_hash" in admin_user:
                print("✅ Admin user has 'password_hash' field")
                print(f"📧 Admin email: {admin_user.get('email')}")
            else:
                print("❌ Admin user missing 'password_hash' field!")
        
        client.close()
        print("🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def check_env():
    """Check environment variables"""
    print("🔧 Checking environment...")
    
    if not hasattr(settings, 'get_mongo_url') or not settings.get_mongo_url():
        print("❌ MONGO_URL not configured!")
        sys.exit(1)
    
    if not hasattr(settings, 'DATABASE_NAME') or not settings.DATABASE_NAME:
        print("❌ DATABASE_NAME not configured!")
        sys.exit(1)
    
    print("✅ Environment check passed")

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 MINIMALSELLER - PASSWORD HASH MIGRATION")
    print("=" * 60)
    
    check_env()
    
    # Ask for confirmation
    response = input("\n❓ Continue with migration? (y/N): ")
    if response.lower() != 'y':
        print("❌ Migration cancelled by user")
        sys.exit(0)
    
    # Run migration
    asyncio.run(migrate_password_fields())
