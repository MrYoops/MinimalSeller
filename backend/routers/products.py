
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from backend.services.auth_service import AuthService
from backend.services.product_service import ProductService
from backend.schemas.product import ProductCreate, ProductUpdate, ProductResponse, BulkImportRequest, AIAdaptRequest, ProductMappingCreate, BulkTagsRequestModel
from backend.schemas.user import UserRole
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

@router.get("", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    investor_tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_quality: Optional[float] = Query(None),
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    return await ProductService.get_products(
        seller_id=str(current_user["_id"]),
        category_id=category_id,
        status=status,
        investor_tag=investor_tag,
        search=search,
        min_quality=min_quality
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

@router.post("/marketplaces/import-all")
async def import_all_marketplace_products(
    marketplace: str = Query(...),
    api_key_id: Optional[str] = Query(None),
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
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

@router.get("/marketplaces/{marketplace}/products")
async def get_marketplace_products(
    marketplace: str,
    api_key_id: Optional[str] = Query(None),
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
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
