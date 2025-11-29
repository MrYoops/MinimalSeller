from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any
from datetime import datetime
from jose import JWTError, jwt
import uuid
import os
from bson import ObjectId

from database import get_database

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])
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
async def get_suppliers(
    current_user: dict = Depends(get_current_user)
):
    """Получить список поставщиков"""
    db = await get_database()
    
    suppliers = await db.suppliers.find({
        "user_id": current_user["_id"]
    }).to_list(length=1000)
    
    return suppliers


@router.get("/{supplier_id}")
async def get_supplier(
    supplier_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить детали поставщика"""
    db = await get_database()
    
    supplier = await db.suppliers.find_one({
        "id": supplier_id,
        "user_id": current_user["_id"]
    })
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    return supplier


@router.post("", status_code=201)
async def create_supplier(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Создать поставщика"""
    db = await get_database()
    
    supplier = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "name": data.get("name"),
        "contact_person": data.get("contact_person", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "inn": data.get("inn", ""),
        "address": data.get("address", ""),
        "comment": data.get("comment", ""),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.suppliers.insert_one(supplier)
    
    return {
        "message": "Supplier created successfully",
        "supplier": supplier
    }


@router.put("/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Обновить поставщика"""
    db = await get_database()
    
    supplier = await db.suppliers.find_one({
        "id": supplier_id,
        "user_id": current_user["_id"]
    })
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if "name" in data:
        update_data["name"] = data["name"]
    if "contact_person" in data:
        update_data["contact_person"] = data["contact_person"]
    if "phone" in data:
        update_data["phone"] = data["phone"]
    if "email" in data:
        update_data["email"] = data["email"]
    if "inn" in data:
        update_data["inn"] = data["inn"]
    if "address" in data:
        update_data["address"] = data["address"]
    if "comment" in data:
        update_data["comment"] = data["comment"]
    
    await db.suppliers.update_one(
        {"id": supplier_id},
        {"$set": update_data}
    )
    
    return {
        "message": "Supplier updated successfully"
    }


@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить поставщика"""
    db = await get_database()
    
    supplier = await db.suppliers.find_one({
        "id": supplier_id,
        "user_id": current_user["_id"]
    })
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    await db.suppliers.delete_one({"id": supplier_id})
    
    return {
        "message": "Supplier deleted successfully"
    }
