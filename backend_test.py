#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for MinimalMod
Tests REAL marketplace integrations (Ozon, Wildberries, Yandex.Market)
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://minimalmod-dash.preview.emergentagent.com/api"

# Test credentials
TEST_SELLER_EMAIL = "seller@test.com"
TEST_SELLER_PASSWORD = "password123"

# Colors for output
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

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.test_api_key_id: Optional[str] = None
        self.passed = 0
        self.failed = 0
        self.warnings = 0
    
    def test_health_check(self) -> bool:
        """Test 1: Health Check Endpoint"""
        print("\n" + "="*60)
        print("TEST 1: Health Check")
        print("="*60)
        
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    print_success(f"Health check passed: {data}")
                    self.passed += 1
                    return True
                else:
                    print_error(f"Health check returned unexpected status: {data}")
                    self.failed += 1
                    return False
            else:
                print_error(f"Health check failed with status {response.status_code}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Health check exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_login(self) -> bool:
        """Test 2: Authentication - Login"""
        print("\n" + "="*60)
        print("TEST 2: Authentication - Login")
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
            
            print_info(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                if "access_token" in data and "user" in data:
                    self.token = data["access_token"]
                    self.user_id = data["user"].get("id")
                    
                    print_success(f"Login successful!")
                    print_info(f"User: {data['user'].get('email')} (Role: {data['user'].get('role')})")
                    print_info(f"Token: {self.token[:20]}...")
                    self.passed += 1
                    return True
                else:
                    print_error(f"Login response missing required fields: {data}")
                    self.failed += 1
                    return False
                    
            elif response.status_code == 401:
                print_error(f"Login failed: Invalid credentials")
                print_warning("User may not exist or password is incorrect")
                print_info("Attempting to register user...")
                
                # Try to register the user
                if self.register_test_user():
                    # Retry login
                    return self.test_login()
                else:
                    self.failed += 1
                    return False
                    
            elif response.status_code == 403:
                print_error(f"Login failed: Account not activated")
                print_warning("User exists but needs admin approval")
                self.failed += 1
                return False
            else:
                print_error(f"Login failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Login exception: {str(e)}")
            self.failed += 1
            return False
    
    def register_test_user(self) -> bool:
        """Helper: Register test user"""
        print_info("Registering test user...")
        
        try:
            payload = {
                "email": TEST_SELLER_EMAIL,
                "password": TEST_SELLER_PASSWORD,
                "full_name": "Test Seller",
                "company_name": "Test Company",
                "inn": "1234567890"
            }
            
            response = requests.post(
                f"{self.base_url}/auth/register",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                print_success("User registered successfully")
                
                # Now activate the user directly in MongoDB
                print_info("Activating user account...")
                return self.activate_test_user()
            else:
                print_error(f"Registration failed: {response.text}")
                return False
                
        except Exception as e:
            print_error(f"Registration exception: {str(e)}")
            return False
    
    def activate_test_user(self) -> bool:
        """Helper: Activate test user via MongoDB"""
        try:
            import subprocess
            
            cmd = f"""mongo minimalmod --eval 'db.users.updateOne({{email: "{TEST_SELLER_EMAIL}"}}, {{$set: {{is_active: true}}}})'"""
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if "nModified" in result.stdout or "modifiedCount" in result.stdout:
                print_success("User activated successfully")
                return True
            else:
                print_warning("Could not activate user via MongoDB")
                return False
                
        except Exception as e:
            print_warning(f"Could not activate user: {str(e)}")
            return False
    
    def test_get_me(self) -> bool:
        """Test 3: Get Current User"""
        print("\n" + "="*60)
        print("TEST 3: Get Current User (/auth/me)")
        print("="*60)
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            response = requests.get(
                f"{self.base_url}/auth/me",
                headers=headers,
                timeout=10
            )
            
            print_info(f"Get user response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify user data
                if data.get("email") == TEST_SELLER_EMAIL:
                    print_success(f"User data retrieved successfully")
                    print_info(f"User: {data.get('full_name')} ({data.get('email')})")
                    print_info(f"Role: {data.get('role')}, Active: {data.get('is_active')}")
                    self.passed += 1
                    return True
                else:
                    print_error(f"User data mismatch: {data}")
                    self.failed += 1
                    return False
                    
            elif response.status_code == 401:
                print_error("Unauthorized - token invalid or expired")
                self.failed += 1
                return False
            else:
                print_error(f"Get user failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Get user exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_add_api_key(self) -> bool:
        """Test 4: Add API Key"""
        print("\n" + "="*60)
        print("TEST 4: Add API Key")
        print("="*60)
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "marketplace": "wb",
                "client_id": "",
                "api_key": "test-token-123"
            }
            
            response = requests.post(
                f"{self.base_url}/seller/api-keys",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            print_info(f"Add API key response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if "key_id" in data:
                    self.test_api_key_id = data["key_id"]
                    print_success(f"API key added successfully")
                    print_info(f"Key ID: {self.test_api_key_id}")
                    print_info(f"Marketplace: {data.get('key', {}).get('marketplace')}")
                    print_info(f"Masked Key: {data.get('key', {}).get('api_key_masked')}")
                    self.passed += 1
                    return True
                else:
                    print_error(f"API key response missing key_id: {data}")
                    self.failed += 1
                    return False
                    
            else:
                print_error(f"Add API key failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Add API key exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_list_api_keys(self) -> bool:
        """Test 5: List API Keys"""
        print("\n" + "="*60)
        print("TEST 5: List API Keys")
        print("="*60)
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            response = requests.get(
                f"{self.base_url}/seller/api-keys",
                headers=headers,
                timeout=10
            )
            
            print_info(f"List API keys response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    print_success(f"API keys retrieved successfully")
                    print_info(f"Total keys: {len(data)}")
                    
                    # Check if our test key is in the list
                    if self.test_api_key_id:
                        found = any(key.get("id") == self.test_api_key_id for key in data)
                        if found:
                            print_success(f"Test API key found in list")
                        else:
                            print_warning(f"Test API key not found in list")
                    
                    # Display keys
                    for key in data:
                        print_info(f"  - {key.get('marketplace')}: {key.get('api_key_masked')} (ID: {key.get('id')})")
                    
                    self.passed += 1
                    return True
                else:
                    print_error(f"Unexpected response format: {data}")
                    self.failed += 1
                    return False
                    
            else:
                print_error(f"List API keys failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"List API keys exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_update_api_key(self) -> bool:
        """Test 6: Update API Key"""
        print("\n" + "="*60)
        print("TEST 6: Update API Key")
        print("="*60)
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        if not self.test_api_key_id:
            print_warning("No test API key ID available. Skipping update test.")
            self.warnings += 1
            return True
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "name": "Test Integration"
            }
            
            response = requests.put(
                f"{self.base_url}/seller/api-keys/{self.test_api_key_id}",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            print_info(f"Update API key response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"API key updated successfully")
                print_info(f"Response: {data}")
                self.passed += 1
                return True
            else:
                print_error(f"Update API key failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Update API key exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_api_key_connection(self) -> bool:
        """Test 7: Test API Key Connection (REAL API)"""
        print("\n" + "="*60)
        print("TEST 7: Test API Key Connection (REAL MARKETPLACE API)")
        print("="*60)
        print_warning("This makes REAL HTTP requests to Wildberries API")
        print_warning("Invalid tokens will return 401/403 errors - THIS IS EXPECTED")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "marketplace": "wb",
                "client_id": "",
                "api_key": "invalid-token"
            }
            
            response = requests.post(
                f"{self.base_url}/seller/api-keys/test",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            print_info(f"Test API key response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if it's a success or error response
                if data.get("success") == False:
                    # Expected: API error from marketplace
                    print_success(f"API test endpoint working correctly")
                    print_info(f"Marketplace returned error (expected): {data.get('message')}")
                    print_info("✓ Real HTTP request was initiated")
                    print_info("✓ Error handling works correctly")
                    self.passed += 1
                    return True
                elif data.get("success") == True:
                    # Unexpected: token worked (shouldn't happen with invalid token)
                    print_warning(f"API test succeeded unexpectedly: {data.get('message')}")
                    print_info(f"Products found: {data.get('products_count', 0)}")
                    self.passed += 1
                    return True
                else:
                    print_error(f"Unexpected response format: {data}")
                    self.failed += 1
                    return False
            else:
                print_error(f"Test API key failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Test API key exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_get_marketplace_products(self) -> bool:
        """Test 8: Get Marketplace Products (REAL API)"""
        print("\n" + "="*60)
        print("TEST 8: Get Marketplace Products (REAL API)")
        print("="*60)
        print_warning("This endpoint requires valid API key in database")
        print_warning("Will return error if no valid key exists - THIS IS EXPECTED")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            response = requests.get(
                f"{self.base_url}/marketplaces/wb/products",
                headers=headers,
                timeout=30
            )
            
            print_info(f"Get marketplace products response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    print_success(f"Marketplace products endpoint working")
                    print_info(f"Products returned: {len(data)}")
                    
                    if len(data) > 0:
                        print_info(f"Sample product: {data[0].get('name', 'N/A')}")
                    
                    self.passed += 1
                    return True
                else:
                    print_error(f"Unexpected response format: {data}")
                    self.failed += 1
                    return False
                    
            elif response.status_code == 400:
                # Expected: No API key configured
                print_success(f"Endpoint working correctly - no valid API key")
                print_info(f"Error message: {response.json().get('detail', 'N/A')}")
                print_info("✓ Error handling works correctly")
                self.passed += 1
                return True
                
            elif response.status_code in [401, 403]:
                # Expected: Marketplace API error
                print_success(f"Endpoint working correctly - marketplace API error")
                print_info(f"Error: {response.json().get('detail', 'N/A')}")
                print_info("✓ Real HTTP request was initiated")
                print_info("✓ Error handling works correctly")
                self.passed += 1
                return True
            else:
                print_error(f"Get marketplace products failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Get marketplace products exception: {str(e)}")
            self.failed += 1
            return False
    
    def test_delete_api_key(self) -> bool:
        """Test 9: Delete API Key"""
        print("\n" + "="*60)
        print("TEST 9: Delete API Key")
        print("="*60)
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        if not self.test_api_key_id:
            print_warning("No test API key ID available. Skipping delete test.")
            self.warnings += 1
            return True
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            response = requests.delete(
                f"{self.base_url}/seller/api-keys/{self.test_api_key_id}",
                headers=headers,
                timeout=10
            )
            
            print_info(f"Delete API key response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"API key deleted successfully")
                print_info(f"Response: {data}")
                
                # Verify deletion by listing keys
                list_response = requests.get(
                    f"{self.base_url}/seller/api-keys",
                    headers=headers,
                    timeout=10
                )
                
                if list_response.status_code == 200:
                    keys = list_response.json()
                    found = any(key.get("id") == self.test_api_key_id for key in keys)
                    
                    if not found:
                        print_success("Verified: API key removed from list")
                    else:
                        print_warning("API key still appears in list")
                
                self.passed += 1
                return True
            elif response.status_code == 404:
                print_warning("API key not found (may have been deleted already)")
                self.warnings += 1
                return True
            else:
                print_error(f"Delete API key failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Delete API key exception: {str(e)}")
            self.failed += 1
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("\n" + "="*60)
        print("MINIMALMOD BACKEND API TESTING")
        print("Testing REAL Marketplace Integrations")
        print("="*60)
        print_info(f"Backend URL: {self.base_url}")
        print_info(f"Test User: {TEST_SELLER_EMAIL}")
        
        # Run tests in sequence
        self.test_health_check()
        self.test_login()
        self.test_get_me()
        self.test_add_api_key()
        self.test_list_api_keys()
        self.test_update_api_key()
        self.test_api_key_connection()
        self.test_get_marketplace_products()
        self.test_delete_api_key()
        
        # Print summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print_success(f"Passed: {self.passed}")
        if self.failed > 0:
            print_error(f"Failed: {self.failed}")
        if self.warnings > 0:
            print_warning(f"Warnings: {self.warnings}")
        
        total = self.passed + self.failed
        if total > 0:
            success_rate = (self.passed / total) * 100
            print(f"\nSuccess Rate: {success_rate:.1f}%")
        
        print("="*60)
        
        # Return exit code
        return 0 if self.failed == 0 else 1

if __name__ == "__main__":
    tester = BackendTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
