import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def remove_imported_tags():
    try:
        db = await get_database()
        
        # Удаляем тег 'imported' у всех товаров
        result = await db.products.update_many(
            {},
            {"$pull": {"tags": "imported"}}
        )
        
        print(f'Удален тег "imported" у {result.modified_count} товаров')
        
        # Проверяем результат
        products = await db.products.find({}).to_list(None)
        for p in products:
            print(f'Товар: {p.get("article")} - теги: {p.get("tags", [])}')
            
    except Exception as e:
        print(f'Ошибка: {e}')

if __name__ == "__main__":
    asyncio.run(remove_imported_tags())
