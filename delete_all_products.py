#!/usr/bin/env python3
"""
Delete ALL products for seller
"""

import requests
import json

def delete_all_products():
    """Delete all products for seller"""
    print("🗑️ DELETING ALL PRODUCTS")
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
    print(f"📋 Seller ID: {seller_id}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get all products first
    print("\n2. Getting all products...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code != 200:
        print(f"❌ Failed to get products: {response.status_code}")
        return
    
    products = response.json()
    print(f"   Found {len(products)} products")
    
    # Delete ALL products
    deleted_count = 0
    failed_count = 0
    
    for product in products:
        product_id = product.get('id')
        name = product.get('minimalmod', {}).get('name', 'Unknown')
        sku = product.get('sku', 'Unknown')
        
        print(f"   🗑️ Deleting: {name} (ID: {product_id}, SKU: {sku})")
        
        delete_response = requests.delete(f"http://localhost:8002/api/products/{product_id}", 
                                         headers=headers, timeout=10)
        
        if delete_response.status_code == 200:
            deleted_count += 1
            print(f"      ✅ Deleted")
        else:
            failed_count += 1
            print(f"      ❌ Failed: {delete_response.status_code} - {delete_response.text}")
    
    print(f"\n   📊 Results: {deleted_count} deleted, {failed_count} failed")
    
    # Check final state
    print("\n3. Checking final state...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        final_products = response.json()
        print(f"   ✅ Final count: {len(final_products)} products")
        
        if len(final_products) == 0:
            print("   🎉 All products deleted successfully!")
        else:
            print("   ⚠️ Some products remain:")
            for product in final_products:
                name = product.get('minimalmod', {}).get('name', 'Unknown')
                sku = product.get('sku', 'Unknown')
                print(f"      📦 {name} (SKU: {sku})")
    else:
        print(f"   ❌ Failed to check final state: {response.status_code}")
    
    print("\n" + "=" * 50)
    print("🎉 DELETION COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    delete_all_products()
