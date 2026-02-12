#!/usr/bin/env python3
"""
Debug user ID matching between token and database
"""

import requests
import json

def debug_user_ids():
    """Debug user ID matching"""
    print("🔍 DEBUGGING USER ID MATCHING")
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
    
    # Decode token to see user_id
    import base64
    import json
    
    # JWT token has 3 parts: header.payload.signature
    parts = token.split('.')
    payload = parts[1]
    
    # Add padding if needed
    padding = len(payload) % 4
    if padding:
        payload += '=' * (4 - padding)
    
    decoded_payload = base64.b64decode(payload)
    payload_data = json.loads(decoded_payload)
    
    token_user_id = payload_data.get('sub')
    token_role = payload_data.get('role')
    
    print(f"✅ Token decoded successfully")
    print(f"📋 Token user_id (sub): {token_user_id}")
    print(f"📋 Token role: {token_role}")
    print(f"📋 Token user_id type: {type(token_user_id)}")
    
    # Get current user info
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n2. Getting current user info...")
    response = requests.get("http://localhost:8002/api/auth/me", headers=headers, timeout=10)
    
    if response.status_code == 200:
        current_user = response.json()
        current_user_id = current_user.get('id')
        current_user_email = current_user.get('email')
        
        print(f"✅ Current user retrieved")
        print(f"📋 Current user id: {current_user_id}")
        print(f"📋 Current user email: {current_user_email}")
        print(f"📋 Current user id type: {type(current_user_id)}")
        
        # Compare IDs
        print(f"\n3. Comparing IDs...")
        print(f"📋 Token user_id: {token_user_id}")
        print(f"📋 Current user id: {current_user_id}")
        
        if str(token_user_id) == str(current_user_id):
            print(f"✅ IDs MATCH!")
        else:
            print(f"❌ IDs DON'T MATCH!")
            print(f"   Token ID: {token_user_id} (length: {len(str(token_user_id))})")
            print(f"   Current ID: {current_user_id} (length: {len(str(current_user_id))})")
    else:
        print(f"❌ Failed to get current user: {response.status_code}")
    
    # Test products with both IDs
    print(f"\n4. Testing products with both IDs...")
    
    # Test with token user_id
    print(f"   🔍 Testing with token user_id: {token_user_id}")
    # We can't directly call ProductService, but we can see if products exist
    
    print(f"\n" + "=" * 60)
    print("🎉 USER ID DEBUG COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    debug_user_ids()
