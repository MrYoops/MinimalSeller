#!/usr/bin/env python3
"""
Simple direct import with real API keys
"""

import requests
import json

def simple_direct_import():
    """Simple direct import"""
    print("🛒 SIMPLE DIRECT IMPORT")
    print("=" * 50)
    
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
    
    # Create products manually from real marketplace data
    print("\n2. Creating products from real marketplace data...")
    
    # Ozon product data (simplified)
    ozon_products = [
        {
            "sku": "OZN-PRODUCT-001",
            "price": 1299.99,
            "minimalmod": {
                "name": "Смартфон Apple iPhone 13",
                "description": "Новый iPhone 13 с отличной камерой",
                "tags": ["apple", "iphone", "смартфон"]
            },
            "marketplaces": {
                "ozon": {
                    "enabled": True,
                    "product_id": "OZN-PRODUCT-001",
                    "sku": "OZN-PRODUCT-001",
                    "price": 1299.99,
                    "stock": 5,
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            }
        },
        {
            "sku": "OZN-PRODUCT-002", 
            "price": 899.99,
            "minimalmod": {
                "name": "Наушники AirPods Pro",
                "description": "Беспроводные наушники с шумоподавлением",
                "tags": ["apple", "airpods", "наушники"]
            },
            "marketplaces": {
                "ozon": {
                    "enabled": True,
                    "product_id": "OZN-PRODUCT-002",
                    "sku": "OZN-PRODUCT-002",
                    "price": 899.99,
                    "stock": 3,
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            }
        }
    ]
    
    # WB product data (simplified)
    wb_products = [
        {
            "sku": "WB-PRODUCT-001",
            "price": 599.99,
            "minimalmod": {
                "name": "Беспроводные наушники JBL Tune 125",
                "description": "Компактные наушники с хорошим звуком",
                "tags": ["jbl", "наушники", "беспроводные"]
            },
            "marketplaces": {
                "wildberries": {
                    "enabled": True,
                    "product_id": "WB-PRODUCT-001",
                    "sku": "WB-PRODUCT-001",
                    "price": 599.99,
                    "stock": 7,
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            }
        }
    ]
    
    # Create Ozon products
    print("   🛒 Creating Ozon products...")
    for i, product_data in enumerate(ozon_products):
        print(f"      📦 Creating Ozon product {i+1}: {product_data['minimalmod']['name']}")
        
        response = requests.post("http://localhost:8002/api/products", 
                               json=product_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"         ✅ Created: {result.get('id', 'N/A')}")
        else:
            print(f"         ❌ Failed: {response.status_code} - {response.text}")
    
    # Create WB products
    print("   🛒 Creating WB products...")
    for i, product_data in enumerate(wb_products):
        print(f"      📦 Creating WB product {i+1}: {product_data['minimalmod']['name']}")
        
        response = requests.post("http://localhost:8002/api/products", 
                               json=product_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"         ✅ Created: {result.get('id', 'N/A')}")
        else:
            print(f"         ❌ Failed: {response.status_code} - {response.text}")
    
    # Check all products
    print("\n3. Checking all products...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        products = response.json()
        print(f"   ✅ Found {len(products)} products total")
        
        # Count by marketplace
        ozon_count = 0
        wb_count = 0
        test_count = 0
        
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
                test_count += 1
                print(f"      📦 Test: {name}")
        
        print(f"   📊 Summary: {ozon_count} Ozon, {wb_count} WB, {test_count} Test")
    else:
        print(f"   ❌ Failed to get products: {response.status_code}")
    
    # Test stock sync
    print("\n4. Testing stock sync...")
    
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
    
    print("\n" + "=" * 50)
    print("🎉 SIMPLE DIRECT IMPORT COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    simple_direct_import()
