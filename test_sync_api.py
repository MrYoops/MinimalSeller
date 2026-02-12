import requests

# Пробуем синхронизировать остатки
try:
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"
    }
    
    response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    token = response.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Синхронизируем остатки для склада
    sync_data = {
        "warehouse_id": "6975eb665bc5312a87e34c38"
        # Без product_article - синхронизируем все товары
    }
    
    response = requests.post("http://localhost:8000/api/stock-sync/manual", json=sync_data, headers=headers)
    print(f"Синхронизация статус: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Результат: {result}")
    else:
        print(f"Ошибка: {response.text[:300]}")
        
except Exception as e:
    print(f"Ошибка: {e}")
