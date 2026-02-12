import requests

# Пробуем новый endpoint синхронизации
try:
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"
    }
    
    response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    token = response.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Вызываем sync-catalog
    response = requests.post("http://localhost:8000/api/inventory/sync-catalog", headers=headers)
    print(f"Sync-catalog статус: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Результат: {result}")
    else:
        print(f"Ошибка: {response.text[:300]}")
        
except Exception as e:
    print(f"Ошибка: {e}")
