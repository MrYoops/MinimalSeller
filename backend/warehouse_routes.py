from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any, Optional
from datetime import datetime
from jose import JWTError, jwt
import uuid
import os
from bson import ObjectId

from database import get_database

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])
security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-min-32-chars-long-change-me-please")
ALGORITHM = "HS256"

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    db = await get_database()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    return user


@router.get("")
async def get_warehouses(
    current_user: dict = Depends(get_current_user)
):
    """Получить список складов пользователя"""
    db = await get_database()
    
    warehouses = await db.warehouses.find({
        "user_id": current_user["_id"]
    }).to_list(length=1000)
    
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
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
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
        "user_id": current_user["_id"],
        "name": data.get("name"),
        "type": data.get("type", "main"),  # main, marketplace, transit
        "address": data.get("address", ""),
        "comment": data.get("comment", ""),
        
        # НОВЫЕ НАСТРОЙКИ (ФАЗА 1)
        "transfer_stock": data.get("transfer_stock", True),  # Передавать остатки на МП
        "load_orders": data.get("load_orders", True),  # Загружать заказы
        "use_for_orders": data.get("use_for_orders", True),  # Использовать для заказов
        "priority": data.get("priority", 1),  # Приоритет списания
        "fbo_accounting": data.get("fbo_accounting", False),  # Учёт FBO
        
        # Marketplace-specific
        "marketplace_warehouse_id": data.get("marketplace_warehouse_id"),
        "marketplace_name": data.get("marketplace_name"),
        "sync_with_main_warehouse_id": data.get("sync_with_main_warehouse_id"),
        
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.warehouses.insert_one(warehouse)
    
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
    
    # Verify ownership
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Update fields
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Basic fields
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
    
    # Verify ownership
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Don't allow deleting main warehouse if it's the only one
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
