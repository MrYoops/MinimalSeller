#!/usr/bin/env python3
"""
Debug API keys in database
"""

import requests
import json

def debug_api_keys():
    """Debug API keys in database"""
    print("🔍 DEBUGGING API KEYS IN DATABASE")
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
    seller_id = token_data.get('user', {}).get('id')
    print(f"✅ Got seller token")
    print(f"📋 Seller ID: {seller_id}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get integrations (what frontend sees)
    print("\n2. Getting integrations from API...")
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
    
    if response.status_code == 200:
        integrations = response.json()
        print(f"✅ Found {len(integrations)} integrations via API")
        for i, integration in enumerate(integrations):
            print(f"   🔑 {i+1}. {integration.get('name', 'Unknown')}")
            print(f"      ID: {integration.get('id', 'N/A')}")
            print(f"      Marketplace: {integration.get('marketplace', 'N/A')}")
            print(f"      Client ID: {integration.get('client_id', 'N/A')}")
            print(f"      Key: {integration.get('api_key_masked', 'N/A')}")
    else:
        print(f"❌ Failed to get integrations: {response.status_code}")
        return
    
    # Test direct import with specific key ID
    print("\n3. Testing direct import with first key ID...")
    
    if len(integrations) > 0:
        first_integration = integrations[0]
        key_id = first_integration.get('id')
        marketplace = first_integration.get('marketplace')
        
        print(f"   🔧 Using key ID: {key_id} for marketplace: {marketplace}")
        
        # Test direct API key test
        test_data = {
            "marketplace": marketplace,
            "client_id": first_integration.get('client_id', ''),
            "api_key": "placeholder",
            "key_id": key_id
        }
        
        response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                               json=test_data, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"   ✅ Direct API test successful: {result.get('message')}")
            else:
                print(f"   ❌ Direct API test failed: {result.get('message')}")
        else:
            print(f"   ❌ Direct API test failed: {response.status_code} - {response.text}")
        
        # Test import with key ID
        print(f"\n4. Testing import with key ID...")
        params = {
            "marketplace": marketplace,
            "api_key_id": key_id
        }
        
        response = requests.post("http://localhost:8002/api/products/marketplaces/import-all", 
                               params=params, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Import successful: {result}")
        else:
            print(f"   ❌ Import failed: {response.status_code} - {response.text}")
    
    print("\n" + "=" * 60)
    print("🎉 API KEYS DEBUG COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    debug_api_keys()
