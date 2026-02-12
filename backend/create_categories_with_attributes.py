import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "minimalmod"

async def create_categories():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    # Удалим старые категории
    await db.categories.delete_many({})
    
    categories = [
        {
            'name': 'Electronics',
            'parent_id': None,
            'order': 0,
            'attributes': ['Brand', 'Model', 'Color', 'Warranty'],
            'marketplace_mapping': {
                'ozon': {
                    'category_id': '17028922',
                    'attribute_mapping': {
                        'Brand': 'Бренд',
                        'Model': 'Модель',
                        'Color': 'Цвет',
                        'Warranty': 'Гарантия'
                    }
                },
                'wildberries': {
                    'category_id': 'Электроника',
                    'attribute_mapping': {
                        'Brand': 'Бренд',
                        'Model': 'Модель',
                        'Color': 'Цвет',
                        'Warranty': 'Срок гарантии'
                    }
                },
                'yandex': {
                    'category_id': '91491',
                    'attribute_mapping': {
                        'Brand': 'vendor',
                        'Model': 'model',
                        'Color': 'color',
                        'Warranty': 'warranty_period'
                    }
                }
            },
            'created_at': datetime.utcnow()
        },
        {
            'name': 'Clothing',
            'parent_id': None,
            'order': 1,
            'attributes': ['Brand', 'Size', 'Color', 'Material', 'Season'],
            'marketplace_mapping': {
                'ozon': {
                    'category_id': '7500',
                    'attribute_mapping': {
                        'Brand': 'Бренд',
                        'Size': 'Размер',
                        'Color': 'Цвет',
                        'Material': 'Материал',
                        'Season': 'Сезон'
                    }
                },
                'wildberries': {
                    'category_id': 'Одежда',
                    'attribute_mapping': {
                        'Brand': 'Бренд',
                        'Size': 'Размер',
                        'Color': 'Цвет',
                        'Material': 'Состав',
                        'Season': 'Сезон'
                    }
                },
                'yandex': {
                    'category_id': '7811901',
                    'attribute_mapping': {
                        'Brand': 'vendor',
                        'Size': 'size',
                        'Color': 'color',
                        'Material': 'material',
                        'Season': 'season'
                    }
                }
            },
            'created_at': datetime.utcnow()
        }
    ]
    
    for cat in categories:
        await db.categories.insert_one(cat)
    
    print(f"✅ Создано {len(categories)} категорий с характеристиками и маппингом")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_categories())
