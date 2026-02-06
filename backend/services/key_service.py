
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from bson import ObjectId
from fastapi import HTTPException, status
import logging

from backend.core.database import get_database
from backend.core.security import encrypt_api_key
from backend.schemas.api_key import APIKey, APIKeyCreate

logger = logging.getLogger(__name__)

class KeyService:
    @staticmethod
    async def get_keys(user_id: str) -> List[APIKey]:
        db = await get_database()
        profile = await db.seller_profiles.find_one({"user_id": ObjectId(user_id)})
        if not profile:
            return []
        
        api_keys = profile.get("api_keys", [])
        result = []
        
        for key in api_keys:
            key_id = str(key.get("id", "")) or str(key.get("_id", ""))
            
            created_at = key.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except:
                    created_at = datetime.utcnow()
            elif not isinstance(created_at, datetime):
                created_at = datetime.utcnow()
            
            encrypted_key = key.get("api_key", "")
            if encrypted_key and len(encrypted_key) > 4:
                api_key_masked = "***" + encrypted_key[-4:]
            else:
                api_key_masked = "***"
            
            result.append(APIKey(
                id=key_id,
                marketplace=key["marketplace"],
                client_id=key.get("client_id", ""),
                api_key_masked=api_key_masked,
                name=key.get("name"),
                created_at=created_at
            ))
        
        return result

    @staticmethod
    async def add_key(user_id: str, key_data: APIKeyCreate) -> Dict[str, Any]:
        db = await get_database()
        
        if not key_data.api_key or key_data.api_key.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="API key is required"
            )
        
        key_id = str(uuid.uuid4())
        encrypted_api_key = encrypt_api_key(key_data.api_key)
        
        new_key = {
            "id": key_id,
            "marketplace": key_data.marketplace,
            "client_id": key_data.client_id,
            "api_key": encrypted_api_key,
            "name": key_data.name or f"{key_data.marketplace.upper()} Integration",
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Check profile
        profile = await db.seller_profiles.find_one({"user_id": ObjectId(user_id)})
        if not profile:
            await db.seller_profiles.insert_one({
                "user_id": ObjectId(user_id),
                "api_keys": []
            })
            
        result = await db.seller_profiles.update_one(
            {"user_id": ObjectId(user_id)},
            {"$push": {"api_keys": new_key}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to add API key")
            
        return {
            "message": "API key added successfully",
            "key_id": key_id,
            "key": {
                "id": key_id,
                "marketplace": new_key["marketplace"],
                "client_id": new_key["client_id"],
                "api_key_masked": "***" + new_key["api_key"][-4:] if len(new_key["api_key"]) > 4 else "***",
                "name": new_key["name"],
                "created_at": new_key["created_at"]
            }
        }

    @staticmethod
    async def delete_key(user_id: str, key_id: str) -> bool:
        db = await get_database()
        
        # Try UUID first
        result = await db.seller_profiles.update_one(
            {"user_id": ObjectId(user_id)},
            {"$pull": {"api_keys": {"id": key_id}}}
        )
        
        if result.modified_count == 0:
            # Try ObjectId
            try:
                result = await db.seller_profiles.update_one(
                    {"user_id": ObjectId(user_id)},
                    {"$pull": {"api_keys": {"_id": ObjectId(key_id)}}}
                )
            except:
                pass
                
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="API key not found")
            
        return True

    @staticmethod
    async def update_key(user_id: str, key_id: str, update_data: Dict[str, Any]) -> bool:
        db = await get_database()
        profile = await db.seller_profiles.find_one({"user_id": ObjectId(user_id)})
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        api_keys = profile.get("api_keys", [])
        key_index = None
        
        for i, key in enumerate(api_keys):
            if key.get("id") == key_id or str(key.get("_id")) == key_id:
                key_index = i
                break
                
        if key_index is None:
            raise HTTPException(status_code=404, detail="API key not found")
            
        # Update fields
        for field in ["name", "auto_sync_stock", "auto_update_prices", "auto_get_orders"]:
            if field in update_data:
                api_keys[key_index][field] = update_data[field]
                
        result = await db.seller_profiles.update_one(
            {"user_id": ObjectId(user_id)},
            {"$set": {"api_keys": api_keys}}
        )
        
        return result.modified_count > 0
