import requests

# Пробуем получить фото для товара
try:
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"
    }
    
    response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    token = response.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Получаем фото первого товара
    response = requests.get("http://localhost:8000/api/products/698c5e5bbf935af7f2aa42d5/photos", headers=headers)
    print(f"Фото статус: {response.status_code}")
    
    if response.status_code == 200:
        photos = response.json()
        print(f"Получено фото: {len(photos)}")
        for i, photo in enumerate(photos[:3]):  # Первые 3 фото
            print(f"  {i+1}: {photo.get('url', 'NO URL')}")
    else:
        print(f"Ошибка: {response.text[:200]}")
        
except Exception as e:
    print(f"Ошибка: {e}")
