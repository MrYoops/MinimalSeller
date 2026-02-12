
import sys
import os
import importlib
from fastapi import FastAPI

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock environment variables to prevent crashes during import
os.environ["MONGODB_URL"] = "mongodb://localhost:27017/minimalseller"
os.environ["JWT_SECRET"] = "debug_secret"
os.environ["OPENAI_API_KEY"] = "sk-debug-key" # Mock key to prevent openai errors
os.environ["OZON_API_KEY"] = "debug"
os.environ["WB_API_KEY"] = "debug"

router_names = [
    "auth", "users", "keys", "products",
    "admin", "ai", "analytics", "categories", "categories_v2", "categories_internal",
    "export", "orders_fbs", "orders_fbo", "orders_retail", "orders", "orders_income",
    "inventory", "inventory_stock", "stock_operations", "stock_sync",
    "warehouses", "warehouses_marketplace", "warehouse_links",
    "suppliers", "finance", "reports_parser", "ozon_bonuses", "ozon_reports",
    "analytics_profit"
]

app = FastAPI()

print("Starting DYNAMIC router verification...")

for name in router_names:
    module_path = f"backend.routers.{name}"
    try:
        # Dynamically import the module
        module = importlib.import_module(module_path)
        
        # Check for router object
        if hasattr(module, 'router'):
            app.include_router(module.router)
            print(f"✅ {name}: Success")
        else:
            print(f"⚠️ {name}: No 'router' object found")
            
    except Exception as e:
        print(f"❌ {name}: FAILED - {e}")
        # import traceback
        # traceback.print_exc()

print("Verification complete.")
