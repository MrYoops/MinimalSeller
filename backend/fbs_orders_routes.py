from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
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
