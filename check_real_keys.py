#!/usr/bin/env python3
"""
Check real API keys and fix import
"""

import requests
import json

def check_real_keys():
    """Check real API keys and test import"""
    print("🔍 CHECKING REAL API KEYS")
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
    
    # Get integrations
    print("\n2. Getting integrations...")
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
    
    if response.status_code != 200:
        print(f"❌ Failed to get integrations: {response.status_code}")
        return
    
    integrations = response.json()
    print(f"✅ Found {len(integrations)} integrations:")
    
    ozon_key_123 = None
    
    for i, integration in enumerate(integrations):
        name = integration.get('name', 'Unknown')
        marketplace = integration.get('marketplace', 'N/A')
        key_id = integration.get('id', 'N/A')
        client_id = integration.get('client_id', 'N/A')
        key_masked = integration.get('api_key_masked', 'N/A')
        
        print(f"   🔑 {i+1}. {name}")
        print(f"      Marketplace: {marketplace}")
        print(f"      ID: {key_id}")
        print(f"      Client ID: {client_id}")
        print(f"      Key: {key_masked}")
        
        # Check if this is the "123" key for Ozon
        if marketplace == 'ozon' and name == '123':
            ozon_key_123 = integration
            print(f"      🎯 FOUND '123' Ozon key!")
    
    if ozon_key_123:
        print(f"\n3. Testing '123' Ozon key...")
        
        # Test the key
        test_data = {
            "marketplace": "ozon",
            "client_id": ozon_key_123.get('client_id', ''),
            "api_key": "placeholder",
            "key_id": ozon_key_123.get('id')
        }
        
        test_response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                                     json=test_data, headers=headers, timeout=30)
        
        if test_response.status_code == 200:
            test_result = test_response.json()
            if test_result.get('success'):
                print(f"   ✅ Key test successful: {test_result.get('message')}")
                
                # Now test import with this key
                print(f"\n4. Testing import with '123' Ozon key...")
                
                params = {
                    "marketplace": "ozon",
                    "api_key_id": ozon_key_123.get('id')
                }
                
                import_response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                                params=params, headers=headers, timeout=30)
                
                if import_response.status_code == 200:
                    import_result = import_response.json()
                    print(f"   ✅ Import successful: {import_result}")
                    
                    # Check products after import
                    print(f"\n5. Checking products after import...")
                    products_response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
                    
                    if products_response.status_code == 200:
                        products = products_response.json()
                        print(f"   ✅ Found {len(products)} products after import")
                        
                        for i, product in enumerate(products[:5]):
                            name = product.get('minimalmod', {}).get('name', 'Unknown')
                            sku = product.get('sku', 'N/A')
                            print(f"      📦 {i+1}. {name} (SKU: {sku})")
                    else:
                        print(f"   ❌ Failed to get products: {products_response.status_code}")
                else:
                    print(f"   ❌ Import failed: {import_response.status_code} - {import_response.text}")
            else:
                print(f"   ❌ Key test failed: {test_result.get('message')}")
        else:
            print(f"   ❌ Key test failed: {test_response.status_code} - {test_response.text}")
    else:
        print(f"\n❌ '123' Ozon key not found!")
    
    print("\n" + "=" * 50)
    print("🎉 REAL KEYS CHECK COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    check_real_keys()
