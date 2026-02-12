
import os
import shutil
import re

BACKEND_DIR = "backend"
ROUTERS_DIR = os.path.join(BACKEND_DIR, "routers")

# File -> New Name (in routers/)
MAPPING = {
    "admin_routes.py": "admin.py",
    "ai_routes.py": "ai.py",
    "analytics_routes.py": "analytics.py",
    "category_routes.py": "categories.py",
    "category_routes_v2.py": "categories_v2.py",
    "export_routes.py": "export.py",
    "fbo_orders_routes.py": "orders_fbo.py",
    "fbs_orders_routes.py": "orders_fbs.py",
    "finance_routes.py": "finance.py",
    "income_order_routes.py": "orders_income.py",
    "internal_category_routes.py": "categories_internal.py",
    "inventory_routes.py": "inventory.py",
    "inventory_stock_routes.py": "inventory_stock.py",
    "marketplace_warehouse_routes.py": "warehouses_marketplace.py",
    "order_routes.py": "orders.py",
    "ozon_bonuses_routes.py": "ozon_bonuses.py",
    "ozon_reports_routes.py": "ozon_reports.py",
    "profit_analytics_routes.py": "analytics_profit.py",
    "reports_parser_routes.py": "reports_parser.py",
    "retail_orders_routes.py": "orders_retail.py",
    "stock_operations_routes.py": "stock_operations.py",
    "stock_sync_routes.py": "stock_sync.py",
    "supplier_routes.py": "suppliers.py",
    "warehouse_links_routes.py": "warehouse_links.py",
    "warehouse_routes.py": "warehouses.py"
}

# Imports to fix
# Pattern: "from X import" -> "from backend.X import"
# BUT only if X is a local file in backend/
LOCAL_MODULES = [
    "auth_utils", "connectors", "utils", "dependencies",
    "stock_sync_routes", "inventory_routes", "order_routes" # Referenced by valid routers
]

def fix_imports(content):
    new_content = content
    
    # Fix explicit local modules
    for mod in LOCAL_MODULES:
        # from auth_utils import -> from backend.auth_utils import
        new_content = re.sub(f"from {mod} import", f"from backend.{mod} import", new_content)
        # import auth_utils -> import backend.auth_utils
        # new_content = re.sub(f"import {mod}", f"import backend.{mod}", new_content) # Risk of "import backend.auth_utils as auth_utils"
    
    # Fix references to moved routers?
    # e.g. from stock_sync_routes import ...
    # This is tricky as we just renamed it to stock_sync.py in routers/
    # So "from stock_sync_routes" -> "from backend.routers.stock_sync"
    
    # Map old names to new locations
    for old_name, new_name in MAPPING.items():
        old_mod = old_name.replace(".py", "")
        new_mod = new_name.replace(".py", "")
        new_import = f"backend.routers.{new_mod}"
        
        new_content = re.sub(f"from {old_mod} import", f"from {new_import} import", new_content)
        new_content = re.sub(f"import {old_mod}", f"import {new_import}", new_content)
        
        # Also catch "from backend.X"
        new_content = re.sub(f"from backend.{old_mod} import", f"from {new_import} import", new_content)

    return new_content

def main():
    print("🚀 Starting router migration...")
    if not os.path.exists(ROUTERS_DIR):
        os.makedirs(ROUTERS_DIR)
        
    for old_file, new_name in MAPPING.items():
        src = os.path.join(BACKEND_DIR, old_file)
        dst = os.path.join(ROUTERS_DIR, new_name)
        
        if os.path.exists(src):
            print(f"📦 Moving {old_file} -> routers/{new_name}")
            with open(src, "r", encoding="utf-8") as f:
                content = f.read()
            
            content = fix_imports(content)
            
            with open(dst, "w", encoding="utf-8") as f:
                f.write(content)
                
            # Remove original?
            # os.remove(src) 
            # Better to rename to .bak or delete later
            shutil.move(src, src + ".migrated")
        else:
            print(f"⚠️ Source not found: {old_file}")

    print("✨ Migration done.")

if __name__ == "__main__":
    main()
