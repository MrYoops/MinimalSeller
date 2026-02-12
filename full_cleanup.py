import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def full_cleanup():
    try:
        db = await get_database()
        
        print("=== ПОЛНАЯ ОЧИСТКА ТЕСТОВЫХ ТОВАРОВ ===")
        
        # 1. Проверяем и чистим products
        products = await db.products.find({}).to_list(None)
        test_products = [p for p in products if 'TEST' in p.get('article', '')]
        print(f"Тестовых товаров в products: {len(test_products)}")
        
        if test_products:
            for p in test_products:
                print(f"  Удаляю: {p.get('article')}")
                await db.products.delete_one({"_id": p["_id"]})
        
        # 2. Проверяем и чистим product_catalog
        catalog = await db.product_catalog.find({}).to_list(None)
        test_catalog = [p for p in catalog if 'TEST' in p.get('article', '')]
        print(f"Тестовых товаров в product_catalog: {len(test_catalog)}")
        
        if test_catalog:
            for p in test_catalog:
                print(f"  Удаляю: {p.get('article')}")
                await db.product_catalog.delete_one({"_id": p["_id"]})
        
        # 3. Проверяем дубликаты в product_catalog по article
        catalog_after = await db.product_catalog.find({}).to_list(None)
        articles = {}
        duplicates_to_delete = []
        
        for p in catalog_after:
            article = p.get('article', '')
            if article in articles:
                duplicates_to_delete.append(p["_id"])
                print(f"  Дубликат для удаления: {article}")
            else:
                articles[article] = p["_id"]
        
        # Удаляем дубликаты (оставляем первые)
        for dup_id in duplicates_to_delete:
            await db.product_catalog.delete_one({"_id": dup_id})
        
        print(f"Удалено дубликатов: {len(duplicates_to_delete)}")
        
        # 4. Чистим inventory от несуществующих товаров
        all_products = await db.products.find({}).to_list(None)
        valid_product_ids = [str(p["_id"]) for p in all_products]
        
        inventory = await db.inventory.find({}).to_list(None)
        invalid_inventory = [inv for inv in inventory if str(inv.get("product_id")) not in valid_product_ids]
        
        print(f"Невалидных записей в inventory: {len(invalid_inventory)}")
        for inv in invalid_inventory:
            print(f"  Удаляю inventory: {inv.get('product_id')}")
            await db.inventory.delete_one({"_id": inv["_id"]})
        
        print("\n=== ИТОГОВЫЙ СТАТУС ===")
        print(f"Products: {await db.products.count_documents({})}")
        print(f"Product_catalog: {await db.product_catalog.count_documents({})}")
        print(f"Inventory: {await db.inventory.count_documents({})}")
        
    except Exception as e:
        print(f"Ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(full_cleanup())
