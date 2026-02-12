#!/usr/bin/env python3
"""
Test API integration functionality
"""

import requests
import json

def test_api_integration():
    """Test API integration with seller account"""
    print("🔍 TESTING API INTEGRATION")
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
    
    # Get API keys
    print("\n2. Getting API keys...")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=5)
    
    if response.status_code != 200:
        print(f"❌ Failed to get API keys: {response.text}")
        return
    
    keys = response.json()
    print(f"✅ Found {len(keys)} API keys")
    
    for key in keys:
        print(f"   📋 {key.get('name', 'Unknown')}: {key.get('marketplace', 'Unknown')}")
        print(f"      Client ID: {key.get('client_id', 'N/A')}")
        print(f"      Key Masked: {key.get('api_key_masked', 'N/A')}")
    
    # Test API connections
    print("\n3. Testing API connections...")
    
    for key in keys:
        marketplace = key.get('marketplace')
        client_id = key.get('client_id', '')
        key_id = key.get('id')
        
        print(f"\n   🔧 Testing {marketplace.upper()}...")
        
        # Test connection using key ID (system will decrypt the key)
        test_data = {
            "marketplace": marketplace,
            "client_id": client_id,
            "api_key": "placeholder",  # System will use the stored encrypted key
            "key_id": key_id  # Pass key ID to use stored key
        }
        
        # Test connection
        response = requests.post("http://localhost:8002/api/seller/api-keys/test", 
                               json=test_data, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"      ✅ {marketplace.upper()}: {result.get('message', 'Success')}")
                if 'products_count' in result:
                    print(f"      📊 Products found: {result['products_count']}")
            else:
                print(f"      ❌ {marketplace.upper()}: {result.get('message', 'Failed')}")
        else:
            print(f"      ❌ {marketplace.upper()}: HTTP {response.status_code}")
    
    print("\n" + "=" * 50)
    print("🎉 API INTEGRATION TEST COMPLETED")
    print("📝 Next steps:")
    print("   1. Add real API keys")
    print("   2. Test connections with real keys")
    print("   3. Verify data retrieval")
    print("=" * 50)

if __name__ == "__main__":
    test_api_integration()
