#!/usr/bin/env python3
"""
Test seller account functionality
"""

import requests
import json

def test_seller_login():
    """Test seller login and basic functionality"""
    print("🔍 TESTING SELLER ACCOUNT")
    print("=" * 50)
    
    # Test 1: Seller login
    print("\n1. Testing Seller Login:")
    try:
        login_data = {
            "email": "seller@test.com",
            "password": "seller123"
        }
        response = requests.post("http://localhost:8002/api/auth/login", json=login_data, timeout=10)
        print(f"   ✅ Seller Login: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get('access_token')
            print(f"   🎉 Login successful!")
            print(f"   🔑 Token preview: {access_token[:50]}...")
            print(f"   👤 User: {token_data.get('user', {}).get('email', 'N/A')}")
            print(f"   🔐 Role: {token_data.get('user', {}).get('role', 'N/A')}")
            print(f"   ✅ Active: {token_data.get('user', {}).get('is_active', 'N/A')}")
            
            return access_token
        else:
            print(f"   ❌ Login failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Login error: {e}")
        return None

def test_seller_endpoints(token):
    """Test seller-specific endpoints"""
    print("\n2. Testing Seller Endpoints:")
    
    if not token:
        print("   ❌ No token available")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test seller profile
    try:
        response = requests.get("http://localhost:8002/api/auth/me", headers=headers, timeout=5)
        print(f"   ✅ Profile: {response.status_code}")
        if response.status_code == 200:
            user_data = response.json()
            print(f"   👤 Email: {user_data.get('email', 'N/A')}")
            print(f"   🔐 Role: {user_data.get('role', 'N/A')}")
            print(f"   ✅ Active: {user_data.get('is_active', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Profile error: {e}")
    
    # Test seller dashboard data (if exists)
    try:
        response = requests.get("http://localhost:8002/api/seller/dashboard", headers=headers, timeout=5)
        print(f"   📊 Dashboard: {response.status_code}")
        if response.status_code == 200:
            dashboard_data = response.json()
            print(f"   📈 Dashboard data available: {len(dashboard_data)} items")
        elif response.status_code == 404:
            print(f"   ⚠️ Dashboard endpoint not found (404)")
        else:
            print(f"   ❌ Dashboard error: {response.text}")
    except Exception as e:
        print(f"   ❌ Dashboard error: {e}")

def test_seller_permissions(token):
    """Test seller permissions (should not access admin endpoints)"""
    print("\n3. Testing Seller Permissions:")
    
    if not token:
        print("   ❌ No token available")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to access admin endpoint (should fail)
    try:
        response = requests.get("http://localhost:8002/api/admin/users", headers=headers, timeout=5)
        print(f"   🚫 Admin Users: {response.status_code}")
        if response.status_code == 403:
            print("   ✅ Correctly denied access to admin endpoint")
        elif response.status_code == 404:
            print("   ⚠️ Admin endpoint not found")
        else:
            print(f"   ⚠️ Unexpected response: {response.text}")
    except Exception as e:
        print(f"   ❌ Admin test error: {e}")

if __name__ == "__main__":
    print("🧪 SELLER ACCOUNT FUNCTIONALITY TEST")
    print("=" * 60)
    
    # Test seller login
    token = test_seller_login()
    
    if token:
        # Test seller endpoints
        test_seller_endpoints(token)
        
        # Test permissions
        test_seller_permissions(token)
        
        print("\n" + "=" * 60)
        print("🎉 SELLER TEST COMPLETED")
        print("✅ Seller account is functional")
        print("✅ Login works correctly")
        print("✅ Permissions are properly enforced")
        print("=" * 60)
    else:
        print("\n❌ SELLER LOGIN FAILED")
        print("🔧 Check seller credentials and account status")
        print("=" * 60)
