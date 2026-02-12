import asyncio
import sys
sys.path.append('backend')
from backend.services.product_service import ProductService

async def debug_products():
    try:
        # Проверяем все товары в БД без фильтрации по seller_id
        from backend.core.database import get_database
        db = await get_database()
        
        all_products = await db.products.find({}).to_list(None)
        print(f'Всего товаров в БД: {len(all_products)}')
        
        for i, p in enumerate(all_products):
            print(f'\n=== Товар {i+1} ===')
            print(f'ID: {p["_id"]}')
            print(f'Seller ID: {p.get("seller_id")} (тип: {type(p.get("seller_id"))})')
            print(f'Name: {p.get("name")}')
            print(f'Minimalmod name: {p.get("minimalmod", {}).get("name")}')
            print(f'Article: {p.get("article")}')
            print(f'Status: {p.get("status")}')
            print(f'Price: {p.get("price")}')
        
        # Теперь проверим с конкретным seller_id
        seller_id = "6974099198874d5e82417822"
        print(f'\n\n=== Проверка для seller_id: {seller_id} ===')
        
        products = await ProductService.get_products(
            seller_id=seller_id,
            skip=0,
            limit=50
        )
        
        print(f'Найдено товаров для seller: {len(products)}')
        for p in products:
            print(f'- {p.get("article")}: {p.get("name")}')
            
    except Exception as e:
        print(f'Ошибка: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_products())
