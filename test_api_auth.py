import requests
import json

# Пробуем получить товары без авторизации (должно быть 401)
try:
    response = requests.get("http://localhost:8000/api/products")
    print(f"Без авторизации: {response.status_code}")
    if response.status_code == 401:
        print("✅ Требуется авторизация (корректно)")
    else:
        print(f"❌ Неправильный статус: {response.text[:200]}")
except Exception as e:
    print(f"Ошибка запроса: {e}")

# Пробуем авторизоваться как seller@test.com
try:
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"  # Стандартный пароль для тестов
    }
    
    response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    print(f"\nЛогин: {response.status_code}")
    
    if response.status_code == 200:
        token_data = response.json()
        token = token_data.get("access_token")
        print(f"✅ Успешный вход, токен получен")
        
        # Теперь пробуем получить товары с токеном
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get("http://localhost:8000/api/products", headers=headers)
        print(f"Товары с токеном: {response.status_code}")
        
        if response.status_code == 200:
            products = response.json()
            print(f"✅ Получено товаров: {len(products)}")
            for p in products:
                print(f"  - {p.get('article')}: {p.get('name', 'NO NAME')}")
        else:
            print(f"❌ Ошибка получения товаров: {response.text[:200]}")
    else:
        print(f"❌ Ошибка логина: {response.text[:200]}")
        
except Exception as e:
    print(f"Ошибка: {e}")
