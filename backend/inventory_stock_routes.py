from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging

from database import get_database
from auth_utils import get_current_user
from stock_sync_routes import sync_product_to_marketplace

router = APIRouter(prefix="/api/inventory", tags=["inventory-stock"])
logger = logging.getLogger(__name__)


@router.put("/update-stock")
async def update_stock(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Обновить остаток товара и синхронизировать на МП
    
    Body: {
      product_id: str,
      article: str,
      new_quantity: int,
      warehouse_id: str (опционально - если не указан, синхронизирует на все склады с sends_stock=True)
    }
    """
    db = await get_database()
    
    product_id = data.get("product_id")
    article = data.get("article")
    new_quantity = data.get("new_quantity", 0)
    warehouse_id = data.get("warehouse_id")  # Может быть None
    
    if not product_id or not article:
        raise HTTPException(status_code=400, detail="product_id and article required")
    
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    
    # Найти inventory запись (product_id может быть ObjectId или UUID строкой)
    # Сначала пробуем найти напрямую
    inventory = await db.inventory.find_one({
        "product_id": product_id,
        "seller_id": str(current_user["_id"])
    })
    
    # Если не нашли и product_id выглядит как ObjectId, пробуем конвертировать
    if not inventory and isinstance(product_id, str) and len(product_id) == 24:
        try:
            inventory = await db.inventory.find_one({
                "product_id": ObjectId(product_id),
                "seller_id": str(current_user["_id"])
            })
        except:
            pass
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")
    
    old_quantity = inventory.get("quantity", 0)
    reserved = inventory.get("reserved", 0)
    new_available = new_quantity - reserved
    
    # Обновить остаток
    await db.inventory.update_one(
        {"_id": inventory["_id"]},
        {"$set": {
            "quantity": new_quantity,
            "available": new_available
        }}
    )
    
    # Записать в историю (используем тот же product_id что в inventory)
    quantity_change = new_quantity - old_quantity
    await db.inventory_history.insert_one({
        "product_id": inventory["product_id"],  # Используем из найденной записи
        "seller_id": str(current_user["_id"]),
        "operation_type": "manual_adjustment",
        "quantity_change": quantity_change,
        "reason": f"Остаток изменён вручную: {old_quantity} → {new_quantity}",
        "user_id": str(current_user["_id"]),
        "created_at": datetime.utcnow(),
        "order_id": None,
        "shipment_id": None
    })
    
    logger.info(f"[STOCK UPDATE] Product {article}: {old_quantity} → {new_quantity}")
    
    # Синхронизация на МП
    synced_warehouses = []
    
    if warehouse_id:
        # Синхронизация на конкретный склад
        try:
            await sync_product_to_marketplace(
                db,
                current_user["_id"],
                warehouse_id,
                article,
                new_available
            )
            
            warehouse = await db.warehouses.find_one({"id": warehouse_id})
            warehouse_name = warehouse.get("name") if warehouse else warehouse_id
            synced_warehouses.append(warehouse_name)
            
            logger.info(f"[STOCK UPDATE] ✅ Synced to warehouse: {warehouse_name}")
        except Exception as e:
            logger.error(f"[STOCK UPDATE] ❌ Sync failed: {e}")
    else:
        # Синхронизация на все склады с sends_stock=True
        warehouses = await db.warehouses.find({
            "seller_id": str(current_user["_id"]),
            "sends_stock": True
        }).to_list(length=100)
        
        for wh in warehouses:
            try:
                await sync_product_to_marketplace(
                    db,
                    current_user["_id"],
                    wh["id"],
                    article,
                    new_available
                )
                synced_warehouses.append(wh.get("name"))
                logger.info(f"[STOCK UPDATE] ✅ Synced to warehouse: {wh.get('name')}")
            except Exception as e:
                logger.error(f"[STOCK UPDATE] ❌ Sync to {wh.get('name')} failed: {e}")
    
    return {
        "message": "Остаток обновлён и синхронизирован",
        "old_quantity": old_quantity,
        "new_quantity": new_quantity,
        "new_available": new_available,
        "synced_to_warehouses": synced_warehouses
    }


@router.post("/sync-all-stocks")
async def sync_all_stocks(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Ручная синхронизация всех остатков на выбранный склад
    
    Body: {
      warehouse_id: str
    }
    """
    db = await get_database()
    
    warehouse_id = data.get("warehouse_id")
    
    if not warehouse_id:
        raise HTTPException(status_code=400, detail="warehouse_id required")
    
    # Проверить существование склада
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "seller_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    logger.info(f"[MANUAL SYNC] Starting sync for warehouse: {warehouse.get('name')} (ID: {warehouse_id})")
    
    # Проверить наличие warehouse_links
    links = await db.warehouse_links.find({"warehouse_id": warehouse_id}).to_list(length=100)
    if not links:
        raise HTTPException(
            status_code=400, 
            detail=f"У склада '{warehouse.get('name')}' нет связей с маркетплейсами! Создайте связи в настройках склада."
        )
    
    logger.info(f"[MANUAL SYNC] Found {len(links)} warehouse links")
    
    # Получить все inventory записи
    inventories = await db.inventory.find({
        "seller_id": str(current_user["_id"])
    }).to_list(length=10000)
    
    synced_count = 0
    failed_count = 0
    skipped_count = 0
    
    logger.info(f"[MANUAL SYNC] Total inventory records to process: {len(inventories)}")
    
    for inv in inventories:
        product = await db.product_catalog.find_one({"_id": inv["product_id"]})
        
        if not product:
            skipped_count += 1
            logger.warning(f"[MANUAL SYNC] ⚠️ Product not found for inventory {inv.get('_id')}, skipping")
            continue
        
        article = product.get("article")
        available = inv.get("available", 0)
        
        logger.info(f"[MANUAL SYNC] Processing: {article} (available: {available})")
        
        try:
            await sync_product_to_marketplace(
                db,
                current_user["_id"],
                warehouse_id,
                article,
                available
            )
            synced_count += 1
            logger.info(f"[MANUAL SYNC] ✅ {article}: {available}")
        except Exception as e:
            failed_count += 1
            logger.error(f"[MANUAL SYNC] ❌ {article} failed: {e}")
    
    logger.info(f"[MANUAL SYNC] SUMMARY: synced={synced_count}, failed={failed_count}, skipped={skipped_count}")
    
    return {
        "message": f"Синхронизировано {synced_count} товаров",
        "synced": synced_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "warehouse_name": warehouse.get("name")
    }
