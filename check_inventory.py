import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_inventory():
    try:
        db = await get_database()
        
        # Проверяем inventory коллекцию
        inventory_count = await db.inventory.count_documents({})
        print(f'Всего записей в inventory: {inventory_count}')
        
        if inventory_count > 0:
            inventory_items = await db.inventory.find({}).limit(3).to_list(None)
            for item in inventory_items:
                print(f'Inventory: product_id={item.get("product_id")}, quantity={item.get("quantity")}')
        
        # Проверяем есть ли у товаров inventory записи
        products = await db.products.find({}).to_list(None)
        print(f'\nТоваров в БД: {len(products)}')
        
        for product in products:
            product_id = str(product.get("_id"))
            inventory = await db.inventory.find_one({"product_id": product_id})
            print(f'Товар {product.get("article")}: inventory={"exists" if inventory else "missing"}')
            
    except Exception as e:
        print(f'Ошибка: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_inventory())
