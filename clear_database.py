#!/usr/bin/env python3
"""
Clear database directly
"""

import requests
import json

def clear_database():
    """Clear database directly"""
    print("🗑️ CLEARING DATABASE DIRECTLY")
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
    
    # Clear products collection directly via admin endpoint if exists
    print("\n2. Trying to clear products...")
    
    # Try to use admin endpoint
    admin_login_data = {
        "email": "admin@minimalmod.com",
        "password": "admin123"
    }
    
    admin_response = requests.post("http://localhost:8002/api/auth/login", json=admin_login_data, timeout=10)
    
    if admin_response.status_code == 200:
        admin_token = admin_response.json().get('access_token')
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Try to clear products
        clear_response = requests.delete("http://localhost:8002/api/admin/products/clear", 
                                      headers=admin_headers, timeout=10)
        
        if clear_response.status_code == 200:
            print("   ✅ Products cleared via admin endpoint")
        else:
            print(f"   ❌ Admin clear failed: {clear_response.status_code}")
    else:
        print("   ❌ Admin login failed")
    
    # Now test import
    print("\n3. Testing import after clearing...")
    
    # Get integrations
    integrations_response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
    
    if integrations_response.status_code == 200:
        integrations = integrations_response.json()
        ozon_key = next((i for i in integrations if i.get('marketplace') == 'ozon'), None)
        
        if ozon_key:
            params = {
                "marketplace": "ozon",
                "api_key_id": ozon_key.get('id')
            }
            
            import_response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                            params=params, headers=headers, timeout=30)
            
            if import_response.status_code == 200:
                import_result = import_response.json()
                print(f"   ✅ Import result: {import_result}")
                
                # Check products
                products_response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
                
                if products_response.status_code == 200:
                    products = products_response.json()
                    print(f"   ✅ Found {len(products)} products after import")
                    
                    for i, product in enumerate(products):
                        name = product.get('minimalmod', {}).get('name', 'Unknown')
                        sku = product.get('sku', 'Unknown')
                        print(f"      📦 {i+1}. {name} (SKU: {sku})")
                else:
                    print(f"   ❌ Failed to get products: {products_response.status_code}")
            else:
                print(f"   ❌ Import failed: {import_response.status_code}")
        else:
            print("   ❌ No Ozon key found")
    else:
        print(f"   ❌ Failed to get integrations: {integrations_response.status_code}")
    
    print("\n" + "=" * 50)
    print("🎉 DATABASE CLEAR COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    clear_database()
