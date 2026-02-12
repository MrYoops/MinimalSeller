#!/usr/bin/env python3
"""
Test stock synchronization with real API keys
"""

import requests
import json

def test_stock_sync():
    """Test stock synchronization"""
    print("📦 TESTING STOCK SYNCHRONIZATION")
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
    print(f"✅ Got seller token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get warehouses
    print("\n2. Getting warehouses...")
    response = requests.get("http://localhost:8002/api/warehouses", headers=headers, timeout=10)
    
    if response.status_code == 200:
        warehouses = response.json()
        print(f"✅ Found {len(warehouses)} warehouses")
        for warehouse in warehouses:
            print(f"   📦 {warehouse.get('name', 'Unknown')}: {warehouse.get('id', 'N/A')}")
        
        if len(warehouses) > 0:
            warehouse_id = warehouses[0].get('id')
            warehouse_name = warehouses[0].get('name')
            
            # Test stock sync with Ozon
            print(f"\n3. Testing stock sync with Ozon...")
            
            sync_data = {
                "marketplace": "ozon",
                "warehouse_id": warehouse_id,
                "api_key_id": None  # Use default key
            }
            
            response = requests.post("http://localhost:8002/api/inventory/sync-all-stocks", 
                                   json=sync_data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Stock sync successful: {result}")
                print(f"   📊 Synced: {result.get('synced', 0)}")
                print(f"   ❌ Failed: {result.get('failed', 0)}")
                print(f"   ⏸️ Skipped: {result.get('skipped', 0)}")
            else:
                print(f"   ❌ Stock sync failed: {response.status_code} - {response.text}")
            
            # Test stock sync with WB
            print(f"\n4. Testing stock sync with Wildberries...")
            
            sync_data = {
                "marketplace": "wb",
                "warehouse_id": warehouse_id,
                "api_key_id": None  # Use default key
            }
            
            response = requests.post("http://localhost:8002/api/inventory/sync-all-stocks", 
                                   json=sync_data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Stock sync successful: {result}")
                print(f"   📊 Synced: {result.get('synced', 0)}")
                print(f"   ❌ Failed: {result.get('failed', 0)}")
                print(f"   ⏸️ Skipped: {result.get('skipped', 0)}")
            else:
                print(f"   ❌ Stock sync failed: {response.status_code} - {response.text}")
        else:
            print("❌ No warehouses found")
    
    # Check inventory after sync
    print("\n5. Checking inventory after sync...")
    
    # Try different inventory endpoints
    inventory_endpoints = [
        "/api/inventory",
        "/api/inventory/stock",
        "/api/stock"
    ]
    
    for endpoint in inventory_endpoints:
        print(f"   🔍 Trying {endpoint}...")
        response = requests.get(f"http://localhost:8002{endpoint}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            inventory = response.json()
            print(f"   ✅ Found {len(inventory)} inventory items")
            for i, item in enumerate(inventory[:3]):
                print(f"      📊 Item {i+1}: {item.get('product_name', 'N/A')} - Stock: {item.get('stock', 'N/A')}")
            break
        else:
            print(f"   ❌ {endpoint}: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("🎉 STOCK SYNC TEST COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    test_stock_sync()
