
import os
import glob
import re

# Mapping of class names to their new schema module (relative to backend/schemas)
CLASS_MAP = {
    # Product
    "ProductVisibility": "product", "ProductSEO": "product", "ProductDates": "product",
    "MinimalModData": "product", "MarketplaceData": "product", "MarketplacesData": "product",
    "ListingQualityScore": "product", "ProductCreate": "product", "ProductUpdate": "product",
    "ProductResponse": "product", "BulkImportRequest": "product", "AIAdaptRequest": "product",
    "ProductMappingCreate": "product", "ProductCategoryCreate": "product", "ProductCategoryUpdate": "product",
    "ProductCategoryResponse": "product", "ProductDimensions": "product", "ProductCatalogCreate": "product",
    "ProductCatalogUpdate": "product", "ProductCatalogResponse": "product", "ProductVariantCreate": "product",
    "ProductVariantUpdate": "product", "ProductVariantResponse": "product", "ProductPhotoCreate": "product",
    "ProductPhotoUpdate": "product", "ProductPhotoResponse": "product", "ProductKitItem": "product",
    "ProductKitCreate": "product", "ProductKitUpdate": "product", "ProductKitResponse": "product",
    "ProductMarketplaceLinkCreate": "product", "ProductMarketplaceLinkUpdate": "product", "ProductMarketplaceLinkResponse": "product",
    
    # Inventory
    "Inventory": "inventory", "FBOInventory": "inventory", "InventoryHistory": "inventory",
    "FBOShipmentItem": "inventory", "FBOShipment": "inventory", "InventoryAdjustment": "inventory",
    "InventoryResponse": "inventory", "FBOInventoryResponse": "inventory", "InventoryHistoryResponse": "inventory",
    "FBOShipmentResponse": "inventory", "ProductStockCreate": "inventory", "ProductStockUpdate": "inventory",
    "ProductStockResponse": "inventory",
    
    # Order
    "OrderCustomer": "order", "OrderItem": "order", "OrderTotals": "order", "OrderPayment": "order",
    "OrderShipping": "order", "OrderDates": "order", "OrderCreate": "order", "OrderResponse": "order",
    "OrderStatusUpdate": "order", "CDEKLabelRequest": "order", "ReturnItem": "order", "ReturnCreate": "order",
    "ReturnResponse": "order", "OrderItemNew": "order", "OrderCustomerNew": "order", "OrderTotalsNew": "order",
    "OrderStatusHistory": "order", "OrderFBS": "order", "OrderFBSCreate": "order", "OrderFBSResponse": "order",
    "OrderFBO": "order", "OrderFBOCreate": "order", "OrderFBOResponse": "order", "OrderRetail": "order",
    "OrderRetailCreate": "order", "OrderRetailResponse": "order", "OrderStatusUpdateNew": "order",
    "OrderSyncRequest": "order", "OrderItemSplit": "order", "OrderBoxSplit": "order", "OrderSplitRequest": "order",
    
    # Pricing
    "MarketplacePrices": "pricing", "ProductPricing": "pricing", "PricingUpdate": "pricing",
    "BulkPricingUpdate": "pricing", "PriceAlert": "pricing", "ProductPriceCreate": "pricing",
    "ProductPriceUpdate": "pricing", "ProductPriceResponse": "pricing", "BulkPriceUpdate": "pricing",
    
    # Warehouse
    "WarehouseUpdate": "warehouse",

    # Auth/User (previously in server.py mostly, but mapped just in case)
    "User": "user", "UserRole": "user", "UserCreate": "user", "UserLogin": "user", "Token": "auth",
    "APIKey": "api_key", "APIKeyCreate": "api_key"
}

BACKEND_DIR = "backend"

def refactor_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        original_content = content
        
        # Regex to match "from [backend.]models import (...)" including multi-line
        # Pattern handles both single line and multi-line with parenthesis
        pattern = re.compile(r"from (?:backend\.)?models import\s*(?:\(([\s\S]*?)\)|([^\n]+))")
        
        def replace_match(match):
            # content inside () or the single line content
            imports_str = match.group(1) or match.group(2)
            
            # clean up string
            imports_str = imports_str.replace('\n', ' ').replace('\r', ' ')
            
            imported_names = [name.strip() for name in imports_str.split(',') if name.strip()]
            
            # Group by new module
            new_imports = {} # module -> list of names
            
            for name in imported_names:
                # Handle "Name as Alias"
                alias = ""
                real_name = name
                # remove comments if any inside line (simplified)
                if "#" in real_name:
                    real_name = real_name.split("#")[0].strip()
                    
                if " as " in name:
                    parts = name.split(" as ")
                    real_name = parts[0].strip()
                    alias = " as " + parts[1].strip()
                
                target_module = CLASS_MAP.get(real_name)
                if target_module:
                    if target_module not in new_imports:
                        new_imports[target_module] = []
                    new_imports[target_module].append(real_name + alias)
                else:
                    print(f"⚠️ Unknown class {real_name} in {filepath}")
                    if "fallback" not in new_imports:
                        new_imports["fallback"] = []
                    new_imports["fallback"].append(real_name + alias)
            
            # Generate new import lines
            res_lines = []
            for mod, names in new_imports.items():
                if mod == "fallback":
                    res_lines.append(f"from backend.models import {', '.join(names)}")
                else:
                    res_lines.append(f"from backend.schemas.{mod} import {', '.join(names)}")
            
            return "\n".join(res_lines)

        new_content = pattern.sub(replace_match, content)
        
        if new_content != original_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"✅ Updated imports in: {filepath}")
            return True
        return False
            
    except Exception as e:
        print(f"❌ Error processing {filepath}: {e}")
        return False

def main():
    print("🚀 Starting models import refactoring (v2)...")
    files = glob.glob(os.path.join(BACKEND_DIR, "**/*.py"), recursive=True)
    
    count = 0
    for filepath in files:
        if "backend\\schemas\\" in filepath or "backend/schemas/" in filepath:
            continue
        if "scripts" in filepath:
            continue
            
        if refactor_file(filepath):
            count += 1
            
    print(f"✨ Finished. Updated {count} files.")

if __name__ == "__main__":
    main()
