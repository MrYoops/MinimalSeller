
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime
from services.auth_service import AuthService
from services.product_service import ProductService
from schemas.product import ProductCreate, ProductUpdate, ProductResponse, BulkImportRequest, AIAdaptRequest, ProductMappingCreate, BulkTagsRequestModel
from schemas.user import UserRole
import os

router = APIRouter(prefix="/api/products", tags=["Products"])

# AI Client
try:
    from openai import OpenAI
    client = OpenAI() if os.getenv('OPENAI_API_KEY') else None
except Exception:
    client = None

# ============================================================================
# TAGS ENDPOINTS (Must be before /{product_id})
# ============================================================================

@router.get("/tags")
async def get_tags_root():
    """
    Get all tags (Frontend uses this path)
    """
    return {"tags": await ProductService.get_all_tags()}

@router.get("/tags/list")
async def get_all_tags():
    return {"tags": await ProductService.get_all_tags()}

@router.post("/tags")
async def create_tag(tag_name: str = Query(..., min_length=1)):
    # Tags are implicitly created when assigned
    return {"message": f"Tag {tag_name} created", "tag": tag_name}

@router.delete("/tags/{tag_name}")
async def delete_tag(
    tag_name: str,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    db = await ProductService.get_database()
    res = await db.product_catalog.update_many(
        {"seller_id": str(current_user["_id"])},
        {"$pull": {"tags": tag_name}}
    )
    return {"message": f"Tag deleted from {res.modified_count} products"}

@router.post("/bulk-assign-tags")
async def bulk_assign_tags_endpoint(
    request: BulkTagsRequestModel,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    db = await ProductService.get_database()
    # Ensure IDs are ObjectIds
    p_ids = [ObjectId(pid) for pid in request.product_ids if ObjectId.is_valid(pid)]
    if not p_ids:
        return {"message": "No valid products"}
    
    await db.product_catalog.update_many(
        {"_id": {"$in": p_ids}, "seller_id": str(current_user["_id"])},
        {"$addToSet": {"tags": request.tag}}
    )
    return {"message": "Tags assigned"}

@router.post("/bulk-remove-tags")
async def bulk_remove_tags_endpoint(
    request: BulkTagsRequestModel,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    db = await ProductService.get_database()
    p_ids = [ObjectId(pid) for pid in request.product_ids if ObjectId.is_valid(pid)]
    if not p_ids:
        return {"message": "No valid products"}
        
    await db.product_catalog.update_many(
        {"_id": {"$in": p_ids}, "seller_id": str(current_user["_id"])},
        {"$pull": {"tags": request.tag}}
    )
    return {"message": "Tags removed"}

# ============================================================================
# PRODUCTS CRUD
# ============================================================================

@router.get("/marketplaces/{marketplace}/products")
async def get_marketplace_products(
    marketplace: str,
    api_key_id: Optional[str] = Query(None),
    current_user: dict = Depends(AuthService.get_current_user)
):
    """
    Fetch products from a marketplace (Ozon, WB, Yandex) for import selection.
    """
    try:
        products = await ProductService.get_marketplace_products(marketplace, str(current_user["_id"]), api_key_id)
        return {"marketplace": marketplace, "products": products}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {str(e)}")

class MarketplaceImportRequest(BaseModel):
    products: List[dict]

@router.post("/marketplaces/{marketplace}/import")
async def import_marketplace_products(
    marketplace: str,
    request: MarketplaceImportRequest,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    """
    Import selected marketplace products to local catalog
    """
    try:
        result = await ProductService.import_from_marketplace(marketplace, request.products, str(current_user["_id"]))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import products: {str(e)}")

@router.get("", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    investor_tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_quality: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    sort_by: Optional[str] = Query("created_at"),
    ascending: Optional[bool] = Query(False),
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    skip = (page - 1) * limit
    return await ProductService.get_products(
        seller_id=str(current_user["_id"]),
        category_id=category_id,
        status=status,
        investor_tag=investor_tag,
        search=search,
        min_quality=min_quality,
        skip=skip,
        limit=limit
    )

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    product = await ProductService.get_product(product_id, str(current_user["_id"]))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("", response_model=ProductResponse)
async def create_product(
    product: ProductCreate,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    try:
        return await ProductService.create_product(product, str(current_user["_id"]))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product: ProductUpdate,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    updated = await ProductService.update_product(product_id, product, str(current_user["_id"]))
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found")
    return updated

@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    deleted = await ProductService.delete_product(product_id, str(current_user["_id"]))
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

@router.post("/bulk-import")
async def bulk_import_products(
    request: BulkImportRequest,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    return await ProductService.bulk_import(request, str(current_user["_id"]))

# AI Endpoints (Keeping logic here for now as it uses 'client' global)
@router.post("/ai/adapt-name")
async def ai_adapt_name(request: AIAdaptRequest):
    if not client:
        raise HTTPException(status_code=503, detail="OpenAI unavailable")
    try:
        marketplace_rules = {
            "ozon": "Ozon требует короткие, информативные названия...",
            "wildberries": "Wildberries предпочитает названия с указанием бренда...",
            "yandex_market": "Yandex Market требует структурированные названия..."
        }
        rules = marketplace_rules.get(request.marketplace, "")
        response = client.chat.completions.create(
            model="gpt-4o-mini", # Updated model name?
            messages=[
                {"role": "system", "content": f"Ты эксперт по оптимизации. {rules}"},
                {"role": "user", "content": f"Адаптируй: {request.text}"}
            ],
            temperature=0.7,
            max_tokens=100
        )
        return {"adapted_text": response.choices[0].message.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

# Tags logic moved to top (see above)

# ============================================================================
# MARKETPLACE IMPORT ENDPOINTS
# ============================================================================

class ProductMarketplaceImportRequest(BaseModel):
    product: dict
    duplicate_action: str = "link_only"  # link_only, create_new, update_existing

@router.post("/import-from-marketplace")
async def import_from_marketplace(
    request: ProductMarketplaceImportRequest,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    """
    Import a single product from marketplace with duplicate handling
    """
    try:
        product_data = request.product
        marketplace = product_data.get('marketplace', 'ozon')
        
        # Check if product already exists by article/sku
        db = await ProductService.get_database()
        seller_object_id = ObjectId(current_user["_id"])
        
        sku = product_data.get('sku') or product_data.get('offer_id')
        if not sku:
            raise HTTPException(status_code=400, detail="Missing SKU/offer_id")
        
        existing = await db.products.find_one({
            "$or": [{"sku": sku}, {"article": sku}],
            "seller_id": seller_object_id
        })
        
        if existing:
            if request.duplicate_action == "link_only":
                # Just link the marketplace data
                update_fields = {
                    f"marketplace_data.{marketplace}": product_data,
                    "dates.updated_at": datetime.utcnow()
                }
                await db.products.update_one(
                    {"_id": existing["_id"]},
                    {"$set": update_fields}
                )
                return {
                    "status": "linked",
                    "message": "Product linked successfully",
                    "product_id": str(existing["_id"])
                }
            elif request.duplicate_action == "update_existing":
                # Update existing product with new data
                update_fields = {
                    f"marketplace_data.{marketplace}": product_data,
                    "minimalmod.name": product_data.get('name', existing.get('minimalmod', {}).get('name')),
                    "dates.updated_at": datetime.utcnow()
                }
                await db.products.update_one(
                    {"_id": existing["_id"]},
                    {"$set": update_fields}
                )
                return {
                    "status": "updated", 
                    "message": "Product updated successfully",
                    "product_id": str(existing["_id"])
                }
            elif request.duplicate_action == "create_new":
                # Force create new product even if duplicate exists
                # Modify SKU to make it unique
                original_sku = sku
                counter = 1
                while True:
                    test_sku = f"{original_sku}_COPY_{counter}"
                    existing_test = await db.products.find_one({
                        "$or": [{"sku": test_sku}, {"article": test_sku}],
                        "seller_id": seller_object_id
                    })
                    if not existing_test:
                        sku = test_sku
                        break
                    counter += 1
            else:
                return {"status": "duplicate_found", "message": "Product already exists"}
        
        # Create new product
        new_product_data = {
            "sku": sku,
            "article": sku,
            "price": float(product_data.get('price', 0)),
            "purchase_price": 0.0,
            "seller_id": seller_object_id,
            "minimalmod": {
                "name": product_data.get('name', 'Unknown'),
                "description": product_data.get('description', ''),
                "images": product_data.get('images', []),
                "attributes": product_data.get('attributes', {}) or {},
                "tags": [marketplace, "imported"]
            },
            "marketplaces": {
                marketplace: {
                    "enabled": True,
                    "product_id": product_data.get('id', ''),
                    "sku": sku,
                    "price": float(product_data.get('price', 0)),
                    "stock": product_data.get('stock', 0)
                }
            },
            "marketplace_data": {
                marketplace: product_data
            },
            "dates": {
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "published_at": None
            },
            "listing_quality_score": ProductService.calculate_listing_quality_score(product_data).dict(),
            "tags": [marketplace, "imported"]
        }
        
        result = await db.products.insert_one(new_product_data)
        
        # Initialize inventory
        await db.inventory.insert_one({
            "product_id": str(result.inserted_id),
            "product_id_oid": result.inserted_id,
            "seller_id": str(current_user["_id"]),
            "sku": sku,
            "article": sku,
            "quantity": 0,
            "reserved": 0,
            "available": 0,
            "alert_threshold": 10
        })
        
        return {
            "status": "created",
            "message": "Product imported successfully",
            "product_id": str(result.inserted_id)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.post("/marketplaces/import-all")
async def import_all_marketplace_products(
    marketplace: str = Query(...),
    api_key_id: Optional[str] = Query(None),
    current_user: dict = Depends(AuthService.get_current_user)
):
    """
    Import ALL products from marketplace (Frontend Sync style).
    """
    try:
        # 1. Fetch all
        products = await ProductService.get_marketplace_products(marketplace, str(current_user["_id"]), api_key_id)
        
        # 2. Import all
        result = await ProductService.import_from_marketplace(
            marketplace, 
            products, 
            str(current_user["_id"])
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import products: {str(e)}")

# ============================================================================
# PRODUCT PHOTOS ENDPOINTS
# ============================================================================

@router.get("/{product_id}/photos")
async def get_product_photos(
    product_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Get photos for a product"""
    try:
        product = await ProductService.get_product(product_id, str(current_user["_id"]))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Extract photos from minimalmod.images and marketplace_data
        photos = []
        
        # From minimalmod
        minimalmod_images = product.get("minimalmod", {}).get("images", [])
        for img in minimalmod_images:
            if isinstance(img, str):
                photos.append({"url": img})
            elif isinstance(img, dict):
                url = img.get("url") or img.get("file_name") or img.get("src")
                if url:
                    photos.append({"url": url})
        
        # From marketplace_data
        marketplace_data = product.get("marketplace_data", {})
        for marketplace, data in marketplace_data.items():
            if isinstance(data, dict) and data.get("images"):
                for img in data["images"]:
                    if isinstance(img, str):
                        photos.append({"url": img, "source": marketplace})
                    elif isinstance(img, dict):
                        url = img.get("url") or img.get("file_name") or img.get("src")
                        if url:
                            photos.append({"url": url, "source": marketplace})
        
        return photos
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get photos: {str(e)}")

@router.get("/marketplaces/{marketplace}/products")
async def get_marketplace_products(
    marketplace: str,
    api_key_id: Optional[str] = Query(None),
    current_user: dict = Depends(AuthService.get_current_user)
):
    """
    Fetch products from a marketplace (Ozon, WB, Yandex) for import selection.
    """
    try:
        products = await ProductService.get_marketplace_products(marketplace, str(current_user["_id"]), api_key_id)
        return {"marketplace": marketplace, "products": products}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {str(e)}")

class MarketplaceImportRequest(BaseModel):
    products: List[dict]

@router.post("/marketplaces/{marketplace}/import")
async def import_marketplace_products(
    marketplace: str,
    request: MarketplaceImportRequest,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    """
    Import selected products from marketplace.
    """
    try:
        result = await ProductService.import_from_marketplace(
            marketplace, 
            request.products, 
            str(current_user["_id"])
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import products: {str(e)}")

# ============================================================================
# PRODUCT PHOTOS ENDPOINTS
# ============================================================================

@router.get("/{product_id}/photos")
async def get_product_photos(
    product_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Get photos for a product"""
    try:
        product = await ProductService.get_product(product_id, str(current_user["_id"]))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Extract photos from minimalmod.images and marketplace_data
        photos = []
        
        # From minimalmod
        minimalmod_images = product.get("minimalmod", {}).get("images", [])
        for img in minimalmod_images:
            if isinstance(img, str):
                photos.append({"url": img})
            elif isinstance(img, dict):
                url = img.get("url") or img.get("file_name") or img.get("src")
                if url:
                    photos.append({"url": url})
        
        # From marketplace_data
        marketplace_data = product.get("marketplace_data", {})
        for marketplace, data in marketplace_data.items():
            if isinstance(data, dict) and data.get("images"):
                for img in data["images"]:
                    if isinstance(img, str):
                        photos.append({"url": img, "source": marketplace})
                    elif isinstance(img, dict):
                        url = img.get("url") or img.get("file_name") or img.get("src")
                        if url:
                            photos.append({"url": url, "source": marketplace})
        
        return photos
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get photos: {str(e)}")
