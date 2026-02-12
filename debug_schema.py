#!/usr/bin/env python3
"""
Debug schema validation issue
"""

import sys
sys.path.append('.')

from pydantic import BaseModel

class MarketplaceImportRequest(BaseModel):
    product: dict
    duplicate_action: str = "link_only"

# Test the schema
test_product = {
    "id": "test-product-123",
    "sku": "TEST-001",
    "name": "Test Product",
    "price": 999.99,
    "marketplace": "ozon"
}

try:
    request = MarketplaceImportRequest(
        product=test_product,
        duplicate_action="create_new"
    )
    print("✅ Schema validation successful")
    print(f"   Product SKU: {request.product['sku']}")
except Exception as e:
    print(f"❌ Schema validation failed: {e}")

# Now test the imported version
try:
    from backend.routers.products import MarketplaceImportRequest as ImportedRequest
    
    request2 = ImportedRequest(
        product=test_product,
        duplicate_action="create_new"
    )
    print("✅ Imported schema validation successful")
    print(f"   Product SKU: {request2.product['sku']}")
except Exception as e:
    print(f"❌ Imported schema validation failed: {e}")
