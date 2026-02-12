#!/usr/bin/env python3
"""
Проверка текущих API ключей для пользователя seller
"""

import asyncio
import sys
sys.path.append('backend')

async def check_current_api_keys():
    """Проверить текущие API ключи в системе"""
    try:
        from backend.core.database import get_database
        from bson import ObjectId
        
        db = await get_database()
        
        print("🔍 Проверка текущих API ключей...")
        
        # Находим пользователя seller@test.com
        seller_user = await db.users.find_one({"email": "seller@test.com"})
        if not seller_user:
            print("❌ Пользователь seller@test.com не найден")
            return
        
        seller_id = str(seller_user["_id"])
        print(f"✅ Пользователь найден: {seller_user['email']} (ID: {seller_id})")
        
        # Проверяем профиль продавца
        profile = await db.seller_profiles.find_one({
            "$or": [
                {"user_id": seller_id},
                {"user_id": ObjectId(seller_id) if ObjectId.is_valid(seller_id) else seller_id}
            ]
        })
        
        if not profile:
            print("❌ Профиль продавца не найден")
            return
        
        print(f"✅ Профиль найден: {profile.get('company_name', 'N/A')}")
        
        # Проверяем API ключи
        api_keys = profile.get("api_keys", [])
        print(f"📋 Найдено API ключей: {len(api_keys)}")
        
        for i, key in enumerate(api_keys):
            print(f"\n--- Ключ #{i+1} ---")
            print(f"ID: {key.get('id', 'N/A')}")
            print(f"Маркетплейс: {key.get('marketplace', 'N/A')}")
            print(f"Название: {key.get('name', 'N/A')}")
            print(f"Статус: {key.get('status', 'N/A')}")
            print(f"Последняя синхронизация: {key.get('last_sync', 'N/A')}")
            print(f"Client ID: {key.get('client_id', 'N/A')}")
            print(f"API Key: {'***' + key.get('api_key', '')[-10:] if key.get('api_key') else 'N/A'}")
        
        # Проверяем, какой ID используется в frontend
        print(f"\n🎯 ID используемый в frontend: 070911de-47aa-4bb0-bb15-3174b073edbd")
        
        matching_key = None
        for key in api_keys:
            if key.get('id') == '070911de-47aa-4bb0-bb15-3174b073edbd':
                matching_key = key
                break
        
        if matching_key:
            print(f"✅ Найден ключ с ID из frontend:")
            print(f"   Маркетплейс: {matching_key.get('marketplace')}")
            print(f"   Название: {matching_key.get('name')}")
            print(f"   Статус: {matching_key.get('status')}")
        else:
            print(f"❌ Ключ с ID '070911de-47aa-4bb0-bb15-3174b073edbd' не найден!")
            print(f"🔄 Доступные ID ключей:")
            for key in api_keys:
                print(f"   - {key.get('id')} ({key.get('marketplace')} - {key.get('name')})")
        
        # Проверяем тестовые товары маркетплейсов
        print(f"\n🏪 Проверка тестовых товаров маркетплейсов...")
        
        seller_object_id = ObjectId(seller_id)
        
        ozon_count = await db.marketplace_products.count_documents({
            "marketplace": "ozon",
            "seller_id": seller_object_id
        })
        
        wb_count = await db.marketplace_products.count_documents({
            "marketplace": "wb", 
            "seller_id": seller_object_id
        })
        
        print(f"   Ozon товары: {ozon_count}")
        print(f"   Wildberries товары: {wb_count}")
        
        if ozon_count == 0 and wb_count == 0:
            print("⚠️ Тестовые товары не найдены! Нужно запустить скрипт создания.")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_current_api_keys())
