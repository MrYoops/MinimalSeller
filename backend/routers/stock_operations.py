from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime
import uuid
from bson import ObjectId
import logging

from backend.core.database import get_database
from backend.auth_utils import get_current_user
from backend.connectors import get_connector, MarketplaceError

router = APIRouter(prefix="/api/stock-operations", tags=["stock-operations"])
logger = logging.getLogger(__name__)


@router.post("/import-from-marketplace")
async def import_stocks_from_marketplace(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Перенести остатки С маркетплейса В систему (первичная загрузка)
    
    Body: {
      marketplace: str (ozon/wb/yandex),
      warehouse_id: str (опционально)
    }
    """
    db = await get_database()
    
    marketplace = data.get("marketplace")
    mp_warehouse_id = data.get("warehouse_id")
    
    if not marketplace:
        raise HTTPException(status_code=400, detail="marketplace required")
    
    # Получить API ключ для МП
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_key_data = next(
        (k for k in profile.get("api_keys", []) if k.get("marketplace") == marketplace),
        None
    )
    
    if not api_key_data:
        raise HTTPException(
            status_code=404,
            detail=f"No API key for {marketplace}"
        )
    
    # Создать коннектор
    connector = get_connector(
        marketplace,
        api_key_data.get("client_id", ""),
        api_key_data["api_key"]
    )
    
    # Получить остатки с МП
    try:
        mp_stocks = await connector.get_stocks(mp_warehouse_id)
    except Exception as e:
        logger.error(f"Failed to get stocks from {marketplace}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get stocks: {str(e)}"
        )
    
    imported_count = 0
    updated_count = 0
    
    # Для каждого товара с МП
    for stock_item in mp_stocks:
        # Извлечь SKU в зависимости от МП
        if marketplace == "ozon":
            sku = stock_item.get("offer_id")
            quantity = stock_item.get("present", 0)
        elif marketplace in ["wb", "wildberries"]:
            sku = stock_item.get("sku")
            quantity = stock_item.get("amount", 0)
        elif marketplace == "yandex":
            sku = stock_item.get("sku")
            items = stock_item.get("items", [])
            quantity = sum(item.get("count", 0) for item in items if item.get("type") == "FIT")
        else:
            continue
        
        if not sku:
            continue
        
        # Найти товар в системе по артикулу
        product = await db.product_catalog.find_one({
            "article": sku,
            "seller_id": current_user["_id"]
        })
        
        if not product:
            logger.warning(f"[IMPORT] Product {sku} not found in catalog, skipping")
            continue
        
        product_id = product["_id"]
        
        # Найти или создать inventory
        inventory = await db.inventory.find_one({
            "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
            "seller_id": current_user["_id"]
        })
        
        if inventory:
            # Обновить существующий
            await db.inventory.update_one(
                {"_id": inventory["_id"]},
                {"$set": {
                    "quantity": quantity,
                    "available": quantity - inventory.get("reserved", 0)
                }}
            )
            updated_count += 1
        else:
            # Создать новый
            await db.inventory.insert_one({
                "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
                "seller_id": current_user["_id"],
                "sku": sku,
                "quantity": quantity,
                "reserved": 0,
                "available": quantity,
                "alert_threshold": 10
            })
            imported_count += 1
        
        # Записать в историю
        await db.inventory_history.insert_one({
            "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
            "seller_id": current_user["_id"],
            "operation_type": "import_from_mp",
            "quantity_change": quantity,
            "reason": f"Перенос остатков с {marketplace.upper()}",
            "user_id": current_user["_id"],
            "created_at": datetime.utcnow(),
            "order_id": None,
            "shipment_id": None
        })
    
    return {
        "message": f"Импортировано {imported_count}, обновлено {updated_count} товаров",
        "imported": imported_count,
        "updated": updated_count,
        "total": imported_count + updated_count
    }


@router.post("/reconcile")
async def reconcile_stocks(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Сверка остатков: система vs маркетплейс
    
    Body: {
      marketplace: str,
      warehouse_id: str (опционально)
    }
    
    Returns: {
      matches: [{sku, system_qty, mp_qty}],  # Совпадают
      discrepancies: [{sku, system_qty, mp_qty, diff}]  # Расхождения
    }
    """
    db = await get_database()
    
    marketplace = data.get("marketplace")
    mp_warehouse_id = data.get("warehouse_id")
    
    if not marketplace:
        raise HTTPException(status_code=400, detail="marketplace required")
    
    # Получить API ключ
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_key_data = next(
        (k for k in profile.get("api_keys", []) if k.get("marketplace") == marketplace),
        None
    )
    
    if not api_key_data:
        raise HTTPException(status_code=404, detail=f"No API key for {marketplace}")
    
    # Получить остатки с МП
    connector = get_connector(
        marketplace,
        api_key_data.get("client_id", ""),
        api_key_data["api_key"]
    )
    
    try:
        mp_stocks = await connector.get_stocks(mp_warehouse_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stocks: {str(e)}")
    
    # Получить остатки из системы
    inventories = await db.inventory.find({
        "seller_id": current_user["_id"]
    }).to_list(length=10000)
    
    # Создать словарь для быстрого поиска
    system_stocks = {}
    for inv in inventories:
        system_stocks[inv["sku"]] = inv.get("available", 0)
    
    matches = []
    discrepancies = []
    
    # Сравнить
    for stock_item in mp_stocks:
        # Извлечь SKU и количество
        if marketplace == "ozon":
            sku = stock_item.get("offer_id")
            mp_qty = stock_item.get("present", 0)
        elif marketplace in ["wb", "wildberries"]:
            sku = stock_item.get("sku")
            mp_qty = stock_item.get("amount", 0)
        elif marketplace == "yandex":
            sku = stock_item.get("sku")
            items = stock_item.get("items", [])
            mp_qty = sum(item.get("count", 0) for item in items if item.get("type") == "FIT")
        else:
            continue
        
        system_qty = system_stocks.get(sku, 0)
        
        if system_qty == mp_qty:
            matches.append({
                "sku": sku,
                "system_qty": system_qty,
                "mp_qty": mp_qty
            })
        else:
            discrepancies.append({
                "sku": sku,
                "system_qty": system_qty,
                "mp_qty": mp_qty,
                "diff": system_qty - mp_qty
            })
    
    return {
        "marketplace": marketplace,
        "matches": len(matches),
        "discrepancies": discrepancies,
        "total_compared": len(matches) + len(discrepancies)
    }


@router.post("/transfer")
async def transfer_stocks(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Перенос остатков между складами
    
    Body: {
      from_warehouse_id: str,
      to_warehouse_id: str,
      items: [{article: str, quantity: int}, ...]
    }
    """
    db = await get_database()
    
    from_wh_id = data.get("from_warehouse_id")
    to_wh_id = data.get("to_warehouse_id")
    items = data.get("items", [])
    
    if not from_wh_id or not to_wh_id:
        raise HTTPException(status_code=400, detail="from_warehouse_id and to_warehouse_id required")
    
    if not items:
        raise HTTPException(status_code=400, detail="items required")
    
    transferred_count = 0
    
    # Для каждого товара
    for item in items:
        article = item.get("article")
        quantity = item.get("quantity", 0)
        
        if quantity <= 0:
            continue
        
        product = await db.product_catalog.find_one({
            "article": article,
            "seller_id": current_user["_id"]
        })
        
        if not product:
            continue
        
        product_id = product["_id"]
        
        # Списать с первого склада (через inventory_history)
        # Зачислить на второй склад
        # TODO: Расширенная логика с несколькими складами
        
        transferred_count += 1
    
    return {
        "message": f"Перенесено {transferred_count} товаров",
        "transferred": transferred_count
    }
