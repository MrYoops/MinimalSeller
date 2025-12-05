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


@router.get("/marketplace-warehouses/{integration_id}")
async def get_marketplace_warehouses(
    integration_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список складов МП для выбранной интеграции
    
    Используется для импорта остатков
    """
    db = await get_database()
    
    # Получить интеграцию
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_keys = profile.get("api_keys", [])
    integration = next((k for k in api_keys if k.get("id") == integration_id), None)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    marketplace = integration.get("marketplace")
    
    logger.info(f"[MP WAREHOUSES] Getting warehouses for {marketplace}")
    
    # Создать коннектор
    from connectors import get_connector, MarketplaceError
    
    try:
        connector = get_connector(
            marketplace,
            integration.get("client_id", ""),
            integration["api_key"]
        )
        
        # Получить склады
        warehouses = await connector.get_warehouses()
        
        logger.info(f"[MP WAREHOUSES] Got {len(warehouses)} warehouses")
        
        return {
            "marketplace": marketplace,
            "warehouses": warehouses
        }
    
    except MarketplaceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[MP WAREHOUSES] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import-stocks-from-marketplace")
async def import_stocks_from_marketplace(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    ИМПОРТ остатков ИЗ маркетплейса В базу данных
    
    Body: {
      integration_id: str,
      marketplace_warehouse_id: str (ID склада на МП)
    }
    """
    db = await get_database()
    
    integration_id = data.get("integration_id")
    mp_warehouse_id = data.get("marketplace_warehouse_id")
    
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id required")
    
    if not mp_warehouse_id:
        raise HTTPException(status_code=400, detail="marketplace_warehouse_id required")
    
    # Получить интеграцию
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_keys = profile.get("api_keys", [])
    integration = next((k for k in api_keys if k.get("id") == integration_id), None)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    marketplace = integration.get("marketplace")
    
    logger.info(f"[IMPORT STOCKS] Starting import from {marketplace} warehouse {mp_warehouse_id}")
    
    # Создать коннектор
    from connectors import get_connector, MarketplaceError
    
    try:
        connector = get_connector(
            marketplace,
            integration.get("client_id", ""),
            integration["api_key"]
        )
        
        # Получить остатки с МП
        if marketplace == "ozon":
            mp_stocks = await connector.get_stocks(mp_warehouse_id)
        elif marketplace in ["wb", "wildberries"]:
            mp_stocks = await connector.get_stocks(mp_warehouse_id)
        else:
            raise HTTPException(status_code=400, detail=f"Marketplace {marketplace} not supported")
        
        logger.info(f"[IMPORT STOCKS] Got {len(mp_stocks)} stock records from {marketplace}")
        
        if mp_stocks:
            logger.info(f"[IMPORT STOCKS] Sample stock record: {mp_stocks[0]}")
        
        updated_count = 0
        created_count = 0
        skipped_count = 0
        
        # Для Ozon: фильтруем по warehouse_id на стороне Python
        # т.к. API возвращает данные со всех складов
        if marketplace == "ozon" and mp_warehouse_id:
            logger.info(f"[IMPORT STOCKS] Filtering stocks for warehouse {mp_warehouse_id}")
            original_count = len(mp_stocks)
            mp_stocks = [s for s in mp_stocks if str(s.get('warehouse_id')) == str(mp_warehouse_id)]
            logger.info(f"[IMPORT STOCKS] Filtered: {original_count} → {len(mp_stocks)} records")
        
        for mp_stock in mp_stocks:
            # Извлечь данные в зависимости от МП
            if marketplace == "ozon":
                offer_id = mp_stock.get("offer_id")
                stock_quantity = mp_stock.get("present", 0)
                
                logger.debug(f"[IMPORT STOCKS] Processing: {offer_id}, warehouse={mp_stock.get('warehouse_id')}, quantity={stock_quantity}")
            elif marketplace in ["wb", "wildberries"]:
                offer_id = mp_stock.get("sku")
                stock_quantity = mp_stock.get("amount", 0)
            else:
                continue
            
            if not offer_id:
                skipped_count += 1
                continue
            
            # Найти товар в каталоге
            product = await db.product_catalog.find_one({
                "article": offer_id,
                "seller_id": str(current_user["_id"])
            })
            
            if not product:
                logger.warning(f"[IMPORT STOCKS] Product {offer_id} not found in catalog, skipping")
                skipped_count += 1
                continue
            
            # Найти или создать inventory запись ДЛЯ КОНКРЕТНОГО СКЛАДА
            # ВАЖНО: Мы ищем по product_id И seller_id (БЕЗ warehouse_id)
            # Потому что inventory - это ОБЩИЙ остаток, не по складам
            inventory = await db.inventory.find_one({
                "product_id": product["_id"],
                "seller_id": str(current_user["_id"])
            })
            
            if inventory:
                # Обновить существующую запись
                old_quantity = inventory.get("quantity", 0)
                reserved = inventory.get("reserved", 0)
                new_available = stock_quantity - reserved
                
                await db.inventory.update_one(
                    {"_id": inventory["_id"]},
                    {"$set": {
                        "quantity": stock_quantity,
                        "available": new_available,
                        "sku": offer_id  # Обновляем SKU на всякий случай
                    }}
                )
                
                # Записать в историю
                await db.inventory_history.insert_one({
                    "product_id": product["_id"],
                    "seller_id": str(current_user["_id"]),
                    "operation_type": "import_from_marketplace",
                    "quantity_change": stock_quantity - old_quantity,
                    "reason": f"Импорт остатков с {marketplace} (склад МП {mp_warehouse_id})",
                    "user_id": str(current_user["_id"]),
                    "created_at": datetime.utcnow()
                })
                
                updated_count += 1
                logger.info(f"[IMPORT STOCKS] ✅ Updated {offer_id}: {old_quantity} → {stock_quantity}")
            else:
                # Создать новую запись
                new_inventory = {
                    "product_id": product["_id"],
                    "seller_id": str(current_user["_id"]),
                    "sku": offer_id,
                    "quantity": stock_quantity,
                    "reserved": 0,
                    "available": stock_quantity,
                    "alert_threshold": 10
                }
                
                await db.inventory.insert_one(new_inventory)
                
                # Записать в историю
                await db.inventory_history.insert_one({
                    "product_id": product["_id"],
                    "seller_id": str(current_user["_id"]),
                    "operation_type": "import_from_marketplace",
                    "quantity_change": stock_quantity,
                    "reason": f"Импорт остатков с {marketplace} (склад {mp_warehouse_id})",
                    "user_id": str(current_user["_id"]),
                    "created_at": datetime.utcnow()
                })
                
                created_count += 1
                logger.info(f"[IMPORT STOCKS] ✅ Created {offer_id}: {stock_quantity}")
        
        logger.info(f"[IMPORT STOCKS] SUMMARY: created={created_count}, updated={updated_count}, skipped={skipped_count}")
        
        return {
            "message": f"Импортировано остатков: {created_count + updated_count} товаров",
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "marketplace": marketplace,
            "warehouse_id": mp_warehouse_id
        }
    
    except MarketplaceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[IMPORT STOCKS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
