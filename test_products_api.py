import asyncio
import sys
sys.path.append('backend')
from backend.services.product_service import ProductService

async def test_products():
    try:
        # Use the seller_id from our test data
        seller_id = "6974099198874d5e82417822"
        
        products = await ProductService.get_products(
            seller_id=seller_id,
            skip=0,
            limit=50
        )
        
        print(f'Found {len(products)} products')
        
        for i, p in enumerate(products):
            print(f'\n=== Product {i+1} ===')
            print(f'ID: {p.get("id")}')
            print(f'Name: {p.get("name")}')
            print(f'Article: {p.get("article")}')
            print(f'Price: {p.get("price")}')
            print(f'Status: {p.get("status")}')
            print(f'Category Name: {p.get("category_name")}')
            print(f'Verified: {p.get("verified")}')
            print(f'Variants Count: {p.get("variants_count")}')
            print(f'Tags: {p.get("tags")}')
            
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_products())
