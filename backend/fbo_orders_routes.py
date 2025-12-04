from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from models import OrderFBO, OrderFBOCreate, OrderFBOResponse, OrderSyncRequest
from database import get_database
from auth_utils import get_current_user
from connectors import get_connector

router = APIRouter(prefix="/api/orders/fbo", tags=["orders-fbo"])
logger = logging.getLogger(__name__)


@router.get("", response_model=List[OrderFBOResponse])
async def get_fbo_orders(
    marketplace: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список FBO заказов (read-only, только аналитика)
    """
    db = await get_database()
    
    query = {"seller_id": str(current_user["_id"])}
    
    if marketplace:
        query["marketplace"] = marketplace
    if status:
        query["status"] = status
    if date_from:
        query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(date_to)}
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    
    orders = await db.orders_fbo.find(query).sort("created_at", -1).to_list(1000)
    
    for order in orders:
        order["id"] = str(order.pop("_id"))
    
    return orders


@router.get("/{order_id}", response_model=OrderFBOResponse)
async def get_fbo_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить детали FBO заказа
    """
    db = await get_database()
    
    order = await db.orders_fbo.find_one({
        "_id": ObjectId(order_id),
        "seller_id": str(current_user["_id"])
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    order["id"] = str(order.pop("_id"))
    return order


@router.post("/sync")
async def sync_fbo_orders(
    sync_request: OrderSyncRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Синхронизация FBO заказов с маркетплейсов
    """
    db = await get_database()
    
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Профиль продавца не найден")
    
    api_keys = profile.get("api_keys", [])
    
    if not api_keys:
        raise HTTPException(status_code=400, detail="API ключи не настроены")
    
    date_from = sync_request.date_from or (datetime.utcnow() - timedelta(days=1))
    date_to = sync_request.date_to or datetime.utcnow()
    
    synced_count = 0
    updated_count = 0
    errors = []
    
    for api_key_data in api_keys:
        marketplace = api_key_data.get("marketplace")
        
        if sync_request.marketplace != "all" and sync_request.marketplace != marketplace:
            continue
        
        try:
            connector = get_connector(
                marketplace,
                api_key_data.get("client_id", ""),
                api_key_data["api_key"]
            )
            
            # Получить FBO заказы с МП
            mp_orders = await connector.get_fbo_orders(date_from, date_to)
            
            # Обработать каждый заказ
            for mp_order_data in mp_orders:
                # Извлечь external_order_id
                if marketplace == "ozon":
                    external_id = mp_order_data.get("posting_number")
                elif marketplace == "wb":
                    external_id = str(mp_order_data.get("id"))
                elif marketplace == "yandex":
                    external_id = str(mp_order_data.get("id"))
                else:
                    continue
                
                # Проверить существует ли заказ
                existing = await db.orders_fbo.find_one({
                    "external_order_id": external_id,
                    "seller_id": str(current_user["_id"])
                })
                
                if not existing:
                    # СОЗДАТЬ НОВЫЙ (без влияния на inventory)
                    synced_count += 1
                else:
                    # ОБНОВИТЬ
                    updated_count += 1
        
        except Exception as e:
            logger.error(f"[FBO Sync] Ошибка синхронизации {marketplace}: {e}")
            errors.append({"marketplace": marketplace, "error": str(e)})
    
    return {
        "message": "Синхронизация FBO завершена",
        "synced": synced_count,
        "updated": updated_count,
        "errors": errors
    }
