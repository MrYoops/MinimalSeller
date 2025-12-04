from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import logging

from models import (
    OrderFBS, OrderFBSCreate, OrderFBSResponse,
    OrderItemNew, OrderCustomerNew, OrderTotalsNew,
    OrderStatusUpdateNew, OrderStatusHistory,
    OrderSyncRequest
)
from database import get_database
from auth_utils import get_current_user
from connectors import get_connector, MarketplaceError
from stock_sync_routes import sync_product_to_marketplace

router = APIRouter(prefix="/api/orders/fbs", tags=["orders-fbs"])
logger = logging.getLogger(__name__)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def reserve_inventory_for_order(db, items: List[OrderItemNew], seller_id: str, warehouse_id: str):
    """
    Зарезервировать товары на складе при создании FBS заказа
    
    Логика:
    - reserved += quantity
    - available -= quantity
    - quantity БЕЗ изменений!
    """
    for item in items:
        # Найти товар по артикулу
        product = await db.product_catalog.find_one({
            "article": item.article,
            "seller_id": seller_id
        })
        
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Товар {item.article} не найден в каталоге"
            )
        
        product_id = product["_id"]
        
        # Найти inventory
        inventory = await db.inventory.find_one({
            "product_id": product_id,
            "seller_id": seller_id
        })
        
        if not inventory:
            raise HTTPException(
                status_code=404,
                detail=f"Остаток для товара {item.article} не найден"
            )
        
        # Проверить доступность
        if inventory.get("available", 0) < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Недостаточно остатка для {item.article}. Доступно: {inventory.get('available', 0)}, требуется: {item.quantity}"
            )
        
        # РЕЗЕРВ
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {
                "$inc": {
                    "reserved": item.quantity,
                    "available": -item.quantity
                }
            }
        )
        
        # Записать в историю
        await db.inventory_history.insert_one({
            "product_id": product_id,
            "seller_id": seller_id,
            "operation_type": "reserve",
            "quantity_change": 0,  # quantity не меняется
            "reason": f"Резерв для FBS заказа",
            "user_id": seller_id,
            "created_at": datetime.utcnow()
        })
        
        logger.info(f"[FBS] Зарезервирован товар {item.article}: {item.quantity} шт")


async def deduct_inventory_for_order(db, items: List[OrderItemNew], seller_id: str, order_number: str):
    """
    Списать товары со склада при статусе "delivering"
    
    Логика:
    - quantity -= reserved
    - reserved = 0
    - available БЕЗ изменений (уже уменьшен при резерве)
    """
    for item in items:
        # Найти товар
        product = await db.product_catalog.find_one({
            "article": item.article,
            "seller_id": seller_id
        })
        
        if not product:
            logger.error(f"[FBS] Товар {item.article} не найден при списании")
            continue
        
        product_id = product["_id"]
        
        # Найти inventory
        inventory = await db.inventory.find_one({
            "product_id": product_id,
            "seller_id": seller_id
        })
        
        if not inventory:
            logger.error(f"[FBS] Inventory для {item.article} не найден при списании")
            continue
        
        # СПИСАНИЕ
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {
                "$inc": {
                    "quantity": -item.quantity,
                    "reserved": -item.quantity
                }
            }
        )
        
        # Записать в историю
        await db.inventory_history.insert_one({
            "product_id": product_id,
            "seller_id": seller_id,
            "operation_type": "sale",
            "quantity_change": -item.quantity,
            "reason": f"Списание для заказа {order_number}",
            "user_id": seller_id,
            "created_at": datetime.utcnow()
        })
        
        logger.info(f"[FBS] Списан товар {item.article}: {item.quantity} шт (заказ {order_number})")


async def return_inventory_for_order(db, items: List[OrderItemNew], seller_id: str, warehouse_id: str, order_number: str):
    """
    Вернуть товары на склад при отмене заказа
    (только если warehouse.return_on_cancel = True)
    
    Логика:
    - reserved -= quantity
    - available += quantity
    - quantity БЕЗ изменений
    """
    # Проверить настройки склада
    warehouse = await db.warehouses.find_one({"id": warehouse_id})
    
    if not warehouse:
        logger.error(f"[FBS] Склад {warehouse_id} не найден")
        return
    
    if not warehouse.get("return_on_cancel", False):
        logger.info(f"[FBS] Возврат при отмене отключен для склада {warehouse.get('name')}")
        return
    
    for item in items:
        # Найти товар
        product = await db.product_catalog.find_one({
            "article": item.article,
            "seller_id": seller_id
        })
        
        if not product:
            logger.error(f"[FBS] Товар {item.article} не найден при возврате")
            continue
        
        product_id = product["_id"]
        
        # Найти inventory
        inventory = await db.inventory.find_one({
            "product_id": product_id,
            "seller_id": seller_id
        })
        
        if not inventory:
            logger.error(f"[FBS] Inventory для {item.article} не найден при возврате")
            continue
        
        # ВОЗВРАТ
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {
                "$inc": {
                    "reserved": -item.quantity,
                    "available": item.quantity
                }
            }
        )
        
        # Записать в историю
        await db.inventory_history.insert_one({
            "product_id": product_id,
            "seller_id": seller_id,
            "operation_type": "return",
            "quantity_change": 0,  # quantity не меняется
            "reason": f"Возврат при отмене заказа {order_number}",
            "user_id": seller_id,
            "created_at": datetime.utcnow()
        })
        
        logger.info(f"[FBS] Возвращён товар {item.article}: {item.quantity} шт (отмена {order_number})")


async def sync_stocks_after_order_change(db, items: List[OrderItemNew], seller_id: str):
    """
    Синхронизировать остатки на все маркетплейсы после изменения заказа
    """
    for item in items:
        # Получить все склады с sends_stock=True
        warehouses = await db.warehouses.find({
            "seller_id": seller_id,
            "sends_stock": True
        }).to_list(length=100)
        
        # Получить текущий available остаток
        product = await db.product_catalog.find_one({
            "article": item.article,
            "seller_id": seller_id
        })
        
        if not product:
            continue
        
        inventory = await db.inventory.find_one({
            "product_id": product["_id"],
            "seller_id": seller_id
        })
        
        if not inventory:
            continue
        
        available = inventory.get("available", 0)
        
        # Отправить на каждый склад МП
        for wh in warehouses:
            try:
                await sync_product_to_marketplace(
                    db,
                    seller_id,
                    wh["id"],
                    item.article,
                    available
                )
                logger.info(f"[FBS] Синхронизирован остаток {item.article}: {available} на {wh.get('name')}")
            except Exception as e:
                logger.error(f"[FBS] Ошибка синхронизации {item.article} на {wh.get('name')}: {e}")


# ============================================================================
# CRUD ENDPOINTS
# ============================================================================

@router.get("", response_model=List[OrderFBSResponse])
async def get_fbs_orders(
    marketplace: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список FBS заказов с фильтрацией
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
            query["created_at"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    
    orders = await db.orders_fbs.find(query).sort("created_at", -1).to_list(1000)
    
    # Convert ObjectId to string
    for order in orders:
        order["id"] = str(order.pop("_id"))
    
    return orders


@router.get("/{order_id}", response_model=OrderFBSResponse)
async def get_fbs_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить детали FBS заказа
    """
    db = await get_database()
    
    order = await db.orders_fbs.find_one({
        "_id": ObjectId(order_id),
        "seller_id": str(current_user["_id"])
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    order["id"] = str(order.pop("_id"))
    return order


@router.put("/{order_id}/status")
async def update_fbs_order_status(
    order_id: str,
    status_update: OrderStatusUpdateNew,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Обновить статус FBS заказа
    """
    db = await get_database()
    
    # Найти заказ
    order = await db.orders_fbs.find_one({
        "_id": ObjectId(order_id),
        "seller_id": str(current_user["_id"])
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    old_status = order["status"]
    new_status = status_update.status
    
    # Добавить в историю
    status_history_entry = OrderStatusHistory(
        status=new_status,
        changed_at=datetime.utcnow(),
        changed_by=str(current_user["_id"]),
        comment=status_update.comment
    ).dict()
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.utcnow(),
        "$push": {"status_history": status_history_entry}
    }
    
    # ЛОГИКА РЕЗЕРВОВ
    
    if new_status == "delivering" and old_status != "delivering":
        # СПИСАНИЕ при передаче в доставку
        items = [OrderItemNew(**item) for item in order["items"]]
        await deduct_inventory_for_order(db, items, str(current_user["_id"]), order["order_number"])
        
        update_data["reserve_status"] = "deducted"
        
        # Синхронизировать остатки на МП
        background_tasks.add_task(sync_stocks_after_order_change, db, items, str(current_user["_id"]))
        
        logger.info(f"[FBS] Заказ {order['order_number']}: статус {old_status} → {new_status}, товары списаны")
    
    elif new_status == "cancelled" and order.get("reserve_status") == "reserved":
        # ВОЗВРАТ при отмене (если есть резерв и настройка return_on_cancel)
        items = [OrderItemNew(**item) for item in order["items"]]
        await return_inventory_for_order(db, items, str(current_user["_id"]), order["warehouse_id"], order["order_number"])
        
        update_data["reserve_status"] = "returned"
        update_data["cancelled_at"] = datetime.utcnow()
        
        # Синхронизировать остатки на МП
        background_tasks.add_task(sync_stocks_after_order_change, db, items, str(current_user["_id"]))
        
        logger.info(f"[FBS] Заказ {order['order_number']}: статус {old_status} → {new_status}, товары возвращены")
    
    elif new_status == "delivered":
        update_data["delivered_at"] = datetime.utcnow()
    
    # Обновить заказ
    await db.orders_fbs.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {k: v for k, v in update_data.items() if k != "$push"},
         "$push": update_data.get("$push", {})}
    )
    
    return {
        "message": f"Статус заказа обновлён: {old_status} → {new_status}",
        "order_number": order["order_number"],
        "new_status": new_status
    }


@router.post("/import")
async def import_fbs_orders(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    РУЧНАЯ ЗАГРУЗКА заказов FBS за период
    
    Body: {
        integration_id: str (ID интеграции из seller_profiles.api_keys),
        date_from: str (ISO date),
        date_to: str (ISO date),
        update_stock: bool (списывать ли товары со склада)
    }
    """
    db = await get_database()
    
    integration_id = data.get("integration_id")
    date_from_str = data.get("date_from")
    date_to_str = data.get("date_to")
    update_stock = data.get("update_stock", True)
    
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id обязателен")
    
    if not date_from_str or not date_to_str:
        raise HTTPException(status_code=400, detail="date_from и date_to обязательны")
    
    date_from = datetime.fromisoformat(date_from_str)
    date_to = datetime.fromisoformat(date_to_str)
    
    # Получить конкретную интеграцию
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    
    api_keys = profile.get("api_keys", [])
    selected_integration = next((k for k in api_keys if k.get("id") == integration_id), None)
    
    if not selected_integration:
        raise HTTPException(status_code=404, detail="Интеграция не найдена")
    
    marketplace = selected_integration.get("marketplace")
    
    imported_count = 0
    updated_count = 0
    stock_updated_count = 0
    errors = []
    
    # Использовать ТОЛЬКО выбранную интеграцию
    try:
        connector = get_connector(
            marketplace,
            selected_integration.get("client_id", ""),
            selected_integration["api_key"]
        )
        
        # Получить FBS заказы
        if marketplace == "ozon":
            mp_orders = await connector.get_fbs_orders(date_from, date_to)
        elif marketplace in ["wb", "wildberries"]:
            mp_orders = await connector.get_orders(date_from, date_to)
        elif marketplace == "yandex":
            campaign_id = selected_integration.get("metadata", {}).get("campaign_id")
            if not campaign_id:
                raise HTTPException(status_code=400, detail="campaign_id не найден для Yandex")
            mp_orders = await connector.get_orders(date_from, date_to, campaign_id)
        else:
            raise HTTPException(status_code=400, detail=f"Неизвестный маркетплейс: {marketplace}")
            
            logger.info(f"[FBS Import] {marketplace}: получено {len(mp_orders)} заказов")
            
            # Обработать каждый заказ
            for mp_order_data in mp_orders:
                # Парсинг данных заказа
                if marketplace == "ozon":
                    external_id = mp_order_data.get("posting_number")
                    mp_status = mp_order_data.get("status")
                    products = mp_order_data.get("products", [])
                    
                    items = []
                    total_sum = 0
                    
                    for prod in products:
                        offer_id = prod.get("offer_id")
                        quantity = prod.get("quantity", 1)
                        price = float(prod.get("price", 0))
                        
                        # Найти товар в системе
                        product = await db.product_catalog.find_one({
                            "article": offer_id,
                            "seller_id": str(current_user["_id"])
                        })
                        
                        if product:
                            items.append({
                                "product_id": str(product["_id"]),
                                "article": offer_id,
                                "name": prod.get("name", product.get("name", "")),
                                "price": price,
                                "quantity": quantity,
                                "total": price * quantity
                            })
                            total_sum += price * quantity
                    
                    customer_data = {
                        "full_name": (mp_order_data.get("customer") or {}).get("name", ""),
                        "phone": (mp_order_data.get("customer") or {}).get("phone", ""),
                        "address": (mp_order_data.get("delivery_method") or {}).get("address", "")
                    }
                    
                elif marketplace in ["wb", "wildberries"]:
                    external_id = str(mp_order_data.get("id"))
                    mp_status = mp_order_data.get("wbStatus", 0)
                    
                    # TODO: парсинг WB заказов
                    items = []
                    total_sum = 0
                    customer_data = {"full_name": "", "phone": ""}
                    
                elif marketplace == "yandex":
                    external_id = str(mp_order_data.get("id"))
                    mp_status = mp_order_data.get("status")
                    
                    # TODO: парсинг Yandex заказов
                    items = []
                    total_sum = 0
                    customer_data = {"full_name": "", "phone": ""}
                
                else:
                    continue
                
                if not external_id or not items:
                    continue
                
                # Проверить существует ли заказ
                existing = await db.orders_fbs.find_one({
                    "external_order_id": external_id,
                    "seller_id": str(current_user["_id"])
                })
                
                if existing:
                    updated_count += 1
                    continue
                
                # Найти склад с use_for_orders=True
                warehouse = await db.warehouses.find_one({
                    "seller_id": str(current_user["_id"]),
                    "use_for_orders": True
                })
                
                if not warehouse:
                    errors.append({"order": external_id, "error": "Склад для заказов не найден"})
                    continue
                
                # СОЗДАТЬ ЗАКАЗ
                order_doc = {
                    "seller_id": str(current_user["_id"]),
                    "warehouse_id": warehouse["id"],
                    "marketplace": marketplace,
                    "external_order_id": external_id,
                    "order_number": f"FBS-{marketplace.upper()}-{external_id[:8]}",
                    "status": "imported",
                    "stock_updated": update_stock,
                    "customer": customer_data,
                    "items": items,
                    "totals": {
                        "subtotal": total_sum,
                        "shipping_cost": 0,
                        "marketplace_commission": 0,
                        "seller_payout": total_sum,
                        "total": total_sum
                    },
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await db.orders_fbs.insert_one(order_doc)
                imported_count += 1
                
                # ОБНОВИТЬ ОСТАТКИ (если чекбокс включен)
                if update_stock:
                    for item in items:
                        product = await db.product_catalog.find_one({
                            "article": item["article"],
                            "seller_id": str(current_user["_id"])
                        })
                        
                        if not product:
                            continue
                        
                        inventory = await db.inventory.find_one({
                            "product_id": product["_id"],
                            "seller_id": str(current_user["_id"])
                        })
                        
                        if not inventory:
                            continue
                        
                        # СПИСАТЬ СО СКЛАДА
                        new_qty = max(0, inventory.get("quantity", 0) - item["quantity"])
                        new_avail = max(0, inventory.get("available", 0) - item["quantity"])
                        
                        await db.inventory.update_one(
                            {"_id": inventory["_id"]},
                            {"$set": {
                                "quantity": new_qty,
                                "available": new_avail
                            }}
                        )
                        
                        # Записать в историю
                        await db.inventory_history.insert_one({
                            "product_id": product["_id"],
                            "seller_id": str(current_user["_id"]),
                            "operation_type": "fbs_order",
                            "quantity_change": -item["quantity"],
                            "reason": f"FBS заказ {order_doc['order_number']}",
                            "user_id": str(current_user["_id"]),
                            "created_at": datetime.utcnow()
                        })
                        
                        stock_updated_count += 1
                        
                        logger.info(f"[FBS Import] Списан товар {item['article']}: -{item['quantity']} шт")
    
    except Exception as e:
        logger.error(f"[FBS Import] Ошибка {marketplace}: {e}")
        errors.append({"marketplace": marketplace, "error": str(e)})
    
    return {
        "message": f"Загружено {imported_count} заказов",
        "imported": imported_count,
        "updated": updated_count,
        "stock_updated": stock_updated_count if update_stock else 0,
        "errors": errors
    }


@router.post("/sync")
async def sync_fbs_orders(
    sync_request: OrderSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Ручная синхронизация FBS заказов с маркетплейсов
    
    Обычно эта функция вызывается автоматически каждые 5 минут,
    но можно запустить вручную.
    """
    db = await get_database()
    
    # Получить API ключи пользователя
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Профиль продавца не найден")
    
    api_keys = profile.get("api_keys", [])
    
    if not api_keys:
        raise HTTPException(status_code=400, detail="API ключи не настроены")
    
    # Период синхронизации
    date_from = sync_request.date_from or (datetime.utcnow() - timedelta(days=1))
    date_to = sync_request.date_to or datetime.utcnow()
    
    synced_count = 0
    updated_count = 0
    errors = []
    
    # Для каждого МП
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
            
            # Получить FBS заказы с МП
            mp_orders = await connector.get_fbs_orders(date_from, date_to)
            
            # Обработать каждый заказ
            for mp_order_data in mp_orders:
                # Извлечь external_order_id в зависимости от МП
                if marketplace == "ozon":
                    external_id = mp_order_data.get("posting_number")
                    mp_status = mp_order_data.get("status")
                elif marketplace == "wb":
                    external_id = str(mp_order_data.get("id"))
                    mp_status = mp_order_data.get("wbStatus")
                elif marketplace == "yandex":
                    external_id = str(mp_order_data.get("id"))
                    mp_status = mp_order_data.get("status")
                else:
                    continue
                
                # Проверить существует ли заказ
                existing = await db.orders_fbs.find_one({
                    "external_order_id": external_id,
                    "seller_id": str(current_user["_id"])
                })
                
                if not existing:
                    # СОЗДАТЬ НОВЫЙ ЗАКАЗ + ЗАРЕЗЕРВИРОВАТЬ
                    # TODO: Парсинг данных заказа (items, customer, totals)
                    # Пока просто считаем
                    synced_count += 1
                else:
                    # ОБНОВИТЬ СТАТУС
                    # TODO: Обновление статуса если изменился
                    updated_count += 1
        
        except Exception as e:
            logger.error(f"[FBS Sync] Ошибка синхронизации {marketplace}: {e}")
            errors.append({"marketplace": marketplace, "error": str(e)})
    
    return {
        "message": "Синхронизация завершена",
        "synced": synced_count,
        "updated": updated_count,
        "errors": errors
    }
