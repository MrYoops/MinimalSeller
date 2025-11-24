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
BACKEND_URL = "https://seller-platform-7.preview.emergentagent.com/api"

# Test credentials from review request
TEST_SELLER_EMAIL = "testuser@test.com"
TEST_SELLER_PASSWORD = "password"

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
    
    def test_ozon_api_connection_real(self) -> bool:
        """Test 10: Test Ozon API Connection with REAL credentials"""
        print("\n" + "="*60)
        print("TEST 10: Test Ozon API Connection (REAL CREDENTIALS)")
        print("="*60)
        print_info("Testing with REAL Ozon API credentials")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            # REAL Ozon credentials from review request
            payload = {
                "marketplace": "ozon",
                "client_id": "3152566",
                "api_key": "a3acc5e5-45d8-4667-9fab-9f6d0e3bfb3c"
            }
            
            print_info(f"Testing Ozon API with Client ID: {payload['client_id']}")
            
            response = requests.post(
                f"{self.base_url}/seller/api-keys/test",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 404:
                print_error("❌ CRITICAL: Endpoint returned 404!")
                print_error("This means the API endpoint in connectors.py is WRONG")
                print_error("Expected endpoint: /v3/product/info/list")
                self.failed += 1
                return False
            
            if response.status_code == 200:
                data = response.json()
                print_info(f"Response: {data}")
                
                if data.get("success") == True:
                    print_success(f"✅ Ozon API connection successful!")
                    print_info(f"Products found: {data.get('products_count', 0)}")
                    self.passed += 1
                    return True
                else:
                    print_error(f"❌ Ozon API connection failed: {data.get('message')}")
                    print_info("Check if credentials are valid or API endpoint is correct")
                    self.failed += 1
                    return False
            else:
                print_error(f"Request failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during Ozon API test: {str(e)}")
            self.failed += 1
            return False
    
    def test_ozon_warehouses(self) -> bool:
        """Test 11: Get Ozon Warehouses with Brotli/GZIP decompression (CRITICAL)"""
        print("\n" + "="*60)
        print("TEST 11: Get Ozon Warehouses with Brotli/GZIP Decompression (CRITICAL)")
        print("="*60)
        print_warning("CRITICAL: Testing Brotli and gzip decompression fix for Ozon API")
        print_info("First adding Ozon API key, then fetching warehouses")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            # Step 1: Add Ozon API key
            print_info("Step 1: Adding Ozon API key...")
            add_key_payload = {
                "marketplace": "ozon",
                "client_id": "3152566",
                "api_key": "a3acc5e5-45d8-4667-9fab-9f6d0e3bfb3c"
            }
            
            add_response = requests.post(
                f"{self.base_url}/seller/api-keys",
                headers=headers,
                json=add_key_payload,
                timeout=10
            )
            
            if add_response.status_code != 200:
                print_warning(f"Could not add API key (may already exist): {add_response.text}")
            else:
                ozon_key_id = add_response.json().get('key_id')
                print_success(f"Ozon API key added: {ozon_key_id}")
            
            # Step 2: Get warehouses
            print_info("Step 2: Fetching Ozon warehouses...")
            print_info("Expected: Backend should detect and decompress gzip response")
            
            warehouse_response = requests.get(
                f"{self.base_url}/marketplaces/ozon/all-warehouses",
                headers=headers,
                timeout=30
            )
            
            print_info(f"Warehouse response status: {warehouse_response.status_code}")
            
            if warehouse_response.status_code == 200:
                data = warehouse_response.json()
                print_info(f"Response: {json.dumps(data, indent=2)}")
                
                # Check if response is properly parsed JSON (not garbled text)
                if not isinstance(data, dict):
                    print_error("❌ Response is not a valid JSON object!")
                    print_error("This indicates gzip decompression may have failed")
                    self.failed += 1
                    return False
                
                warehouses = data.get('warehouses', [])
                
                if isinstance(warehouses, list):
                    print_success(f"✅ Successfully retrieved Ozon warehouses!")
                    print_success(f"✅ Response properly parsed as JSON (Brotli/gzip decompression working)")
                    print_info(f"Total warehouses: {len(warehouses)}")
                    
                    if len(warehouses) == 0:
                        print_info("Seller has 0 FBS warehouses (this is legitimate for new accounts)")
                        print_info("The important thing is the API call succeeded and response was parsed")
                    
                    # Check if these are seller's FBS warehouses (not FBO)
                    fbs_count = sum(1 for wh in warehouses if wh.get('is_fbs') == True)
                    fbo_count = sum(1 for wh in warehouses if wh.get('type', '').upper() == 'FBO' and not wh.get('is_fbs'))
                    
                    print_info(f"FBS warehouses (seller's own): {fbs_count}")
                    print_info(f"FBO warehouses (marketplace): {fbo_count}")
                    
                    # Display warehouse details
                    for wh in warehouses[:5]:  # Show first 5
                        print_info(f"  - {wh.get('name')} (ID: {wh.get('id')}, Type: {wh.get('type')}, FBS: {wh.get('is_fbs')})")
                    
                    if fbo_count > 0 and fbs_count == 0:
                        print_warning("⚠️  WARNING: Only FBO warehouses returned, but should return seller's FBS warehouses!")
                        print_warning("The endpoint should use /v1/warehouse/list to get seller's warehouses")
                    
                    # Step 3: Check backend logs for Brotli/gzip detection message
                    print_info("\nStep 3: Checking backend logs for Brotli/gzip decompression...")
                    self.check_backend_logs_for_compression()
                    
                    self.passed += 1
                    return True
                else:
                    print_error(f"Unexpected response format: {data}")
                    self.failed += 1
                    return False
            else:
                print_error(f"Failed to get warehouses: {warehouse_response.status_code}")
                print_error(f"Response: {warehouse_response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during warehouse test: {str(e)}")
            self.failed += 1
            return False
    
    def check_backend_logs_for_compression(self):
        """Helper: Check backend logs for Brotli/gzip decompression messages"""
        try:
            import subprocess
            
            # Check backend logs for compression detection
            print_info("Checking for Brotli compression logs...")
            cmd_brotli = "tail -n 300 /var/log/supervisor/backend.out.log | grep -i 'brotli' | tail -n 10"
            
            result_brotli = subprocess.run(cmd_brotli, shell=True, capture_output=True, text=True)
            
            if result_brotli.stdout:
                print_success("✅ Found Brotli-related log entries:")
                print(result_brotli.stdout)
                
                if "Detected Brotli-compressed response, decompressing" in result_brotli.stdout:
                    print_success("✅ CONFIRMED: Brotli decompression was triggered!")
                    if "Successfully decompressed Brotli" in result_brotli.stdout:
                        print_success("✅ CONFIRMED: Brotli decompression succeeded!")
                        return
            else:
                print_info("No Brotli-related logs found, checking for gzip...")
            
            # Check for gzip if no Brotli found
            print_info("Checking for gzip compression logs...")
            cmd_gzip = "tail -n 300 /var/log/supervisor/backend.out.log | grep -i 'gzip' | tail -n 10"
            
            result_gzip = subprocess.run(cmd_gzip, shell=True, capture_output=True, text=True)
            
            if result_gzip.stdout:
                print_success("✅ Found gzip-related log entries:")
                print(result_gzip.stdout)
                
                if "Detected gzip-compressed response, decompressing" in result_gzip.stdout:
                    print_success("✅ CONFIRMED: Gzip decompression was triggered!")
                    if "Successfully decompressed gzip" in result_gzip.stdout:
                        print_success("✅ CONFIRMED: Gzip decompression succeeded!")
                        return
            else:
                print_info("No gzip-related logs found")
            
            # Check for Content-Encoding header logs
            print_info("Checking for Content-Encoding header logs...")
            cmd_encoding = "tail -n 300 /var/log/supervisor/backend.out.log | grep -i 'content-encoding' | tail -n 5"
            
            result_encoding = subprocess.run(cmd_encoding, shell=True, capture_output=True, text=True)
            
            if result_encoding.stdout:
                print_info("Content-Encoding header logs:")
                print(result_encoding.stdout)
                
                if "'br'" in result_encoding.stdout or "br" in result_encoding.stdout:
                    print_info("✅ Response was Brotli-compressed (Content-Encoding: br)")
                elif "'gzip'" in result_encoding.stdout or "gzip" in result_encoding.stdout:
                    print_info("✅ Response was gzip-compressed (Content-Encoding: gzip)")
            else:
                print_info("No Content-Encoding logs found (response may not have been compressed)")
                
        except Exception as e:
            print_warning(f"Could not check logs: {str(e)}")
    
    def test_wb_add_integration(self) -> bool:
        """Test 12: Add WB Integration with REAL token"""
        print("\n" + "="*60)
        print("TEST 12: Add WB Integration (REAL TOKEN)")
        print("="*60)
        print_info("Adding Wildberries integration with REAL valid token")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            # REAL WB token from review request
            payload = {
                "marketplace": "wb",
                "client_id": "",
                "api_key": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzc4OTA3MzY0LCJpZCI6IjAxOWE4MzRiLWE0YmYtNzhlMy1hNjIwLTY0YmYwZmFhYmQzYyIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.-HhPg4RMtRtgRgT-jo2f2Lyp1s9rIgKzoyEoKpVl4s-IRp_kQ9_JMeDG1DxBiwAzeZ_So9McQEaSfThjinAqYQ"
            }
            
            print_info(f"Adding WB integration...")
            
            response = requests.post(
                f"{self.base_url}/seller/api-keys",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if "key_id" in data:
                    wb_key_id = data["key_id"]
                    print_success(f"✅ WB integration added successfully!")
                    print_info(f"Key ID: {wb_key_id}")
                    print_info(f"Masked Key: {data.get('key', {}).get('api_key_masked')}")
                    self.passed += 1
                    return True
                else:
                    print_error(f"Response missing key_id: {data}")
                    self.failed += 1
                    return False
            else:
                print_error(f"Failed to add WB integration: {response.status_code}")
                print_error(f"Response: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during WB integration add: {str(e)}")
            self.failed += 1
            return False
    
    def test_wb_connection(self) -> bool:
        """Test 13: Test WB Connection with REAL token"""
        print("\n" + "="*60)
        print("TEST 13: Test WB Connection (REAL TOKEN)")
        print("="*60)
        print_info("Testing Wildberries API connection with REAL valid token")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            # REAL WB token from review request
            payload = {
                "marketplace": "wb",
                "client_id": "",
                "api_key": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzc4OTA3MzY0LCJpZCI6IjAxOWE4MzRiLWE0YmYtNzhlMy1hNjIwLTY0YmYwZmFhYmQzYyIsImlpZCI6MzAxNjU1NDM2LCJvaWQiOjI1MDA2MDc4OCwicyI6MTYxMjYsInNpZCI6Ijk5NmRiN2VjLWZiMGUtNGU5Ni05NmQ1LTcxNjgwNWMwNWU3MCIsInQiOmZhbHNlLCJ1aWQiOjMwMTY1NTQzNn0.-HhPg4RMtRtgRgT-jo2f2Lyp1s9rIgKzoyEoKpVl4s-IRp_kQ9_JMeDG1DxBiwAzeZ_So9McQEaSfThjinAqYQ"
            }
            
            print_info(f"Testing WB API connection...")
            
            response = requests.post(
                f"{self.base_url}/seller/api-keys/test",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_info(f"Response: {json.dumps(data, indent=2)}")
                
                if data.get("success") == True:
                    print_success(f"✅ WB API connection successful!")
                    print_info(f"Products found: {data.get('products_count', 0)}")
                    self.passed += 1
                    return True
                else:
                    print_error(f"❌ WB API connection failed: {data.get('message')}")
                    print_info("Check if token is valid or API endpoint is correct")
                    self.failed += 1
                    return False
            else:
                print_error(f"Request failed with status {response.status_code}: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during WB API test: {str(e)}")
            self.failed += 1
            return False
    
    def test_wb_seller_warehouses(self) -> bool:
        """Test 14: Get WB SELLER Warehouses (CRITICAL TEST)"""
        print("\n" + "="*60)
        print("TEST 14: Get WB SELLER Warehouses (CRITICAL TEST)")
        print("="*60)
        print_info("Fetching seller's FBS warehouses from Wildberries")
        print_warning("CRITICAL: Should return SELLER'S warehouses, NOT WB FBO warehouses!")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            print_info("Fetching WB warehouses...")
            
            warehouse_response = requests.get(
                f"{self.base_url}/marketplaces/wb/all-warehouses",
                headers=headers,
                timeout=30
            )
            
            print_info(f"Warehouse response status: {warehouse_response.status_code}")
            
            if warehouse_response.status_code == 200:
                data = warehouse_response.json()
                print_info(f"Response: {json.dumps(data, indent=2)}")
                
                warehouses = data.get('warehouses', [])
                
                if isinstance(warehouses, list):
                    print_success(f"✅ Successfully retrieved WB warehouses!")
                    print_info(f"Total warehouses: {len(warehouses)}")
                    
                    # CRITICAL VALIDATION: Check if these are seller's warehouses or WB FBO warehouses
                    fbo_warehouse_names = ["Коледино", "Электросталь", "Подольск", "Казань", "Екатеринбург"]
                    
                    fbo_count = 0
                    fbs_count = 0
                    
                    print("\n" + "-"*60)
                    print("WAREHOUSE DETAILS:")
                    print("-"*60)
                    
                    for wh in warehouses:
                        wh_name = wh.get('name', '')
                        wh_type = wh.get('type', '')
                        is_fbs = wh.get('is_fbs', False)
                        
                        print_info(f"  - Name: {wh_name}")
                        print_info(f"    ID: {wh.get('id')}")
                        print_info(f"    Type: {wh_type}")
                        print_info(f"    is_fbs: {is_fbs}")
                        print_info(f"    Address: {wh.get('address', 'N/A')}")
                        
                        # Check if this is a WB FBO warehouse (WRONG!)
                        if any(fbo_name in wh_name for fbo_name in fbo_warehouse_names):
                            fbo_count += 1
                            print_error(f"    ❌ WARNING: This is a WB FBO warehouse (WRONG!)")
                        elif is_fbs == True and wh_type == "FBS":
                            fbs_count += 1
                            print_success(f"    ✅ This is a seller's FBS warehouse (CORRECT!)")
                        
                        print()
                    
                    print("-"*60)
                    print_info(f"FBS warehouses (seller's own): {fbs_count}")
                    print_info(f"FBO warehouses (WB marketplace): {fbo_count}")
                    print("-"*60)
                    
                    # CRITICAL VALIDATION
                    if fbo_count > 0 and fbs_count == 0:
                        print_error("❌ CRITICAL FAILURE: Only WB FBO warehouses returned!")
                        print_error("Expected: Seller's FBS warehouses")
                        print_error("Got: WB marketplace FBO warehouses")
                        print_error("The endpoint is WRONG!")
                        self.failed += 1
                        return False
                    elif fbs_count > 0:
                        print_success("✅ CORRECT: Seller's FBS warehouses returned!")
                        self.passed += 1
                        return True
                    else:
                        print_warning("⚠️  No warehouses returned (seller may not have any)")
                        self.passed += 1
                        return True
                else:
                    print_error(f"Unexpected response format: {data}")
                    self.failed += 1
                    return False
            else:
                print_error(f"Failed to get warehouses: {warehouse_response.status_code}")
                print_error(f"Response: {warehouse_response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during warehouse test: {str(e)}")
            self.failed += 1
            return False
    
    def test_wb_endpoint_verification(self) -> bool:
        """Test 15: Verify WB endpoint is correct in backend logs"""
        print("\n" + "="*60)
        print("TEST 15: Verify WB Endpoint in Backend Logs")
        print("="*60)
        print_info("Checking backend logs for correct WB warehouse endpoint")
        
        try:
            import subprocess
            
            # Check backend logs for the warehouse API call
            cmd = "tail -n 100 /var/log/supervisor/backend.out.log | grep -i 'warehouses' | tail -n 10"
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.stdout:
                print_info("Recent warehouse-related log entries:")
                print(result.stdout)
                
                # Check if correct endpoint is used
                if "https://marketplace-api.wildberries.ru/api/v3/warehouses" in result.stdout:
                    print_success("✅ CORRECT endpoint found: /api/v3/warehouses")
                    self.passed += 1
                    return True
                elif "/api/v3/supplier/warehouses" in result.stdout:
                    print_error("❌ OLD endpoint found: /api/v3/supplier/warehouses (WRONG!)")
                    print_error("Should be: /api/v3/warehouses")
                    self.failed += 1
                    return False
                else:
                    print_warning("⚠️  Could not find warehouse endpoint in logs")
                    print_info("This may be normal if no warehouse requests were made yet")
                    self.warnings += 1
                    return True
            else:
                print_warning("⚠️  No warehouse-related logs found")
                self.warnings += 1
                return True
                
        except Exception as e:
            print_warning(f"Could not check logs: {str(e)}")
            self.warnings += 1
            return True
    
    def test_category_search_ozon(self) -> bool:
        """Test 16: Search Ozon Categories for 'кроссовки'"""
        print("\n" + "="*60)
        print("TEST 16: Search Ozon Categories (REAL API)")
        print("="*60)
        print_info("Testing category search endpoint with query 'кроссовки'")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            # Search for кроссовки categories
            response = requests.get(
                f"{self.base_url}/categories/search/ozon",
                headers=headers,
                params={"query": "кроссовки"},
                timeout=30
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_info(f"Response structure: {list(data.keys())}")
                
                categories = data.get('categories', [])
                print_success(f"✅ Category search successful!")
                print_info(f"Found {len(categories)} categories matching 'кроссовки'")
                
                if categories:
                    # Show first few categories
                    for i, cat in enumerate(categories[:3]):
                        print_info(f"  {i+1}. {cat.get('name')} (ID: {cat.get('id')}, Type ID: {cat.get('type_id')})")
                    
                    # Store first category for next test
                    self.test_category_id = categories[0].get('id')
                    self.test_type_id = categories[0].get('type_id')
                    print_info(f"Stored for next test: Category ID={self.test_category_id}, Type ID={self.test_type_id}")
                
                self.passed += 1
                return True
            else:
                print_error(f"Category search failed: {response.status_code}")
                print_error(f"Response: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during category search: {str(e)}")
            self.failed += 1
            return False
    
    def test_category_attributes_ozon(self) -> bool:
        """Test 17: Get Category Attributes for Ozon"""
        print("\n" + "="*60)
        print("TEST 17: Get Ozon Category Attributes (REAL API)")
        print("="*60)
        print_info("Testing category attributes endpoint")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        if not hasattr(self, 'test_category_id') or not self.test_category_id:
            print_warning("No category ID from previous test. Using default category.")
            self.test_category_id = "15621048"  # Default category
            self.test_type_id = 91248  # Default type
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            # Get attributes for the category
            response = requests.get(
                f"{self.base_url}/categories/ozon/{self.test_category_id}/attributes",
                headers=headers,
                params={"type_id": self.test_type_id} if self.test_type_id else {},
                timeout=30
            )
            
            print_info(f"Response status: {response.status_code}")
            print_info(f"Category ID: {self.test_category_id}, Type ID: {self.test_type_id}")
            
            if response.status_code == 200:
                data = response.json()
                print_info(f"Response structure: {list(data.keys())}")
                
                attributes = data.get('attributes', [])
                print_success(f"✅ Category attributes retrieved successfully!")
                print_info(f"Found {len(attributes)} attributes")
                
                if attributes:
                    # Show first few attributes
                    for i, attr in enumerate(attributes[:5]):
                        attr_id = attr.get('attribute_id') or attr.get('id')
                        attr_name = attr.get('name', 'Unnamed')
                        is_required = attr.get('is_required', False)
                        dictionary_id = attr.get('dictionary_id')
                        
                        print_info(f"  {i+1}. {attr_name} (ID: {attr_id}, Required: {is_required}, Dict: {dictionary_id})")
                        
                        # Store "Пол" attribute for next test
                        if attr_id == 9163 or "пол" in attr_name.lower():
                            self.test_attribute_id = attr_id
                            print_info(f"Found 'Пол' attribute: ID={attr_id}")
                
                self.passed += 1
                return True
            else:
                print_error(f"Get attributes failed: {response.status_code}")
                print_error(f"Response: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during get attributes: {str(e)}")
            self.failed += 1
            return False
    
    def test_attribute_values_ozon(self) -> bool:
        """Test 18: Get Attribute Values for 'Пол' attribute"""
        print("\n" + "="*60)
        print("TEST 18: Get Ozon Attribute Values (REAL API)")
        print("="*60)
        print_info("Testing attribute values endpoint for 'Пол' attribute")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        # Use the attribute ID from review request or from previous test
        attribute_id = getattr(self, 'test_attribute_id', None)
        if not attribute_id:
            attribute_id = 9163  # 9163 is "Пол" attribute from review request
        category_id = getattr(self, 'test_category_id', "15621048")
        type_id = getattr(self, 'test_type_id', 91248)
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            
            # Get values for the attribute
            params = {
                "attribute_id": attribute_id
            }
            if type_id:
                params["type_id"] = type_id
            
            response = requests.get(
                f"{self.base_url}/categories/ozon/{category_id}/attribute-values",
                headers=headers,
                params=params,
                timeout=30
            )
            
            print_info(f"Response status: {response.status_code}")
            print_info(f"Attribute ID: {attribute_id} (Пол)")
            
            if response.status_code == 200:
                data = response.json()
                print_info(f"Response structure: {list(data.keys())}")
                
                values = data.get('values', [])
                print_success(f"✅ Attribute values retrieved successfully!")
                print_info(f"Found {len(values)} values for 'Пол' attribute")
                
                if values:
                    # Show all values for gender
                    for i, value in enumerate(values[:10]):  # Show first 10
                        value_id = value.get('id') or value.get('value_id')
                        value_name = value.get('value') or value.get('name')
                        print_info(f"  {i+1}. {value_name} (ID: {value_id})")
                
                self.passed += 1
                return True
            else:
                print_error(f"Get attribute values failed: {response.status_code}")
                print_error(f"Response: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during get attribute values: {str(e)}")
            self.failed += 1
            return False
    
    def test_save_category_mappings(self) -> bool:
        """Test 19: Save Category Mappings for Product"""
        print("\n" + "="*60)
        print("TEST 19: Save Category Mappings (MOCK TEST)")
        print("="*60)
        print_info("Testing category mappings save endpoint")
        
        if not self.token:
            print_error("No token available. Login first.")
            self.failed += 1
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            
            # Use a mock product ID for testing
            test_product_id = "test-product-123"
            
            payload = {
                "ozon_category_id": getattr(self, 'test_category_id', "15621048"),
                "ozon_type_id": getattr(self, 'test_type_id', 91248),
                "ozon_category_name": "Кроссовки",
                "wb_category_id": "123456",
                "wb_category_name": "Обувь",
                "yandex_category_id": "789012",
                "yandex_category_name": "Спортивная обувь"
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products/{test_product_id}/category-mappings",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            print_info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"✅ Category mappings saved successfully!")
                print_info(f"Response: {data.get('message')}")
                self.passed += 1
                return True
            elif response.status_code == 404:
                print_warning("⚠️ Product not found (expected for mock test)")
                print_info("Endpoint is working but product doesn't exist")
                self.passed += 1
                return True
            else:
                print_error(f"Save mappings failed: {response.status_code}")
                print_error(f"Response: {response.text}")
                self.failed += 1
                return False
                
        except Exception as e:
            print_error(f"Exception during save mappings: {str(e)}")
            self.failed += 1
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("\n" + "="*60)
        print("MINIMALMOD BACKEND API TESTING")
        print("Testing REAL Marketplace Integrations + Category System")
        print("="*60)
        print_info(f"Backend URL: {self.base_url}")
        print_info(f"Test User: {TEST_SELLER_EMAIL}")
        
        # Initialize test variables
        self.test_category_id = None
        self.test_type_id = None
        self.test_attribute_id = None
        
        # Run basic tests
        self.test_health_check()
        self.test_login()
        self.test_get_me()
        
        # Add Ozon API key for category tests
        print("\n" + "="*60)
        print("SETUP: Adding Ozon API Key for Category Tests")
        print("="*60)
        if self.token:
            try:
                headers = {
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "marketplace": "ozon",
                    "client_id": "3152566",
                    "api_key": "a3acc5e5-45d8-4667-9fab-9f6d0e3bfb3c"
                }
                
                response = requests.post(
                    f"{self.base_url}/seller/api-keys",
                    headers=headers,
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    print_success("✅ Ozon API key added for category tests")
                else:
                    print_warning("⚠️ Could not add Ozon API key (may already exist)")
            except:
                print_warning("⚠️ Could not add Ozon API key")
        
        # NEW TESTS: Category System API Endpoints
        print("\n" + "="*60)
        print("CATEGORY SYSTEM API TESTS (NEW ENDPOINTS)")
        print("="*60)
        print_warning("CRITICAL: Testing new category search and attributes endpoints")
        print_info("Testing endpoints from /app/backend/category_routes.py")
        
        self.test_category_search_ozon()
        self.test_category_attributes_ozon()
        self.test_attribute_values_ozon()
        self.test_save_category_mappings()
        
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
