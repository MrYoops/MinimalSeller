import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_api_keys():
    try:
        db = await get_database()
        
        # Проверяем API ключи
        api_keys = await db.api_keys.find({}).to_list(None)
        print(f'API ключей: {len(api_keys)}')
        
        for key in api_keys:
            print(f"  {key.get('name')}: {key.get('marketplace')} (активен: {key.get('active')})")
            if key.get('marketplace') == 'ozon':
                print(f"    Client ID: {key.get('client_id')}")
                print(f"    Есть тестовый доступ: {key.get('test_access')}")
        
        # Проверяем есть ли активный ключ для Ozon
        ozon_keys = [k for k in api_keys if k.get('marketplace') == 'ozon' and k.get('active')]
        
        if not ozon_keys:
            print("❌ Нет активных API ключей для Ozon!")
        else:
            print(f"✅ Найдено {len(ozon_keys)} активных ключей Ozon")
            
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(check_api_keys())
