#!/usr/bin/env python3
"""
Test frontend import functionality
"""

import requests
import json

def test_frontend_import():
    """Test frontend import endpoints"""
    print("🛒 TESTING FRONTEND IMPORT FUNCTIONALITY")
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
    
    # Get integrations (what frontend sees)
    print("\n2. Getting integrations (frontend view)...")
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
    
    if response.status_code == 200:
        integrations = response.json()
        print(f"✅ Found {len(integrations)} integrations")
        for i, integration in enumerate(integrations):
            print(f"   🔑 {i+1}. {integration.get('name', 'Unknown')} ({integration.get('marketplace', 'N/A')})")
            print(f"      ID: {integration.get('id', 'N/A')}")
            print(f"      Client ID: {integration.get('client_id', 'N/A')}")
            print(f"      Key: {integration.get('api_key_masked', 'N/A')}")
    else:
        print(f"❌ Failed to get integrations: {response.status_code}")
        return
    
    # Test import from Ozon (like frontend does)
    print("\n3. Testing import from Ozon (frontend style)...")
    
    if len(integrations) > 0:
        # Find Ozon integration
        ozon_integration = next((i for i in integrations if i.get('marketplace') == 'ozon'), None)
        
        if ozon_integration:
            print(f"   🛒 Using Ozon integration: {ozon_integration.get('name', 'Unknown')}")
            
            # Test import like frontend does
            params = {
                "marketplace": "ozon",
                "api_key_id": ozon_integration.get('id')
            }
            
            response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                   params=params, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Import successful: {result}")
                
                # Check products after import
                print("\n4. Checking products after import...")
                products_response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
                
                if products_response.status_code == 200:
                    products = products_response.json()
                    print(f"   ✅ Found {len(products)} products after import")
                    
                    # Count by marketplace
                    ozon_count = 0
                    for product in products:
                        marketplaces = product.get('marketplaces', {})
                        if marketplaces.get('ozon', {}).get('enabled', False):
                            ozon_count += 1
                    
                    print(f"   📊 Ozon products: {ozon_count}")
                    
                    # Show first few products
                    for i, product in enumerate(products[:3]):
                        name = product.get('minimalmod', {}).get('name', 'Unknown')
                        sku = product.get('sku', 'N/A')
                        print(f"      📦 {i+1}. {name} (SKU: {sku})")
                else:
                    print(f"   ❌ Failed to get products after import: {products_response.status_code}")
            else:
                print(f"   ❌ Import failed: {response.status_code} - {response.text}")
        else:
            print("   ❌ No Ozon integration found")
    else:
        print("   ❌ No integrations found")
    
    # Test import from WB
    print("\n5. Testing import from Wildberries (frontend style)...")
    
    if len(integrations) > 0:
        # Find WB integration
        wb_integration = next((i for i in integrations if i.get('marketplace') == 'wb'), None)
        
        if wb_integration:
            print(f"   🛒 Using WB integration: {wb_integration.get('name', 'Unknown')}")
            
            # Test import like frontend does
            params = {
                "marketplace": "wb",
                "api_key_id": wb_integration.get('id')
            }
            
            response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                                   params=params, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Import successful: {result}")
            else:
                print(f"   ❌ Import failed: {response.status_code} - {response.text}")
        else:
            print("   ❌ No WB integration found")
    
    print("\n" + "=" * 60)
    print("🎉 FRONTEND IMPORT TEST COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    test_frontend_import()
