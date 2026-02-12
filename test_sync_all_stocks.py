import requests

# Пробуем endpoint sync-all-stocks
try:
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"
    }
    
    response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    token = response.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Проверяем warehouse
    response = requests.get("http://localhost:8000/api/warehouses", headers=headers)
    warehouses = response.json()
    print(f"Складов: {len(warehouses)}")
    
    if warehouses:
        warehouse = warehouses[0]
        print(f"Используем склад: {warehouse.get('name')} (ID: {warehouse.get('id')})")
        
        # Вызываем sync-all-stocks
        sync_data = {
            "warehouse_id": str(warehouse.get('id'))
        }
        
        response = requests.post("http://localhost:8000/api/inventory/sync-all-stocks", json=sync_data, headers=headers)
        print(f"Sync-all-stocks статус: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Результат: {result}")
        else:
            print(f"Ошибка: {response.text[:300]}")
    else:
        print("Склады не найдены")
        
except Exception as e:
    print(f"Ошибка: {e}")
