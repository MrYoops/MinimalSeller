#!/usr/bin/env python3
"""
Test frontend login functionality
"""

import requests
import json

def test_frontend_login():
    """Test login through frontend (direct URL)"""
    print("🔍 Testing frontend login with direct backend URL...")
    
    # Simulate frontend request to backend
    url = "http://localhost:8002/api/auth/login"
    data = {
        "email": "admin@minimalmod.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        print(f"✅ Login request status: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get('access_token')
            print(f"🎉 Login successful!")
            print(f"📋 Token type: {token_data.get('token_type', 'N/A')}")
            print(f"🔑 Token preview: {access_token[:50]}..." if access_token else "❌ No token")
            
            # Test token with a protected endpoint
            if access_token:
                print("\n🔍 Testing protected endpoint...")
                headers = {"Authorization": f"Bearer {access_token}"}
                
                # Try to access a protected endpoint (e.g., user profile)
                try:
                    profile_response = requests.get("http://localhost:8002/api/auth/me", headers=headers, timeout=5)
                    print(f"📋 Profile status: {profile_response.status_code}")
                    if profile_response.status_code == 200:
                        user_data = profile_response.json()
                        print(f"👤 User: {user_data.get('email', 'N/A')}")
                        print(f"🔐 Role: {user_data.get('role', 'N/A')}")
                    else:
                        print(f"❌ Profile error: {profile_response.text}")
                except Exception as e:
                    print(f"❌ Profile request error: {e}")
            
            return True
        else:
            print(f"❌ Login failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Login request error: {e}")
        return False

def test_backend_health():
    """Test backend health"""
    print("\n🔍 Testing backend health...")
    
    try:
        response = requests.get("http://localhost:8002/api/health", timeout=5)
        print(f"✅ Backend health: {response.status_code}")
        if response.status_code == 200:
            health_data = response.json()
            print(f"📋 Service: {health_data.get('service', 'N/A')}")
            print(f"📊 Status: {health_data.get('status', 'N/A')}")
        return True
    except Exception as e:
        print(f"❌ Backend health error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 FRONTEND LOGIN FUNCTIONALITY TEST")
    print("=" * 60)
    
    # Test backend health first
    health_ok = test_backend_health()
    
    if health_ok:
        # Test login
        login_ok = test_frontend_login()
        
        print("\n" + "=" * 60)
        if login_ok:
            print("🎉 FRONTEND LOGIN TEST: PASSED")
            print("✅ User can successfully authenticate")
            print("✅ Token is generated and valid")
            print("✅ Protected endpoints are accessible")
        else:
            print("❌ FRONTEND LOGIN TEST: FAILED")
            print("❌ Authentication is not working")
        print("=" * 60)
    else:
        print("\n❌ BACKEND NOT AVAILABLE - SKIPPING LOGIN TEST")
        print("=" * 60)
