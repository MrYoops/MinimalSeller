import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_nike_inventory():
    try:
        db = await get_database()
        
        # Проверяем inventory для nike товара
        inventory = await db.inventory.find({'article': 'nikedunklow-hemp-wearstudio'}).to_list(None)
        print(f'Inventory записей для nike: {len(inventory)}')
        for inv in inventory:
            print(f'  quantity: {inv.get("quantity")}')
            print(f'  available: {inv.get("available")}')
            print(f'  reserved: {inv.get("reserved")}')
            print(f'  product_id: {inv.get("product_id")}')
            print()
        
        # Проверяем сам товар
        product = await db.products.find_one({'article': 'nikedunklow-hemp-wearstudio'})
        if product:
            print(f'Товар найден: {product.get("article")}')
            print(f'  _id: {product.get("_id")}')
            marketplaces = product.get('marketplaces', {})
            if 'ozon' in marketplaces:
                ozon = marketplaces['ozon']
                print(f'  Ozon product_id: {ozon.get("product_id")}')
                print(f'  Ozon enabled: {ozon.get("enabled")}')
            else:
                print('  Ozon: нет связи')
        
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_nike_inventory())
