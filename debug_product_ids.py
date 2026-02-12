import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database
from bson import ObjectId

async def debug_product_ids():
    try:
        db = await get_database()
        
        # Проверяем товары
        products = await db.products.find({}).to_list(None)
        print("Товары:")
        for p in products:
            print(f"  _id: {p['_id']} (тип: {type(p['_id'])})")
            print(f"  article: {p.get('article')}")
        
        # Проверяем inventory
        inventory = await db.inventory.find({}).to_list(None)
        print("\nInventory:")
        for inv in inventory:
            product_id = inv.get('product_id')
            print(f"  product_id: {product_id} (тип: {type(product_id)})")
            
            # Пробуем найти товар
            if isinstance(product_id, str):
                # Пробуем как ObjectId
                try:
                    obj_id = ObjectId(product_id)
                    product = await db.products.find_one({"_id": obj_id})
                    if product:
                        print(f"    ✅ Найден по ObjectId: {product.get('article')}")
                    else:
                        print(f"    ❌ Не найден по ObjectId")
                except:
                    print(f"    ❌ Неверный ObjectId")
                
                # Пробуем как строку
                product = await db.products.find_one({"_id": product_id})
                if product:
                    print(f"    ✅ Найден по строке: {product.get('article')}")
                else:
                    print(f"    ❌ Не найден по строке")
            
            print()
            
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(debug_product_ids())
