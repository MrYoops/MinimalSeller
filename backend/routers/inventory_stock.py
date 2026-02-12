from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
from bson import ObjectId
import logging
import asyncio
from pathlib import Path

from core.database import get_database
from auth_utils import get_current_user

# Определяем путь к корню проекта динамически
PROJECT_ROOT = Path(__file__).parent.parent
DEBUG_LOG_PATH = PROJECT_ROOT / ".cursor" / "debug.log"
DEBUG_LOG_PATH.parent.mkdir(exist_ok=True)
# Ленивый импорт для избежания ошибки при отсутствии tenacity
def _get_sync_function():
    try:
        from routers.stock_sync import sync_product_to_marketplace
        return sync_product_to_marketplace
    except ImportError:
        return None

router = APIRouter(prefix="/api/inventory", tags=["inventory-stock"])
logger = logging.getLogger(__name__)

# #region agent log
# Log that this module is being imported
try:
    import time
    with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
        f.write(json.dumps({"id":"log_module_imported","timestamp":int(time.time()*1000),"location":"inventory_stock_routes.py:19","message":"Module imported","data":{"router_prefix":router.prefix},"sessionId":"debug-session","runId":"run2","hypothesisId":"G"}) + '\n')
except Exception as e:
    pass  # Don't fail if logging fails
# #endregion

# Test endpoint to verify router is working
@router.get("/test-router")
async def test_router():
    """Test endpoint to verify router is registered"""
    return {"status": "ok", "message": "Router is working", "prefix": router.prefix}


@router.get("/fbs")
async def get_fbs_inventory(
    current_user: dict = Depends(get_current_user)
):
    """Получить все остатки FBS (собственный склад) продавца"""
    db = await get_database()
    seller_id = str(current_user["_id"])
    
    # Получить все записи inventory
    cursor = db.inventory.find({"seller_id": seller_id})
    inventory_list = await cursor.to_list(length=1000)
    
    # Обогатить данными о товарах
    result = []
    for inv in inventory_list:
        product_id = inv["product_id"]
        sku = inv.get("sku", "")
        
        # Попробовать найти товар по product_id или по артикулу (sku)
        product = await db.product_catalog.find_one({"_id": product_id})
        
        if not product and sku:
            # Поиск по артикулу
            product = await db.product_catalog.find_one({"article": sku, "seller_id": seller_id})
        
        if not product:
            try:
                product = await db.product_catalog.find_one({"_id": ObjectId(product_id) if isinstance(product_id, str) else product_id})
            except:
                product = None
        
        # Получить имя товара и фото
        product_name = ""
        product_image = ""
        
        if product:
            product_name = product.get("name") or product.get("minimalmod", {}).get("name", "")
            actual_product_id = str(product.get("_id", product_id))
            
            # Попробовать загрузить фото из product_photos
            photo = await db.product_photos.find_one({"product_id": actual_product_id})
            if photo:
                product_image = photo.get("url", "")
            else:
                # Fallback на старые поля
                product_image = product.get("photos", [None])[0] or product.get("minimalmod", {}).get("images", [""])[0] or ""
        
        result.append({
            "id": str(inv["_id"]),
            "product_id": str(inv["product_id"]),
            "seller_id": str(inv["seller_id"]),
            "sku": sku,
            "quantity": inv.get("quantity", 0),
            "reserved": inv.get("reserved", 0),
            "available": inv.get("available", 0),
            "alert_threshold": inv.get("alert_threshold", 10),
            "product_name": product_name,
            "product_image": product_image
        })
    
    return result


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
            sync_func = _get_sync_function()
            if sync_func:
                await sync_func(
                    db,
                    current_user["_id"],
                    warehouse_id,
                    article,
                    new_available
                )
            
            # ИСПРАВЛЕНО: Поиск по _id (UUID строка), с fallback на id для совместимости
            warehouse = await db.warehouses.find_one({"_id": warehouse_id})
            if not warehouse:
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
                sync_func = _get_sync_function()
                if sync_func:
                    await sync_func(
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
    
    # Создать коннектор - расшифровываем API ключ
    from connectors import get_connector, MarketplaceError
    from utils import get_decrypted_api_key
    
    decrypted_api_key = get_decrypted_api_key(integration)
    if not decrypted_api_key:
        raise HTTPException(status_code=400, detail="Failed to decrypt API key")
    
    try:
        connector = get_connector(
            marketplace,
            integration.get("client_id", ""),
            decrypted_api_key
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
        else:
            logger.warning(f"[IMPORT STOCKS] ⚠️ No stock records returned from {marketplace} API!")
            logger.warning(f"[IMPORT STOCKS] This might mean:")
            logger.warning(f"[IMPORT STOCKS] 1. No products on marketplace")
            logger.warning(f"[IMPORT STOCKS] 2. API doesn't return items with stock=0")
            logger.warning(f"[IMPORT STOCKS] 3. Warehouse ID mismatch")
        
        updated_count = 0
        created_count = 0
        skipped_count = 0
        not_found_in_catalog = []
        
        # Для Ozon: фильтруем по warehouse_id на стороне Python
        # т.к. API возвращает данные со всех складов
        if marketplace == "ozon" and mp_warehouse_id:
            logger.info(f"[IMPORT STOCKS] Filtering stocks for warehouse {mp_warehouse_id}")
            original_count = len(mp_stocks)
            mp_stocks = [s for s in mp_stocks if str(s.get('warehouse_id')) == str(mp_warehouse_id)]
            logger.info(f"[IMPORT STOCKS] Filtered: {original_count} → {len(mp_stocks)} records")
            if original_count > 0 and len(mp_stocks) == 0:
                logger.warning(f"[IMPORT STOCKS] ⚠️ All records filtered out! Check warehouse_id matching")
                # Берем sample из оригинального массива до фильтрации
                if original_count > 0:
                    # Нужно сохранить оригинальный массив до фильтрации для отладки
                    logger.warning(f"[IMPORT STOCKS] Requested warehouse_id: {mp_warehouse_id}")
        
        # Создаем множество offer_id из ответа API для быстрого поиска
        mp_offer_ids = set()
        for mp_stock in mp_stocks:
            if marketplace == "ozon":
                offer_id = mp_stock.get("offer_id")
            elif marketplace in ["wb", "wildberries"]:
                offer_id = mp_stock.get("sku")
            else:
                continue
            if offer_id:
                mp_offer_ids.add(offer_id)
        
        logger.info(f"[IMPORT STOCKS] Found {len(mp_offer_ids)} unique offer_ids in MP response")
        
        # Если нет записей с остатками, но есть товары в каталоге - нужно обновить их на 0
        # Также обновляем товары, которых нет в ответе API (значит остаток = 0)
        logger.info(f"[IMPORT STOCKS] Checking catalog products to update missing/zero stock items...")
        
        # Получаем все товары из каталога для этого seller_id
        # Пробуем разные варианты seller_id (строка, ObjectId, user_id)
        seller_id_str = str(current_user["_id"])
        seller_id_obj = ObjectId(seller_id_str)
        
        # Ищем товары по разным вариантам seller_id
        all_catalog_products = await db.product_catalog.find({
            "$or": [
                {"seller_id": seller_id_str},
                {"seller_id": seller_id_obj},
                {"user_id": seller_id_str},
                {"user_id": seller_id_obj}
            ]
        }).to_list(length=10000)  # Увеличиваем лимит
        
        logger.info(f"[IMPORT STOCKS] Found {len(all_catalog_products)} products in catalog for seller")
        logger.info(f"[IMPORT STOCKS] Seller ID variants: str={seller_id_str}, obj={seller_id_obj}")
        
        # Если не нашли товары в каталоге, используем inventory напрямую
        if len(all_catalog_products) == 0:
            total_products = await db.product_catalog.count_documents({})
            logger.warning(f"[IMPORT STOCKS] ⚠️ No products found in catalog! Total products in catalog: {total_products}")
            
            # Если каталог пуст, но есть записи в inventory - используем их
            inventory_items = await db.inventory.find({
                "$or": [
                    {"seller_id": seller_id_str},
                    {"seller_id": seller_id_obj}
                ]
            }).to_list(length=10000)
            
            logger.info(f"[IMPORT STOCKS] Found {len(inventory_items)} items in inventory, using them instead of catalog")
            
            # Обновляем остатки напрямую из inventory
            for inv_item in inventory_items:
                sku = inv_item.get("sku")
                if not sku:
                    continue
                
                # Проверяем, есть ли этот товар в ответе API
                if sku not in mp_offer_ids:
                    # Товара нет в ответе API - значит остаток = 0
                    old_quantity = inv_item.get("quantity", 0)
                    if old_quantity > 0:
                        reserved = inv_item.get("reserved", 0)
                        
                        await db.inventory.update_one(
                            {"_id": inv_item["_id"]},
                            {"$set": {
                                "quantity": 0,
                                "available": max(0, 0 - reserved),
                                "sku": sku
                            }}
                        )
                        
                        await db.inventory_history.insert_one({
                            "product_id": inv_item.get("product_id"),
                            "seller_id": seller_id_str,
                            "operation_type": "import_from_marketplace",
                            "quantity_change": 0 - old_quantity,
                            "reason": f"Импорт остатков с {marketplace} (склад МП {mp_warehouse_id}) - товар отсутствует в ответе API (остаток = 0)",
                            "user_id": seller_id_str,
                            "created_at": datetime.utcnow()
                        })
                        
                        updated_count += 1
                        logger.info(f"[IMPORT STOCKS] ✅ Updated inventory {sku}: {old_quantity} → 0 (not in MP response, stock = 0)")
            
            # Если были обновления через inventory, пропускаем дальнейшую обработку каталога
            if len(inventory_items) > 0:
                logger.info(f"[IMPORT STOCKS] Processed {len(inventory_items)} inventory items directly")
                # Продолжаем обработку записей из API (если они есть)
                # Но пропускаем цикл по каталогу, т.к. он пуст
        
        # Для каждого товара в каталоге проверяем:
        # 1. Если его нет в ответе API - обновляем на 0
        # 2. Если его остаток в API = 0 - обновляем на 0
        for catalog_product in all_catalog_products:
            article = catalog_product.get("article") or catalog_product.get("sku")
            if not article:
                continue
            
            # Проверяем, есть ли этот товар в ответе API
            if article not in mp_offer_ids:
                # Товара нет в ответе API - значит остаток = 0 или товар удален
                product_id = catalog_product["_id"]
                seller_id_str = str(current_user["_id"])
                seller_id_obj = ObjectId(seller_id_str)
                
                # Пробуем найти inventory с разными форматами
                inventory = await db.inventory.find_one({
                    "$or": [
                        {"product_id": product_id, "seller_id": seller_id_str},
                        {"product_id": product_id, "seller_id": seller_id_obj},
                        {"product_id": str(product_id), "seller_id": seller_id_str},
                        {"product_id": str(product_id), "seller_id": seller_id_obj}
                    ]
                })
                
                if inventory and inventory.get("quantity", 0) > 0:
                    # Обновляем на 0, т.к. на МП остатка нет
                    old_quantity = inventory.get("quantity", 0)
                    reserved = inventory.get("reserved", 0)
                    
                    await db.inventory.update_one(
                        {"_id": inventory["_id"]},
                        {"$set": {
                            "quantity": 0,
                            "available": max(0, 0 - reserved),
                            "sku": article
                        }}
                    )
                    
                    await db.inventory_history.insert_one({
                        "product_id": catalog_product["_id"],
                        "seller_id": str(current_user["_id"]),
                        "operation_type": "import_from_marketplace",
                        "quantity_change": 0 - old_quantity,
                        "reason": f"Импорт остатков с {marketplace} (склад МП {mp_warehouse_id}) - товар отсутствует в ответе API (остаток = 0)",
                        "user_id": str(current_user["_id"]),
                        "created_at": datetime.utcnow()
                    })
                    
                    updated_count += 1
                    logger.info(f"[IMPORT STOCKS] ✅ Updated {article}: {old_quantity} → 0 (not in MP response, stock = 0)")
        
        for mp_stock in mp_stocks:
            # Извлечь данные в зависимости от МП
            if marketplace == "ozon":
                offer_id = mp_stock.get("offer_id")
                stock_quantity = mp_stock.get("present", 0)
                
                logger.info(f"[IMPORT STOCKS] Processing: offer_id={offer_id}, warehouse={mp_stock.get('warehouse_id')}, quantity={stock_quantity}")
            elif marketplace in ["wb", "wildberries"]:
                offer_id = mp_stock.get("sku")
                stock_quantity = mp_stock.get("amount", 0)
                logger.info(f"[IMPORT STOCKS] Processing: sku={offer_id}, quantity={stock_quantity}")
            else:
                continue
            
            if not offer_id:
                logger.warning(f"[IMPORT STOCKS] ⚠️ Skipping record without offer_id/sku: {mp_stock}")
                skipped_count += 1
                continue
            
            # Найти товар в каталоге - пробуем разные варианты поиска
            seller_id_str = str(current_user["_id"])
            seller_id_obj = ObjectId(seller_id_str)
            
            # Вариант 1: поиск по article с разными форматами seller_id
            product = await db.product_catalog.find_one({
                "article": offer_id,
                "$or": [
                    {"seller_id": seller_id_str},
                    {"seller_id": seller_id_obj},
                    {"user_id": seller_id_str},
                    {"user_id": seller_id_obj}
                ]
            })
            
            # Вариант 2: поиск по sku (если article не совпадает)
            if not product:
                product = await db.product_catalog.find_one({
                    "sku": offer_id,
                    "$or": [
                        {"seller_id": seller_id_str},
                        {"seller_id": seller_id_obj},
                        {"user_id": seller_id_str},
                        {"user_id": seller_id_obj}
                    ]
                })
            
            # Вариант 3: поиск только по article без seller_id (на случай если seller_id не установлен)
            if not product:
                product = await db.product_catalog.find_one({
                    "article": offer_id
                })
                if product:
                    logger.warning(f"[IMPORT STOCKS] Found product without seller_id filter: {offer_id}")
            
            if not product:
                logger.warning(f"[IMPORT STOCKS] ⚠️ Product {offer_id} not found in catalog, trying to update inventory directly")
                
                # Если товара нет в каталоге, пробуем обновить inventory напрямую по sku
                inventory_by_sku = await db.inventory.find_one({
                    "sku": offer_id,
                    "$or": [
                        {"seller_id": seller_id_str},
                        {"seller_id": seller_id_obj}
                    ]
                })
                
                if inventory_by_sku:
                    # Нашли inventory по sku - обновляем напрямую
                    old_quantity = inventory_by_sku.get("quantity", 0)
                    reserved = inventory_by_sku.get("reserved", 0)
                    new_available = max(0, stock_quantity - reserved)
                    
                    await db.inventory.update_one(
                        {"_id": inventory_by_sku["_id"]},
                        {"$set": {
                            "quantity": stock_quantity,
                            "available": new_available,
                            "sku": offer_id
                        }}
                    )
                    
                    if old_quantity != stock_quantity:
                        await db.inventory_history.insert_one({
                            "product_id": inventory_by_sku.get("product_id"),
                            "seller_id": seller_id_str,
                            "operation_type": "import_from_marketplace",
                            "quantity_change": stock_quantity - old_quantity,
                            "reason": f"Импорт остатков с {marketplace} (склад МП {mp_warehouse_id}) - обновлено напрямую из inventory",
                            "user_id": seller_id_str,
                            "created_at": datetime.utcnow()
                        })
                    
                    updated_count += 1
                    logger.info(f"[IMPORT STOCKS] ✅ Updated inventory directly {offer_id}: {old_quantity} → {stock_quantity}")
                    continue
                else:
                    logger.warning(f"[IMPORT STOCKS] ⚠️ Product {offer_id} not found in catalog and inventory")
                    not_found_in_catalog.append(offer_id)
                    skipped_count += 1
                    continue
            
            logger.info(f"[IMPORT STOCKS] ✅ Found product in catalog: article={product.get('article')}, product_id={product['_id']}")
            
            # Найти или создать inventory запись ДЛЯ КОНКРЕТНОГО СКЛАДА
            # ВАЖНО: Мы ищем по product_id И seller_id (БЕЗ warehouse_id)
            # Потому что inventory - это ОБЩИЙ остаток, не по складам
            product_id = product["_id"]
            seller_id_str = str(current_user["_id"])
            seller_id_obj = ObjectId(seller_id_str)
            
            # Пробуем найти inventory с разными форматами seller_id и product_id
            inventory = await db.inventory.find_one({
                "$or": [
                    {"product_id": product_id, "seller_id": seller_id_str},
                    {"product_id": product_id, "seller_id": seller_id_obj},
                    {"product_id": str(product_id), "seller_id": seller_id_str},
                    {"product_id": str(product_id), "seller_id": seller_id_obj}
                ]
            })
            
            if inventory:
                # Обновить существующую запись
                old_quantity = inventory.get("quantity", 0)
                reserved = inventory.get("reserved", 0)
                new_available = max(0, stock_quantity - reserved)  # Не может быть отрицательным
                
                # Обновляем ВСЕГДА, даже если остаток = 0
                await db.inventory.update_one(
                    {"_id": inventory["_id"]},
                    {"$set": {
                        "quantity": stock_quantity,  # Может быть 0!
                        "available": new_available,
                        "sku": offer_id  # Обновляем SKU на всякий случай
                    }}
                )
                
                # Записать в историю только если было изменение
                if old_quantity != stock_quantity:
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
                logger.info(f"[IMPORT STOCKS] ✅ Updated {offer_id}: {old_quantity} → {stock_quantity} (from MP API)")
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
        
        if not_found_in_catalog:
            logger.warning(f"[IMPORT STOCKS] ⚠️ {len(not_found_in_catalog)} products not found in catalog: {not_found_in_catalog[:10]}")
        
        total_processed = created_count + updated_count
        
        if total_processed == 0:
            message = f"Импортировано 0 товаров. "
            if len(mp_stocks) == 0 and len(all_catalog_products) > 0:
                message += f"На маркетплейсе нет остатков. Проверено товаров в каталоге: {len(all_catalog_products)}."
            elif len(mp_stocks) == 0:
                message += "На маркетплейсе нет остатков или API не вернул данные."
            elif len(not_found_in_catalog) > 0:
                message += f"Товары не найдены в каталоге: {len(not_found_in_catalog)} шт."
            else:
                message += "Проверьте логи для деталей."
        else:
            message = f"Импортировано остатков: {total_processed} товаров"
            details = []
            if created_count > 0:
                details.append(f"создано: {created_count}")
            if updated_count > 0:
                details.append(f"обновлено: {updated_count}")
            if details:
                message += f" ({', '.join(details)})"
            if len(mp_stocks) == 0 and updated_count > 0:
                message += " Все остатки обновлены на 0 (на маркетплейсе нет остатков)."
        
        return {
            "message": message,
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "not_found_in_catalog": not_found_in_catalog[:20],  # Первые 20 для отладки
            "marketplace": marketplace,
            "warehouse_id": mp_warehouse_id,
            "total_records_from_mp": len(mp_stocks) if mp_stocks else 0
        }
    
    except MarketplaceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[IMPORT STOCKS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Явный обработчик OPTIONS ДО endpoint с авторизацией
@router.options("/sync-all-stocks")
async def sync_all_stocks_options(request: Request):
    """Обработка OPTIONS запроса для CORS preflight - БЕЗ авторизации"""
    # #region agent log
    try:
        import json
        import time
        with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
            f.write(json.dumps({"id":"log_options_endpoint_called","timestamp":int(time.time()*1000),"location":"inventory_stock_routes.py:481","message":"OPTIONS endpoint explicitly called","data":{"origin":request.headers.get("origin")},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + '\n')
    except Exception as e:
        pass
    # #endregion
    from fastapi.responses import Response
    origin = request.headers.get("origin", "*")
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "3600"
    return response

@router.post("/sync-all-stocks", name="sync_all_stocks")
async def sync_all_stocks(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    # #region agent log
    import time
    try:
        with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
            f.write(json.dumps({"id":"log_endpoint_reached","timestamp":int(time.time()*1000),"location":"inventory_stock_routes.py:485","message":"POST endpoint function called","data":{"router_prefix":router.prefix,"user_id":str(current_user.get("_id"))},"sessionId":"debug-session","runId":"run1","hypothesisId":"E"}) + '\n')
    except Exception as e:
        logger.error(f"Failed to write debug log: {e}")
    # #endregion
    """
    Ручная синхронизация всех остатков на выбранный склад
    ОПТИМИЗИРОВАНО: отправляет батчами для избежания rate limit
    
    ВАЖНО: Отправляет ВСЕ товары из БД (даже с остатком 0), чтобы синхронизировать МП с базой
    База данных - источник истины!
    
    Body: {
      warehouse_id: str
    }
    """
    # Парсим JSON body
    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse request body: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    # #region agent log
    try:
        with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
            f.write(json.dumps({"id":"log_endpoint_start","timestamp":int(time.time()*1000),"location":"inventory_stock_routes.py:417","message":"Endpoint started execution","data":{"body_parsed":body,"user_id":str(current_user.get("_id"))},"sessionId":"debug-session","runId":"run2","hypothesisId":"C"}) + '\n')
    except Exception as e:
        logger.error(f"Failed to write debug log: {e}")
    # #endregion
    
    logger.info(f"")
    logger.info(f"{'='*80}")
    logger.info(f"[SYNC-ALL-STOCKS] Запрос на синхронизацию остатков")
    logger.info(f"[SYNC-ALL-STOCKS] User ID: {current_user.get('_id')}")
    logger.info(f"[SYNC-ALL-STOCKS] Request data: {body}")
    logger.info(f"{'='*80}")
    
    db = await get_database()
    
    warehouse_id = body.get("warehouse_id")
    
    # #region agent log
    try:
        with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
            f.write(json.dumps({"id":"log_warehouse_id_extracted","timestamp":int(time.time()*1000),"location":"inventory_stock_routes.py:432","message":"Warehouse ID extracted","data":{"warehouse_id":warehouse_id},"sessionId":"debug-session","runId":"run2","hypothesisId":"C"}) + '\n')
    except Exception as e:
        logger.error(f"Failed to write debug log: {e}")
    # #endregion
    
    if not warehouse_id:
        logger.error("[SYNC-ALL-STOCKS] ❌ warehouse_id не передан в запросе")
        raise HTTPException(status_code=400, detail="warehouse_id required")
    
    logger.info(f"[SYNC-ALL-STOCKS] Ищем склад с ID: {warehouse_id}")
    # #region agent log
    import json
    with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
        f.write(json.dumps({"id":"log_search_start","timestamp":int(__import__('time').time()*1000),"location":"inventory_stock_routes.py:418","message":"Starting warehouse search","data":{"warehouse_id":warehouse_id,"user_id":str(current_user["_id"]),"user_id_type":type(current_user["_id"]).__name__},"sessionId":"debug-session","runId":"run2","hypothesisId":"C"}) + '\n')
    # #endregion
    
    # Проверить существование склада
    # В базе данных склад использует _id как идентификатор
    # Но в API возвращается как "id": str(wh["_id"])
    # В server.py используется current_user["_id"] (ObjectId), а не str(current_user["_id"])
    # Поэтому ищем по _id, а не по полю "id"
    
    warehouse = None
    from bson import ObjectId
    
    # ИСПРАВЛЕНО: В базе данных склад хранится с _id как UUID строка (не ObjectId)
    # warehouse_id из запроса - это UUID строка, которая используется как _id
    # Проверяем оба варианта user_id: ObjectId и строка
    # А также проверяем поле "id" (где хранится UUID)
    
    # 1. Поиск по id (UUID) без user_id проверки
    warehouse = await db.warehouses.find_one({"id": warehouse_id})

    if not warehouse:
        # 2. Поиск по _id
        warehouse = await db.warehouses.find_one({"_id": warehouse_id})
    
    if not warehouse:
        logger.error(f"[SYNC-ALL-STOCKS] ❌ Склад с ID {warehouse_id} не найден")
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    logger.info(f"[SYNC-ALL-STOCKS] ✅ Склад найден: {warehouse.get('name')}")
    
    # Получить связи склада с маркетплейсами
    logger.info(f"[MANUAL SYNC] Склад: {warehouse.get('name')} (ID: {warehouse_id})")
    logger.info(f"{'='*80}")
    
    # Проверить наличие warehouse_links
    links = await db.warehouse_links.find({"warehouse_id": warehouse_id}).to_list(length=100)
    if not links:
        raise HTTPException(
            status_code=400, 
            detail=f"У склада '{warehouse.get('name')}' нет связей с маркетплейсами! Создайте связи в настройках склада."
        )
    
    logger.info(f"[MANUAL SYNC] Найдено связей с МП: {len(links)}")
    for link in links:
        logger.info(f"  - {link.get('marketplace_name')} → Склад МП: {link.get('marketplace_warehouse_id')}")
    
    # Получить все inventory записи
    inventories = await db.inventory.find({
        "seller_id": str(current_user["_id"])
    }).to_list(length=10000)
    
    logger.info(f"")
    logger.info(f"[MANUAL SYNC] Всего записей inventory в БД: {len(inventories)}")
    logger.info(f"[MANUAL SYNC] ⚠️ ВАЖНО: Будут отправлены ВСЕ товары, включая товары с остатком 0")
    logger.info(f"[MANUAL SYNC] База данных = источник истины для МП")
    logger.info(f"")
    
    # Группируем товары по маркетплейсам для батч-отправки
    from connectors import get_connector, MarketplaceError
    
    synced_count = 0
    failed_count = 0
    skipped_count = 0
    
    # Для каждого МП синхронизируем батчами
    for link in links:
        marketplace = link.get("marketplace_name")
        mp_warehouse_id = link.get("marketplace_warehouse_id")
        
        logger.info(f"")
        logger.info(f"[MANUAL SYNC] {'='*60}")
        logger.info(f"[MANUAL SYNC] Обработка МП: {marketplace.upper()}")
        logger.info(f"[MANUAL SYNC] Склад МП: {mp_warehouse_id}")
        logger.info(f"[MANUAL SYNC] {'='*60}")
        
        # Получить API ключ
        profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
        if not profile:
            logger.error(f"[MANUAL SYNC] ❌ Профиль пользователя не найден!")
            continue
        
        api_key_data = next(
            (k for k in profile.get("api_keys", []) if k.get("marketplace") == marketplace),
            None
        )
        
        if not api_key_data:
            logger.error(f"[MANUAL SYNC] ❌ API ключ для {marketplace} не найден!")
            continue
        
        logger.info(f"[MANUAL SYNC] ✅ API ключ найден для {marketplace}")
        
        # Создать коннектор - расшифровываем API ключ
        from utils import get_decrypted_api_key
        decrypted_api_key = get_decrypted_api_key(api_key_data)
        if not decrypted_api_key:
            logger.error(f"[MANUAL SYNC] ❌ Не удалось расшифровать API ключ для {marketplace}!")
            continue
        
        connector = get_connector(
            marketplace,
            api_key_data.get("client_id", ""),
            decrypted_api_key
        )
        
        # Собираем товары для этого МП
        batch_items = []
        
        logger.info(f"[MANUAL SYNC] Сбор товаров для отправки...")
        
        for inv in inventories:
            logger.info(f"[MANUAL SYNC] Обработка inventory: product_id={inv.get('product_id')}, available={inv.get('available')}")
            
            # ПРЕОБРАЗУЕМ product_id в ObjectId для поиска
            try:
                product_id_obj = ObjectId(inv["product_id"])
            except:
                logger.warning(f"[MANUAL SYNC] ⚠️ Неверный product_id: {inv.get('product_id')}")
                skipped_count += 1
                continue
                
            product = await db.products.find_one({"_id": product_id_obj})
            
            if not product:
                skipped_count += 1
                logger.warning(f"[MANUAL SYNC] ⚠️ Товар с ID {inv['product_id']} не найден в products")
                continue
            
            article = product.get("article")
            available = inv.get("available", 0)
            
            logger.info(f"[MANUAL SYNC] Найден товар: {article}, остаток: {available}")
            
            # ВАЖНО: Ozon не принимает отрицательные остатки, исправляем на 0
            if available < 0:
                logger.warning(f"[MANUAL SYNC] ⚠️ Товар {article} имеет отрицательный остаток {available}, исправляем на 0")
                available = 0
            
            # ИЗМЕНЕНО: Отправляем ВСЕ товары, используем article как offer_id
            # Для Ozon offer_id = article продавца
            if marketplace == "ozon":
                batch_items.append({"offer_id": article, "stock": available})
                logger.info(f"[MANUAL SYNC] Добавлен в batch: {article} → {available}")
            elif marketplace in ["wb", "wildberries"]:
                # Для WB нужен barcode, если его нет - используем article
                marketplace_data = product.get("marketplace_data", {}).get(marketplace, {})
                mp_sku = marketplace_data.get("barcode") or marketplace_data.get("id") or article
                batch_items.append({"sku": mp_sku, "amount": available})
                logger.info(f"[MANUAL SYNC] Добавлен в batch: {mp_sku} → {available}")
        
        logger.info(f"[MANUAL SYNC] Итого собрано товаров: {len(batch_items)}")
        logger.info(f"[MANUAL SYNC] Пропущено (не найдены в каталоге): {skipped_count}")
        
        # КРИТИЧЕСКАЯ ПРОВЕРКА
        if not batch_items:
            logger.error(f"[MANUAL SYNC] ❌ НЕТ ТОВАРОВ ДЛЯ ОТПРАВКИ!")
            logger.error(f"[MANUAL SYNC] ❌ Проверьте:")
            logger.error(f"[MANUAL SYNC]   - Есть ли inventory записи")
            logger.error(f"[MANUAL SYNC]   - Есть ли товары в products")
            logger.error(f"[MANUAL SYNC]   - Совпадают ли product_id в inventory и _id в products")
            continue
        
        # Отправляем БАТЧАМИ
        if batch_items:
            batch_size = 100
            total_batches = (len(batch_items) + batch_size - 1) // batch_size
            
            logger.info(f"")
            logger.info(f"[MANUAL SYNC] Начинаю отправку батчами (размер батча: {batch_size})")
            logger.info(f"[MANUAL SYNC] Всего батчей: {total_batches}")
            logger.info(f"")
            
            for i in range(0, len(batch_items), batch_size):
                batch = batch_items[i:i+batch_size]
                batch_num = i//batch_size + 1
                
                try:
                    logger.info(f"[MANUAL SYNC] ▶ Отправка батча {batch_num}/{total_batches} ({len(batch)} товаров)...")
                    
                    # Логируем первые 3 товара из батча для проверки
                    sample = batch[:3]
                    logger.info(f"[MANUAL SYNC]   Пример товаров из батча:")
                    for item in sample:
                        if marketplace == "ozon":
                            logger.info(f"[MANUAL SYNC]     - offer_id: {item['offer_id']}, stock: {item['stock']}")
                        else:
                            logger.info(f"[MANUAL SYNC]     - sku: {item['sku']}, amount: {item['amount']}")
                    
                    await connector.update_stock(mp_warehouse_id, batch)
                    synced_count += len(batch)
                    
                    logger.info(f"[MANUAL SYNC] ✅ Батч {batch_num}/{total_batches} отправлен успешно!")
                    
                    # Небольшая задержка между батчами для избежания rate limit
                    if batch_num < total_batches:
                        logger.info(f"[MANUAL SYNC] ⏳ Пауза 0.5 сек перед следующим батчем...")
                        await asyncio.sleep(0.5)
                    
                except MarketplaceError as e:
                    failed_count += len(batch)
                    logger.error(f"[MANUAL SYNC] ❌ Батч {batch_num}/{total_batches} FAILED!")
                    logger.error(f"[MANUAL SYNC] ❌ Ошибка: {e.message}")
                    logger.error(f"[MANUAL SYNC] ❌ Status code: {e.status_code}")
        else:
            logger.warning(f"[MANUAL SYNC] ⚠️ Нет товаров для отправки на {marketplace}!")
    
    logger.info(f"")
    logger.info(f"{'='*80}")
    logger.info(f"[MANUAL SYNC] СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА")
    logger.info(f"[MANUAL SYNC] Успешно отправлено: {synced_count}")
    logger.info(f"[MANUAL SYNC] Ошибок: {failed_count}")
    logger.info(f"[MANUAL SYNC] Пропущено: {skipped_count}")
    logger.info(f"{'='*80}")
    logger.info(f"")
    
    return {
        "message": f"Синхронизировано {synced_count} товаров",
        "synced": synced_count,
        "failed": failed_count,
        "skipped": skipped_count,
    }

@router.post("/sync-from-marketplaces")
async def sync_from_marketplaces(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Импортировать остатки с маркетплейсов в нашу базу
    """
    import json
    
    try:
        body = await request.body()
        body = json.loads(body.decode()) if body else {}
        
        integration_id = body.get("integration_id")
        warehouse_id = body.get("warehouse_id")
        
        if not integration_id:
            raise HTTPException(status_code=400, detail="integration_id required")
        if not warehouse_id:
            raise HTTPException(status_code=400, detail="warehouse_id required")
        
        logger.info(f"")
        logger.info(f"{'='*80}")
        logger.info(f"[SYNC-FROM-MP] Запрос на импорт остатков")
        logger.info(f"[SYNC-FROM-MP] Integration ID: {integration_id}")
        logger.info(f"[SYNC-FROM-MP] Warehouse ID: {warehouse_id}")
        logger.info(f"{'='*80}")
        
        db = await get_database()
        seller_id = str(current_user["_id"])
        
        # Получить конкретную интеграцию из коллекции api_keys
        from bson import ObjectId
        try:
            integration_object_id = ObjectId(integration_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid integration_id format")
        
        api_key_data = await db.api_keys.find_one({"_id": integration_object_id, "seller_id": current_user["_id"]})
        
        if not api_key_data:
            raise HTTPException(status_code=404, detail="API key not found")
        
        marketplace = api_key_data.get("marketplace")
        logger.info(f"[SYNC-FROM-MP] Обработка маркетплейса: {marketplace}")
        
        try:
            # Расшифровать API ключ
            from utils import get_decrypted_api_key
            decrypted_api_key = get_decrypted_api_key(api_key_data)
            if not decrypted_api_key:
                raise HTTPException(status_code=400, detail="Failed to decrypt API key")
            
            # Создать коннектор
            from connectors import get_connector, MarketplaceError
            connector = get_connector(
                marketplace,
                api_key_data.get("client_id", ""),
                decrypted_api_key
            )
            
            # Получить остатки с маркетплейса для конкретного склада
            logger.info(f"[SYNC-FROM-MP] 📥 Получение остатков с {marketplace}, склад {warehouse_id}...")
            
            stocks = await connector.get_stocks_for_warehouse(warehouse_id)
            
            logger.info(f"[SYNC-FROM-MP] Получено {len(stocks)} товаров с {marketplace}")
            
            # Обновляем inventory в нашей базе
            updated_count = 0
            errors_count = 0
            
            for stock_item in stocks:
                try:
                    # Ищем товар по offer_id/article
                    offer_id = stock_item.get("offer_id") or stock_item.get("sku") or stock_item.get("article")
                    if not offer_id:
                        continue
                        
                    # Ищем товар в products
                    product = await db.products.find_one({
                        "$or": [
                            {"article": offer_id},
                            {"sku": offer_id},
                            {"marketplaces.ozon.product_id": offer_id}
                        ]
                    })
                    
                    if not product:
                        logger.warning(f"[SYNC-FROM-MP] ⚠️ Товар не найден: {offer_id}")
                        continue
                        
                    # Обновляем inventory
                    mp_stock = stock_item.get("stock", 0) or stock_item.get("amount", 0)
                    
                    await db.inventory.update_one(
                        {
                            "product_id": str(product["_id"]),
                            "seller_id": seller_id
                        },
                        {
                            "$set": {
                                "quantity": mp_stock,
                                "available": mp_stock,
                                "dates.updated_at": datetime.utcnow()
                            }
                        },
                        upsert=True
                    )
                    
                    updated_count += 1
                    logger.debug(f"[SYNC-FROM-MP] ✅ Обновлен товар {offer_id}: {mp_stock}")
                    
                except Exception as e:
                    logger.warning(f"[SYNC-FROM-MP] ⚠️ Ошибка обновления товара: {e}")
                    errors_count += 1
            
            logger.info(f"")
            logger.info(f"{'='*80}")
            logger.info(f"[SYNC-FROM-MP] ИМПОРТ ЗАВЕРШЕН")
            logger.info(f"[SYNC-FROM-MP] Обновлено: {updated_count}")
            logger.info(f"[SYNC-FROM-MP] Ошибок: {errors_count}")
            logger.info(f"{'='*80}")
            
            return {
                "message": f"Импортировано {updated_count} остатков с {marketplace}",
                "updated": updated_count,
                "errors": errors_count,
                "marketplace": marketplace
            }
            
        except Exception as e:
            logger.error(f"[SYNC-FROM-MP] ❌ Ошибка {marketplace}: {e}")
            raise HTTPException(status_code=400, detail=f"Marketplace error: {str(e)}")
        
    except Exception as e:
        logger.error(f"[SYNC-FROM-MP] ❌ Критическая ошибка: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync from marketplaces: {str(e)}")
