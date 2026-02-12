#!/usr/bin/env python3
"""
Simple product import test
"""

import requests
import json

def simple_import():
    """Simple import test"""
    print("🛒 SIMPLE IMPORT TEST")
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
    
    # Create test product manually
    print("\n2. Creating test product...")
    
    test_product = {
        "sku": "TEST-OZON-001",
        "price": 999.99,
        "minimalmod": {
            "name": "Test Product from Ozon",
            "description": "Test product imported from Ozon",
            "tags": ["test", "ozon", "electronics"]
        },
        "marketplaces": {
            "ozon": {
                "product_id": "TEST-OZON-001",
                "sku": "TEST-OZON-001",
                "price": 999.99,
                "stock": 10,
                "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
            }
        }
    }
    
    response = requests.post("http://localhost:8002/api/products", 
                           json=test_product, headers=headers, timeout=10)
    
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Product created: {result}")
    else:
        print(f"   ❌ Product creation failed: {response.status_code} - {response.text}")
    
    # Check products
    print("\n3. Checking products...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        products = response.json()
        print(f"   ✅ Found {len(products)} products")
        for i, product in enumerate(products):
            print(f"      📦 {product.get('name', 'Unknown')} - {product.get('marketplace', 'N/A')}")
    else:
        print(f"   ❌ Failed to get products: {response.status_code}")
    
    print("\n" + "=" * 50)
    print("🎉 SIMPLE IMPORT COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    simple_import()
