"""
POC Test Script: Category System End-to-End Flow
Tests: Title → Suggestion → Attributes → Dictionary Values

Run: python test_category_poc.py
"""

import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")
TEST_EMAIL = "seller@test.com"
TEST_PASSWORD = "password123"

# Test data
TEST_TITLES = [
    "Мышка игровая Angry Miao infinity Mouse 8k",
    "Клавиатура механическая Keychron K8",
    "Наушники беспроводные Sony WH-1000XM5",
    "Телефон Samsung Galaxy S24",
]


class CategoryPOCTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token = None
        self.base_url = BACKEND_URL
        
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, *args):
        await self.client.aclose()
    
    async def login(self):
        """Login and get auth token"""
        print("\n=== 1. LOGIN ===")
        try:
            response = await self.client.post(
                f"{self.base_url}/api/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            
            if response.status_code != 200:
                print(f"❌ Login failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
            
            data = response.json()
            self.token = data.get("access_token")
            
            if not self.token:
                print("❌ No token received")
                return False
            
            print(f"✅ Login successful")
            print(f"   User: {data.get('user', {}).get('email')}")
            return True
            
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def get_headers(self):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    async def test_category_suggestion(self, title):
        """Test 1: Category suggestion from title"""
        print(f"\n=== 2. CATEGORY SUGGESTION: '{title}' ===")
        
        try:
            response = await self.client.get(
                f"{self.base_url}/api/categories/suggest",
                params={"title": title},
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                print(f"❌ Suggestion failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
            
            data = response.json()
            suggestions = data.get("suggestions", [])
            
            if not suggestions:
                print("⚠️  No suggestions found")
                return None
            
            print(f"✅ Found {len(suggestions)} suggestions:")
            for i, sugg in enumerate(suggestions[:3], 1):
                print(f"   {i}. {sugg.get('internal_name')}")
                mappings = sugg.get('marketplace_categories', {})
                if mappings:
                    mp_list = [f"{k}={v}" for k, v in mappings.items() if v]
                    print(f"      Mappings: {', '.join(mp_list)}")
            
            return suggestions[0]  # Return first suggestion
            
        except Exception as e:
            print(f"❌ Suggestion error: {e}")
            return None
    
    async def test_get_attributes(self, marketplace, category_id, type_id=None):
        """Test 2: Get category attributes"""
        print(f"\n=== 3. GET ATTRIBUTES: {marketplace} category {category_id} ===")
        
        try:
            url = f"{self.base_url}/api/categories/marketplace/{marketplace}/{category_id}/attributes"
            params = {}
            if type_id:
                params["type_id"] = type_id
            
            response = await self.client.get(
                url,
                params=params,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                print(f"❌ Get attributes failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return []
            
            data = response.json()
            attributes = data.get("attributes", [])
            cached = data.get("cached", False)
            
            print(f"✅ Got {len(attributes)} attributes (cached: {cached})")
            
            # Count required attributes
            required = [a for a in attributes if a.get('is_required')]
            print(f"   Required attributes: {len(required)}")
            
            # Show first 3 required attributes
            if required:
                print(f"   Sample required attributes:")
                for attr in required[:3]:
                    name = attr.get('name') or attr.get('attribute_name')
                    attr_id = attr.get('attribute_id') or attr.get('id')
                    is_dict = attr.get('dictionary_id', 0) > 0 or attr.get('type') == 'Dictionary'
                    dict_mark = " [DICT]" if is_dict else ""
                    print(f"      ⭐ {name} (ID: {attr_id}){dict_mark}")
            
            return attributes
            
        except Exception as e:
            print(f"❌ Get attributes error: {e}")
            return []
    
    async def test_get_attribute_values(self, marketplace, category_id, attribute_id, type_id=None):
        """Test 3: Get dictionary values for attribute"""
        print(f"\n=== 4. GET ATTRIBUTE VALUES: attribute {attribute_id} ===")
        
        try:
            url = f"{self.base_url}/api/categories/marketplace/{marketplace}/{category_id}/attribute-values"
            params = {"attribute_id": attribute_id}
            if type_id:
                params["type_id"] = type_id
            
            response = await self.client.get(
                url,
                params=params,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                print(f"❌ Get values failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return []
            
            data = response.json()
            values = data.get("values", [])
            cached = data.get("cached", False)
            
            print(f"✅ Got {len(values)} values (cached: {cached})")
            
            # Show first 5 values
            if values:
                print(f"   Sample values:")
                for val in values[:5]:
                    val_id = val.get('id') or val.get('value_id')
                    val_name = val.get('value') or val.get('name')
                    print(f"      - {val_name} (ID: {val_id})")
            
            return values
            
        except Exception as e:
            print(f"❌ Get values error: {e}")
            return []
    
    async def run_full_flow(self):
        """Run complete POC flow"""
        print("=" * 60)
        print("CATEGORY SYSTEM POC TEST")
        print("=" * 60)
        
        # Login
        if not await self.login():
            print("\n❌ TEST FAILED: Cannot login")
            return False
        
        success_count = 0
        total_tests = len(TEST_TITLES)
        
        for title in TEST_TITLES:
            try:
                # Test 1: Suggestion
                suggestion = await self.test_category_suggestion(title)
                if not suggestion:
                    print(f"\n⚠️  Skipping '{title}' - no suggestions")
                    continue
                
                # Get first marketplace with mapping
                mappings = suggestion.get('marketplace_categories', {})
                type_ids = suggestion.get('marketplace_type_ids', {})
                
                # Try Ozon first
                marketplace = None
                category_id = None
                type_id = None
                
                if mappings.get('ozon'):
                    marketplace = 'ozon'
                    category_id = mappings['ozon']
                    type_id = type_ids.get('ozon')
                elif mappings.get('wildberries'):
                    marketplace = 'wb'
                    category_id = mappings['wildberries']
                elif mappings.get('yandex'):
                    marketplace = 'yandex'
                    category_id = mappings['yandex']
                
                if not marketplace or not category_id:
                    print(f"\n⚠️  No marketplace mappings for '{title}'")
                    continue
                
                # Test 2: Get attributes
                attributes = await self.test_get_attributes(marketplace, category_id, type_id)
                if not attributes:
                    print(f"\n⚠️  No attributes found for '{title}'")
                    continue
                
                # Test 3: Get dictionary values for first dictionary attribute
                dict_attr = None
                for attr in attributes:
                    is_dict = attr.get('dictionary_id', 0) > 0 or attr.get('type') == 'Dictionary'
                    if is_dict:
                        dict_attr = attr
                        break
                
                if dict_attr:
                    attr_id = dict_attr.get('attribute_id') or dict_attr.get('id')
                    values = await self.test_get_attribute_values(marketplace, category_id, attr_id, type_id)
                    if values:
                        success_count += 1
                else:
                    print(f"\n⚠️  No dictionary attributes found")
                    success_count += 1  # Still count as success
                
                print(f"\n✅ Flow completed for '{title}'")
                
            except Exception as e:
                print(f"\n❌ Flow failed for '{title}': {e}")
                continue
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total tests: {total_tests}")
        print(f"Successful: {success_count}")
        print(f"Failed: {total_tests - success_count}")
        
        if success_count >= total_tests * 0.75:  # 75% success rate
            print("\n✅ POC TEST PASSED")
            return True
        else:
            print("\n❌ POC TEST FAILED")
            return False


async def main():
    """Main test runner"""
    async with CategoryPOCTester() as tester:
        success = await tester.run_full_flow()
        return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
