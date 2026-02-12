"""
Полный тест интеграции - проверка всех компонентов
"""
import asyncio
import sys

async def test_all():
    print("=" * 60)
    print("🧪 ТЕСТИРОВАНИЕ ВСЕХ КОМПОНЕНТОВ")
    print("=" * 60)
    
    # Test 1: Import modules
    print("\n1️⃣ Проверка импортов...")
    try:
        import httpx
        print("   ✅ httpx")
        import passlib
        print("   ✅ passlib")
        from connectors import get_connector, OzonConnector, WildberriesConnector, YandexMarketConnector, MarketplaceError
        print("   ✅ connectors")
        from motor.motor_asyncio import AsyncIOMotorClient
        print("   ✅ motor")
        from fastapi import FastAPI
        print("   ✅ fastapi")
        print("✅ Все модули импортированы успешно!\n")
    except Exception as e:
        print(f"❌ ОШИБКА ИМПОРТА: {e}")
        sys.exit(1)
    
    # Test 2: Test connector creation
    print("2️⃣ Проверка создания коннекторов...")
    try:
        ozon = get_connector("ozon", "test-client", "test-key")
        print(f"   ✅ OzonConnector: {ozon.marketplace_name}")
        
        wb = get_connector("wb", "", "test-token")
        print(f"   ✅ WildberriesConnector: {wb.marketplace_name}")
        
        yandex = get_connector("yandex", "12345", "y0_test")
        print(f"   ✅ YandexMarketConnector: {yandex.marketplace_name}")
        
        print("✅ Все коннекторы созданы успешно!\n")
    except Exception as e:
        print(f"❌ ОШИБКА СОЗДАНИЯ КОННЕКТОРОВ: {e}")
        sys.exit(1)
    
    # Test 3: Test headers
    print("3️⃣ Проверка генерации заголовков...")
    try:
        ozon_headers = ozon._get_headers()
        print(f"   Ozon headers: {list(ozon_headers.keys())}")
        assert "Client-Id" in ozon_headers
        assert "Api-Key" in ozon_headers
        assert "Origin" in ozon_headers
        assert "User-Agent" in ozon_headers
        print("   ✅ Ozon headers OK")
        
        wb_headers = wb._get_headers()
        print(f"   WB headers: {list(wb_headers.keys())}")
        assert "Authorization" in wb_headers
        assert "Origin" in wb_headers
        assert "User-Agent" in wb_headers
        print("   ✅ WB headers OK")
        
        yandex_headers = yandex._get_headers()
        print(f"   Yandex headers: {list(yandex_headers.keys())}")
        assert "Authorization" in yandex_headers
        assert "Bearer" in yandex_headers["Authorization"]
        assert "Origin" in yandex_headers
        print("   ✅ Yandex headers OK")
        
        print("✅ Все заголовки корректны!\n")
    except Exception as e:
        print(f"❌ ОШИБКА ГЕНЕРАЦИИ ЗАГОЛОВКОВ: {e}")
        sys.exit(1)
    
    # Test 4: Test MongoDB connection
    print("4️⃣ Проверка подключения к MongoDB...")
    try:
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["minimalmod"]
        
        # Simple query
        count = await db.users.count_documents({})
        print(f"   Найдено пользователей в БД: {count}")
        
        client.close()
        print("✅ MongoDB подключение работает!\n")
    except Exception as e:
        print(f"❌ ОШИБКА MONGODB: {e}")
        print("   Убедитесь что MongoDB запущена!")
        sys.exit(1)
    
    # Test 5: Test backend server
    print("5️⃣ Проверка Backend API...")
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8001/api/health")
            assert response.status_code == 200
            data = response.json()
            print(f"   Health check: {data['status']}")
            print("✅ Backend API работает!\n")
    except Exception as e:
        print(f"❌ ОШИБКА BACKEND: {e}")
        print("   Убедитесь что backend запущен на порту 8001!")
        sys.exit(1)
    
    print("=" * 60)
    print("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
    print("=" * 60)
    print("\n✅ Система готова к работе!")
    print("✅ Можете добавлять реальные API ключи и тестировать интеграции!")

if __name__ == "__main__":
    asyncio.run(test_all())
