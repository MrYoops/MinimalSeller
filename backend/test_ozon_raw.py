"""
Прямой тест Ozon API - что именно возвращается
"""

import asyncio
import httpx
import json

CLIENT_ID = "3152566"
API_KEY = "71389f62-904f-4030-a7e7-675cc832f831"
BASE_URL = "https://api-seller.ozon.ru"

async def test():
    headers = {
        "Client-Id": CLIENT_ID,
        "Api-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    print("="*60)
    print("ТЕСТ OZON API")
    print("="*60)
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        
        # Метод 1: /v1/description-category/tree
        print("\n1️⃣ GET /v1/description-category/tree")
        try:
            response = await client.post(
                f"{BASE_URL}/v1/description-category/tree",
                headers=headers,
                json={"language": "DEFAULT"}
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                result = data.get('result', [])
                print(f"✅ Получено: {len(result)} категорий")
                
                # Показать структуру первой
                if result:
                    print(f"\n📋 Структура первой категории:")
                    print(json.dumps(result[0], indent=2, ensure_ascii=False)[:500])
            else:
                print(f"❌ Ошибка: {response.text}")
        except Exception as e:
            print(f"❌ Исключение: {e}")
        
        # Метод 2: /v2/category/tree
        print("\n2️⃣ GET /v2/category/tree")
        try:
            response = await client.post(
                f"{BASE_URL}/v2/category/tree",
                headers=headers,
                json={"language": "DEFAULT"}
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                result = data.get('result', [])
                print(f"✅ Получено: {len(result)} категорий")
                
                if result:
                    print(f"\n📋 Структура первой категории:")
                    print(json.dumps(result[0], indent=2, ensure_ascii=False)[:500])
            else:
                print(f"❌ Ошибка: {response.text}")
        except Exception as e:
            print(f"❌ Исключение: {e}")

if __name__ == "__main__":
    asyncio.run(test())
