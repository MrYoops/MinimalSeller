import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_inventory_for_sync():
    try:
        db = await get_database()
        
        # Проверяем inventory для нашего seller
        seller_id = "6974099198874d5e82417822"
        inventories = await db.inventory.find({"seller_id": seller_id}).to_list(None)
        
        print(f"Inventory записей для seller: {len(inventories)}")
        
        for inv in inventories:
            print(f"  Product ID: {inv.get('product_id')}")
            print(f"  Available: {inv.get('available')}")
            print(f"  SKU: {inv.get('sku')}")
            
            # Проверяем связанный товар
            product = await db.products.find_one({"_id": inv.get("product_id")})
            if product:
                print(f"    Товар: {product.get('article')} - {product.get('minimalmod', {}).get('name', 'NO NAME')[:30]}")
            else:
                print(f"    ❌ Товар не найден!")
            print()
            
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(check_inventory_for_sync())
