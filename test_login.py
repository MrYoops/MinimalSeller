#!/usr/bin/env python3
"""
Test script to verify login functionality
"""

import requests
import json

def test_direct_backend():
    """Test direct backend API"""
    print("🔍 Testing direct backend API...")
    
    url = "http://localhost:8001/api/auth/login"
    data = {
        "email": "admin@minimalmod.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"✅ Direct backend: {response.status_code}")
        if response.status_code == 200:
            print(f"🎉 Token received: {response.json().get('access_token', 'N/A')[:50]}...")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

def test_frontend_proxy():
    """Test through frontend proxy"""
    print("\n🔍 Testing through frontend proxy...")
    
    url = "http://localhost:3000/api/auth/login"
    data = {
        "email": "admin@minimalmod.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"✅ Frontend proxy: {response.status_code}")
        if response.status_code == 200:
            print(f"🎉 Token received: {response.json().get('access_token', 'N/A')[:50]}...")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

def test_frontend_health():
    """Test frontend health endpoint"""
    print("\n🔍 Testing frontend health...")
    
    try:
        response = requests.get("http://localhost:3000/api/health")
        print(f"✅ Frontend health: {response.status_code}")
        if response.status_code == 200:
            print(f"🎉 Health check: {response.text}")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 MINIMALSELLER LOGIN TEST")
    print("=" * 60)
    
    test_direct_backend()
    test_frontend_proxy()
    test_frontend_health()
    
    print("\n" + "=" * 60)
    print("📊 TEST COMPLETE")
    print("=" * 60)
