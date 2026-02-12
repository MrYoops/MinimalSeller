#!/usr/bin/env python3
"""
Debug imported products - why they don't appear in frontend
"""

import requests
import json

def debug_imported_products():
    """Debug why imported products don't appear"""
    print("🔍 DEBUGGING IMPORTED PRODUCTS")
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
        print(f"   ✅ Found {len(products)} products in database")
        
        if len(products) == 0:
            print("   ⚠️ No products found! Let's check what's in the database directly...")
            
            # Let's check what's in the products collection directly
            print("\n3. Checking database directly...")
            
            # We can't access MongoDB directly, but let's try to import again to see what happens
            print("   🔄 Running import again to see details...")
            
            # Get integrations
            integrations_response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
            
            if integrations_response.status_code == 200:
                integrations = integrations_response.json()
                ozon_key = next((i for i in integrations if i.get('marketplace') == 'ozon'), None)
                
                if ozon_key:
                    print(f"   🔧 Using key: {ozon_key.get('name')} (ID: {ozon_key.get('id')})")
                    
                    # Test import again with logging
                    params = {
                        "marketplace": "ozon",
                        "api_key_id": ozon_key.get('id')
                    }
                    
                    print(f"   📤 Import request: POST /api/products/marketplaces/import-all")
                    print(f"   📋 Params: {params}")
                    
                    import_response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                                    params=params, headers=headers, timeout=30)
                    
                    if import_response.status_code == 200:
                        import_result = import_response.json()
                        print(f"   ✅ Import result: {import_result}")
                        
                        # Check products again
                        products_response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
                        
                        if products_response.status_code == 200:
                            products_after = products_response.json()
                            print(f"   ✅ Products after import: {len(products_after)}")
                            
                            if len(products_after) > 0:
                                print("   📦 Products found after import:")
                                for i, product in enumerate(products_after):
                                    name = product.get('minimalmod', {}).get('name', 'Unknown')
                                    sku = product.get('sku', 'Unknown')
                                    marketplace = 'unknown'
                                    
                                    marketplaces = product.get('marketplaces', {})
                                    if marketplaces.get('ozon', {}).get('enabled', False):
                                        marketplace = 'ozon'
                                    elif marketplaces.get('wildberries', {}).get('enabled', False):
                                        marketplace = 'wb'
                                    
                                    print(f"      📦 {i+1}. {name} (SKU: {sku}, Marketplace: {marketplace})")
                            else:
                                print("   ❌ Still no products after import!")
                    else:
                        print(f"   ❌ Import failed: {import_response.status_code} - {import_response.text}")
                else:
                    print("   ❌ No Ozon key found")
            else:
                print(f"   ❌ Failed to get integrations: {integrations_response.status_code}")
        else:
            print(f"   ❌ Failed to get products: {response.status_code} - {response.text}")
    else:
        print(f"   ❌ Failed to get products: {response.status_code}")
    
    # Check if there's a different endpoint for products
    print("\n4. Checking alternative product endpoints...")
    
    alternative_endpoints = [
        "/api/catalog/products",
        "/api/seller/products",
        "/api/inventory/products"
    ]
    
    for endpoint in alternative_endpoints:
        print(f"   🔍 Trying {endpoint}...")
        response = requests.get(f"http://localhost:8000{endpoint}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            products = response.json()
            print(f"   ✅ Found {len(products)} products at {endpoint}")
            
            if len(products) > 0:
                print("   📦 Products found:")
                for i, product in enumerate(products[:3]):
                    name = product.get('name', product.get('minimalmod', {}).get('name', 'Unknown'))
                    print(f"      📦 {i+1}. {name}")
        else:
            print(f"   ❌ {endpoint}: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("🎉 DEBUG COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    debug_imported_products()
