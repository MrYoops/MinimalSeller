import requests

# Проверяем что API возвращает правильные данные
try:
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"
    }
    
    response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    token = response.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Проверяем товары
    response = requests.get("http://localhost:8000/api/products", headers=headers)
    products = response.json()
    print(f"Товаров в API: {len(products)}")
    
    for p in products:
        print(f"  {p.get('article')}: {p.get('name', 'NO NAME')[:50]}")
    
    # Проверяем остатки
    response = requests.get("http://localhost:8000/api/inventory/fbs", headers=headers)
    inventory = response.json()
    print(f"\nОстатков в API: {len(inventory)}")
    
    for inv in inventory:
        print(f"  {inv.get('sku')}: {inv.get('available')} доступно")
        
except Exception as e:
    print(f"Ошибка: {e}")
