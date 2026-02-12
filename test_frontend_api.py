#!/usr/bin/env python3
"""
Test frontend API proxy
"""

import requests
import json

def test_proxy():
    """Test if frontend proxy is working"""
    try:
        # Test direct backend
        print("🧪 Testing direct backend API...")
        response = requests.get("http://localhost:8000/api/health")
        print(f"   Direct backend: {response.status_code} - {response.json()}")
        
        # Test through frontend proxy
        print("🧪 Testing frontend proxy...")
        response = requests.get("http://localhost:3002/api/health")
        print(f"   Frontend proxy: {response.status_code} - {response.json()}")
        
        # Test products endpoint through proxy
        print("🧪 Testing products endpoint through proxy...")
        headers = {
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTc0MDk5MTk4ODc0ZDVlODI0MTc4MjIiLCJyb2xlIjoic2VsbGVyIiwiZXhwIjoxNzcwOTAyMTU1fQ.FqxPlk5QeqEOzXJh1ifwCi_0Kxg3cuQiEUUQkQUVnpU"
        }
        response = requests.get("http://localhost:3002/api/products?limit=10", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"   Products through proxy: {response.status_code} - Found {len(data)} products")
            return True
        else:
            print(f"   Products through proxy: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🔧 TESTING FRONTEND API PROXY")
    print("=" * 40)
    success = test_proxy()
    
    if success:
        print("\n✅ Frontend proxy is working correctly!")
        print("🎯 Products should load in the interface now.")
    else:
        print("\n❌ Frontend proxy has issues.")
        print("🔧 Check browser console for more details.")
