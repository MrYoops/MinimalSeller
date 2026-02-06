"""
API endpoints for Internal Categories Management
Manages internal categories with custom attributes for own site + marketplace mappings
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import logging
from pydantic import BaseModel, Field
from server import get_current_user
import server

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== MODELS ==========

class InternalAttribute(BaseModel):
    """Internal attribute definition"""
    code: str = Field(..., description="Attribute code (slug)")
    name: str = Field(..., description="Display name")
    type: str = Field(..., description="Input type: text, number, select, multiselect, boolean")
    unit: Optional[str] = Field(None, description="Unit of measurement")
    is_required: bool = Field(False, description="Required field")
    dictionary_values: Optional[List[Dict[str, Any]]] = Field(None, description="For select/multiselect")
    help_text: Optional[str] = Field(None, description="Help tooltip")
    order: int = Field(0, description="Display order")


class InternalCategoryCreate(BaseModel):
    """Create internal category"""
    internal_name: str = Field(..., description="Category name")
    slug: Optional[str] = Field(None, description="URL slug")
    site_visibility: bool = Field(True, description="Show on site")
    default_channels: List[str] = Field(default=['site'], description="Default channels: site, ozon, wb, yandex")
    # Marketplace mappings
    ozon_category_id: Optional[str] = None
    ozon_type_id: Optional[int] = None
    wb_category_id: Optional[str] = None
    yandex_category_id: Optional[str] = None
    # Internal attributes
    internal_attributes: List[InternalAttribute] = Field(default=[], description="Custom attributes for site")
    # Category properties
    dimensions: Optional[Dict[str, float]] = Field(None, description="Width, height, length, weight")
    products_marked: bool = Field(False, description="Products require marking")
    separate_by_color: bool = Field(False, description="Separate products by color")
    separate_by_size: bool = Field(False, description="Separate products by size")
    name_template: Optional[str] = Field(None, description="Product name template")


class InternalCategoryUpdate(BaseModel):
    """Update internal category"""
    internal_name: Optional[str] = None
    slug: Optional[str] = None
    site_visibility: Optional[bool] = None
    default_channels: Optional[List[str]] = None
    ozon_category_id: Optional[str] = None
    ozon_type_id: Optional[int] = None
    wb_category_id: Optional[str] = None
    yandex_category_id: Optional[str] = None
    internal_attributes: Optional[List[InternalAttribute]] = None
    dimensions: Optional[Dict[str, float]] = None
    products_marked: Optional[bool] = None
    separate_by_color: Optional[bool] = None
    separate_by_size: Optional[bool] = None
    name_template: Optional[str] = None


# ========== CRUD OPERATIONS ==========

@router.get("/api/internal-categories")
async def list_internal_categories(
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0, ge=0),
    search: Optional[str] = None,
    channel: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List internal categories with pagination and filters
    """
    logger.info(f"[InternalCategories] List categories (limit={limit}, skip={skip})")
    
    try:
        query = {}
        
        # Search filter
        if search:
            query["internal_name"] = {"$regex": search, "$options": "i"}
        
        # Channel filter
        if channel:
            query["default_channels"] = channel
        
        # Get total count
        total = await server.db.internal_categories.count_documents(query)
        
        # Get categories
        categories = await server.db.internal_categories.find(query).skip(skip).limit(limit).to_list(limit)
        
        # Convert ObjectId to string
        for cat in categories:
            cat["id"] = str(cat.pop("_id"))
        
        logger.info(f"[InternalCategories] Found {len(categories)} categories (total: {total})")
        
        return {
            "total": total,
            "limit": limit,
            "skip": skip,
            "categories": categories
        }
        
    except Exception as e:
        logger.error(f"[InternalCategories] List error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/internal-categories/{category_id}")
async def get_internal_category(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get single internal category by ID
    """
    logger.info(f"[InternalCategories] Get category {category_id}")
    
    try:
        category = await server.db.internal_categories.find_one({"_id": ObjectId(category_id)})
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        category["id"] = str(category.pop("_id"))
        
        return category
        
    except Exception as e:
        logger.error(f"[InternalCategories] Get error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/internal-categories")
async def create_internal_category(
    data: InternalCategoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create new internal category
    Only admins can create categories
    """
    logger.info(f"[InternalCategories] Create category: {data.internal_name}")
    
    # Check admin role
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create categories")
    
    try:
        # Check if slug/name exists
        existing = await server.db.internal_categories.find_one({
            "$or": [
                {"internal_name": data.internal_name},
                {"slug": data.slug if data.slug else data.internal_name.lower().replace(' ', '-')}
            ]
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name/slug already exists")
        
        # Generate slug if not provided
        if not data.slug:
            data.slug = data.internal_name.lower().replace(' ', '-')
        
        # Prepare document
        category_doc = data.model_dump()
        category_doc["created_at"] = datetime.utcnow()
        category_doc["updated_at"] = datetime.utcnow()
        category_doc["created_by"] = current_user.get("_id")
        
        # Build marketplace mappings
        category_doc["marketplace_mappings"] = {
            "ozon": {
                "category_id": data.ozon_category_id,
                "type_id": data.ozon_type_id
            } if data.ozon_category_id else None,
            "wb": {
                "category_id": data.wb_category_id
            } if data.wb_category_id else None,
            "yandex": {
                "category_id": data.yandex_category_id
            } if data.yandex_category_id else None
        }
        
        # Insert
        result = await server.db.internal_categories.insert_one(category_doc)
        category_id = str(result.inserted_id)
        
        logger.info(f"[InternalCategories] Created category {category_id}")
        
        return {
            "message": "Category created successfully",
            "category_id": category_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[InternalCategories] Create error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/internal-categories/{category_id}")
async def update_internal_category(
    category_id: str,
    data: InternalCategoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update internal category
    Only admins can update categories
    """
    logger.info(f"[InternalCategories] Update category {category_id}")
    
    # Check admin role
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update categories")
    
    try:
        # Check if exists
        existing = await server.db.internal_categories.find_one({"_id": ObjectId(category_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Prepare update
        update_data = {}
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value
        
        if not update_data:
            return {"message": "No fields to update"}
        
        # Update marketplace mappings if provided
        if any([data.ozon_category_id, data.wb_category_id, data.yandex_category_id]):
            update_data["marketplace_mappings"] = {
                "ozon": {
                    "category_id": data.ozon_category_id,
                    "type_id": data.ozon_type_id
                } if data.ozon_category_id else existing.get("marketplace_mappings", {}).get("ozon"),
                "wb": {
                    "category_id": data.wb_category_id
                } if data.wb_category_id else existing.get("marketplace_mappings", {}).get("wb"),
                "yandex": {
                    "category_id": data.yandex_category_id
                } if data.yandex_category_id else existing.get("marketplace_mappings", {}).get("yandex")
            }
        
        update_data["updated_at"] = datetime.utcnow()
        
        # Update
        await server.db.internal_categories.update_one(
            {"_id": ObjectId(category_id)},
            {"$set": update_data}
        )
        
        logger.info(f"[InternalCategories] Updated category {category_id}")
        
        return {"message": "Category updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[InternalCategories] Update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/internal-categories/{category_id}")
async def delete_internal_category(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete internal category
    Only admins can delete categories
    """
    logger.info(f"[InternalCategories] Delete category {category_id}")
    
    # Check admin role
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete categories")
    
    try:
        # Check if exists
        existing = await server.db.internal_categories.find_one({"_id": ObjectId(category_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if used by products
        products_count = await server.db.product_catalog.count_documents({"internal_category_id": category_id})
        if products_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete category: {products_count} products are using it"
            )
        
        # Delete
        await server.db.internal_categories.delete_one({"_id": ObjectId(category_id)})
        
        logger.info(f"[InternalCategories] Deleted category {category_id}")
        
        return {"message": "Category deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[InternalCategories] Delete error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== ATTRIBUTE MANAGEMENT ==========

@router.post("/api/internal-categories/{category_id}/attributes")
async def add_attribute_to_category(
    category_id: str,
    attribute: InternalAttribute,
    current_user: dict = Depends(get_current_user)
):
    """
    Add attribute to internal category
    """
    logger.info(f"[InternalCategories] Add attribute to {category_id}")
    
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can modify attributes")
    
    try:
        category = await server.db.internal_categories.find_one({"_id": ObjectId(category_id)})
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if attribute code exists
        attributes = category.get("internal_attributes", [])
        if any(attr.get("code") == attribute.code for attr in attributes):
            raise HTTPException(status_code=400, detail="Attribute code already exists")
        
        # Add attribute
        attributes.append(attribute.model_dump())
        
        await server.db.internal_categories.update_one(
            {"_id": ObjectId(category_id)},
            {
                "$set": {
                    "internal_attributes": attributes,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"[InternalCategories] Added attribute {attribute.code}")
        
        return {"message": "Attribute added successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[InternalCategories] Add attribute error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/internal-categories/{category_id}/attributes/{attribute_code}")
async def update_category_attribute(
    category_id: str,
    attribute_code: str,
    attribute: InternalAttribute,
    current_user: dict = Depends(get_current_user)
):
    """
    Update attribute in internal category
    """
    logger.info(f"[InternalCategories] Update attribute {attribute_code} in {category_id}")
    
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can modify attributes")
    
    try:
        category = await server.db.internal_categories.find_one({"_id": ObjectId(category_id)})
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Find and update attribute
        attributes = category.get("internal_attributes", [])
        found = False
        for i, attr in enumerate(attributes):
            if attr.get("code") == attribute_code:
                attributes[i] = attribute.model_dump()
                found = True
                break
        
        if not found:
            raise HTTPException(status_code=404, detail="Attribute not found")
        
        await server.db.internal_categories.update_one(
            {"_id": ObjectId(category_id)},
            {
                "$set": {
                    "internal_attributes": attributes,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"[InternalCategories] Updated attribute {attribute_code}")
        
        return {"message": "Attribute updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[InternalCategories] Update attribute error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/internal-categories/{category_id}/attributes/{attribute_code}")
async def delete_category_attribute(
    category_id: str,
    attribute_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete attribute from internal category
    """
    logger.info(f"[InternalCategories] Delete attribute {attribute_code} from {category_id}")
    
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can modify attributes")
    
    try:
        category = await server.db.internal_categories.find_one({"_id": ObjectId(category_id)})
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Remove attribute
        attributes = category.get("internal_attributes", [])
        attributes = [attr for attr in attributes if attr.get("code") != attribute_code]
        
        await server.db.internal_categories.update_one(
            {"_id": ObjectId(category_id)},
            {
                "$set": {
                    "internal_attributes": attributes,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"[InternalCategories] Deleted attribute {attribute_code}")
        
        return {"message": "Attribute deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[InternalCategories] Delete attribute error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== MERGED ATTRIBUTES (for product form) ==========

@router.post("/api/categories/merged-attributes")
async def get_merged_attributes(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Get merged attributes from internal category + selected marketplace categories
    Returns unified list with source and required_for_channels markers
    """
    logger.info("[MergedAttributes] Getting merged attributes")
    
    try:
        internal_category_id = data.get("internal_category_id")
        selected_channels = data.get("selected_channels", [])
        marketplace_mappings = data.get("marketplace_mappings", {})
        
        merged = []
        
        # 1. Get internal attributes (for 'site' channel)
        if internal_category_id and 'site' in selected_channels:
            category = await server.db.internal_categories.find_one({"_id": ObjectId(internal_category_id)})
            if category:
                internal_attrs = category.get("internal_attributes", [])
                for attr in internal_attrs:
                    merged.append({
                        **attr,
                        "source": "site",
                        "required_for_channels": ["site"] if attr.get("is_required") else []
                    })
        
        # 2. Get marketplace attributes
        from category_system import CategorySystem
        cat_system = CategorySystem(server.db)
        
        for channel in ['ozon', 'wb', 'yandex']:
            if channel not in selected_channels:
                continue
            
            mapping = marketplace_mappings.get(channel, {})
            category_id = mapping.get("category_id")
            type_id = mapping.get("type_id")
            
            if not category_id:
                continue
            
            # Get cached attributes
            mp_attrs = await cat_system.get_cached_attributes(channel, category_id, type_id)
            
            # If not cached, skip (will be loaded in frontend dynamically)
            if not mp_attrs:
                logger.warning(f"[MergedAttributes] No cached attributes for {channel} category {category_id}")
                continue
            
            # Add to merged list
            for attr in mp_attrs:
                # Check if attribute with same name exists
                existing = next((a for a in merged if a.get("name") == attr.get("name")), None)
                
                if existing:
                    # Add channel to existing attribute
                    if attr.get("is_required"):
                        if channel not in existing["required_for_channels"]:
                            existing["required_for_channels"].append(channel)
                else:
                    # Add new attribute
                    merged.append({
                        **attr,
                        "source": channel,
                        "required_for_channels": [channel] if attr.get("is_required") else []
                    })
        
        logger.info(f"[MergedAttributes] Merged {len(merged)} attributes")
        
        return {
            "attributes": merged,
            "total": len(merged)
        }
        
    except Exception as e:
        logger.error(f"[MergedAttributes] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
