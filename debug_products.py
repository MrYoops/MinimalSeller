#!/usr/bin/env python3
"""
Debug products and inventory issues
"""

import requests
import json

def debug_products():
    """Debug products and inventory"""
    print("🔍 DEBUGGING PRODUCTS AND INVENTORY")
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
    
    # Check products in database
    print("\n2. Checking products in database...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        products = response.json()
        print(f"✅ Found {len(products)} products in database")
        for i, product in enumerate(products[:5]):  # Show first 5
            print(f"   📦 Product {i+1}: {product.get('name', 'Unknown')}")
            print(f"      ID: {product.get('_id', 'N/A')}")
            print(f"      SKU: {product.get('sku', 'N/A')}")
            print(f"      Marketplace: {product.get('marketplace', 'N/A')}")
    else:
        print(f"❌ Failed to get products: {response.text}")
    
    # Check inventory/stock
    print("\n3. Checking inventory/stock...")
    response = requests.get("http://localhost:8002/api/inventory", headers=headers, timeout=10)
    
    if response.status_code == 200:
        inventory = response.json()
        print(f"✅ Found {len(inventory)} inventory items")
        for i, item in enumerate(inventory[:5]):  # Show first 5
            print(f"   📊 Item {i+1}: {item.get('product_name', 'Unknown')}")
            print(f"      Stock: {item.get('stock', 'N/A')}")
            print(f"      Warehouse: {item.get('warehouse', 'N/A')}")
    else:
        print(f"❌ Failed to get inventory: {response.text}")
    
    # Test import from marketplace
    print("\n4. Testing import from marketplace...")
    
    # Test Ozon import
    print("   🛒 Testing Ozon import...")
    import_data = {
        "marketplace": "ozon",
        "api_key_id": None,  # Use default key
        "limit": 10
    }
    
    response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                           params={"marketplace": "ozon"}, 
                           json=import_data, 
                           headers=headers, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Ozon import successful: {result}")
    else:
        print(f"   ❌ Ozon import failed: {response.status_code} - {response.text}")
    
    # Test WB import
    print("   🛒 Testing WB import...")
    response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                           params={"marketplace": "wb"}, 
                           json=import_data, 
                           headers=headers, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ WB import successful: {result}")
    else:
        print(f"   ❌ WB import failed: {response.status_code} - {response.text}")
    
    # Test stock sync
    print("\n5. Testing stock sync...")
    sync_data = {
        "marketplace": "ozon",
        "warehouse_id": "default"
    }
    
    response = requests.post("http://localhost:8002/api/inventory/sync-all-stocks", 
                           json=sync_data, 
                           headers=headers, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Stock sync successful: {result}")
    else:
        print(f"   ❌ Stock sync failed: {response.status_code} - {response.text}")
    
    print("\n" + "=" * 60)
    print("🎉 DEBUG COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    debug_products()
