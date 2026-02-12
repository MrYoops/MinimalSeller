#!/usr/bin/env python3
"""
Debug seller ID issues
"""

import requests
import json

def debug_seller_id():
    """Debug seller ID matching"""
    print("🔍 DEBUGGING SELLER ID")
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
    seller_id = token_data.get('user', {}).get('id')
    print(f"✅ Got seller token")
    print(f"📋 Seller ID from token: {seller_id}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check products in database with this seller_id
    print("\n2. Checking products with correct seller_id...")
    
    # Create a new product with correct seller_id
    test_product = {
        "sku": f"TEST-PRODUCT-{int(time.time())}",
        "price": 999.99,
        "minimalmod": {
            "name": "Debug Test Product",
            "description": "Product for debugging seller ID",
            "tags": ["test", "debug"]
        },
        "marketplaces": {
            "ozon": {
                "product_id": f"TEST-PRODUCT-{int(time.time())}",
                "sku": f"TEST-PRODUCT-{int(time.time())}",
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
        created_id = result.get('id')
        print(f"   ✅ Product created with ID: {created_id}")
        
        # Now try to get products
        response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
        
        if response.status_code == 200:
            products = response.json()
            print(f"   ✅ Found {len(products)} products")
            print(f"   📋 Raw response type: {type(products)}")
            print(f"   📋 Raw response: {products}")
            
            for i, product in enumerate(products):
                print(f"      📦 {i+1}. {product.get('minimalmod', {}).get('name', 'Unknown')} - ID: {product.get('id', 'N/A')}")
                print(f"         Seller ID: {product.get('seller_id', 'N/A')} (type: {type(product.get('seller_id', 'N/A'))})")
        else:
            print(f"   ❌ Failed to get products: {response.status_code}")
            print(f"   📋 Response: {response.text}")
    else:
        print(f"   ❌ Product creation failed: {response.status_code} - {response.text}")
    
    print("\n" + "=" * 50)
    print("🎉 SELLER ID DEBUG COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    import time
    debug_seller_id()
