#!/usr/bin/env python3
"""
Обновление ID интеграции в тестовых товарах маркетплейсов
"""

import asyncio
import sys
sys.path.append('backend')

async def update_integration_id():
    """Обновить ID интеграции в тестовых товарах"""
    try:
        from backend.core.database import get_database
        from bson import ObjectId
        
        db = await get_database()
        
        print("🔄 Обновление ID интеграции в тестовых товарах...")
        
        # Новый правильный ID
        new_integration_id = "6a64ba4f-8c91-4efe-802d-a8a3d82f545c"
        
        # Обновляем Ozon товары
        ozon_result = await db.marketplace_products.update_many(
            {
                "marketplace": "ozon",
                "seller_id": ObjectId("6974099198874d5e82417822")
            },
            {
                "$set": {
                    "integration_id": new_integration_id,
                    "updated_at": "2024-01-15T11:00:00Z"
                }
            }
        )
        
        print(f"✅ Обновлено Ozon товаров: {ozon_result.modified_count}")
        
        # Обновляем WB товары
        wb_result = await db.marketplace_products.update_many(
            {
                "marketplace": "wb",
                "seller_id": ObjectId("6974099198874d5e82417822")
            },
            {
                "$set": {
                    "integration_id": new_integration_id,
                    "updated_at": "2024-01-15T11:00:00Z"
                }
            }
        )
        
        print(f"✅ Обновлено WB товаров: {wb_result.modified_count}")
        
        # Проверяем результат
        ozon_count = await db.marketplace_products.count_documents({
            "marketplace": "ozon",
            "seller_id": ObjectId("6974099198874d5e82417822"),
            "integration_id": new_integration_id
        })
        
        wb_count = await db.marketplace_products.count_documents({
            "marketplace": "wb",
            "seller_id": ObjectId("6974099198874d5e82417822"),
            "integration_id": new_integration_id
        })
        
        print(f"\n📊 Результат:")
        print(f"   Ozon товары с правильным ID: {ozon_count}")
        print(f"   WB товары с правильным ID: {wb_count}")
        print(f"   Новый ID интеграции: {new_integration_id}")
        
        print(f"\n🎉 ID интеграции успешно обновлен!")
        print(f"Теперь frontend должен находить правильные товары.")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(update_integration_id())
