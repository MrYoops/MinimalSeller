import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_api_keys():
    try:
        db = await get_database()
        
        profile = await db.seller_profiles.find_one({"user_id": "6974099198874d5e82417822"})
        
        if profile and "api_keys" in profile:
            api_keys = profile["api_keys"]
            print('API keys структура:')
            for i, key in enumerate(api_keys):
                print(f'  Ключ {i}:')
                print(f'    Поля: {list(key.keys())}')
                print(f'    id: {key.get("id")}')
                print(f'    integration_id: {key.get("integration_id")}')
                print(f'    marketplace: {key.get("marketplace")}')
                print()
        else:
            print('API keys не найдены')
        
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_api_keys())
