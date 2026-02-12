#!/usr/bin/env python3
"""
Test direct Ozon API call
"""

import requests
import json

def test_direct_ozon_api():
    """Test direct Ozon API call"""
    print("🔍 TESTING DIRECT OZON API")
    print("=" * 50)
    
    # Your provided credentials
    client_id = "3152566"
    api_key = "2a159f7c-59df-497c-bb5f-88d36ae6d890"
    
    print(f"\n1. Testing with provided credentials:")
    print(f"   Client ID: {client_id}")
    print(f"   API Key: {api_key[:20]}...")
    
    # Test direct API call
    url = "https://api-seller.ozon.ru/v3/product/list"
    
    headers = {
        "Client-Id": client_id,
        "Api-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    data = {
        "filter": {
            "visibility": "ALL"
        },
        "limit": 10
    }
    
    try:
        print(f"\n2. Making API call to: {url}")
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            products = result.get('result', {}).get('items', [])
            print(f"   ✅ SUCCESS! Found {len(products)} products")
            
            for i, product in enumerate(products[:3]):
                name = product.get('marketing_title', 'Unknown')
                sku = product.get('sku', 'Unknown')
                print(f"      📦 {i+1}. {name} (SKU: {sku})")
        else:
            print(f"   ❌ FAILED: {response.status_code}")
            print(f"   Response: {response.text}")
            
            # Try to get more details
            try:
                error_data = response.json()
                print(f"   Error details: {error_data}")
            except:
                pass
    
    except Exception as e:
        print(f"   ❌ Exception: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 DIRECT API TEST COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    test_direct_ozon_api()
