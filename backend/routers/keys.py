
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from services.auth_service import AuthService
from services.key_service import KeyService
from schemas.user import UserRole
from schemas.api_key import APIKey, APIKeyCreate

router = APIRouter(prefix="/api/seller/api-keys", tags=["API Keys"])

@router.get("", response_model=List[APIKey])
async def get_api_keys(current_user: dict = Depends(AuthService.get_current_user)):
    return await KeyService.get_keys(str(current_user["_id"]))

@router.post("", response_model=dict)
async def add_api_key(
    key_data: APIKeyCreate,
    current_user: dict = Depends(AuthService.get_current_user)
):
    return await KeyService.add_key(str(current_user["_id"]), key_data)

@router.delete("/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    await KeyService.delete_key(str(current_user["_id"]), key_id)
    return {"message": "API key deleted successfully"}

@router.put("/{key_id}")
async def update_api_key(
    key_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(AuthService.get_current_user)
):
    await KeyService.update_key(str(current_user["_id"]), key_id, update_data)
    return {
        "message": "API key updated successfully",
        "key_id": key_id
    }

@router.post("/test")
async def test_api_key(
    data: Dict[str, Any],
    current_user: dict = Depends(AuthService.get_current_user)
):
    # This logic was inline in server.py using connectors directly.
    # Refactoring connectors is Block 2.
    # For now, we keep the logic here or move to KeyService?
    from connectors import get_connector, MarketplaceError
    from core.security import decrypt_api_key
    from services.key_service import KeyService
    import logging
    logger = logging.getLogger(__name__)

    marketplace = data.get('marketplace')
    client_id = data.get('client_id', '')
    api_key = data.get('api_key', '')
    key_id = data.get('key_id')
    
    if not marketplace or marketplace not in ["ozon", "wb", "yandex"]:
        return {'success': False, 'message': '❌ Invalid marketplace'}
    
    # Try to get real API key from database if key_id is provided
    if key_id:
        try:
            user_keys = await KeyService.get_keys(str(current_user["_id"]))
            for key in user_keys:
                if key.id == key_id and key.marketplace == marketplace:
                    # Decrypt the stored API key
                    encrypted_key = await KeyService.get_encrypted_key(str(current_user["_id"]), key_id)
                    if encrypted_key:
                        api_key = decrypt_api_key(encrypted_key)
                        logger.info(f"Using decrypted API key for {marketplace}")
                        break
        except Exception as e:
            logger.error(f"Error getting stored API key: {e}")
        
    if not api_key:
        return {'success': False, 'message': '❌ No API key provided'}
        
    try:
        connector = get_connector(marketplace, client_id, api_key)
        products = await connector.get_products()
        return {
            'success': True, 
            'message': f'✅ Connection successful! Found {len(products)} products.',
            'products_count': len(products)
        }
    except Exception as e:
        logger.error(f"API test error: {e}")
        return {'success': False, 'message': f'❌ Error: {str(e)}'}
