import asyncio
import sys
sys.path.append('backend')
from backend.core.database import get_database

async def check_integrations():
    try:
        db = await get_database()
        
        # Check API keys
        api_keys = await db.api_keys.count_documents({})
        print(f'Total API keys: {api_keys}')
        
        # List API keys
        keys = await db.api_keys.find({}).limit(5).to_list(None)
        for key in keys:
            print(f'Key: {key.get("marketplace")} - {key.get("name", "N/A")}')
            
        # Check seller profiles
        profiles = await db.seller_profiles.count_documents({})
        print(f'Seller profiles: {profiles}')
        
        # Check warehouses
        warehouses = await db.warehouses.count_documents({})
        print(f'Warehouses: {warehouses}')
        
        # List warehouses
        wh = await db.warehouses.find({}).limit(3).to_list(None)
        for w in wh:
            print(f'Warehouse: {w.get("name")} - {w.get("marketplace")}')
            
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_integrations())
