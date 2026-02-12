#!/usr/bin/env python3
"""
Add real API keys for seller@test.com
"""

import requests
import json

# Seller credentials
SELLER_EMAIL = "seller@test.com"
SELLER_PASSWORD = "seller123"

# Real API keys
REAL_API_KEYS = {
    "ozon": {
        "client_id": "3152566",
        "api_key": "2a159f7c-59df-497c-bb5f-88d36ae6d890",
        "name": "Ozon Real API"
    },
    "wb": {
        "client_id": "",
        "api_key": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzg2NTcyNjc3LCJpZCI6IjAxOWM0YzJmLTA5YzYtN2VmMC05MWUzLTgwOWZmMmU4YjY5NSIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.q0kfgFeOpzENjH78xIQ1XHgvQI8VN0HR2vNGlxGPJ8h-4QyS9rpbtpxP0LquzSXB2cT_9FZ4Z1Dh7eW6Zy1q1A",
        "name": "Wildberries Real API"
    },
    "yandex": {
        "client_id": "",
        "api_key": "YOUR_REAL_YANDEX_API_KEY_HERE",  # Пока нет ключа
        "campaign_id": "YOUR_CAMPAIGN_ID_HERE",      # Пока нет Campaign ID
        "name": "Yandex Market Real API"
    }
}

def get_seller_token():
    """Get seller auth token"""
    print("🔑 Getting seller token...")
    
    login_data = {
        "email": SELLER_EMAIL,
        "password": SELLER_PASSWORD
    }
    
    response = requests.post("http://localhost:8002/api/auth/login", json=login_data, timeout=10)
    
    if response.status_code == 200:
        token_data = response.json()
        return token_data.get('access_token')
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def clear_existing_keys(token):
    """Clear existing API keys"""
    print("🗑️ Clearing existing API keys...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get existing keys
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=5)
    
    if response.status_code == 200:
        keys = response.json()
        for key in keys:
            key_id = key.get('id')
            if key_id:
                delete_response = requests.delete(f"http://localhost:8002/api/seller/api-keys/{key_id}", headers=headers, timeout=5)
                if delete_response.status_code == 200:
                    print(f"   ✅ Deleted key: {key.get('name', 'Unknown')}")
                else:
                    print(f"   ❌ Failed to delete key: {delete_response.text}")
    
    print("✅ Existing keys cleared")

def add_api_key(token, marketplace, key_data):
    """Add a single API key"""
    print(f"🔧 Adding {marketplace.upper()} API key...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Prepare key data
    api_key_data = {
        "marketplace": marketplace,
        "client_id": key_data.get("client_id", ""),
        "api_key": key_data.get("api_key", ""),
        "name": key_data.get("name", f"{marketplace.title()} API")
    }
    
    # Add campaign_id for Yandex
    if marketplace == "yandex" and "campaign_id" in key_data:
        api_key_data["campaign_id"] = key_data["campaign_id"]
    
    response = requests.post("http://localhost:8002/api/seller/api-keys", 
                           json=api_key_data, headers=headers, timeout=10)
    
    if response.status_code == 200:
        print(f"   ✅ Added {marketplace.upper()} API key")
        return True
    else:
        print(f"   ❌ Failed to add {marketplace.upper()} API key: {response.text}")
        return False

def main():
    """Main function"""
    print("🔧 ADDING REAL API KEYS TO SELLER ACCOUNT")
    print("=" * 60)
    
    # Get seller token
    token = get_seller_token()
    if not token:
        print("❌ Cannot proceed without token")
        return
    
    print(f"✅ Got seller token")
    
    # Clear existing keys
    clear_existing_keys(token)
    
    # Add new keys
    success_count = 0
    total_count = len(REAL_API_KEYS)
    
    for marketplace, key_data in REAL_API_KEYS.items():
        if add_api_key(token, marketplace, key_data):
            success_count += 1
    
    print("\n" + "=" * 60)
    print(f"📊 RESULTS: {success_count}/{total_count} keys added successfully")
    
    if success_count == total_count:
        print("🎉 ALL API KEYS ADDED SUCCESSFULLY!")
        print("📱 You can now test integrations in the frontend")
    else:
        print("⚠️ Some keys failed to add")
        print("🔧 Check the error messages above")
    
    print("=" * 60)
    
    # Show current keys
    print("\n🔍 CURRENT API KEYS:")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get("http://localhost:8002/api/seller/api-keys", headers=headers, timeout=5)
    
    if response.status_code == 200:
        keys = response.json()
        for key in keys:
            print(f"   📋 {key.get('name', 'Unknown')}: {key.get('marketplace', 'Unknown')}")

if __name__ == "__main__":
    print("🔧 Adding REAL API keys to seller account...")
    print("📋 Keys to add:")
    print("   ✅ Ozon: Real API key")
    print("   ✅ Wildberries: Real API key") 
    print("   ⏸️ Yandex: No key provided (will skip)")
    print()
    
    main()
