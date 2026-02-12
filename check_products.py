import asyncio
import sys
sys.path.append('backend')
from bson import ObjectId
from backend.core.database import get_database

async def check_products():
    try:
        db = await get_database()
        count = await db.products.count_documents({})
        print(f'Total products in database: {count}')
        
        # List first few products
        products = await db.products.find({}).limit(3).to_list(None)
        for p in products:
            print(f'Product: {p.get("article", "N/A")} - {p.get("name", "N/A")}')
            
        # Check if there are any seller_id issues
        if count > 0:
            sample = await db.products.find_one({})
            print(f'Sample product seller_id type: {type(sample.get("seller_id"))}')
            print(f'Sample product keys: {list(sample.keys())}')
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_products())
