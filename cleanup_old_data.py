import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def cleanup_old_data():
    try:
        db = await get_database()
        
        # Удаляем тестовые товары из product_catalog
        result = await db.product_catalog.delete_many({"article": {"$regex": "TEST"}})
        print(f'Удалено тестовых товаров из product_catalog: {result.deleted_count}')
        
        # Показываем сколько осталось
        remaining = await db.product_catalog.count_documents({})
        print(f'Осталось товаров в product_catalog: {remaining}')
        
        # Можно также удалить всю коллекцию если она не нужна
        # await db.product_catalog.drop()
        # print('Коллекция product_catalog удалена')
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(cleanup_old_data())
