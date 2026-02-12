import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_inventory_duplicates():
    try:
        db = await get_database()
        
        # Проверяем inventory
        inventory_items = await db.inventory.find({}).to_list(None)
        print(f'Всего записей в inventory: {len(inventory_items)}')
        
        # Группируем по product_id
        product_groups = {}
        for item in inventory_items:
            product_id = str(item.get('product_id'))
            if product_id not in product_groups:
                product_groups[product_id] = []
            product_groups[product_id].append(item)
        
        print(f'\nАнализ дубликатов в inventory:')
        duplicates = 0
        for product_id, items in product_groups.items():
            if len(items) > 1:
                print(f'Дубликат inventory: {product_id} - {len(items)} записей')
                duplicates += len(items) - 1
        
        print(f'Всего дубликатов в inventory: {duplicates}')
        
        # Проверяем product_catalog (старая коллекция)
        catalog_items = await db.product_catalog.find({}).to_list(None)
        print(f'\nЗаписей в product_catalog: {len(catalog_items)}')
        
        if catalog_items:
            print('Первые 3 записи из product_catalog:')
            for item in catalog_items[:3]:
                print(f'  {item.get("article")}: {item.get("name", "NO NAME")[:50]}')
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_inventory_duplicates())
