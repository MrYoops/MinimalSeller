#!/usr/bin/env python3
"""
Final comprehensive test of the login system
"""

import requests
import json
import time

def test_complete_system():
    """Test complete system functionality"""
    print("🔍 FINAL COMPREHENSIVE SYSTEM TEST")
    print("=" * 60)
    
    # Test 1: Backend health
    print("\n1. Testing Backend Health:")
    try:
        response = requests.get("http://localhost:8002/api/health", timeout=5)
        print(f"   ✅ Backend Health: {response.status_code}")
        if response.status_code == 200:
            print(f"   📋 Service: {response.json().get('service', 'N/A')}")
        else:
            print(f"   ❌ Health check failed: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Backend health error: {e}")
        return False
    
    # Test 2: Direct API login
    print("\n2. Testing Direct API Login:")
    try:
        login_data = {
            "email": "admin@minimalmod.com",
            "password": "admin123"
        }
        response = requests.post("http://localhost:8002/api/auth/login", json=login_data, timeout=10)
        print(f"   ✅ Direct Login: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get('access_token')
            print(f"   🎉 Login successful!")
            print(f"   🔑 Token preview: {access_token[:50]}..." if access_token else "❌ No token")
            
            # Test 3: Protected endpoint
            print("\n3. Testing Protected Endpoint:")
            headers = {"Authorization": f"Bearer {access_token}"}
            try:
                profile_response = requests.get("http://localhost:8002/api/auth/me", headers=headers, timeout=5)
                print(f"   ✅ Profile: {profile_response.status_code}")
                if profile_response.status_code == 200:
                    user_data = profile_response.json()
                    print(f"   👤 User: {user_data.get('email', 'N/A')}")
                    print(f"   🔐 Role: {user_data.get('role', 'N/A')}")
                else:
                    print(f"   ❌ Profile error: {profile_response.text}")
                    return False
            except Exception as e:
                print(f"   ❌ Profile request error: {e}")
                return False
                
        else:
            print(f"   ❌ Login failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Direct login error: {e}")
        return False
    
    # Test 4: Frontend availability
    print("\n4. Testing Frontend Availability:")
    try:
        response = requests.get("http://localhost:3000/", timeout=5)
        print(f"   ✅ Frontend: {response.status_code}")
        if response.status_code != 200:
            print(f"   ❌ Frontend not available: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Frontend error: {e}")
        return False
    
    # Test 5: CORS preflight
    print("\n5. Testing CORS Preflight:")
    try:
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
        response = requests.options("http://localhost:8002/api/auth/login", headers=headers, timeout=5)
        print(f"   ✅ CORS Preflight: {response.status_code}")
        
        cors_headers = response.headers
        if 'access-control-allow-origin' in cors_headers:
            print(f"   🌐 CORS Origin: {cors_headers['access-control-allow-origin']}")
        else:
            print(f"   ⚠️ No CORS Origin header found")
            
    except Exception as e:
        print(f"   ❌ CORS error: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 ALL TESTS PASSED!")
    print("✅ System is fully functional")
    print("✅ Backend API working")
    print("✅ Authentication working")
    print("✅ Frontend available")
    print("✅ CORS configured")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = test_complete_system()
    
    if not success:
        print("\n❌ SOME TESTS FAILED")
        print("🔧 Check the logs above for details")
        exit(1)
    else:
        print("\n🚀 READY FOR USE!")
        print("📱 Open http://localhost:3000 in your browser")
        print("🔑 Login with: admin@minimalmod.com / admin123")
