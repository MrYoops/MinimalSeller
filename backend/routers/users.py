
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from backend.services.auth_service import AuthService
from backend.core.database import get_database
from backend.schemas.user import User, UserRole

router = APIRouter(prefix="/api/admin/users", tags=["Admin"])

@router.get("", response_model=List[User])
async def get_all_users(current_user: dict = Depends(AuthService.require_role(UserRole.ADMIN))):
    db = await get_database()
    users = await db.users.find().to_list(length=1000)
    return [
        User(
            id=str(user["_id"]),
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            is_active=user["is_active"],
            created_at=user["created_at"],
            last_login_at=user.get("last_login_at")
        )
        for user in users
    ]

@router.put("/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_user: dict = Depends(AuthService.require_role(UserRole.ADMIN))
):
    db = await get_database()
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User approved successfully"}

@router.put("/{user_id}/block")
async def block_user(
    user_id: str,
    current_user: dict = Depends(AuthService.require_role(UserRole.ADMIN))
):
    db = await get_database()
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User blocked successfully"}

@router.put("/{user_id}/commission")
async def set_commission(
    user_id: str,
    commission_rate: float,
    current_user: dict = Depends(AuthService.require_role(UserRole.ADMIN))
):
    db = await get_database()
    result = await db.seller_profiles.update_one(
        {"user_id": ObjectId(user_id)},
        {"$set": {"commission_rate": commission_rate}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    return {"message": "Commission rate updated successfully"}
