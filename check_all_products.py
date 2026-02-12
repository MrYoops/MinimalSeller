import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_all_products():
    try:
        db = await get_database()
        
        # Все товары
        all_products = await db.products.find({}).to_list(None)
        print(f'Всего товаров в БД: {len(all_products)}')
        
        # Группируем по article для поиска дубликатов
        articles = {}
        for p in all_products:
            article = p.get('article', 'NO-ARTICLE')
            if article not in articles:
                articles[article] = []
            articles[article].append(p)
        
        print(f'\nАнализ дубликатов:')
        duplicates = 0
        for article, products in articles.items():
            if len(products) > 1:
                print(f'Дубликат: {article} - {len(products)} штук')
                duplicates += len(products) - 1
                for i, p in enumerate(products):
                    print(f'  {i+1}: ID={p.get("_id")}, name={p.get("minimalmod", {}).get("name", "NO NAME")[:50]}')
        
        print(f'\nВсего дубликатов: {duplicates}')
        
        # Показываем тестовые товары
        print(f'\nТестовые товары (содержат "TEST"):')
        test_products = [p for p in all_products if 'TEST' in p.get('article', '')]
        print(f'Найдено тестовых товаров: {len(test_products)}')
        for p in test_products[:5]:  # Первые 5
            print(f'  {p.get("article")}: {p.get("minimalmod", {}).get("name", "NO NAME")[:50]}')
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_all_products())
