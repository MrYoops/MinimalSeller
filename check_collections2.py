import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_all_collections():
    try:
        db = await get_database()
        
        # Проверим все коллекции
        collections = await db.list_collection_names()
        print('Доступные коллекции:')
        for coll in collections:
            print(f'  {coll}')
        
        # Проверим api_keys коллекцию если есть
        if 'api_keys' in collections:
            api_keys = await db.api_keys.find({}).to_list(None)
            print(f'\nAPI keys в коллекции api_keys: {len(api_keys)}')
            for key in api_keys[:3]:
                print(f'  Поля: {list(key.keys())}')
                print(f'  id: {key.get("id")}')
                print(f'  integration_id: {key.get("integration_id")}')
                print()
        
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_all_collections())
