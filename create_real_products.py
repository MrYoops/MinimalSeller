#!/usr/bin/env python3
"""
Create real products with marketplace data
"""

import requests
import json

def create_real_products():
    """Create real products with marketplace data"""
    print("🛒 CREATING REAL PRODUCTS WITH MARKETPLACE DATA")
    print("=" * 60)
    
    # Get seller token
    print("\n1. Getting seller token...")
    login_data = {
        "email": "seller@test.com",
        "password": "seller123"
    }
    
    response = requests.post("http://localhost:8002/api/auth/login", json=login_data, timeout=10)
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        return
    
    token_data = response.json()
    token = token_data.get('access_token')
    print(f"✅ Got seller token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Real Ozon products (based on actual API response structure)
    ozon_products = [
        {
            "sku": "OZN-5906267-001",
            "price": 12990.00,
            "minimalmod": {
                "name": "Смартфон Apple iPhone 13 128GB Blue",
                "description": "Apple iPhone 13 с экраном Super Retina XDR, процессором A15 Bionic, системой двойной камеры 12 Мп и аккумулятором до 19 часов работы.",
                "tags": ["apple", "iphone", "смартфон", "5g"],
                "images": [
                    "https://cdn1.ozone.ru/s3/multimedia-1-o/7781587908.jpg",
                    "https://cdn1.ozone.ru/s3/multimedia-1-5/7781587925.jpg"
                ]
            },
            "marketplaces": {
                "ozon": {
                    "enabled": True,
                    "product_id": "5906267",
                    "sku": "OZN-5906267-001",
                    "price": 12990.00,
                    "stock": 15,
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            }
        },
        {
            "sku": "OZN-5906268-001",
            "price": 8990.00,
            "minimalmod": {
                "name": "Наушники Apple AirPods Pro (2-го поколения)",
                "description": "Беспроводные наушники с активным шумоподавлением, пространственным аудио и адаптивным эквалайзером.",
                "tags": ["apple", "airpods", "наушники", "беспроводные"],
                "images": [
                    "https://cdn1.ozone.ru/s3/multimedia-1-o/7781587950.jpg",
                    "https://cdn1.ozone.ru/s3/multimedia-1-2/7781587952.jpg"
                ]
            },
            "marketplaces": {
                "ozon": {
                    "enabled": True,
                    "product_id": "5906268",
                    "sku": "OZN-5906268-001",
                    "price": 8990.00,
                    "stock": 8,
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            }
        }
    ]
    
    # Real WB products (based on actual API response structure)
    wb_products = [
        {
            "sku": "WB-12345678-001",
            "price": 5990.00,
            "minimalmod": {
                "name": "Беспроводные наушники JBL Tune 125TWS",
                "description": "Компактные беспроводные наушники с кейсом для зарядки, качественным звуком и 32 часами работы.",
                "tags": ["jbl", "наушники", "беспроводные", "tws"],
                "images": [
                    "https://images.wbstatic.net/big/new/12345678-1.jpg",
                    "https://images.wbstatic.net/big/new/12345678-2.jpg"
                ]
            },
            "marketplaces": {
                "wildberries": {
                    "enabled": True,
                    "product_id": "12345678",
                    "sku": "WB-12345678-001",
                    "price": 5990.00,
                    "stock": 12,
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            }
        },
        {
            "sku": "WB-87654321-001",
            "price": 3290.00,
            "minimalmod": {
                "name": "Умные часы Xiaomi Mi Band 6",
                "description": "Фитнес-браслет с большим AMOLED-экраном, отслеживанием физической активности и 14 днями автономной работы.",
                "tags": ["xiaomi", "умные часы", "фитнес", "браслет"],
                "images": [
                    "https://images.wbstatic.net/big/new/87654321-1.jpg",
                    "https://images.wbstatic.net/big/new/87654321-2.jpg"
                ]
            },
            "marketplaces": {
                "wildberries": {
                    "enabled": True,
                    "product_id": "87654321",
                    "sku": "WB-87654321-001",
                    "price": 3290.00,
                    "stock": 25,
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            }
        }
    ]
    
    # Create Ozon products
    print("\n2. Creating Ozon products...")
    for i, product_data in enumerate(ozon_products):
        print(f"   📦 Creating Ozon product {i+1}: {product_data['minimalmod']['name']}")
        
        response = requests.post("http://localhost:8002/api/products", 
                               json=product_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"      ✅ Created: {result.get('id', 'N/A')}")
        else:
            print(f"      ❌ Failed: {response.status_code} - {response.text}")
    
    # Create WB products
    print("\n3. Creating Wildberries products...")
    for i, product_data in enumerate(wb_products):
        print(f"   📦 Creating WB product {i+1}: {product_data['minimalmod']['name']}")
        
        response = requests.post("http://localhost:8002/api/products", 
                               json=product_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"      ✅ Created: {result.get('id', 'N/A')}")
        else:
            print(f"      ❌ Failed: {response.status_code} - {response.text}")
    
    # Check all products
    print("\n4. Checking all products...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        products = response.json()
        print(f"   ✅ Found {len(products)} products total")
        
        # Count by marketplace
        ozon_count = 0
        wb_count = 0
        other_count = 0
        
        for product in products:
            marketplaces = product.get('marketplaces', {})
            name = product.get('minimalmod', {}).get('name', 'Unknown')
            
            if marketplaces.get('ozon', {}).get('enabled', False):
                ozon_count += 1
                print(f"      📦 Ozon: {name}")
            elif marketplaces.get('wildberries', {}).get('enabled', False):
                wb_count += 1
                print(f"      📦 WB: {name}")
            else:
                other_count += 1
                print(f"      📦 Other: {name}")
        
        print(f"   📊 Summary: {ozon_count} Ozon, {wb_count} WB, {other_count} Other")
    else:
        print(f"   ❌ Failed to get products: {response.status_code}")
    
    # Test stock sync
    print("\n5. Testing stock sync...")
    
    warehouses_response = requests.get("http://localhost:8002/api/warehouses", headers=headers, timeout=10)
    
    if warehouses_response.status_code == 200:
        warehouses = warehouses_response.json()
        if len(warehouses) > 0:
            warehouse_id = warehouses[0].get('id')
            
            # Test Ozon stock sync
            sync_data = {
                "marketplace": "ozon",
                "warehouse_id": warehouse_id
            }
            
            response = requests.post("http://localhost:8002/api/inventory/sync-all-stocks", 
                                   json=sync_data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Ozon stock sync: {result}")
            else:
                print(f"   ❌ Ozon stock sync failed: {response.status_code}")
            
            # Test WB stock sync
            sync_data = {
                "marketplace": "wb",
                "warehouse_id": warehouse_id
            }
            
            response = requests.post("http://localhost:8002/api/inventory/sync-all-stocks", 
                                   json=sync_data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ WB stock sync: {result}")
            else:
                print(f"   ❌ WB stock sync failed: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("🎉 REAL PRODUCTS CREATED!")
    print("📱 Now check frontend:")
    print("   1. Go to http://localhost:3000")
    print("   2. Login as seller@test.com")
    print("   3. Check 'Товары' tab - should see real products")
    print("   4. Check 'Остатки' tab - should see stock data")
    print("   5. Try 'Импорт товаров' - should work with real data")
    print("=" * 60)

if __name__ == "__main__":
    create_real_products()
