#!/usr/bin/env python3
"""
Check which collections have products
"""

import requests
import json

def check_collections():
    """Check product collections"""
    print("🔍 CHECKING PRODUCT COLLECTIONS")
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
    
    # Check if there's an admin endpoint to check collections
    print("\n2. Checking collections via admin endpoint...")
    
    # Try to get products as admin to see all collections
    admin_login_data = {
        "email": "admin@minimalmod.com",
        "password": "admin123"
    }
    
    admin_response = requests.post("http://localhost:8002/api/auth/login", json=admin_login_data, timeout=10)
    
    if admin_response.status_code == 200:
        admin_token = admin_response.json().get('access_token')
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Check admin products endpoint
        admin_products_response = requests.get("http://localhost:8002/api/admin/products", headers=admin_headers, timeout=10)
        
        if admin_products_response.status_code == 200:
            products = admin_products_response.json()
            print(f"   ✅ Admin found {len(products)} products")
            for i, product in enumerate(products[:3]):
                print(f"      📦 {product.get('minimalmod', {}).get('name', 'Unknown')} - ID: {product.get('id', 'N/A')}")
        else:
            print(f"   ❌ Admin products failed: {admin_products_response.status_code}")
    
    # Try different product endpoints for seller
    print("\n3. Trying different seller endpoints...")
    
    endpoints = [
        "/api/products",
        "/api/catalog/products", 
        "/api/seller/products"
    ]
    
    for endpoint in endpoints:
        print(f"   🔍 Trying {endpoint}...")
        response = requests.get(f"http://localhost:8002{endpoint}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            products = response.json()
            print(f"   ✅ Found {len(products)} products")
            if len(products) > 0:
                for i, product in enumerate(products[:2]):
                    print(f"      📦 {product.get('minimalmod', {}).get('name', 'Unknown')}")
            break
        else:
            print(f"   ❌ {endpoint}: {response.status_code}")
    
    print("\n" + "=" * 50)
    print("🎉 COLLECTION CHECK COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    check_collections()
