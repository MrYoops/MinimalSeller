from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime
import uuid
from bson import ObjectId
import logging

from backend.core.database import get_database
from backend.auth_utils import get_current_user
from backend.connectors import get_connector, MarketplaceError

router = APIRouter(prefix="/api/stock-sync", tags=["stock-sync"])
logger = logging.getLogger(__name__)


async def sync_product_to_marketplace(
    db,
    user_id,
    warehouse_id: str,
    product_article: str,
    quantity: int
):
    """
    Синхронизировать остаток ОДНОГО товара на ВСЕ связанные склады маркетплейсов
    
    Логика (как в SelsUp):
    - Получить все связи склада с МП
    - Для каждой связи отправить ОДИНАКОВЫЙ остаток
    - Записать в историю синхронизации
    """
    # Получить склад
    # ИСПРАВЛЕНО: В базе данных склад хранится с _id как UUID строка (не ObjectId)
    # warehouse_id из запроса - это UUID строка, которая используется как _id
    warehouse = await db.warehouses.find_one({"_id": warehouse_id})
    
    if not warehouse:
        logger.warning(f"Warehouse {warehouse_id} not found")
        return
    
    # Проверка: передавать ли остатки?
    # Проверяем оба поля для совместимости: transfer_stock (новое) и sends_stock (старое)
    transfer_enabled = warehouse.get("transfer_stock", warehouse.get("sends_stock", True))
    if not transfer_enabled:
        logger.info(f"[SYNC] Warehouse {warehouse.get('name')} has transfer_stock=False, skipping")
        return
    
    # Получить все связи склада
    links = await db.warehouse_links.find({"warehouse_id": warehouse_id}).to_list(length=100)
    
    if not links:
        logger.warning(f"[SYNC] ⚠️ No warehouse_links found for warehouse {warehouse_id} ({warehouse.get('name')})")
        logger.warning(f"[SYNC] ⚠️ Cannot send stock to marketplaces without warehouse links!")
        logger.warning(f"[SYNC] ⚠️ Please create warehouse links in the 'Warehouses' section")
        return
    
    logger.info(f"[SYNC] Found {len(links)} marketplace links for warehouse {warehouse.get('name')}")
    
    # Получить товар для маппинга SKU
    product = await db.product_catalog.find_one({"article": product_article})
    
    if not product:
        logger.warning(f"[SYNC] Product {product_article} not found")
        return
    
    # Для каждой связи - отправить остаток
    for link in links:
        marketplace = link.get("marketplace_name")
        mp_warehouse_id = link.get("marketplace_warehouse_id")
        
        try:
            # Получить API ключ для МП
            profile = await db.seller_profiles.find_one({"user_id": user_id})
            if not profile:
                continue
            
            api_key_data = next(
                (k for k in profile.get("api_keys", []) if k.get("marketplace") == marketplace),
                None
            )
            
            if not api_key_data:
                logger.warning(f"[SYNC] No API key for {marketplace}")
                continue
            
            # Получить маркетплейс-специфичный SKU/ID из marketplace_data
            marketplace_data = product.get("marketplace_data", {}).get(marketplace, {})
            
            # Если нет данных для этого МП - пропускаем товар
            if not marketplace_data:
                logger.warning(f"[SYNC] ⚠️ Product {product_article} not imported to {marketplace}, skipping")
                logger.warning(f"[SYNC] ⚠️ Import product to {marketplace} first, then try sync again")
                continue
            
            # Для каждого МП свой идентификатор
            if marketplace == "ozon":
                # Для Ozon используем offer_id (артикул продавца)
                mp_sku = marketplace_data.get("id") or product_article
            elif marketplace in ["wb", "wildberries"]:
                # Для WB используем barcode (штрихкод)
                mp_sku = marketplace_data.get("barcode") or marketplace_data.get("id")
                if not mp_sku:
                    logger.warning(f"[SYNC] No barcode for {product_article} on WB, пропускаем")
                    continue
            elif marketplace == "yandex":
                # Для Yandex используем SKU
                mp_sku = marketplace_data.get("id") or product_article
            else:
                mp_sku = product_article
            
            logger.info(f"[SYNC] {marketplace.upper()}: {product_article} → MP SKU: {mp_sku}")
            
            # Создать коннектор
            connector = get_connector(
                marketplace,
                api_key_data.get("client_id", ""),
                api_key_data["api_key"]
            )
            
            # Обновить остаток
            if marketplace == "ozon":
                await connector.update_stock(
                    mp_warehouse_id,
                    [{"offer_id": mp_sku, "stock": quantity}]
                )
            elif marketplace in ["wb", "wildberries"]:
                await connector.update_stock(
                    mp_warehouse_id,
                    [{"sku": mp_sku, "amount": quantity}]
                )
            elif marketplace == "yandex":
                await connector.update_stock(
                    mp_warehouse_id,
                    [{"sku": mp_sku, "count": quantity}]
                )
            
            # Записать успех в историю
            await db.stock_sync_history.insert_one({
                "id": str(uuid.uuid4()),
                "warehouse_id": warehouse_id,
                "marketplace": marketplace,
                "marketplace_warehouse_id": mp_warehouse_id,
                "product_article": product_article,
                "quantity_sent": quantity,
                "status": "success",
                "error_message": None,
                "synced_at": datetime.utcnow().isoformat(),
                "user_id": str(user_id)
            })
            
            logger.info(f"[SYNC] ✅ {marketplace.upper()} {mp_warehouse_id}: {product_article} = {quantity}")
            
        except Exception as e:
            # Записать ошибку в историю
            await db.stock_sync_history.insert_one({
                "id": str(uuid.uuid4()),
                "warehouse_id": warehouse_id,
                "marketplace": marketplace,
                "marketplace_warehouse_id": mp_warehouse_id,
                "product_article": product_article,
                "quantity_sent": quantity,
                "status": "failed",
                "error_message": str(e),
                "synced_at": datetime.utcnow().isoformat(),
                "user_id": str(user_id)
            })
            
            logger.error(f"[SYNC] ❌ {marketplace.upper()} failed: {e}")


@router.post("/manual")
async def manual_sync(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Ручная синхронизация остатков
    
    Body: {
      warehouse_id: str,
      product_article: str (optional - если не указан, синхронизирует ВСЕ товары)
    }
    """
    db = await get_database()
    
    warehouse_id = data.get("warehouse_id")
    product_article = data.get("product_article")
    
    if not warehouse_id:
        raise HTTPException(status_code=400, detail="warehouse_id required")
    
    # Если указан конкретный товар
    if product_article:
        # Получить остаток из inventory
        product = await db.product_catalog.find_one({"article": product_article})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        inventory = await db.inventory.find_one({
            "product_id": ObjectId(product["_id"]) if isinstance(product["_id"], str) else product["_id"]
        })
        
        quantity = inventory.get("available", 0) if inventory else 0
        
        await sync_product_to_marketplace(
            db,
            current_user["_id"],
            warehouse_id,
            product_article,
            quantity
        )
        
        return {
            "message": f"Синхронизация запущена для {product_article}",
            "synced": 1
        }
    
    else:
        # Синхронизировать ВСЕ товары склада
        inventories = await db.inventory.find({}).to_list(length=10000)
        
        synced_count = 0
        for inv in inventories:
            product = await db.product_catalog.find_one({"_id": inv["product_id"]})
            if product:
                await sync_product_to_marketplace(
                    db,
                    current_user["_id"],
                    warehouse_id,
                    product["article"],
                    inv.get("available", 0)
                )
                synced_count += 1
        
        return {
            "message": f"Синхронизировано {synced_count} товаров",
            "synced": synced_count
        }


@router.get("/history")
async def get_sync_history(
    warehouse_id: str = None,
    marketplace: str = None,
    status: str = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Получить историю синхронизации остатков"""
    db = await get_database()
    
    query = {"user_id": str(current_user["_id"])}
    
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    if marketplace:
        query["marketplace"] = marketplace
    if status:
        query["status"] = status
    
    history = await db.stock_sync_history.find(query).sort(
        "synced_at", -1
    ).limit(limit).to_list(length=limit)
    
    # Convert ObjectId
    for record in history:
        if "_id" in record:
            record["_id"] = str(record["_id"])
        if "user_id" in record:
            record["user_id"] = str(record["user_id"])
    
    return history
