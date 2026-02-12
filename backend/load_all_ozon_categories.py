"""
Загрузка ВСЕХ категорий Ozon
"""

import asyncio
from connectors import OzonConnector
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = "3152566"
API_KEY = "71389f62-904f-4030-a7e7-675cc832f831"


async def load_all():
    print("\n" + "="*60)
    print("ЗАГРУЗКА ВСЕХ КАТЕГОРИЙ OZON")
    print("="*60)
    
    # Connect DB
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DATABASE_NAME', 'minimalmod')]
    
    # Connector
    connector = OzonConnector(CLIENT_ID, API_KEY)
    
    # Загрузить категории
    print("\n1️⃣ Загружаю категории с Ozon API...")
    categories = await connector.get_categories()
    
    print(f"✅ Получено {len(categories)} категорий")
    
    # Показать первые 10
    print("\n📋 Первые 10 категорий:")
    for cat in categories[:10]:
        print(f"   - ID: {cat.get('category_id')} | {cat.get('category_name')}")
    
    # Сохранить в БД
    print(f"\n2️⃣ Сохраняю в MongoDB...")
    
    saved = 0
    for cat in categories:
        cat['marketplace'] = 'ozon'
        cat['loaded_at'] = datetime.utcnow()
        cat['source'] = 'api'
        
        await db.ozon_categories_cache.replace_one(
            {
                'marketplace': 'ozon',
                'category_id': cat['category_id']
            },
            cat,
            upsert=True
        )
        saved += 1
    
    print(f"✅ Сохранено {saved} категорий в ozon_categories_cache")
    
    # Статистика
    total = await db.ozon_categories_cache.count_documents({'marketplace': 'ozon'})
    print(f"\n📊 ИТОГО в базе: {total} категорий Ozon")
    
    client.close()
    
    print("\n" + "="*60)
    print("✅ ЗАГРУЗКА ЗАВЕРШЕНА")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(load_all())
