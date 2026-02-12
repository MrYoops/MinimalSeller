import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def fix_inventory_product_ids():
    try:
        db = await get_database()
        
        # Получаем все товары
        products = await db.products.find({}).to_list(None)
        print(f"Товаров в БД: {len(products)}")
        
        # Создаем маппинг article -> product_id
        article_to_id = {}
        for product in products:
            article = product.get('article')
            if article:
                article_to_id[article] = str(product["_id"])
        
        print(f"Маппинг article -> product_id: {len(article_to_id)} записей")
        
        # Исправляем inventory записи
        inventory = await db.inventory.find({}).to_list(None)
        print(f"Inventory записей: {len(inventory)}")
        
        fixed = 0
        for inv in inventory:
            sku = inv.get('sku')
            if sku in article_to_id:
                correct_product_id = article_to_id[sku]
                current_product_id = str(inv.get('product_id'))
                
                if current_product_id != correct_product_id:
                    print(f"Исправляю {sku}: {current_product_id} -> {correct_product_id}")
                    await db.inventory.update_one(
                        {"_id": inv["_id"]},
                        {"$set": {"product_id": correct_product_id}}
                    )
                    fixed += 1
        
        print(f"Исправлено записей: {fixed}")
        
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(fix_inventory_product_ids())
