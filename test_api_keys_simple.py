import asyncio
import sys
sys.path.append('backend')

async def test_api_keys():
    from backend.core.database import get_database
    from bson import ObjectId
    
    db = await get_database()
    seller_id = '6974099198874d5e82417822'
    seller_object_id = ObjectId(seller_id)
    
    # Получаем API ключи как в роутере
    profile = await db.seller_profiles.find_one({
        "$or": [
            {"user_id": seller_id},
            {"user_id": seller_object_id}
        ]
    })
    
    if profile:
        api_keys = profile.get('api_keys', [])
        print(f'API keys from database: {len(api_keys)}')
        for key in api_keys:
            print(f'  ID: {key.get("id")} - {key.get("marketplace")} - {key.get("name")}')
    else:
        print("Profile not found")

asyncio.run(test_api_keys())
