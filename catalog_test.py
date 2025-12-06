#!/usr/bin/env python3
"""
Catalog Module Testing - 22 Endpoints
Tests the new "Товары" (Products/Catalog) module
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL
BACKEND_URL = "https://ecommerce-analytics-2.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "seller@minimalmod.com"
TEST_PASSWORD = "seller123"

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.RESET}")

def print_header(msg: str):
    print(f"\n{Colors.CYAN}{'='*70}")
    print(f"{msg}")
    print(f"{'='*70}{Colors.RESET}")

class CatalogTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token: Optional[str] = None
        self.passed = 0
        self.failed = 0
        
        # Store IDs for sequential testing
        self.category_id: Optional[str] = None
        self.product_id: Optional[str] = None
        self.variant_id: Optional[str] = None
        self.photo_id: Optional[str] = None
        self.price_id: Optional[str] = None
        self.stock_id: Optional[str] = None
        self.kit_id: Optional[str] = None
        self.warehouse_id: Optional[str] = None
    
    def login(self) -> bool:
        """Login and get JWT token"""
        print_header("AUTHENTICATION")
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print_success(f"Logged in as {TEST_EMAIL}")
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
    
    # ========== CATEGORIES (5 endpoints) ==========
    
    def test_create_category(self) -> bool:
        """POST /api/catalog/categories"""
        print_header("TEST 1: CREATE CATEGORY")
        
        try:
            payload = {
                "name": "Электроника",
                "group_by_color": False,
                "group_by_size": False,
                "common_attributes": {"warranty": "12 месяцев"}
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/categories",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.category_id = data.get("id")
                print_success(f"Category created: {data.get('name')} (ID: {self.category_id})")
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
    
    def test_get_categories(self) -> bool:
        """GET /api/catalog/categories"""
        print_header("TEST 2: GET CATEGORIES LIST")
        
        try:
            response = requests.get(
                f"{self.base_url}/catalog/categories",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Retrieved {len(data)} categories")
                if len(data) > 0:
                    print_info(f"First category: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
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
    
    def test_update_category(self) -> bool:
        """PUT /api/catalog/categories/{id}"""
        print_header("TEST 3: UPDATE CATEGORY")
        
        if not self.category_id:
            print_warning("Skipping: No category_id available")
            return False
        
        try:
            payload = {
                "name": "Электроника и гаджеты",
                "group_by_color": True,
                "group_by_size": False,
                "common_attributes": {"warranty": "24 месяца"}
            }
            
            response = requests.put(
                f"{self.base_url}/catalog/categories/{self.category_id}",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Category updated: {data.get('name')}")
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
    
    def test_delete_category_later(self) -> bool:
        """DELETE /api/catalog/categories/{id} - Will test at the end"""
        # We'll delete the category at the end after all tests
        return True
    
    # ========== PRODUCTS (5 endpoints) ==========
    
    def test_create_product(self) -> bool:
        """POST /api/catalog/products"""
        print_header("TEST 4: CREATE PRODUCT")
        
        if not self.category_id:
            print_warning("No category_id, will create product without category")
        
        try:
            payload = {
                "article": "PHONE-001",
                "name": "Смартфон TestPhone",
                "brand": "TestBrand",
                "category_id": self.category_id,
                "description": "Современный смартфон",
                "status": "active",
                "is_grouped": True,
                "group_by_color": True,
                "group_by_size": False
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.product_id = data.get("id")
                print_success(f"Product created: {data.get('name')} (ID: {self.product_id})")
                print_info(f"Article: {data.get('article')}, Brand: {data.get('brand')}")
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
    
    def test_get_products(self) -> bool:
        """GET /api/catalog/products (with filters)"""
        print_header("TEST 5: GET PRODUCTS LIST (with filters)")
        
        try:
            # Test without filters
            response = requests.get(
                f"{self.base_url}/catalog/products",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status (no filters): {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Retrieved {len(data)} products")
                
                # Test with search filter
                response2 = requests.get(
                    f"{self.base_url}/catalog/products?search=TestPhone",
                    headers=self.get_headers(),
                    timeout=10
                )
                
                if response2.status_code == 200:
                    data2 = response2.json()
                    print_success(f"Search filter works: found {len(data2)} products")
                
                # Test with category filter
                if self.category_id:
                    response3 = requests.get(
                        f"{self.base_url}/catalog/products?category_id={self.category_id}",
                        headers=self.get_headers(),
                        timeout=10
                    )
                    
                    if response3.status_code == 200:
                        data3 = response3.json()
                        print_success(f"Category filter works: found {len(data3)} products")
                
                # Test with status filter
                response4 = requests.get(
                    f"{self.base_url}/catalog/products?status=active",
                    headers=self.get_headers(),
                    timeout=10
                )
                
                if response4.status_code == 200:
                    data4 = response4.json()
                    print_success(f"Status filter works: found {len(data4)} active products")
                
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
    
    def test_get_product_by_id(self) -> bool:
        """GET /api/catalog/products/{id}"""
        print_header("TEST 6: GET PRODUCT BY ID")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/catalog/products/{self.product_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Product retrieved: {data.get('name')}")
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
    
    def test_update_product(self) -> bool:
        """PUT /api/catalog/products/{id}"""
        print_header("TEST 7: UPDATE PRODUCT")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            payload = {
                "name": "Смартфон TestPhone Pro",
                "description": "Обновленное описание смартфона",
                "status": "active"
            }
            
            response = requests.put(
                f"{self.base_url}/catalog/products/{self.product_id}",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Product updated: {data.get('name')}")
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
    
    # ========== VARIANTS (4 endpoints) ==========
    
    def test_create_variant(self) -> bool:
        """POST /api/catalog/products/{id}/variants"""
        print_header("TEST 8: CREATE PRODUCT VARIANT")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            payload = {
                "color": "Черный",
                "size": "64GB",
                "sku": "PHONE-001-BLK-64",
                "barcode": "1234567890123"
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products/{self.product_id}/variants",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.variant_id = data.get("id")
                print_success(f"Variant created: {data.get('color')} {data.get('size')} (ID: {self.variant_id})")
                print_info(f"SKU: {data.get('sku')}, Barcode: {data.get('barcode')}")
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
    
    def test_get_variants(self) -> bool:
        """GET /api/catalog/products/{id}/variants"""
        print_header("TEST 9: GET PRODUCT VARIANTS")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/catalog/products/{self.product_id}/variants",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Retrieved {len(data)} variants")
                if len(data) > 0:
                    print_info(f"First variant: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
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
    
    def test_update_variant(self) -> bool:
        """PUT /api/catalog/products/{id}/variants/{variant_id}"""
        print_header("TEST 10: UPDATE PRODUCT VARIANT")
        
        if not self.product_id or not self.variant_id:
            print_warning("Skipping: No product_id or variant_id available")
            return False
        
        try:
            payload = {
                "color": "Черный матовый",
                "size": "64GB",
                "sku": "PHONE-001-BLK-64",
                "barcode": "1234567890123"
            }
            
            response = requests.put(
                f"{self.base_url}/catalog/products/{self.product_id}/variants/{self.variant_id}",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Variant updated: {data.get('color')} {data.get('size')}")
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
    
    # ========== PHOTOS (4 endpoints) ==========
    
    def test_create_photo(self) -> bool:
        """POST /api/catalog/products/{id}/photos"""
        print_header("TEST 11: CREATE PRODUCT PHOTO")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            payload = {
                "url": "https://via.placeholder.com/800x1067",
                "variant_id": None,
                "order": 1,
                "marketplaces": {"wb": True, "ozon": True, "yandex": False}
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products/{self.product_id}/photos",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.photo_id = data.get("id")
                print_success(f"Photo created (ID: {self.photo_id})")
                print_info(f"URL: {data.get('url')}, Order: {data.get('order')}")
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
    
    def test_get_photos(self) -> bool:
        """GET /api/catalog/products/{id}/photos"""
        print_header("TEST 12: GET PRODUCT PHOTOS")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/catalog/products/{self.product_id}/photos",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Retrieved {len(data)} photos")
                if len(data) > 0:
                    print_info(f"First photo: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
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
    
    def test_update_photo(self) -> bool:
        """PUT /api/catalog/products/{id}/photos/{photo_id}"""
        print_header("TEST 13: UPDATE PRODUCT PHOTO")
        
        if not self.product_id or not self.photo_id:
            print_warning("Skipping: No product_id or photo_id available")
            return False
        
        try:
            payload = {
                "url": "https://via.placeholder.com/800x1067",
                "order": 2,
                "marketplaces": {"wb": True, "ozon": True, "yandex": True}
            }
            
            response = requests.put(
                f"{self.base_url}/catalog/products/{self.product_id}/photos/{self.photo_id}",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Photo updated (Order: {data.get('order')})")
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
    
    # ========== PRICES (3 endpoints) ==========
    
    def test_create_price(self) -> bool:
        """POST /api/catalog/products/{id}/prices"""
        print_header("TEST 14: CREATE PRODUCT PRICE")
        
        if not self.product_id or not self.variant_id:
            print_warning("Skipping: No product_id or variant_id available")
            return False
        
        try:
            payload = {
                "variant_id": self.variant_id,
                "purchase_price": 15000.0,
                "retail_price": 25000.0,
                "price_without_discount": 30000.0,
                "marketplace_prices": {"wb": 24990.0, "ozon": 25000.0, "yandex": 25500.0}
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products/{self.product_id}/prices",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.price_id = data.get("id")
                print_success(f"Price created (ID: {self.price_id})")
                print_info(f"Retail: {data.get('retail_price')}, Purchase: {data.get('purchase_price')}")
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
    
    def test_get_prices(self) -> bool:
        """GET /api/catalog/products/{id}/prices"""
        print_header("TEST 15: GET PRODUCT PRICES")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/catalog/products/{self.product_id}/prices",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Retrieved {len(data)} prices")
                if len(data) > 0:
                    print_info(f"First price: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
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
    
    def test_bulk_price_update(self) -> bool:
        """POST /api/catalog/products/prices/bulk"""
        print_header("TEST 16: BULK PRICE UPDATE")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            payload = {
                "product_ids": [self.product_id],
                "operation": "increase_percent",
                "value": 10,
                "target_field": "retail_price"
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products/prices/bulk",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Bulk price update completed")
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
    
    # ========== STOCK (2 endpoints) ==========
    
    def test_get_warehouses(self) -> bool:
        """Get warehouse_id for stock testing"""
        print_header("PREREQUISITE: GET WAREHOUSE ID")
        
        try:
            response = requests.get(
                f"{self.base_url}/warehouses",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if len(data) > 0:
                    self.warehouse_id = data[0].get("id")
                    print_success(f"Got warehouse_id: {self.warehouse_id}")
                    return True
                else:
                    print_warning("No warehouses found, will skip stock tests")
                    return False
            else:
                print_warning(f"Failed to get warehouses: {response.status_code}")
                return False
        except Exception as e:
            print_warning(f"Exception getting warehouses: {str(e)}")
            return False
    
    def test_create_stock(self) -> bool:
        """POST /api/catalog/products/{id}/stock"""
        print_header("TEST 17: CREATE PRODUCT STOCK")
        
        if not self.product_id or not self.variant_id:
            print_warning("Skipping: No product_id or variant_id available")
            return False
        
        if not self.warehouse_id:
            print_warning("Skipping: No warehouse_id available")
            return False
        
        try:
            payload = {
                "variant_id": self.variant_id,
                "warehouse_id": self.warehouse_id,
                "quantity": 50,
                "reserved": 2,
                "available": 48
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products/{self.product_id}/stock",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.stock_id = data.get("id")
                print_success(f"Stock created (ID: {self.stock_id})")
                print_info(f"Quantity: {data.get('quantity')}, Available: {data.get('available')}")
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
    
    def test_get_stock(self) -> bool:
        """GET /api/catalog/products/{id}/stock"""
        print_header("TEST 18: GET PRODUCT STOCK")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/catalog/products/{self.product_id}/stock",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Retrieved {len(data)} stock records")
                if len(data) > 0:
                    print_info(f"First stock: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
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
    
    # ========== KITS (4 endpoints) ==========
    
    def test_create_kit(self) -> bool:
        """POST /api/catalog/products/{id}/kits"""
        print_header("TEST 19: CREATE PRODUCT KIT")
        
        if not self.product_id or not self.variant_id:
            print_warning("Skipping: No product_id or variant_id available")
            return False
        
        try:
            payload = {
                "name": "Комплект: Телефон + Чехол",
                "items": [
                    {
                        "product_id": self.product_id,
                        "variant_id": self.variant_id,
                        "quantity": 1
                    }
                ]
            }
            
            response = requests.post(
                f"{self.base_url}/catalog/products/{self.product_id}/kits",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.kit_id = data.get("id")
                print_success(f"Kit created: {data.get('name')} (ID: {self.kit_id})")
                print_info(f"Items: {len(data.get('items', []))}")
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
    
    def test_get_kits(self) -> bool:
        """GET /api/catalog/products/{id}/kits"""
        print_header("TEST 20: GET PRODUCT KITS")
        
        if not self.product_id:
            print_warning("Skipping: No product_id available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/catalog/products/{self.product_id}/kits",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Retrieved {len(data)} kits")
                if len(data) > 0:
                    print_info(f"First kit: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
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
    
    def test_update_kit(self) -> bool:
        """PUT /api/catalog/products/{id}/kits/{kit_id}"""
        print_header("TEST 21: UPDATE PRODUCT KIT")
        
        if not self.product_id or not self.kit_id:
            print_warning("Skipping: No product_id or kit_id available")
            return False
        
        try:
            payload = {
                "name": "Комплект: Телефон + Чехол + Защитное стекло",
                "items": [
                    {
                        "product_id": self.product_id,
                        "variant_id": self.variant_id,
                        "quantity": 1
                    }
                ]
            }
            
            response = requests.put(
                f"{self.base_url}/catalog/products/{self.product_id}/kits/{self.kit_id}",
                json=payload,
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Kit updated: {data.get('name')}")
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
    
    def test_delete_kit(self) -> bool:
        """DELETE /api/catalog/products/{id}/kits/{kit_id}"""
        print_header("TEST 22: DELETE PRODUCT KIT")
        
        if not self.product_id or not self.kit_id:
            print_warning("Skipping: No product_id or kit_id available")
            return False
        
        try:
            response = requests.delete(
                f"{self.base_url}/catalog/products/{self.product_id}/kits/{self.kit_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                print_success(f"Kit deleted successfully")
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
    
    # ========== CLEANUP ==========
    
    def test_delete_photo(self) -> bool:
        """DELETE /api/catalog/products/{id}/photos/{photo_id}"""
        print_header("CLEANUP: DELETE PHOTO")
        
        if not self.product_id or not self.photo_id:
            return True
        
        try:
            response = requests.delete(
                f"{self.base_url}/catalog/products/{self.product_id}/photos/{self.photo_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                print_success(f"Photo deleted")
                return True
            else:
                print_warning(f"Failed to delete photo: {response.status_code}")
                return False
        except Exception as e:
            print_warning(f"Exception deleting photo: {str(e)}")
            return False
    
    def test_delete_variant(self) -> bool:
        """DELETE /api/catalog/products/{id}/variants/{variant_id}"""
        print_header("CLEANUP: DELETE VARIANT")
        
        if not self.product_id or not self.variant_id:
            return True
        
        try:
            response = requests.delete(
                f"{self.base_url}/catalog/products/{self.product_id}/variants/{self.variant_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                print_success(f"Variant deleted")
                return True
            else:
                print_warning(f"Failed to delete variant: {response.status_code}")
                return False
        except Exception as e:
            print_warning(f"Exception deleting variant: {str(e)}")
            return False
    
    def test_delete_product(self) -> bool:
        """DELETE /api/catalog/products/{id}"""
        print_header("CLEANUP: DELETE PRODUCT")
        
        if not self.product_id:
            return True
        
        try:
            response = requests.delete(
                f"{self.base_url}/catalog/products/{self.product_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                print_success(f"Product deleted (archived)")
                return True
            else:
                print_warning(f"Failed to delete product: {response.status_code}")
                return False
        except Exception as e:
            print_warning(f"Exception deleting product: {str(e)}")
            return False
    
    def test_delete_category(self) -> bool:
        """DELETE /api/catalog/categories/{id}"""
        print_header("CLEANUP: DELETE CATEGORY")
        
        if not self.category_id:
            return True
        
        try:
            response = requests.delete(
                f"{self.base_url}/catalog/categories/{self.category_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                print_success(f"Category deleted")
                return True
            else:
                print_warning(f"Failed to delete category: {response.status_code}")
                return False
        except Exception as e:
            print_warning(f"Exception deleting category: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all catalog tests in sequence"""
        print(f"\n{Colors.CYAN}{'='*70}")
        print(f"CATALOG MODULE TESTING - 22 ENDPOINTS")
        print(f"Backend: {self.base_url}")
        print(f"User: {TEST_EMAIL}")
        print(f"{'='*70}{Colors.RESET}\n")
        
        # Login first
        if not self.login():
            print_error("Login failed, cannot continue")
            return
        
        # Run tests in sequence
        self.test_create_category()
        self.test_get_categories()
        self.test_update_category()
        
        self.test_create_product()
        self.test_get_products()
        self.test_get_product_by_id()
        self.test_update_product()
        
        self.test_create_variant()
        self.test_get_variants()
        self.test_update_variant()
        
        self.test_create_photo()
        self.test_get_photos()
        self.test_update_photo()
        
        self.test_create_price()
        self.test_get_prices()
        self.test_bulk_price_update()
        
        # Get warehouse for stock tests
        self.test_get_warehouses()
        self.test_create_stock()
        self.test_get_stock()
        
        self.test_create_kit()
        self.test_get_kits()
        self.test_update_kit()
        self.test_delete_kit()
        
        # Cleanup
        self.test_delete_photo()
        self.test_delete_variant()
        self.test_delete_product()
        self.test_delete_category()
        
        # Print summary
        print_header("TEST SUMMARY")
        total = self.passed + self.failed
        print(f"\n{Colors.GREEN}✅ Passed: {self.passed}/{total}{Colors.RESET}")
        print(f"{Colors.RED}❌ Failed: {self.failed}/{total}{Colors.RESET}")
        
        if self.failed == 0:
            print(f"\n{Colors.GREEN}{'='*70}")
            print(f"ALL TESTS PASSED! 🎉")
            print(f"{'='*70}{Colors.RESET}\n")
        else:
            print(f"\n{Colors.RED}{'='*70}")
            print(f"SOME TESTS FAILED")
            print(f"{'='*70}{Colors.RESET}\n")

if __name__ == "__main__":
    tester = CatalogTester()
    tester.run_all_tests()
