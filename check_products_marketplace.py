import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_products_marketplace():
    try:
        db = await get_database()
        products = await db.products.find({}).to_list(length=5)
        
        print('Товары и их связи с МП:')
        for product in products:
            print(f'Товар: {product.get("article")}')
            marketplaces = product.get('marketplaces', {})
            if 'ozon' in marketplaces:
                ozon_data = marketplaces['ozon']
                print(f'  Ozon: product_id={ozon_data.get("product_id")}, enabled={ozon_data.get("enabled")}')
            else:
                print(f'  Ozon: нет связи')
            print()
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_products_marketplace())
