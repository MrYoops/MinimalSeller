#!/usr/bin/env python3
"""
FBS Orders Backend API Testing
Tests order management endpoints for SelsUp-inspired order system
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL
BACKEND_URL = "https://ecommerce-analytics-2.preview.emergentagent.com/api"

# Test credentials
TEST_SELLER_EMAIL = "seller@test.com"
TEST_SELLER_PASSWORD = "seller123"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.RESET}")

class FBSOrdersTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token: Optional[str] = None
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.test_order_id: Optional[str] = None
    
    def login(self) -> bool:
        """Login and get auth token"""
        print("\n" + "="*60)
        print("LOGIN")
        print("="*60)
        
        try:
            payload = {
                "email": TEST_SELLER_EMAIL,
                "password": TEST_SELLER_PASSWORD
            }
            
            response = requests.post(
                f"{self.base_url}/auth/login",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print_success(f"Login successful, token: {self.token[:20]}...")
                return True
            else:
                print_error(f"Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print_error(f"Login exception: {str(e)}")
            return False
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_fbs_orders(self) -> bool:
        """Test GET /api/orders/fbs - List FBS orders"""
        print("\n" + "="*60)
        print("TEST: GET /api/orders/fbs - List FBS Orders")
        print("="*60)
        
        try:
            response = requests.get(
                f"{self.base_url}/orders/fbs",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Got {len(data)} FBS orders")
                
                if len(data) > 0:
                    # Save first order ID for detail test
                    self.test_order_id = data[0].get("id")
                    print_info(f"Sample order: {json.dumps(data[0], indent=2, ensure_ascii=False)[:300]}...")
                    
                    # Check required fields
                    required_fields = ["id", "order_number", "marketplace", "status", "items", "customer"]
                    missing_fields = [f for f in required_fields if f not in data[0]]
                    
                    if missing_fields:
                        print_warning(f"Missing fields in order: {missing_fields}")
                        self.warnings += 1
                    else:
                        print_success("All required fields present")
                else:
                    print_warning("No orders found - this is OK if no orders imported yet")
                    self.warnings += 1
                
                self.passed += 1
                return True
            else:
                print_error(f"Failed: {response.status_code} - {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_get_order_detail(self) -> bool:
        """Test GET /api/orders/fbs/{order_id} - Get order details"""
        print("\n" + "="*60)
        print("TEST: GET /api/orders/fbs/{order_id} - Order Details")
        print("="*60)
        
        if not self.test_order_id:
            print_warning("Skipping - no test order ID available")
            self.warnings += 1
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/orders/fbs/{self.test_order_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Got order details for {data.get('order_number')}")
                print_info(f"Order data: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}...")
                
                # Check detailed fields
                required_fields = ["id", "order_number", "marketplace", "status", "items", "customer", "totals"]
                missing_fields = [f for f in required_fields if f not in data]
                
                if missing_fields:
                    print_warning(f"Missing fields: {missing_fields}")
                    self.warnings += 1
                else:
                    print_success("All required fields present")
                
                self.passed += 1
                return True
            else:
                print_error(f"Failed: {response.status_code} - {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_update_order_status(self) -> bool:
        """Test PUT /api/orders/fbs/{order_id}/status - Update order status"""
        print("\n" + "="*60)
        print("TEST: PUT /api/orders/fbs/{order_id}/status - Update Status")
        print("="*60)
        
        if not self.test_order_id:
            print_warning("Skipping - no test order ID available")
            self.warnings += 1
            return False
        
        try:
            payload = {
                "status": "awaiting_shipment",
                "comment": "Test status update from automated testing"
            }
            
            response = requests.put(
                f"{self.base_url}/orders/fbs/{self.test_order_id}/status",
                headers=self.get_headers(),
                json=payload,
                timeout=10
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Status updated: {data.get('message')}")
                print_info(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                self.passed += 1
                return True
            else:
                print_error(f"Failed: {response.status_code} - {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_get_order_label(self) -> bool:
        """Test GET /api/orders/fbs/{order_id}/label - Get order label"""
        print("\n" + "="*60)
        print("TEST: GET /api/orders/fbs/{order_id}/label - Get Label")
        print("="*60)
        
        if not self.test_order_id:
            print_warning("Skipping - no test order ID available")
            self.warnings += 1
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/orders/fbs/{self.test_order_id}/label",
                headers=self.get_headers(),
                timeout=15
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                label_url = data.get("label_url")
                
                if label_url:
                    print_success(f"Label URL received: {label_url[:100]}...")
                    self.passed += 1
                    return True
                else:
                    print_warning("Label URL is empty - may not be available yet")
                    self.warnings += 1
                    return False
            elif response.status_code == 404:
                print_warning("Label not found - this is OK if order is new")
                self.warnings += 1
                return False
            else:
                print_error(f"Failed: {response.status_code} - {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_refresh_label(self) -> bool:
        """Test POST /api/orders/fbs/{order_id}/label/refresh - Refresh label"""
        print("\n" + "="*60)
        print("TEST: POST /api/orders/fbs/{order_id}/label/refresh - Refresh Label")
        print("="*60)
        
        if not self.test_order_id:
            print_warning("Skipping - no test order ID available")
            self.warnings += 1
            return False
        
        try:
            response = requests.post(
                f"{self.base_url}/orders/fbs/{self.test_order_id}/label/refresh",
                headers=self.get_headers(),
                timeout=15
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Label refreshed successfully")
                print_info(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)[:300]}...")
                self.passed += 1
                return True
            elif response.status_code == 404:
                print_warning("Label refresh failed - order may not support labels")
                self.warnings += 1
                return False
            else:
                print_error(f"Failed: {response.status_code} - {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_split_order(self) -> bool:
        """Test POST /api/orders/fbs/{order_id}/split - Split order"""
        print("\n" + "="*60)
        print("TEST: POST /api/orders/fbs/{order_id}/split - Split Order")
        print("="*60)
        
        if not self.test_order_id:
            print_warning("Skipping - no test order ID available")
            self.warnings += 1
            return False
        
        # First get order details to know items
        try:
            response = requests.get(
                f"{self.base_url}/orders/fbs/{self.test_order_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code != 200:
                print_warning("Cannot get order details for split test")
                self.warnings += 1
                return False
            
            order_data = response.json()
            items = order_data.get("items", [])
            marketplace = order_data.get("marketplace", "")
            
            if marketplace == "wb":
                print_warning("Wildberries doesn't support order splitting - skipping")
                self.warnings += 1
                return False
            
            if len(items) < 2:
                print_warning("Order has less than 2 items - cannot test splitting")
                self.warnings += 1
                return False
            
            # Create split payload - split items into 2 boxes
            box1_items = [{"article": items[0]["article"], "quantity": items[0]["quantity"]}]
            box2_items = [{"article": items[1]["article"], "quantity": items[1]["quantity"]}]
            
            payload = {
                "boxes": [
                    {"box_number": 1, "items": box1_items},
                    {"box_number": 2, "items": box2_items}
                ]
            }
            
            response = requests.post(
                f"{self.base_url}/orders/fbs/{self.test_order_id}/split",
                headers=self.get_headers(),
                json=payload,
                timeout=15
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Order split successfully: {data.get('message')}")
                print_info(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                self.passed += 1
                return True
            elif response.status_code == 400:
                print_warning(f"Split validation failed (expected): {response.text}")
                self.warnings += 1
                return False
            else:
                print_error(f"Failed: {response.status_code} - {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_bulk_labels(self) -> bool:
        """Test POST /api/orders/fbs/labels/bulk - Bulk label download"""
        print("\n" + "="*60)
        print("TEST: POST /api/orders/fbs/labels/bulk - Bulk Labels")
        print("="*60)
        
        if not self.test_order_id:
            print_warning("Skipping - no test order ID available")
            self.warnings += 1
            return False
        
        try:
            payload = {
                "order_ids": [self.test_order_id]
            }
            
            response = requests.post(
                f"{self.base_url}/orders/fbs/labels/bulk",
                headers=self.get_headers(),
                json=payload,
                timeout=20
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                labels = data.get("labels", [])
                errors = data.get("errors", [])
                
                print_success(f"Bulk labels: {len(labels)} successful, {len(errors)} errors")
                print_info(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}...")
                
                if len(labels) > 0:
                    self.passed += 1
                    return True
                else:
                    print_warning("No labels returned - may not be available")
                    self.warnings += 1
                    return False
            else:
                print_error(f"Failed: {response.status_code} - {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
            self.failed += 1
            return False
    
    def run_all_tests(self):
        """Run all FBS orders tests"""
        print("\n" + "="*80)
        print("FBS ORDERS BACKEND API TESTING")
        print("="*80)
        
        # Login first
        if not self.login():
            print_error("Login failed - cannot proceed with tests")
            return False
        
        # Run tests
        self.test_get_fbs_orders()
        self.test_get_order_detail()
        self.test_update_order_status()
        self.test_get_order_label()
        self.test_refresh_label()
        self.test_split_order()
        self.test_bulk_labels()
        
        # Print summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print_success(f"Passed: {self.passed}")
        print_error(f"Failed: {self.failed}")
        print_warning(f"Warnings: {self.warnings}")
        
        total = self.passed + self.failed
        if total > 0:
            success_rate = (self.passed / total) * 100
            print(f"\nSuccess Rate: {success_rate:.1f}%")
        
        return self.failed == 0

if __name__ == "__main__":
    tester = FBSOrdersTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
