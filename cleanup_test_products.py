#!/usr/bin/env python3
"""
Clean up all test products - keep only real marketplace products
"""

import requests
import json

def cleanup_test_products():
    """Delete all test products"""
    print("🗑️ CLEANING UP TEST PRODUCTS")
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
    
    # Get all products
    print("\n2. Getting all products...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code != 200:
        print(f"❌ Failed to get products: {response.status_code}")
        return
    
    products = response.json()
    print(f"   Found {len(products)} products")
    
    # Delete test products (keep only real marketplace products)
    deleted_count = 0
    kept_count = 0
    
    for product in products:
        product_id = product.get('id')
        name = product.get('minimalmod', {}).get('name', 'Unknown')
        sku = product.get('sku', 'Unknown')
        marketplaces = product.get('marketplaces', {})
        
        # Check if this is a test product
        is_test_product = (
            'TEST' in sku.upper() or 
            'Debug' in name or 
            'Test' in name or
            not marketplaces.get('ozon', {}).get('enabled', False) and 
            not marketplaces.get('wildberries', {}).get('enabled', False)
        )
        
        if is_test_product:
            print(f"   🗑️ Deleting test product: {name} (SKU: {sku})")
            
            delete_response = requests.delete(f"http://localhost:8002/api/products/{product_id}", 
                                             headers=headers, timeout=10)
            
            if delete_response.status_code == 200:
                deleted_count += 1
                print(f"      ✅ Deleted")
            else:
                print(f"      ❌ Failed to delete: {delete_response.status_code}")
        else:
            print(f"   ✅ Keeping real product: {name} (SKU: {sku})")
            kept_count += 1
    
    print(f"\n   📊 Results: {deleted_count} deleted, {kept_count} kept")
    
    # Check final products
    print("\n3. Checking final products...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        final_products = response.json()
        print(f"   ✅ Final count: {len(final_products)} products")
        
        for product in final_products:
            name = product.get('minimalmod', {}).get('name', 'Unknown')
            sku = product.get('sku', 'Unknown')
            marketplaces = product.get('marketplaces', {})
            
            if marketplaces.get('ozon', {}).get('enabled', False):
                print(f"      📦 Ozon: {name} (SKU: {sku})")
            elif marketplaces.get('wildberries', {}).get('enabled', False):
                print(f"      📦 WB: {name} (SKU: {sku})")
    else:
        print(f"   ❌ Failed to get final products: {response.status_code}")
    
    print("\n" + "=" * 50)
    print("🎉 CLEANUP COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    cleanup_test_products()
