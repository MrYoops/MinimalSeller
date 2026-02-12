#!/usr/bin/env python3
"""
Создание тестовых товаров маркетплейсов для демонстрации синхронизации
"""

import asyncio
import sys
sys.path.append('backend')

async def create_test_marketplace_products():
    """Создать тестовые товары маркетплейсов с артикулами для сопоставления"""
    try:
        from backend.core.database import get_database
        from bson import ObjectId
        
        db = await get_database()
        
        # Получаем seller_id
        seller_id = "6974099198874d5e82417822"
        seller_object_id = ObjectId(seller_id)
        
        print("🏪 Создание тестовых товаров маркетплейсов...")
        
        # Тестовые товары Ozon с артикулами, которые совпадают с локальными
        ozon_products = [
            {
                "id": "OZON-12345",
                "sku": "nikedunklow-hemp-wearstudio",  # Совпадает с локальным
                "offer_id": "nikedunklow-hemp-wearstudio",
                "name": "Nike Dunk Low Next Nature Hemp - Оригинал",
                "price": 15999.0,
                "description": "Оригинальные кроссовки Nike из натуральных материалов",
                "images": [
                    "https://ozon.ru/image1.jpg",
                    "https://ozon.ru/image2.jpg"
                ],
                "stock": 15,
                "marketplace": "ozon",
                "rating": 4.8,
                "reviews": 234,
                "category": "Кроссовки",
                "brand": "Nike"
            },
            {
                "id": "OZON-67890",
                "sku": "premiata-navy-wearstudio",  # Совпадает с локальным
                "offer_id": "premiata-navy-wearstudio",
                "name": "PREMIATA 183305 Navy - Итальянская классика",
                "price": 25999.0,
                "description": "Премиальные итальянские кроссовки из замши",
                "images": [
                    "https://ozon.ru/premiata1.jpg",
                    "https://ozon.ru/premiata2.jpg"
                ],
                "stock": 8,
                "marketplace": "ozon",
                "rating": 4.9,
                "reviews": 156,
                "category": "Кроссовки",
                "brand": "PREMIATA"
            },
            {
                "id": "OZON-11111",
                "sku": "adidas-ultraboost-22",  # Новый товар для создания
                "offer_id": "adidas-ultraboost-22",
                "name": "Adidas Ultraboost 22 - Беговые кроссовки",
                "price": 18999.0,
                "description": "Легкие беговые кроссовки с технологией Boost",
                "images": [
                    "https://ozon.ru/adidas1.jpg",
                    "https://ozon.ru/adidas2.jpg"
                ],
                "stock": 12,
                "marketplace": "ozon",
                "rating": 4.7,
                "reviews": 89,
                "category": "Кроссовки",
                "brand": "Adidas"
            },
            {
                "id": "OZON-22222",
                "sku": "newbalance-574",  # Новый товар для создания
                "offer_id": "newbalance-574",
                "name": "New Balance 574 - Классические кроссовки",
                "price": 12999.0,
                "description": "Классические кроссовки в ретро стиле",
                "images": [
                    "https://ozon.ru/nb1.jpg",
                    "https://ozon.ru/nb2.jpg"
                ],
                "stock": 20,
                "marketplace": "ozon",
                "rating": 4.6,
                "reviews": 67,
                "category": "Кроссовки",
                "brand": "New Balance"
            }
        ]
        
        # Тестовые товары Wildberries
        wb_products = [
            {
                "id": "WB-33333",
                "sku": "nikedunklow-hemp-wearstudio",  # Совпадает с локальным
                "nm_id": "123456789",
                "name": "Nike Dunk Low Hemp - WB Эксклюзив",
                "price": 16499.0,
                "description": "Эксклюзивная версия для Wildberries",
                "images": [
                    "https://wb.ru/image1.jpg",
                    "https://wb.ru/image2.jpg"
                ],
                "stock": 10,
                "marketplace": "wb",
                "rating": 4.7,
                "reviews": 198,
                "category": "Обувь",
                "brand": "Nike"
            },
            {
                "id": "WB-44444",
                "sku": "puma-suede-classic",  # Новый товар
                "nm_id": "987654321",
                "name": "Puma Suede Classic - Легендарные кроссовки",
                "price": 11999.0,
                "description": "Классические кроссовки Puma в стиле 70-х",
                "images": [
                    "https://wb.ru/puma1.jpg",
                    "https://wb.ru/puma2.jpg"
                ],
                "stock": 25,
                "marketplace": "wb",
                "rating": 4.5,
                "reviews": 143,
                "category": "Обувь",
                "brand": "Puma"
            }
        ]
        
        # Создаем/обновляем коллекцию с тестовыми товарами маркетплейсов
        await db.marketplace_products.delete_many({"seller_id": seller_object_id})
        
        # Добавляем Ozon товары
        ozon_docs = []
        for product in ozon_products:
            product["seller_id"] = seller_object_id
            product["created_at"] = "2024-01-15T10:00:00Z"
            product["updated_at"] = "2024-01-15T10:00:00Z"
            ozon_docs.append(product)
        
        if ozon_docs:
            await db.marketplace_products.insert_many(ozon_docs)
            print(f"✅ Создано {len(ozon_docs)} товаров Ozon")
        
        # Добавляем WB товары
        wb_docs = []
        for product in wb_products:
            product["seller_id"] = seller_object_id
            product["created_at"] = "2024-01-15T10:00:00Z"
            product["updated_at"] = "2024-01-15T10:00:00Z"
            wb_docs.append(product)
        
        if wb_docs:
            await db.marketplace_products.insert_many(wb_docs)
            print(f"✅ Создано {len(wb_docs)} товаров Wildberries")
        
        # Обновляем информацию об интеграции
        await db.api_keys.update_many(
            {"seller_id": seller_object_id},
            {
                "$set": {
                    "last_sync": "2024-01-15T10:00:00Z",
                    "status": "active"
                }
            }
        )
        
        print("\n📊 Статистика созданных товаров:")
        print(f"   Ozon: {len(ozon_docs)} товаров")
        print(f"   Wildberries: {len(wb_docs)} товаров")
        print(f"   Всего: {len(ozon_docs) + len(wb_docs)} товаров")
        
        print(f"\n🎯 Артикулы для сопоставления:")
        print(f"   ✅ nikedunklow-hemp-wearstudio (есть в локальных)")
        print(f"   ✅ premiata-navy-wearstudio (есть в локальных)")
        print(f"   🆕 adidas-ultraboost-22 (новый)")
        print(f"   🆕 newbalance-574 (новый)")
        print(f"   🆕 puma-suede-classic (новый)")
        
        print("\n🎉 Тестовые товары маркетплейсов созданы успешно!")
        print("Теперь можно тестировать синхронизацию по артикулам.")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_test_marketplace_products())
