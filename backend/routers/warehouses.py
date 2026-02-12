from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from bson import ObjectId
import logging

from core.database import get_database
from auth_utils import get_current_user
from routers.warehouses_marketplace import get_marketplace_warehouses

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])
logger = logging.getLogger(__name__)


@router.get("")
async def get_warehouses(
    current_user: dict = Depends(get_current_user)
):
    """Получить список складов пользователя"""
    db = await get_database()
    
    warehouses = await db.warehouses.find({
        "user_id": str(current_user["_id"])  # Convert to string for query
    }).to_list(length=1000)
    
    # Convert ObjectId to string and ensure 'id' field exists
    for wh in warehouses:
        if "_id" in wh:
            wh["_id"] = str(wh["_id"])
        if "user_id" in wh:
            wh["user_id"] = str(wh["user_id"])
        # Если нет поля 'id', используем _id (для старых записей)
        if "id" not in wh and "_id" in wh:
            wh["id"] = str(wh["_id"])
    
    return warehouses


@router.get("/{warehouse_id}")
async def get_warehouse(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить детали склада"""
    db = await get_database()
    
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Convert ObjectId
    if "_id" in warehouse:
        warehouse["_id"] = str(warehouse["_id"])
    if "user_id" in warehouse:
        warehouse["user_id"] = str(warehouse["user_id"])
    
    return warehouse


@router.post("", status_code=201)
async def create_warehouse(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Создать склад
    
    Бизнес-логика:
    - Первый склад должен быть type="main" (основной физический склад)
    - Только один main склад на пользователя
    """
    db = await get_database()
    
    warehouse_type = data.get("type", "main")
    
    # Валидация: первый склад должен быть main
    existing_warehouses = await db.warehouses.count_documents({
        "user_id": str(current_user["_id"])
    })
    
    if existing_warehouses == 0 and warehouse_type != "main":
        raise HTTPException(
            status_code=400,
            detail="Первый склад должен быть основным (type='main')"
        )
    
    # Валидация: только один main склад
    if warehouse_type == "main":
        main_exists = await db.warehouses.find_one({
            "user_id": str(current_user["_id"]),
            "type": "main"
        })
        if main_exists:
            raise HTTPException(
                status_code=400,
                detail="Основной склад уже существует. Можно создать только один основной склад."
            )
    
    # Структура settings согласно промпту
    settings = {
        "transfer_stock": data.get("transfer_stock", True),
        "load_orders": data.get("load_orders", True),
        "use_for_orders": data.get("use_for_orders", True),
        "priority": data.get("priority", 1),
        "return_on_cancel": data.get("return_on_cancel", True)
    }
    
    warehouse = {
        "id": str(uuid.uuid4()),
        "user_id": str(current_user["_id"]),
        "name": data.get("name"),
        "type": warehouse_type,
        "address": data.get("address", ""),
        "settings": settings,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.warehouses.insert_one(warehouse)
    
    # Remove _id from response
    if "_id" in warehouse:
        del warehouse["_id"]
    
    logger.info(f"✅ Warehouse created: {warehouse['name']} (ID: {warehouse['id']})")
    
    return {
        "message": "Warehouse created successfully",
        "warehouse": warehouse
    }


@router.put("/{warehouse_id}")
async def update_warehouse(
    warehouse_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Обновить склад"""
    db = await get_database()
    
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if "name" in data:
        update_data["name"] = data["name"]
    if "address" in data:
        update_data["address"] = data["address"]
    
    # Обновление settings
    if "settings" in data:
        # Если передан объект settings, обновляем его полностью
        update_data["settings"] = data["settings"]
    else:
        # Иначе обновляем отдельные поля settings
        current_settings = warehouse.get("settings", {})
        if "transfer_stock" in data:
            current_settings["transfer_stock"] = data["transfer_stock"]
        if "load_orders" in data:
            current_settings["load_orders"] = data["load_orders"]
        if "use_for_orders" in data:
            current_settings["use_for_orders"] = data["use_for_orders"]
        if "priority" in data:
            current_settings["priority"] = data["priority"]
        if "return_on_cancel" in data:
            current_settings["return_on_cancel"] = data["return_on_cancel"]
        update_data["settings"] = current_settings
    
    await db.warehouses.update_one(
        {"id": warehouse_id},
        {"$set": update_data}
    )
    
    logger.info(f"✅ Warehouse updated: {warehouse_id}")
    
    return {
        "message": "Warehouse updated successfully"
    }


@router.delete("/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить склад"""
    db = await get_database()
    
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Нельзя удалить единственный main склад
    if warehouse.get("type") == "main":
        count = await db.warehouses.count_documents({
            "user_id": str(current_user["_id"]),
            "type": "main"
        })
        if count == 1:
            raise HTTPException(
                status_code=400,
                detail="Нельзя удалить единственный основной склад"
            )
    
    # Удалить все связи склада с маркетплейсами
    await db.warehouse_links.delete_many({"warehouse_id": warehouse_id})
    
    # Удалить остатки склада
    await db.warehouse_stock.delete_many({"warehouse_id": warehouse_id})
    
    # Удалить склад
    await db.warehouses.delete_one({"id": warehouse_id})
    
    logger.info(f"✅ Warehouse deleted: {warehouse_id}")
    
    return {
        "message": "Warehouse deleted successfully"
    }


# ========== СВЯЗИ С МАРКЕТПЛЕЙСАМИ ==========

@router.get("/{warehouse_id}/links")
async def get_warehouse_links(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить все связи склада с маркетплейсами"""
    db = await get_database()
    
    # Проверить существование склада
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    links = await db.warehouse_links.find({
        "warehouse_id": warehouse_id
    }).to_list(length=100)
    
    # Convert ObjectId
    for link in links:
        if "_id" in link:
            link["_id"] = str(link["_id"])
        if "user_id" in link:
            link["user_id"] = str(link["user_id"])
    
    return links


# ========== ЗАГРУЗКА СКЛАДОВ С МАРКЕТПЛЕЙСОВ ==========

@router.get("/mp/{integration_id}/warehouses")
async def get_marketplace_warehouses_by_integration(
    integration_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список складов с маркетплейса через integration_id (API ключ)
    
    Endpoint: GET /api/warehouses/mp/{integration_id}/warehouses
    """
    db = await get_database()
    
    # Получить API ключ
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_keys = profile.get("api_keys", [])
    api_key = None
    
    for key in api_keys:
        if str(key.get("id")) == str(integration_id):
            api_key = key
            break
    
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail=f"API key with id {integration_id} not found"
        )
    
    marketplace = api_key.get("marketplace", "").lower()
    
    # Используем существующую функцию из marketplace_warehouse_routes
    try:
        # Временно создаем объект current_user для функции get_marketplace_warehouses
        # Но лучше вызвать напрямую функции fetch_*
        from routers.warehouses_marketplace import fetch_ozon_warehouses, fetch_wb_warehouses, fetch_yandex_warehouses
        
        warehouses = []
        if marketplace == "ozon":
            warehouses = await fetch_ozon_warehouses(api_key)
        elif marketplace in ["wildberries", "wb"]:
            warehouses = await fetch_wb_warehouses(api_key)
        elif marketplace == "yandex":
            warehouses = await fetch_yandex_warehouses(api_key)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Marketplace {marketplace} not supported"
            )
        
        # Фильтруем только FBS/RFBS/DBS (не FBO)
        filtered_warehouses = [
            wh for wh in warehouses
            if wh.get("type", "").upper() in ["FBS", "RFBS", "DBS"]
        ]
        
        logger.info(f"✅ Found {len(filtered_warehouses)} warehouses from {marketplace}")
        
        return {
            "marketplace": marketplace,
            "warehouses": filtered_warehouses
        }
        
    except Exception as e:
        logger.error(f"Error fetching warehouses: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch warehouses: {str(e)}"
        )


# ========== ОСТАТКИ ==========

@router.get("/{warehouse_id}/stock")
async def get_warehouse_stock(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить остатки на складе
    
    Endpoint: GET /api/warehouses/{warehouse_id}/stock
    """
    db = await get_database()
    
    # Проверить существование склада
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Получить все остатки склада
    stock_items = await db.warehouse_stock.find({
        "warehouse_id": warehouse_id
    }).to_list(length=10000)
    
    # Convert ObjectId
    for item in stock_items:
        if "_id" in item:
            item["_id"] = str(item["_id"])
    
    return {
        "warehouse_id": warehouse_id,
        "warehouse_name": warehouse.get("name"),
        "items": stock_items,
        "total_items": len(stock_items)
    }


@router.post("/{warehouse_id}/stock/adjust")
async def adjust_warehouse_stock(
    warehouse_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Изменить остаток товара на складе и синхронизировать с маркетплейсами
    
    Body: {
        "sku": "артикул",
        "product_id": "id товара (опционально)",
        "quantity": 10,  // Новый остаток
        "min_stock": 5   // Мин. остаток для алерта (опционально)
    }
    """
    db = await get_database()
    
    # Проверить существование склада
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "user_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    sku = data.get("sku")
    product_id = data.get("product_id")
    new_quantity = data.get("quantity", 0)
    min_stock = data.get("min_stock")
    
    if not sku:
        raise HTTPException(status_code=400, detail="sku is required")
    
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    
    # Найти или создать запись остатка
    stock_item = await db.warehouse_stock.find_one({
        "warehouse_id": warehouse_id,
        "sku": sku
    })
    
    old_quantity = stock_item.get("quantity", 0) if stock_item else 0
    old_reserved = stock_item.get("reserved", 0) if stock_item else 0
    
    # Обновить или создать остаток
    stock_data = {
        "warehouse_id": warehouse_id,
        "sku": sku,
        "product_id": product_id or "",
        "quantity": new_quantity,
        "reserved": old_reserved,  # Сохраняем резерв
        "available": max(0, new_quantity - old_reserved),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if min_stock is not None:
        stock_data["min_stock"] = min_stock
    
    if stock_item:
        await db.warehouse_stock.update_one(
            {"warehouse_id": warehouse_id, "sku": sku},
            {"$set": stock_data}
        )
    else:
        stock_data["user_id"] = str(current_user["_id"])
        await db.warehouse_stock.insert_one(stock_data)
    
    # Синхронизировать с маркетплейсами, если включена передача остатков
    settings = warehouse.get("settings", {})
    if settings.get("transfer_stock", True):
        await sync_stock_to_marketplaces(warehouse_id, sku, new_quantity)
    
    logger.info(f"✅ Stock adjusted: {sku} = {old_quantity} → {new_quantity} on warehouse {warehouse_id}")
    
    return {
        "message": "Stock adjusted successfully",
        "sku": sku,
        "old_quantity": old_quantity,
        "new_quantity": new_quantity,
        "synced_to_marketplaces": settings.get("transfer_stock", True)
    }


async def sync_stock_to_marketplaces(warehouse_id: str, sku: str, new_quantity: int):
    """
    Синхронизировать остаток на ВСЕ связанные маркетплейсы
    
    Логика (как в SelSup):
    - Получить все связи склада с МП
    - Для каждой связи отправить ОДИНАКОВЫЙ остаток
    """
    db = await get_database()
    
    # Получить все связи склада
    links = await db.warehouse_links.find({
        "warehouse_id": warehouse_id
    }).to_list(length=100)
    
    if not links:
        logger.info(f"[SYNC] No marketplace links for warehouse {warehouse_id}, skipping sync")
        return
    
    # Получить API ключи для каждой связи
    profile = await db.seller_profiles.find_one({
        "api_keys.id": {"$in": [link.get("integration_id") for link in links]}
    })
    
    if not profile:
        logger.warning(f"[SYNC] Profile not found for warehouse {warehouse_id}")
        return
    
    api_keys_map = {str(key.get("id")): key for key in profile.get("api_keys", [])}
    
    # Импортируем коннекторы
    from connectors import get_connector, MarketplaceError
    
    synced_count = 0
    errors = []
    
    for link in links:
        integration_id = link.get("integration_id")
        # Используем marketplace или marketplace_name для обратной совместимости
        marketplace = (link.get("marketplace") or link.get("marketplace_name", "")).lower()
        mp_warehouse_id = link.get("marketplace_warehouse_id")
        
        if not integration_id or not marketplace or not mp_warehouse_id:
            continue
        
        api_key_data = api_keys_map.get(str(integration_id))
        if not api_key_data:
            logger.warning(f"[SYNC] API key not found for integration {integration_id}")
            continue
        
        try:
            # Создать коннектор
            connector = get_connector(
                marketplace=marketplace,
                client_id=api_key_data.get("client_id", ""),
                api_key=api_key_data.get("api_key", "")
            )
            
            # Обновить остаток на маркетплейсе
            if marketplace == "ozon":
                await connector.update_stock(
                    warehouse_id=mp_warehouse_id,
                    stocks=[{"offer_id": sku, "stock": new_quantity}]
                )
            elif marketplace in ["wb", "wildberries"]:
                await connector.update_stocks(
                    warehouse_id=int(mp_warehouse_id),
                    stocks=[{"sku": sku, "amount": new_quantity}]
                )
            elif marketplace == "yandex":
                await connector.update_stocks(
                    stocks=[{"sku": sku, "count": new_quantity}]
                )
            
            synced_count += 1
            logger.info(f"[SYNC] ✅ {marketplace.upper()}: {sku} = {new_quantity}")
            
        except MarketplaceError as e:
            error_msg = f"{marketplace}: {e.message}"
            errors.append(error_msg)
            logger.error(f"[SYNC] ❌ {error_msg}")
        except Exception as e:
            error_msg = f"{marketplace}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"[SYNC] ❌ {error_msg}")
    
    logger.info(f"[SYNC] Synced {synced_count}/{len(links)} marketplaces for {sku}")
    
    if errors:
        logger.warning(f"[SYNC] Errors: {', '.join(errors)}")
