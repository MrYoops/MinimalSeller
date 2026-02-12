"""
Тест загрузки категорий Ozon
Нужны Client ID и API Key
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_ozon_keys():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DATABASE_NAME', 'minimalmod')]
    
    # Найти admin профиль
    admin = await db.users.find_one({'email': 'admin@minimalmod.com'})
    if not admin:
        print("❌ Admin не найден")
        return
    
    profile = await db.seller_profiles.find_one({'user_id': admin['_id']})
    if not profile:
        print("❌ Seller profile не найден")
        return
    
    api_keys = profile.get('api_keys', [])
    ozon_keys = [k for k in api_keys if k.get('marketplace') == 'ozon']
    
    if not ozon_keys:
        print("❌ Ozon API ключи не найдены")
        print("\nДобавьте Ozon API ключи:")
        print("1. Откройте /settings")
        print("2. Добавьте Ozon Client ID и API Key")
        print("3. Затем можно будет загрузить категории")
        return
    
    print(f"✅ Найден Ozon API ключ")
    print(f"   Client ID: {ozon_keys[0].get('client_id', 'N/A')[:20]}...")
    print(f"   API Key: {ozon_keys[0].get('api_key', 'N/A')[:20]}...")
    
    # Попробовать загрузить категории
    print("\nПробуем загрузить категории Ozon...")
    
    try:
        from connectors import OzonConnector
        
        connector = OzonConnector(
            ozon_keys[0].get('client_id', ''),
            ozon_keys[0].get('api_key', '')
        )
        
        categories = await connector.get_categories()
        print(f"✅ Загружено {len(categories)} категорий Ozon")
        
        # Показать первые 10
        for cat in categories[:10]:
            print(f"   - ID: {cat.get('category_id')} | {cat.get('category_name')}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_ozon_keys())
