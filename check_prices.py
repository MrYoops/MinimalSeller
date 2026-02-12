import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_prices():
    try:
        db = await get_database()
        products = await db.products.find({}).to_list(None)
        
        for p in products:
            print(f'Товар: {p.get("article")}')
            print(f'  Цена в БД: {p.get("price")} (тип: {type(p.get("price"))})')
            print(f'  minimalmod: {p.get("minimalmod", {})}')
            print()
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(check_prices())
