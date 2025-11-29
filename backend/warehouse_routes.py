from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from bson import ObjectId

from database import get_database
from auth_utils import get_current_user

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])


@router.get("")
async def get_warehouses(
    current_user: dict = Depends(get_current_user)
):
    """Получить список складов пользователя"""
    db = await get_database()
    
    warehouses = await db.warehouses.find({
        "user_id": str(current_user["_id"])  # Convert to string for query
    }).to_list(length=1000)
    
    # Convert ObjectId to string
    for wh in warehouses:
        if "_id" in wh:
            wh["_id"] = str(wh["_id"])
        if "user_id" in wh:
            wh["user_id"] = str(wh["user_id"])
    
    return warehouses


@router.get("/{warehouse_id}")
async def get_warehouse(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить детали склада"""
    db = await get_database()
    
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Convert ObjectId
    if "_id" in warehouse:
        warehouse["_id"] = str(warehouse["_id"])
    if "user_id" in warehouse:
        warehouse["user_id"] = str(warehouse["user_id"])
    
    return warehouse


@router.post("", status_code=201)
async def create_warehouse(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Создать склад"""
    db = await get_database()
    
    warehouse = {
        "id": str(uuid.uuid4()),
        "user_id": str(current_user["_id"]),  # Convert to string!
        "name": data.get("name"),
        "type": data.get("type", "main"),
        "address": data.get("address", ""),
        "comment": data.get("comment", ""),
        
        # НОВЫЕ НАСТРОЙКИ (ФАЗА 1)
        "transfer_stock": data.get("transfer_stock", True),
        "load_orders": data.get("load_orders", True),
        "use_for_orders": data.get("use_for_orders", True),
        "priority": data.get("priority", 1),
        "fbo_accounting": data.get("fbo_accounting", False),
        
        # Marketplace-specific
        "marketplace_warehouse_id": data.get("marketplace_warehouse_id"),
        "marketplace_name": data.get("marketplace_name"),
        "sync_with_main_warehouse_id": data.get("sync_with_main_warehouse_id"),
        
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.warehouses.insert_one(warehouse)
    
    # Remove _id from response if exists
    if "_id" in warehouse:
        del warehouse["_id"]
    
    return {
        "message": "Warehouse created successfully",
        "warehouse": warehouse
    }


@router.put("/{warehouse_id}")
async def update_warehouse(
    warehouse_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Обновить склад"""
    db = await get_database()
    
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if "name" in data:
        update_data["name"] = data["name"]
    if "address" in data:
        update_data["address"] = data["address"]
    if "comment" in data:
        update_data["comment"] = data["comment"]
    
    # Settings
    if "transfer_stock" in data:
        update_data["transfer_stock"] = data["transfer_stock"]
    if "load_orders" in data:
        update_data["load_orders"] = data["load_orders"]
    if "use_for_orders" in data:
        update_data["use_for_orders"] = data["use_for_orders"]
    if "priority" in data:
        update_data["priority"] = data["priority"]
    if "fbo_accounting" in data:
        update_data["fbo_accounting"] = data["fbo_accounting"]
    
    await db.warehouses.update_one(
        {"id": warehouse_id},
        {"$set": update_data}
    )
    
    return {
        "message": "Warehouse updated successfully"
    }


@router.delete("/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить склад"""
    db = await get_database()
    
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    if warehouse.get("type") == "main":
        count = await db.warehouses.count_documents({
            "user_id": current_user["_id"],
            "type": "main"
        })
        if count == 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the only main warehouse"
            )
    
    await db.warehouses.delete_one({"id": warehouse_id})
    
    return {
        "message": "Warehouse deleted successfully"
    }
