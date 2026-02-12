"""
Проверка как получить ВСЕ subjects (subcategories) WB
"""

import asyncio
import httpx

API_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzc5ODQzMTQyLCJpZCI6IjAxOWFiYjEyLTdlN2UtN2JlOS1hMTQyLWRjODg2MTZjOWM3NyIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.dsPgDDcu5peT7fF0ImzEBclegtzsJEb3zpbrYrqJc0gHu0-FHG-tf4pZuiSb-eA7rEoDhthSJsBBdoqPfAZVGg"
CONTENT_API = "https://content-api.wildberries.ru"

def get_headers():
    return {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json"
    }

async def test_all_methods():
    print("\n" + "="*60)
    print("ПОИСК СПОСОБА ПОЛУЧИТЬ ВСЕ SUBJECTS WB")
    print("="*60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # Метод 1: /object/all
        print("\n1️⃣ Метод: GET /content/v2/object/all")
        try:
            response = await client.get(
                f"{CONTENT_API}/content/v2/object/all",
                headers=get_headers(),
                params={"top": 5000}  # Пробуем получить до 5000
            )
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                subjects = data.get('data', [])
                print(f"✅ Получено: {len(subjects)} subjects")
                
                # Показать первые 10
                for subj in subjects[:10]:
                    print(f"   - ID: {subj.get('objectID')} | {subj.get('objectName')} (parent: {subj.get('parentName')})")
            else:
                print(f"❌ Ошибка: {response.text}")
        except Exception as e:
            print(f"❌ Исключение: {e}")
        
        # Метод 2: /object/parent/{id}/list для КАЖДОГО parent
        print("\n2️⃣ Метод: GET /content/v2/object/parent/{id}/list (для каждого parent)")
        try:
            # Сначала получим parents
            response = await client.get(
                f"{CONTENT_API}/content/v2/object/parent/all",
                headers=get_headers()
            )
            
            if response.status_code == 200:
                parents = response.json().get('data', [])
                print(f"Родителей: {len(parents)}")
                
                total_subjects = 0
                
                # Пробуем для первых 3 родителей
                for parent in parents[:3]:
                    parent_id = parent.get('id')
                    parent_name = parent.get('name')
                    
                    try:
                        resp = await client.get(
                            f"{CONTENT_API}/content/v2/object/parent/{parent_id}/list",
                            headers=get_headers()
                        )
                        
                        if resp.status_code == 200:
                            subjects = resp.json().get('data', [])
                            total_subjects += len(subjects)
                            print(f"   Parent '{parent_name}': {len(subjects)} subjects")
                        else:
                            print(f"   Parent '{parent_name}': ❌ {resp.status_code}")
                    except:
                        print(f"   Parent '{parent_name}': ❌ Ошибка")
                
                print(f"✅ Всего subjects (из 3 parents): {total_subjects}")
            else:
                print(f"❌ Не удалось получить parents")
        except Exception as e:
            print(f"❌ Исключение: {e}")
        
        # Метод 3: Простой endpoint /subjects (если есть)
        print("\n3️⃣ Метод: Пробуем другие endpoints...")
        endpoints = [
            "/content/v2/object/list",
            "/content/v2/subjects/all",
            "/content/v2/directory/subjects"
        ]
        
        for endpoint in endpoints:
            try:
                response = await client.get(
                    f"{CONTENT_API}{endpoint}",
                    headers=get_headers()
                )
                print(f"   {endpoint}: {response.status_code}")
                if response.status_code == 200:
                    print(f"      ✅ РАБОТАЕТ! {response.text[:200]}")
            except:
                print(f"   {endpoint}: ❌")

if __name__ == "__main__":
    asyncio.run(test_all_methods())
