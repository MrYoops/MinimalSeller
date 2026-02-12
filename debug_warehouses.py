#!/usr/bin/env python3
"""
Debug warehouses and fix stock sync
"""

import requests
import json

def debug_warehouses():
    """Debug warehouses and fix issues"""
    print("🔍 DEBUGGING WAREHOUSES")
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
    
    # Check warehouses
    print("\n2. Checking warehouses...")
    
    # Try different warehouse endpoints
    endpoints = [
        "/api/warehouses",
        "/api/inventory/warehouses", 
        "/api/seller/warehouses",
        "/api/warehouses/list"
    ]
    
    for endpoint in endpoints:
        print(f"   🔍 Trying {endpoint}...")
        response = requests.get(f"http://localhost:8002{endpoint}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            warehouses = response.json()
            print(f"   ✅ Found {len(warehouses)} warehouses")
            for warehouse in warehouses:
                print(f"      📦 {warehouse.get('name', 'Unknown')}: {warehouse.get('id', warehouse.get('_id', 'N/A'))}")
            break
        else:
            print(f"   ❌ {endpoint}: {response.status_code}")
    
    # Check products with proper endpoint
    print("\n3. Checking products...")
    
    # Try different product endpoints
    product_endpoints = [
        "/api/products",
        "/api/seller/products",
        "/api/catalog/products"
    ]
    
    for endpoint in product_endpoints:
        print(f"   🔍 Trying {endpoint}...")
        response = requests.get(f"http://localhost:8002{endpoint}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            products = response.json()
            print(f"   ✅ Found {len(products)} products")
            for i, product in enumerate(products[:3]):
                print(f"      📦 {product.get('name', 'Unknown')}")
            break
        else:
            print(f"   ❌ {endpoint}: {response.status_code} - {response.text[:100]}")
    
    # Test stock sync with correct warehouse ID
    print("\n4. Testing stock sync with correct warehouse...")
    
    # Use the warehouse ID from logs
    warehouse_id = "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
    sync_data = {
        "marketplace": "ozon",
        "warehouse_id": warehouse_id
    }
    
    print(f"   🔧 Using warehouse ID: {warehouse_id}")
    response = requests.post("http://localhost:8002/api/inventory/sync-all-stocks", 
                           json=sync_data, 
                           headers=headers, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Stock sync successful: {result}")
    else:
        print(f"   ❌ Stock sync failed: {response.status_code} - {response.text}")
    
    print("\n" + "=" * 50)
    print("🎉 WAREHOUSE DEBUG COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    debug_warehouses()
