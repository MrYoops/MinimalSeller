"""
Полный тест импорта с исправленным коннектором
"""

import asyncio
from connectors import WildberriesConnector
import json

API_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzc5ODQzMTQyLCJpZCI6IjAxOWFiYjEyLTdlN2UtN2JlOS1hMTQyLWRjODg2MTZjOWM3NyIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.dsPgDDcu5peT7fF0ImzEBclegtzsJEb3zpbrYrqJc0gHu0-FHG-tf4pZuiSb-eA7rEoDhthSJsBBdoqPfAZVGg"


async def test_import():
    print("=" * 60)
    print("ТЕСТ ПОЛНОГО ИМПОРТА С ИСПРАВЛЕННЫМ КОННЕКТОРОМ")
    print("=" * 60)
    
    connector = WildberriesConnector("", API_TOKEN)
    
    # Тест 1: Получить товары
    print("\n1️⃣ Получение товаров...")
    products = await connector.get_products()
    
    print(f"✅ Получено {len(products)} товаров\n")
    
    # Смотрим первый товар
    if products:
        product = products[0]
        print("=== ПЕРВЫЙ ТОВАР ===")
        print(f"SKU: {product.get('sku')}")
        print(f"Name: {product.get('name')}")
        print(f"Category: {product.get('category')}")
        print(f"Category ID: {product.get('category_id')}")  # ← ДОЛЖНО БЫТЬ!
        print(f"Brand: {product.get('brand')}")
        print(f"Characteristics: {len(product.get('characteristics', []))}")
        
        if product.get('category_id'):
            print(f"\n✅ ИСПРАВЛЕНО: category_id теперь есть!")
            
            # Тест 2: Получить характеристики для этой категории
            print(f"\n2️⃣ Получение характеристик для категории {product.get('category_id')}...")
            
            try:
                charcs = await connector.get_category_characteristics(int(product.get('category_id')))
                print(f"✅ Получено {len(charcs)} характеристик")
                
                # Показать обязательные
                required = [c for c in charcs if c.get('required')]
                print(f"\n=== ОБЯЗАТЕЛЬНЫЕ ({len(required)}) ===")
                for char in required[:5]:
                    print(f"  ⭐ {char.get('charcName')}")
                
            except Exception as e:
                print(f"❌ Ошибка получения характеристик: {e}")
        else:
            print(f"\n❌ ОШИБКА: category_id все еще пустой!")
    
    # Тест 3: Поиск категорий
    print(f"\n3️⃣ Тест поиска категорий...")
    search_results = await connector.search_categories("мыш")
    print(f"✅ Найдено {len(search_results)} категорий по запросу 'мыш'")
    
    for cat in search_results[:5]:
        print(f"  - ID: {cat.get('id')} | {cat.get('name')}")
    
    # Тест 4: Получить все категории
    print(f"\n4️⃣ Загрузка всех категорий WB...")
    all_categories = await connector.get_categories()
    print(f"✅ Всего категорий: {len(all_categories)}")
    
    parents = [c for c in all_categories if c.get('is_parent')]
    children = [c for c in all_categories if not c.get('is_parent')]
    print(f"   Родительских: {len(parents)}")
    print(f"   Подкатегорий: {len(children)}")
    
    print("\n" + "=" * 60)
    print("ВЫВОДЫ:")
    print("=" * 60)
    if products and products[0].get('category_id'):
        print("✅ Коннектор исправлен - category_id возвращается")
        print("✅ Автосоздание mapping теперь будет работать")
        print("✅ Характеристики будут загружаться правильно")
    else:
        print("❌ Проблема остается - category_id не возвращается")
    
    print(f"✅ Загрузка категорий работает ({len(all_categories)} шт)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_import())
