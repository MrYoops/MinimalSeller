import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_users():
    try:
        db = await get_database()
        
        # Check users
        users = await db.users.count_documents({})
        print(f'Total users: {users}')
        
        # List users
        user_list = await db.users.find({}).to_list(None)
        for user in user_list:
            print(f'User: {user.get("email")} - Role: {user.get("role")} - Active: {user.get("is_active")}')
            
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_users())
