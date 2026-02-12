#!/usr/bin/env python3
"""
Debug connector headers and data
"""

import requests
import json

def debug_connector_headers():
    """Debug what connector sends vs direct API"""
    print("🔍 DEBUGGING CONNECTOR HEADERS")
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
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=10)
    
    if response.status_code != 200:
        print(f"❌ Failed to get integrations: {response.status_code}")
        return
    
    integrations = response.json()
    ozon_key = next((i for i in integrations if i.get('marketplace') == 'ozon'), None)
    
    if not ozon_key:
        print("❌ No Ozon key found")
        return
    
    print(f"\n2. Testing connector vs direct API...")
    
    # Test through our connector
    test_data = {
        "marketplace": "ozon",
        "client_id": ozon_key.get('client_id', ''),
        "api_key": "placeholder",
        "key_id": ozon_key.get('id')
    }
    
    print(f"   🔧 Testing through connector...")
    print(f"   Client ID: {ozon_key.get('client_id', '')}")
    print(f"   Key ID: {ozon_key.get('id')}")
    
    connector_response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                                      json=test_data, headers=headers, timeout=30)
    
    if connector_response.status_code == 200:
        connector_result = connector_response.json()
        print(f"   Connector result: {connector_result}")
    else:
        print(f"   ❌ Connector failed: {connector_response.status_code} - {connector_response.text}")
    
    # Test direct API
    print(f"\n3. Testing direct API...")
    
    client_id = "3152566"
    api_key = "2a159f7c-59df-497c-bb5f-88d36ae6d890"
    
    url = "https://api-seller.ozon.ru/v3/product/list"
    
    direct_headers = {
        "Client-Id": client_id,
        "Api-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    data = {
        "filter": {"visibility": "ALL"},
        "limit": 10
    }
    
    direct_response = requests.post(url, headers=direct_headers, json=data, timeout=30)
    
    print(f"   Direct API Status: {direct_response.status_code}")
    
    if direct_response.status_code == 200:
        direct_result = direct_response.json()
        products = direct_result.get('result', {}).get('items', [])
        print(f"   ✅ Direct API SUCCESS: {len(products)} products")
    else:
        print(f"   ❌ Direct API failed: {direct_response.status_code}")
        print(f"   Response: {direct_response.text}")
    
    print("\n" + "=" * 50)
    print("🎉 DEBUG COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    debug_connector_headers()
