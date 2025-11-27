#!/usr/bin/env python3
"""
Тестирование API модуля "Товары" (Каталог)
"""
import requests
import json
import os
from datetime import datetime

# Получить Backend URL из .env
BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", "https://catmaster-1.preview.emergentagent.com/api")

# Тестовые данные
TEST_USER = {
    "email": "seller@minimalmod.com",
    "password": "seller123"
}

# Цвета для вывода
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(name):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}ТЕСТ: {name}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

def print_success(message):
    print(f"{GREEN}✅ {message}{RESET}")

def print_error(message):
    print(f"{RED}❌ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ️  {message}{RESET}")

# Глобальные переменные для сохранения ID
token = None
category_id = None
product_id = None
variant_id = None
photo_id = None
warehouse_id = None

def login():
    """Авторизация"""
    global token
    print_test("Авторизация пользователя")
    
    response = requests.post(
        f"{BACKEND_URL}/auth/login",
        json=TEST_USER
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data["access_token"]
        print_success(f"Успешная авторизация: {TEST_USER['email']}")
        print_info(f"Token: {token[:20]}...")
        return True
    else:
        print_error(f"Ошибка авторизации: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def get_headers():
    """Получить заголовки с токеном"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

# ============================================
# ТЕСТЫ КАТЕГОРИЙ
# ============================================

def test_create_category():
    """Создать категорию"""
    global category_id
    print_test("Создание категории товаров")
    
    category_data = {
        "name": "Одежда",
        "group_by_color": True,
        "group_by_size": True,
        "common_attributes": {
            "material": "Хлопок",
            "country": "Россия"
        }
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/categories",
        headers=get_headers(),
        json=category_data
    )
    
    if response.status_code == 201:
        data = response.json()
        category_id = data["id"]
        print_success(f"Категория создана: {data['name']} (ID: {category_id})")
        print_info(f"Разделять по цвету: {data['group_by_color']}")
        print_info(f"Разделять по размеру: {data['group_by_size']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_get_categories():
    """Получить список категорий"""
    print_test("Получение списка категорий")
    
    response = requests.get(
        f"{BACKEND_URL}/catalog/categories",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Получено категорий: {len(data)}")
        for cat in data:
            print_info(f"  - {cat['name']} (товаров: {cat['products_count']})")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

# ============================================
# ТЕСТЫ ТОВАРОВ
# ============================================

def test_create_product():
    """Создать товар"""
    global product_id
    print_test("Создание товара")
    
    product_data = {
        "article": f"TEST-{int(datetime.now().timestamp())}",
        "name": "Футболка базовая",
        "brand": "TestBrand",
        "category_id": category_id,
        "description": "Удобная базовая футболка из хлопка",
        "status": "active",
        "is_grouped": True,
        "group_by_color": True,
        "group_by_size": True
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/products",
        headers=get_headers(),
        json=product_data
    )
    
    if response.status_code == 201:
        data = response.json()
        product_id = data["id"]
        print_success(f"Товар создан: {data['name']} (Артикул: {data['article']})")
        print_info(f"ID: {product_id}")
        print_info(f"Категория: {data['category_name']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_get_products():
    """Получить список товаров"""
    print_test("Получение списка товаров")
    
    response = requests.get(
        f"{BACKEND_URL}/catalog/products",
        headers=get_headers(),
        params={"limit": 10}
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Получено товаров: {len(data)}")
        for prod in data[:3]:
            print_info(f"  - {prod['article']}: {prod['name']} (вариаций: {prod['variants_count']}, фото: {prod['photos_count']})")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

# ============================================
# ТЕСТЫ ВАРИАЦИЙ
# ============================================

def test_create_variant():
    """Создать вариацию товара"""
    global variant_id
    print_test("Создание вариации товара (цвет + размер)")
    
    variant_data = {
        "color": "Красный",
        "size": "M",
        "sku": f"TEST-RED-M-{int(datetime.now().timestamp())}",
        "barcode": "1234567890123"
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/products/{product_id}/variants",
        headers=get_headers(),
        json=variant_data
    )
    
    if response.status_code == 201:
        data = response.json()
        variant_id = data["id"]
        print_success(f"Вариация создана: {data['color']} / {data['size']} (SKU: {data['sku']})")
        print_info(f"ID: {variant_id}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_get_variants():
    """Получить вариации товара"""
    print_test("Получение вариаций товара")
    
    response = requests.get(
        f"{BACKEND_URL}/catalog/products/{product_id}/variants",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Получено вариаций: {len(data)}")
        for var in data:
            print_info(f"  - {var['color']} / {var['size']} (SKU: {var['sku']})")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

# ============================================
# ТЕСТЫ ФОТО
# ============================================

def test_create_photo():
    """Добавить фото товара"""
    global photo_id
    print_test("Добавление фото товара")
    
    photo_data = {
        "url": "https://via.placeholder.com/800x1067",
        "variant_id": variant_id,
        "order": 1,
        "marketplaces": {
            "wb": True,
            "ozon": True,
            "yandex": False
        }
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/products/{product_id}/photos",
        headers=get_headers(),
        json=photo_data
    )
    
    if response.status_code == 201:
        data = response.json()
        photo_id = data["id"]
        print_success(f"Фото добавлено (ID: {photo_id})")
        print_info(f"URL: {data['url']}")
        print_info(f"Маркетплейсы: WB={data['marketplaces']['wb']}, Ozon={data['marketplaces']['ozon']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_get_photos():
    """Получить фото товара"""
    print_test("Получение фото товара")
    
    response = requests.get(
        f"{BACKEND_URL}/catalog/products/{product_id}/photos",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Получено фото: {len(data)}")
        for photo in data:
            print_info(f"  - Порядок: {photo['order']}, Вариация ID: {photo['variant_id']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

# ============================================
# ТЕСТЫ ЦЕН
# ============================================

def test_create_price():
    """Создать цену товара"""
    print_test("Создание цены товара")
    
    price_data = {
        "variant_id": variant_id,
        "purchase_price": 500.0,
        "retail_price": 1000.0,
        "price_without_discount": 1200.0,
        "marketplace_prices": {
            "wb": 990.0,
            "ozon": 1000.0,
            "yandex": 1050.0
        }
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/products/{product_id}/prices",
        headers=get_headers(),
        json=price_data
    )
    
    if response.status_code == 201:
        data = response.json()
        print_success(f"Цена создана (ID: {data['id']})")
        print_info(f"Закупочная: {data['purchase_price']} ₽")
        print_info(f"Розничная: {data['retail_price']} ₽")
        print_info(f"WB: {data['marketplace_prices']['wb']} ₽")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_get_prices():
    """Получить цены товара"""
    print_test("Получение цен товара")
    
    response = requests.get(
        f"{BACKEND_URL}/catalog/products/{product_id}/prices",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Получено цен: {len(data)}")
        for price in data:
            print_info(f"  - {price['variant_color']}/{price['variant_size']}: Закупка={price['purchase_price']} ₽, Розница={price['retail_price']} ₽")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_bulk_price_update():
    """Массовое изменение цен"""
    print_test("Массовое изменение цен (+10%)")
    
    bulk_data = {
        "product_ids": [product_id],
        "operation": "increase_percent",
        "value": 10,
        "target_field": "retail_price"
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/products/prices/bulk",
        headers=get_headers(),
        json=bulk_data
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Обновлено цен: {data['updated_count']}")
        print_info(data['message'])
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

# ============================================
# ТЕСТЫ ОСТАТКОВ
# ============================================

def get_warehouse_id():
    """Получить ID первого склада пользователя"""
    global warehouse_id
    response = requests.get(
        f"{BACKEND_URL}/warehouses",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        warehouses = response.json()
        if len(warehouses) > 0:
            warehouse_id = warehouses[0]["id"]
            print_info(f"Используется склад: {warehouses[0]['name']} (ID: {warehouse_id})")
            return True
    
    print_error("Не удалось получить ID склада")
    return False

def test_create_stock():
    """Создать остаток товара"""
    print_test("Создание остатка товара")
    
    if not get_warehouse_id():
        return False
    
    stock_data = {
        "variant_id": variant_id,
        "warehouse_id": warehouse_id,
        "quantity": 100,
        "reserved": 5,
        "available": 95
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/products/{product_id}/stock",
        headers=get_headers(),
        json=stock_data
    )
    
    if response.status_code == 201:
        data = response.json()
        print_success(f"Остаток создан (ID: {data['id']})")
        print_info(f"Склад: {data['warehouse_name']}")
        print_info(f"Количество: {data['quantity']}, Зарезервировано: {data['reserved']}, Доступно: {data['available']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_get_stock():
    """Получить остатки товара"""
    print_test("Получение остатков товара")
    
    response = requests.get(
        f"{BACKEND_URL}/catalog/products/{product_id}/stock",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Получено остатков: {len(data)}")
        for stock in data:
            print_info(f"  - {stock['warehouse_name']}: {stock['variant_color']}/{stock['variant_size']} - Кол-во: {stock['quantity']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

# ============================================
# ТЕСТЫ КОМПЛЕКТОВ
# ============================================

def test_create_kit():
    """Создать комплект"""
    print_test("Создание комплекта товаров")
    
    kit_data = {
        "name": "Комплект: Футболка + Штаны",
        "items": [
            {
                "product_id": product_id,
                "variant_id": variant_id,
                "quantity": 1
            }
        ]
    }
    
    response = requests.post(
        f"{BACKEND_URL}/catalog/products/{product_id}/kits",
        headers=get_headers(),
        json=kit_data
    )
    
    if response.status_code == 201:
        data = response.json()
        print_success(f"Комплект создан: {data['name']} (ID: {data['id']})")
        print_info(f"Состав: {len(data['items'])} позиций")
        print_info(f"Рассчитанный остаток: {data['calculated_stock']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

def test_get_kits():
    """Получить комплекты товара"""
    print_test("Получение комплектов товара")
    
    response = requests.get(
        f"{BACKEND_URL}/catalog/products/{product_id}/kits",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Получено комплектов: {len(data)}")
        for kit in data:
            print_info(f"  - {kit['name']}: {len(kit['items'])} позиций, остаток: {kit['calculated_stock']}")
        return True
    else:
        print_error(f"Ошибка: {response.status_code}")
        print_error(f"Ответ: {response.text}")
        return False

# ============================================
# MAIN
# ============================================

def main():
    """Запустить все тесты"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}ТЕСТИРОВАНИЕ API МОДУЛЯ 'ТОВАРЫ' (КАТАЛОГ){RESET}")
    print(f"{BLUE}Backend URL: {BACKEND_URL}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    # Счетчики
    total_tests = 0
    passed_tests = 0
    
    tests = [
        ("Авторизация", login),
        ("1. Создание категории", test_create_category),
        ("2. Получение категорий", test_get_categories),
        ("3. Создание товара", test_create_product),
        ("4. Получение товаров", test_get_products),
        ("5. Создание вариации", test_create_variant),
        ("6. Получение вариаций", test_get_variants),
        ("7. Добавление фото", test_create_photo),
        ("8. Получение фото", test_get_photos),
        ("9. Создание цены", test_create_price),
        ("10. Получение цен", test_get_prices),
        ("11. Массовое изменение цен", test_bulk_price_update),
        ("12. Создание остатка", test_create_stock),
        ("13. Получение остатков", test_get_stock),
        ("14. Создание комплекта", test_create_kit),
        ("15. Получение комплектов", test_get_kits),
    ]
    
    for name, test_func in tests:
        total_tests += 1
        try:
            if test_func():
                passed_tests += 1
        except Exception as e:
            print_error(f"Исключение: {str(e)}")
    
    # Итоги
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{GREEN}Пройдено тестов: {passed_tests}/{total_tests}{RESET}")
    print(f"{GREEN}Процент успеха: {(passed_tests/total_tests)*100:.1f}%{RESET}")
    
    if passed_tests == total_tests:
        print(f"\n{GREEN}{'='*60}{RESET}")
        print(f"{GREEN}✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!{RESET}")
        print(f"{GREEN}{'='*60}{RESET}\n")
    else:
        print(f"\n{RED}{'='*60}{RESET}")
        print(f"{RED}❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ{RESET}")
        print(f"{RED}{'='*60}{RESET}\n")

if __name__ == "__main__":
    main()
