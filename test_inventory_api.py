import requests

# Пробуем получить остатки FBS
try:
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"
    }
    
    response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    token = response.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Получаем остатки FBS
    response = requests.get("http://localhost:8000/api/inventory/fbs", headers=headers)
    print(f"FBS остатки статус: {response.status_code}")
    
    if response.status_code == 200:
        inventory = response.json()
        print(f"Получено остатков: {len(inventory)}")
        for item in inventory[:3]:  # Первые 3
            print(f"  {item.get('sku')}: {item.get('available')} доступно")
    else:
        print(f"Ошибка: {response.text[:300]}")
        
except Exception as e:
    print(f"Ошибка: {e}")
