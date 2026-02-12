import asyncio
import sys
sys.path.append('backend')
from bson import ObjectId
from backend.core.database import get_database

async def check_product_details():
    try:
        db = await get_database()
        products = await db.products.find({}).to_list(None)
        
        for i, p in enumerate(products):
            print(f'\n=== Product {i+1} ===')
            print(f'ID: {p["_id"]}')
            print(f'SKU: {p.get("sku")}')
            print(f'Article: {p.get("article")}')
            print(f'Name field: {p.get("name")}')
            print(f'Minimalmod name: {p.get("minimalmod", {}).get("name")}')
            print(f'Price: {p.get("price")}')
            print(f'Seller ID: {p.get("seller_id")}')
            
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_product_details())
