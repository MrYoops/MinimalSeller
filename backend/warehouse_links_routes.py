from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
import uuid
from datetime import datetime

from auth_utils import get_current_user
from database import get_database

router = APIRouter(prefix="/api/warehouses", tags=["warehouse-links"])


class WarehouseLinkCreate(BaseModel):
    integration_id: str
    marketplace_name: str
    marketplace_warehouse_id: str
    marketplace_warehouse_name: str


@router.get("/{warehouse_id}/links")
async def get_warehouse_links(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить все связи склада с маркетплейсами"""
    try:
        db = await get_database()
        
        warehouse = await db.warehouses.find_one({
            "id": warehouse_id,
            "user_id": str(current_user["_id"])
        })
        
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        links = await db.warehouse_links.find({
            "warehouse_id": warehouse_id
        }).to_list(length=100)
        
        # Convert ObjectId
        for link in links:
            if "_id" in link:
                link["_id"] = str(link["_id"])
            if "user_id" in link:
                link["user_id"] = str(link["user_id"])
        
        return links
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{warehouse_id}/links")
async def create_warehouse_link(
    warehouse_id: str,
    link_data: WarehouseLinkCreate,
    current_user: dict = Depends(get_current_user)
):
    """Создать связь склада с маркетплейсом"""
    try:
        db = await get_database()
        
        # Verify warehouse exists and belongs to user
        warehouse = await db.warehouses.find_one({
            "id": warehouse_id,
            "user_id": str(current_user["_id"])
        })
        
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        # Check if link already exists
        existing = await db.warehouse_links.find_one({
            "warehouse_id": warehouse_id,
            "marketplace_warehouse_id": link_data.marketplace_warehouse_id
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Link already exists")
        
        # Create new link
        link = {
            "id": str(uuid.uuid4()),
            "warehouse_id": warehouse_id,
            "integration_id": link_data.integration_id,
            "marketplace_name": link_data.marketplace_name,
            "marketplace_warehouse_id": link_data.marketplace_warehouse_id,
            "marketplace_warehouse_name": link_data.marketplace_warehouse_name,
            "created_at": datetime.utcnow().isoformat(),
            "user_id": str(current_user["_id"])
        }
        
        await db.warehouse_links.insert_one(link)
        
        # Remove _id
        if "_id" in link:
            del link["_id"]
        
        return {"message": "Link created successfully", "link": link}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{warehouse_id}/links/{link_id}")
async def delete_warehouse_link(
    warehouse_id: str,
    link_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить связь склада с маркетплейсом"""
    try:
        db = await get_database()
        
        # Verify warehouse exists and belongs to user
        warehouse = await db.warehouses.find_one({
            "id": warehouse_id,
            "user_id": str(current_user["_id"])
        })
        
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        # Delete link
        result = await db.warehouse_links.delete_one({
            "id": link_id,
            "warehouse_id": warehouse_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Link not found")
        
        return {"message": "Link deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
