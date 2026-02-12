#!/usr/bin/env python3
"""
Test Vite proxy connectivity
"""

import requests
import time

def test_vite_proxy():
    """Test if Vite proxy can connect to backend"""
    print("🔍 Testing Vite proxy connectivity...")
    
    # Test 1: Direct backend
    print("\n1. Testing direct backend (8002):")
    try:
        response = requests.get("http://localhost:8002/api/health", timeout=5)
        print(f"   ✅ Direct backend: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Direct backend error: {e}")
    
    # Test 2: Through Vite proxy
    print("\n2. Testing through Vite proxy (3000):")
    try:
        response = requests.get("http://localhost:3000/api/health", timeout=5)
        print(f"   ✅ Vite proxy: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Vite proxy error: {e}")
    
    # Test 3: Check if Vite is running
    print("\n3. Testing Vite frontend:")
    try:
        response = requests.get("http://localhost:3000/", timeout=5)
        print(f"   ✅ Vite frontend: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Vite frontend error: {e}")
    
    # Test 4: Try different proxy target
    print("\n4. Testing connectivity from Vite perspective:")
    try:
        # This simulates what Vite proxy does
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex(('localhost', 8002))
        sock.close()
        
        if result == 0:
            print("   ✅ Port 8002 is reachable")
        else:
            print(f"   ❌ Port 8002 not reachable (code: {result})")
    except Exception as e:
        print(f"   ❌ Socket test error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 VITE PROXY CONNECTIVITY TEST")
    print("=" * 60)
    
    test_vite_proxy()
    
    print("\n" + "=" * 60)
    print("📊 CONNECTIVITY TEST COMPLETE")
    print("=" * 60)
