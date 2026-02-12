#!/usr/bin/env python3
"""
Debug script for marketplace endpoint
"""

import asyncio
import sys
sys.path.append('backend')

async def debug_marketplace_endpoint():
    """Debug the marketplace endpoint step by step"""
    try:
        print("🔍 DEBUGGING MARKETPLACE ENDPOINT")
        print("=" * 50)
        
        # Step 1: Test imports
        print("📦 Step 1: Testing imports...")
        try:
            from backend.connectors import get_connector
            print("   ✅ connectors imported successfully")
        except Exception as e:
            print(f"   ❌ connectors import failed: {e}")
            return
            
        try:
            from backend.core.security import decrypt_api_key
            print("   ✅ security imported successfully")
        except Exception as e:
            print(f"   ❌ security import failed: {e}")
            return
            
        try:
            from backend.services.product_service import ProductService
            print("   ✅ ProductService imported successfully")
        except Exception as e:
            print(f"   ❌ ProductService import failed: {e}")
            return
        
        # Step 2: Test database connection
        print("\n🗄️  Step 2: Testing database connection...")
        try:
            from backend.core.database import get_database
            db = await get_database()
            print("   ✅ Database connected successfully")
        except Exception as e:
            print(f"   ❌ Database connection failed: {e}")
            return
        
        # Step 3: Test seller profile
        print("\n👤 Step 3: Testing seller profile...")
        try:
            seller_id = "6974099198874d5e82417822"
            from bson import ObjectId
            
            profile = await db.seller_profiles.find_one({
                "$or": [
                    {"user_id": seller_id},
                    {"user_id": ObjectId(seller_id) if ObjectId.is_valid(seller_id) else seller_id}
                ]
            })
            
            if profile:
                print(f"   ✅ Seller profile found: {profile.get('company_name', 'N/A')}")
                api_keys = profile.get("api_keys", [])
                print(f"   📋 API keys count: {len(api_keys)}")
                for key in api_keys:
                    print(f"      - {key.get('marketplace')}: {key.get('name', 'N/A')}")
            else:
                print("   ❌ Seller profile not found")
                return
                
        except Exception as e:
            print(f"   ❌ Seller profile check failed: {e}")
            return
        
        # Step 4: Test ProductService method
        print("\n🧪 Step 4: Testing ProductService.get_marketplace_products...")
        try:
            marketplace = "ozon"
            api_key_id = "070911de-47aa-4bb0-bb15-3174b073edbd"
            
            print(f"   Calling: ProductService.get_marketplace_products('{marketplace}', '{seller_id}', '{api_key_id}')")
            
            products = await ProductService.get_marketplace_products(marketplace, seller_id, api_key_id)
            
            print(f"   ✅ SUCCESS! Found {len(products)} products")
            if products:
                print(f"   📦 First product: {products[0].get('name', 'N/A')}")
            
        except Exception as e:
            print(f"   ❌ ProductService method failed: {e}")
            import traceback
            traceback.print_exc()
            return
        
        print("\n🎉 ALL TESTS PASSED!")
        print("The marketplace endpoint should work correctly.")
        
    except Exception as e:
        print(f"❌ DEBUG FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_marketplace_endpoint())
