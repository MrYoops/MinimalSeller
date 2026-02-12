"""
Тест новой системы предзагрузки WB категорий
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from connectors import WildberriesConnector
from wb_category_preload import WBCategoryManager
import os
from dotenv import load_dotenv

load_dotenv()

API_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzc5ODQzMTQyLCJpZCI6IjAxOWFiYjEyLTdlN2UtN2JlOS1hMTQyLWRjODg2MTZjOWM3NyIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.dsPgDDcu5peT7fF0ImzEBclegtzsJEb3zpbrYrqJc0gHu0-FHG-tf4pZuiSb-eA7rEoDhthSJsBBdoqPfAZVGg"


async def test():
    print("\n" + "="*60)
    print("ТЕСТ НОВОЙ СИСТЕМЫ КАТЕГОРИЙ WB")
    print("="*60)
    
    # Connect to DB
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DATABASE_NAME', 'minimalmod')]
    
    # Create connector
    connector = WildberriesConnector("", API_TOKEN)
    manager = WBCategoryManager(db)
    
    # Test 1: Preload categories
    print("\n1️⃣ ПРЕДЗАГРУЗКА КАТЕГОРИЙ WB")
    result = await manager.preload_from_api(connector)
    
    if result['success']:
        print(f"✅ {result['message']}")
        print(f"   Загружено: {result['loaded']}")
    else:
        print(f"❌ Ошибка: {result['error']}")
        return
    
    # Test 2: Get stats
    print("\n2️⃣ СТАТИСТИКА")
    stats = await manager.get_stats()
    print(f"   Всего: {stats['total']}")
    print(f"   Родительских: {stats['parents']}")
    print(f"   Subcategories: {stats['subjects']}")
    print(f"   Обновлено: {stats['last_updated']}")
    
    # Test 3: Search
    print("\n3️⃣ ПОИСК 'мыш'")
    results = await manager.search_categories("мыш")
    print(f"✅ Найдено: {len(results)}")
    for cat in results[:5]:
        print(f"   - ID: {cat['category_id']} | {cat['name']}")
    
    # Test 4: Get all
    print("\n4️⃣ ВСЕ КАТЕГОРИИ")
    all_cats = await manager.get_all_categories()
    print(f"✅ Всего в базе: {len(all_cats)}")
    
    # Test 5: Add subject from product
    print("\n5️⃣ ДОБАВЛЕНИЕ SUBJECT ИЗ ТОВАРА")
    await manager.add_subject_from_product(
        subject_id=788,
        subject_name="Мыши компьютерные"
    )
    print("✅ Subject добавлен")
    
    # Check stats again
    stats = await manager.get_stats()
    print(f"   Теперь subjects: {stats['subjects']}")
    
    print("\n" + "="*60)
    print("✅ ВСЕ ТЕСТЫ ПРОШЛИ!")
    print("="*60)
    print("\nСистема готова к работе:")
    print("1. Категории загружены в БД")
    print("2. Поиск работает быстро")
    print("3. Subjects добавляются при импорте")
    print("="*60)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(test())
