"""
Тест реального WB API с настоящим ключом
Проверяем что именно возвращает API
"""

import asyncio
import httpx
import json

# Реальный API ключ
API_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzc5ODQzMTQyLCJpZCI6IjAxOWFiYjEyLTdlN2UtN2JlOS1hMTQyLWRjODg2MTZjOWM3NyIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.dsPgDDcu5peT7fF0ImzEBclegtzsJEb3zpbrYrqJc0gHu0-FHG-tf4pZuiSb-eA7rEoDhthSJsBBdoqPfAZVGg"

CONTENT_API = "https://content-api.wildberries.ru"
MARKETPLACE_API = "https://marketplace-api.wildberries.ru"

def get_headers():
    return {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }


async def test_get_products():
    """Тест 1: Получить товары"""
    print("\n" + "="*60)
    print("ТЕСТ 1: Получение товаров с WB")
    print("="*60)
    
    url = f"{CONTENT_API}/content/v2/get/cards/list"
    headers = get_headers()
    payload = {
        "settings": {
            "cursor": {"limit": 5},  # Только 5 товаров для теста
            "filter": {"withPhoto": -1}
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                cards = data.get('cards', [])
                
                print(f"✅ Получено {len(cards)} товаров\n")
                
                if cards:
                    # Смотрим первый товар детально
                    card = cards[0]
                    
                    print("=== ПЕРВЫЙ ТОВАР (детально) ===")
                    print(f"nmID: {card.get('nmID')}")
                    print(f"vendorCode (артикул): {card.get('vendorCode')}")
                    print(f"title: {card.get('title')}")
                    print(f"brand: {card.get('brand')}")
                    print(f"object: {card.get('object')}")  # ЭТО НАЗВАНИЕ КАТЕГОРИИ
                    print(f"objectID: {card.get('objectID')}")  # ЭТО ID КАТЕГОРИИ!!!
                    print(f"subjectID: {card.get('subjectID')}")  # ЭТО ТОЖЕ ID
                    print(f"subjectName: {card.get('subjectName')}")
                    
                    print(f"\n=== ХАРАКТЕРИСТИКИ ({len(card.get('characteristics', []))}) ===")
                    for char in card.get('characteristics', [])[:5]:
                        print(f"  - {char.get('name')}: {char.get('value')}")
                    
                    print(f"\n=== ФОТО ({len(card.get('photos', []))}) ===")
                    for i, photo in enumerate(card.get('photos', [])[:3], 1):
                        print(f"  {i}. {photo.get('big', 'N/A')[:80]}...")
                    
                    print(f"\n=== ПОЛНАЯ СТРУКТУРА ТОВАРА ===")
                    print(json.dumps(card, indent=2, ensure_ascii=False)[:1500])
                    print("...")
                    
                return cards
            else:
                print(f"❌ Ошибка: {response.status_code}")
                print(response.text)
                
    except Exception as e:
        print(f"❌ Исключение: {e}")
        import traceback
        traceback.print_exc()


async def test_get_categories():
    """Тест 2: Получить категории (subjects)"""
    print("\n" + "="*60)
    print("ТЕСТ 2: Получение категорий (предметов)")
    print("="*60)
    
    url = f"{CONTENT_API}/content/v2/object/parent/all"
    headers = get_headers()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                parents = data.get('data', [])
                
                print(f"✅ Получено {len(parents)} родительских категорий\n")
                
                print("=== ПЕРВЫЕ 10 КАТЕГОРИЙ ===")
                for parent in parents[:10]:
                    print(f"  - ID: {parent.get('id')} | {parent.get('name')}")
                
                return parents
            else:
                print(f"❌ Ошибка: {response.status_code}")
                print(response.text)
                
    except Exception as e:
        print(f"❌ Исключение: {e}")


async def test_get_all_subjects():
    """Тест 3: Получить ВСЕ предметы (subcategories)"""
    print("\n" + "="*60)
    print("ТЕСТ 3: Получение ВСЕХ предметов (subcategories)")
    print("="*60)
    
    url = f"{CONTENT_API}/content/v2/object/all"
    headers = get_headers()
    params = {"top": 1000}  # Получить до 1000
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, params=params)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                subjects = data.get('data', [])
                
                print(f"✅ Получено {len(subjects)} предметов (subcategories)\n")
                
                print("=== ПЕРВЫЕ 20 ПРЕДМЕТОВ ===")
                for subj in subjects[:20]:
                    parent_name = subj.get('parentName', 'N/A')
                    print(f"  - ID: {subj.get('objectID')} | {subj.get('objectName')} (родитель: {parent_name})")
                
                # Найдем клавиатуры
                print("\n=== ПОИСК: Клавиатуры ===")
                keyboards = [s for s in subjects if 'клавиатур' in s.get('objectName', '').lower()]
                for kb in keyboards:
                    print(f"  - ID: {kb.get('objectID')} | {kb.get('objectName')}")
                
                # Найдем мыши
                print("\n=== ПОИСК: Мыши ===")
                mice = [s for s in subjects if 'мыш' in s.get('objectName', '').lower()]
                for m in mice:
                    print(f"  - ID: {m.get('objectID')} | {m.get('objectName')}")
                
                return subjects
            else:
                print(f"❌ Ошибка: {response.status_code}")
                print(response.text)
                
    except Exception as e:
        print(f"❌ Исключение: {e}")


async def test_get_characteristics_for_category(object_id):
    """Тест 4: Получить характеристики для категории"""
    print("\n" + "="*60)
    print(f"ТЕСТ 4: Получение характеристик для категории ID={object_id}")
    print("="*60)
    
    url = f"{CONTENT_API}/content/v2/object/charcs/{object_id}"
    headers = get_headers()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                charcs = data.get('data', [])
                
                print(f"✅ Получено {len(charcs)} характеристик\n")
                
                print("=== ХАРАКТЕРИСТИКИ (обязательные) ===")
                required = [c for c in charcs if c.get('required')]
                for char in required[:10]:
                    print(f"  ⭐ {char.get('charcName')} (ID: {char.get('charcID')})")
                
                print(f"\n=== ХАРАКТЕРИСТИКИ (опциональные) ===")
                optional = [c for c in charcs if not c.get('required')]
                for char in optional[:10]:
                    print(f"  - {char.get('charcName')} (ID: {char.get('charcID')})")
                
                return charcs
            else:
                print(f"❌ Ошибка: {response.status_code}")
                print(response.text)
                
    except Exception as e:
        print(f"❌ Исключение: {e}")


async def main():
    print("\n" + "="*60)
    print("ПОЛНАЯ ПРОВЕРКА WB API")
    print("="*60)
    
    # Тест 1: Товары
    products = await test_get_products()
    
    # Тест 2: Родительские категории
    await test_get_categories()
    
    # Тест 3: Все предметы (subcategories)
    subjects = await test_get_all_subjects()
    
    # Тест 4: Характеристики для первого товара
    if products:
        object_id = products[0].get('objectID')
        if object_id:
            await test_get_characteristics_for_category(object_id)
    
    print("\n" + "="*60)
    print("ВЫВОДЫ:")
    print("="*60)
    print("1. Проверьте какие поля есть у товара (objectID, subjectID)")
    print("2. Проверьте сколько всего категорий загружается")
    print("3. Проверьте формат характеристик")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
