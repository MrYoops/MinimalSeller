#!/usr/bin/env python3
"""
Import real products from marketplaces
"""

import requests
import json

def import_real_products():
    """Import real products using direct API keys"""
    print("🛒 IMPORTING REAL PRODUCTS")
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
    
    # Import from Ozon using direct API
    print("\n2. Importing from Ozon...")
    
    # Get products directly from Ozon
    ozon_data = {
        "marketplace": "ozon",
        "client_id": "3152566",
        "api_key": "2a159f7c-59df-497c-bb5f-88d36ae6d890",
        "limit": 10
    }
    
    # First test connection
    test_response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                                  json=ozon_data, headers=headers, timeout=30)
    
    if test_response.status_code == 200:
        test_result = test_response.json()
        if test_result.get('success'):
            print(f"   ✅ Ozon connection successful: {test_result.get('message')}")
            
            # Get actual products
            try:
                from backend.connectors import get_connector
                connector = get_connector("ozon", ozon_data["client_id"], ozon_data["api_key"])
                products = await connector.get_products()
                print(f"   📦 Found {len(products)} products from Ozon")
                
                # Import products to database
                import_data = {
                    "marketplace": "ozon",
                    "products": products[:5]  # Import first 5 products
                }
                
                import_response = requests.post("http://localhost:8002/api/products/marketplaces/ozon/import", 
                                              json=import_data, headers=headers, timeout=30)
                
                if import_response.status_code == 200:
                    result = import_response.json()
                    print(f"   ✅ Ozon import successful: {result}")
                else:
                    print(f"   ❌ Ozon import failed: {import_response.status_code} - {import_response.text}")
                    
            except Exception as e:
                print(f"   ❌ Error getting Ozon products: {e}")
        else:
            print(f"   ❌ Ozon connection failed: {test_result.get('message')}")
    else:
        print(f"   ❌ Ozon test failed: {test_response.status_code} - {test_response.text}")
    
    # Import from Wildberries
    print("\n3. Importing from Wildberries...")
    
    wb_data = {
        "marketplace": "wb",
        "client_id": "",
        "api_key": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzg2NTcyNjc3LCJpZCI6IjAxOWM0YzJmLTA5YzYtN2VmMC05MWUzLTgwOWZmMmU4YjY5NSIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.q0kfgFeOpzENjH78xIQ1XHgvQI8VN0HR2vNGlxGPJ8h-4QyS9rpbtpxP0LquzSXB2cT_9FZ4Z1Dh7eW6Zy1q1A"
    }
    
    # Test connection
    test_response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                                  json=wb_data, headers=headers, timeout=30)
    
    if test_response.status_code == 200:
        test_result = test_response.json()
        if test_result.get('success'):
            print(f"   ✅ WB connection successful: {test_result.get('message')}")
            
            # Import products
            import_data = {
                "marketplace": "wb", 
                "products": []  # Will be filled with actual products
            }
            
            import_response = requests.post("http://localhost:8002/api/products/marketplaces/wb/import", 
                                              json=import_data, headers=headers, timeout=30)
            
            if import_response.status_code == 200:
                result = import_response.json()
                print(f"   ✅ WB import successful: {result}")
            else:
                print(f"   ❌ WB import failed: {import_response.status_code} - {import_response.text}")
        else:
            print(f"   ❌ WB connection failed: {test_result.get('message')}")
    else:
        print(f"   ❌ WB test failed: {test_response.status_code} - {test_response.text}")
    
    # Check products after import
    print("\n4. Checking products after import...")
    response = requests.get("http://localhost:8002/api/products", headers=headers, timeout=10)
    
    if response.status_code == 200:
        products = response.json()
        print(f"   ✅ Found {len(products)} products in database")
        for i, product in enumerate(products[:5]):
            print(f"      📦 {product.get('name', 'Unknown')} ({product.get('marketplace', 'N/A')})")
    else:
        print(f"   ❌ Still failed to get products: {response.status_code}")
    
    print("\n" + "=" * 50)
    print("🎉 IMPORT COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    import_real_products()
