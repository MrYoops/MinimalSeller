#!/usr/bin/env python3
"""
Update real Ozon key with correct data
"""

import requests
import json

def update_real_ozon_key():
    """Update real Ozon key with correct data"""
    print("🔧 UPDATING REAL OZON KEY")
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
    
    # Delete existing keys first
    print("\n2. Deleting existing keys...")
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
    
    if response.status_code == 200:
        integrations = response.json()
        for integration in integrations:
            key_id = integration.get('id')
            name = integration.get('name', 'Unknown')
            
            print(f"   🗑️ Deleting key: {name} (ID: {key_id})")
            
            delete_response = requests.delete(f"http://localhost:8002/api/seller/api-keys/{key_id}", 
                                             headers=headers, timeout=10)
            
            if delete_response.status_code == 200:
                print(f"      ✅ Deleted")
            else:
                print(f"      ❌ Failed: {delete_response.status_code}")
    
    # Add new real Ozon key
    print("\n3. Adding real Ozon key...")
    
    key_data = {
        "marketplace": "ozon",
        "client_id": "3152566",
        "api_key": "2a159f7c-59df-497c-bb5f-88d36ae6d890",
        "name": "123"
    }
    
    response = requests.post("http://localhost:8002/api/seller/api-keys", 
                           json=key_data, headers=headers, timeout=10)
    
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Key added successfully: {result}")
    else:
        print(f"   ❌ Failed to add key: {response.status_code} - {response.text}")
        return
    
    # Test the new key
    print("\n4. Testing new key...")
    
    # Get integrations again to get new key ID
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
    
    if response.status_code == 200:
        integrations = response.json()
        ozon_key = next((i for i in integrations if i.get('marketplace') == 'ozon'), None)
        
        if ozon_key:
            test_data = {
                "marketplace": "ozon",
                "client_id": ozon_key.get('client_id', ''),
                "api_key": "placeholder",
                "key_id": ozon_key.get('id')
            }
            
            test_response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                                         json=test_data, headers=headers, timeout=30)
            
            if test_response.status_code == 200:
                test_result = test_response.json()
                if test_result.get('success'):
                    print(f"   ✅ Key test successful: {test_result.get('message')}")
                    
                    # Test import
                    print("\n5. Testing import with new key...")
                    
                    params = {
                        "marketplace": "ozon",
                        "api_key_id": ozon_key.get('id')
                    }
                    
                    import_response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                                    params=params, headers=headers, timeout=30)
                    
                    if import_response.status_code == 200:
                        import_result = import_response.json()
                        print(f"   ✅ Import successful: {import_result}")
                        
                        # Check products
                        print("\n6. Checking imported products...")
                        products_response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
                        
                        if products_response.status_code == 200:
                            products = products_response.json()
                            print(f"   ✅ Found {len(products)} products")
                            
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
            print("   ❌ No Ozon key found")
    
    print("\n" + "=" * 50)
    print("🎉 REAL OZON KEY UPDATED")
    print("📱 Now check frontend - import should work!")
    print("=" * 50)

if __name__ == "__main__":
    update_real_ozon_key()
