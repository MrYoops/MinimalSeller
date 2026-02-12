#!/usr/bin/env python3
"""
Quick password hash migration - bypass config validation
"""

import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def migrate_password_fields():
    """Migrate hashed_password → password_hash for all users"""
    print("🔍 Starting quick password fields migration...")
    
    try:
        # Connect to MongoDB directly
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
        database_name = os.getenv('DATABASE_NAME', 'minimalmod')
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[database_name]
        
        print(f"📊 Connected to: {mongo_url}")
        print(f"🗄️  Database: {database_name}")
        
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
        
        client.close()
        print("🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 QUICK PASSWORD HASH MIGRATION")
    print("=" * 60)
    
    # Run migration
    asyncio.run(migrate_password_fields())
