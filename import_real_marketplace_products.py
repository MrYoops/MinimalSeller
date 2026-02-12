#!/usr/bin/env python3
"""
Import real products from marketplaces
"""

import requests
import json

def import_real_products():
    """Import real products from marketplaces"""
    print("🛒 IMPORTING REAL MARKETPLACE PRODUCTS")
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
    
    # Import from Ozon
    print("\n2. Importing from Ozon...")
    
    # Test connection first
    ozon_test_data = {
        "marketplace": "ozon",
        "client_id": "3152566",
        "api_key": "2a159f7c-59df-497c-bb5f-88d36ae6d890"
    }
    
    test_response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                                  json=ozon_test_data, headers=headers, timeout=30)
    
    if test_response.status_code == 200:
        test_result = test_response.json()
        if test_result.get('success'):
            print(f"   ✅ Ozon connection successful: {test_result.get('message')}")
            
            # Import from Ozon
            import_data = {
                "marketplace": "ozon",
                "api_key_id": None,
                "limit": 5,
                "auto_create_products": True
            }
            
            response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                   params={"marketplace": "ozon"}, 
                                   json=import_data, 
                                   headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Ozon import result: {result}")
            else:
                print(f"   ❌ Ozon import failed: {response.status_code} - {response.text}")
        else:
            print(f"   ❌ Ozon connection failed: {test_result.get('message')}")
    else:
        print(f"   ❌ Ozon test failed: {test_response.status_code} - {test_response.text}")
    
    # Import from Wildberries
    print("\n3. Importing from Wildberries...")
    
    wb_test_data = {
        "marketplace": "wb",
        "client_id": "",
        "api_key": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzg2NTcyNjc3LCJpZCI6IjAxOWM0YzJmLTA5YzYtN2VmMC05MWUzLTgwOWZmMmU4YjY5NSIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.q0kfgFeOpzENjH78xIQ1XHgvQI8VN0HR2vNGlxGPJ8h-4QyS9rpbtpxP0LquzSXB2cT_9FZ4Z1Dh7eW6Zy1q1A"
    }
    
    test_response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                                  json=wb_test_data, headers=headers, timeout=30)
    
    if test_response.status_code == 200:
        test_result = test_response.json()
        if test_result.get('success'):
            print(f"   ✅ WB connection successful: {test_result.get('message')}")
            
            # Import from WB
            import_data = {
                "marketplace": "wb",
                "api_key_id": None,
                "limit": 5,
                "auto_create_products": True
            }
            
            response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                   params={"marketplace": "wb"}, 
                                   json=import_data, 
                                   headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ WB import result: {result}")
            else:
                print(f"   ❌ WB import failed: {response.status_code} - {response.text}")
        else:
            print(f"   ❌ WB connection failed: {test_result.get('message')}")
    else:
        print(f"   ❌ WB test failed: {test_response.status_code} - {test_response.text}")
    
    # Check products after import
    print("\n4. Checking products after import...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        products = response.json()
        print(f"   ✅ Found {len(products)} products after import")
        
        # Count by marketplace
        ozon_count = 0
        wb_count = 0
        other_count = 0
        
        for product in products:
            marketplaces = product.get('marketplaces', {})
            if marketplaces.get('ozon', {}).get('enabled', False):
                ozon_count += 1
            elif marketplaces.get('wildberries', {}).get('enabled', False):
                wb_count += 1
            else:
                other_count += 1
        
        print(f"   📊 Ozon products: {ozon_count}")
        print(f"   📊 WB products: {wb_count}")
        print(f"   📊 Other products: {other_count}")
        
        # Show first few products
        for i, product in enumerate(products[:3]):
            name = product.get('minimalmod', {}).get('name', 'Unknown')
            sku = product.get('sku', 'N/A')
            print(f"      📦 {i+1}. {name} (SKU: {sku})")
    else:
        print(f"   ❌ Failed to get products: {response.status_code}")
    
    # Test stock sync again
    print("\n5. Testing stock sync with imported products...")
    
    # Get warehouses
    warehouses_response = requests.get("http://localhost:8002/api/warehouses", headers=headers, timeout=10)
    
    if warehouses_response.status_code == 200:
        warehouses = warehouses_response.json()
        if len(warehouses) > 0:
            warehouse_id = warehouses[0].get('id')
            
            sync_data = {
                "marketplace": "ozon",
                "warehouse_id": warehouse_id,
                "api_key_id": None
            }
            
            response = requests.post("http://localhost:8002/api/inventory/sync-all-stocks", 
                                   json=sync_data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Stock sync result: {result}")
                print(f"   📊 Synced: {result.get('synced', 0)}")
                print(f"   ❌ Failed: {result.get('failed', 0)}")
                print(f"   ⏸️ Skipped: {result.get('skipped', 0)}")
            else:
                print(f"   ❌ Stock sync failed: {response.status_code} - {response.text}")
    
    print("\n" + "=" * 60)
    print("🎉 REAL PRODUCTS IMPORT COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    import_real_products()
