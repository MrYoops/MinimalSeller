#!/usr/bin/env python3
"""
Test API keys directly without encryption
"""

import requests
import json

def test_direct_api():
    """Test API keys directly"""
    print("🔍 TESTING DIRECT API KEYS")
    print("=" * 50)
    
    # Real API keys
    api_keys = {
        "ozon": {
            "client_id": "3152566",
            "api_key": "2a159f7c-59df-497c-bb5f-88d36ae6d890"
        },
        "wb": {
            "client_id": "",
            "api_key": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzg2NTcyNjc3LCJpZCI6IjAxOWM0YzJmLTA5YzYtN2VmMC05MWUzLTgwOWZmMmU4YjY5NSIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.q0kfgFeOpzENjH78xIQ1XHgvQI8VN0HR2vNGlxGPJ8h-4QyS9rpbtpxP0LquzSXB2cT_9FZ4Z1Dh7eW6Zy1q1A"
        }
    }
    
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
    
    # Test each API key directly
    headers = {"Authorization": f"Bearer {token}"}
    
    for marketplace, keys in api_keys.items():
        print(f"\n2. Testing {marketplace.upper()} API directly...")
        
        test_data = {
            "marketplace": marketplace,
            "client_id": keys["client_id"],
            "api_key": keys["api_key"]
        }
        
        response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                               json=test_data, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"   ✅ {marketplace.upper()}: {result.get('message', 'Success')}")
                if 'products_count' in result:
                    print(f"   📊 Products found: {result['products_count']}")
            else:
                print(f"   ❌ {marketplace.upper()}: {result.get('message', 'Failed')}")
        else:
            print(f"   ❌ {marketplace.upper()}: HTTP {response.status_code}")
            print(f"   📄 Response: {response.text}")
    
    print("\n" + "=" * 50)
    print("🎉 DIRECT API TEST COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    test_direct_api()
