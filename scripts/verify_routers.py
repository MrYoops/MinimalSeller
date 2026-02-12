
import sys
import os

# Ensure backend path is importable
sys.path.insert(0, os.getcwd())

routers = [
    "backend.routers.auth", 
    "backend.routers.users", 
    "backend.routers.keys", 
    "backend.routers.products",
    "backend.routers.admin", 
    "backend.routers.ai", 
    "backend.routers.analytics", 
    "backend.routers.categories", 
    "backend.routers.categories_v2", 
    "backend.routers.categories_internal",
    "backend.routers.export", 
    "backend.routers.orders_fbs", 
    "backend.routers.orders_fbo", 
    "backend.routers.orders_retail", 
    "backend.routers.orders", 
    "backend.routers.orders_income",
    "backend.routers.inventory", 
    "backend.routers.inventory_stock", 
    "backend.routers.stock_operations", 
    "backend.routers.stock_sync",
    "backend.routers.warehouses", 
    "backend.routers.warehouses_marketplace", 
    "backend.routers.warehouse_links",
    "backend.routers.suppliers", 
    "backend.routers.finance", 
    "backend.routers.reports_parser", 
    "backend.routers.ozon_bonuses", 
    "backend.routers.ozon_reports",
    "backend.routers.analytics_profit"
]

print("🔍 Verifying routers...")
failed = []

for r in routers:
    try:
        __import__(r)
        print(f"✅ {r}")
    except Exception as e:
        print(f"❌ {r}: {e}")
        failed.append(r)

if failed:
    print(f"\n⚠️ Failed routers: {len(failed)}")
    sys.exit(1)
else:
    print("\n✨ All routers verified.")
