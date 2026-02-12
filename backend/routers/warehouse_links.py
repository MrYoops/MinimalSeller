from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
import uuid
from datetime import datetime

from auth_utils import get_current_user
from core.database import get_database

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
    """
    Создать связь склада с маркетплейсом
    
    Связывает наш основной склад со складом на маркетплейсе (FBS/RFBS/DBS)
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        db = await get_database()
        
        logger.info(f"🔗 Creating link: warehouse_id={warehouse_id}, user_id={current_user['_id']}")
        logger.info(f"   Link data: integration_id={link_data.integration_id}, marketplace={link_data.marketplace_name}, mp_warehouse_id={link_data.marketplace_warehouse_id}")
        
        # Verify warehouse exists and belongs to user
        warehouse = await db.warehouses.find_one({
            "id": warehouse_id,
            "user_id": str(current_user["_id"])
        })
        
        if not warehouse:
            # Попробуем найти по _id (на случай если используется ObjectId)
            logger.warning(f"Warehouse not found by id={warehouse_id}, trying _id")
            try:
                from bson import ObjectId
                warehouse = await db.warehouses.find_one({
                    "_id": ObjectId(warehouse_id),
                    "user_id": str(current_user["_id"])
                })
            except:
                pass
            
            if not warehouse:
                logger.error(f"❌ Warehouse not found: id={warehouse_id}, user_id={current_user['_id']}")
                # Проверим, какие склады есть у пользователя
                all_warehouses = await db.warehouses.find({"user_id": str(current_user["_id"])}).to_list(length=10)
                logger.info(f"   User has {len(all_warehouses)} warehouses")
                for wh in all_warehouses:
                    logger.info(f"   - Warehouse: id={wh.get('id')}, _id={wh.get('_id')}, name={wh.get('name')}")
                raise HTTPException(status_code=404, detail=f"Warehouse not found: {warehouse_id}")
        
        # Проверить, что это основной склад (main)
        if warehouse.get("type") != "main":
            raise HTTPException(
                status_code=400,
                detail="Связи можно создавать только для основного склада (type='main')"
            )
        
        # Проверить, что API ключ существует
        profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        api_keys = profile.get("api_keys", [])
        api_key = None
        for key in api_keys:
            if str(key.get("id")) == str(link_data.integration_id):
                api_key = key
                break
        
        if not api_key:
            raise HTTPException(
                status_code=404,
                detail=f"API key with id {link_data.integration_id} not found"
            )
        
        # Проверить, что marketplace совпадает
        if api_key.get("marketplace", "").lower() != link_data.marketplace_name.lower():
            raise HTTPException(
                status_code=400,
                detail=f"Marketplace mismatch: API key is for {api_key.get('marketplace')}, but link is for {link_data.marketplace_name}"
            )
        
        # Check if link already exists
        existing = await db.warehouse_links.find_one({
            "warehouse_id": warehouse_id,
            "marketplace_warehouse_id": link_data.marketplace_warehouse_id,
            "marketplace_name": link_data.marketplace_name.lower()
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Link already exists")
        
        # Create new link
        link = {
            "id": str(uuid.uuid4()),
            "warehouse_id": warehouse_id,
            "integration_id": link_data.integration_id,
            "marketplace": link_data.marketplace_name.lower(),  # Используем marketplace вместо marketplace_name
            "marketplace_name": link_data.marketplace_name,  # Для обратной совместимости
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
