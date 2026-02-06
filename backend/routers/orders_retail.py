from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import uuid
import logging

from backend.schemas.order import OrderRetail, OrderRetailCreate, OrderRetailResponse, OrderItemNew, OrderCustomerNew, OrderTotalsNew, OrderStatusUpdateNew, OrderStatusHistory
from backend.core.database import get_database
from backend.auth_utils import get_current_user

router = APIRouter(prefix="/api/orders/retail", tags=["orders-retail"])
logger = logging.getLogger(__name__)

# Используем те же функции резерва/списания/возврата что и для FBS
from backend.routers.orders_fbs import (
    reserve_inventory_for_order,
    deduct_inventory_for_order,
    return_inventory_for_order,
    sync_stocks_after_order_change
)


@router.get("", response_model=List[OrderRetailResponse])
async def get_retail_orders(
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список розничных заказов
    """
    db = await get_database()
    
    query = {"seller_id": str(current_user["_id"])}
    
    if status:
        query["status"] = status
    if date_from:
        query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    
    orders = await db.orders_retail.find(query).sort("created_at", -1).to_list(1000)
    
    for order in orders:
        order["id"] = str(order.pop("_id"))
    
    return orders


@router.get("/{order_id}", response_model=OrderRetailResponse)
async def get_retail_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить детали розничного заказа
    """
    db = await get_database()
    
    order = await db.orders_retail.find_one({
        "_id": ObjectId(order_id),
        "seller_id": str(current_user["_id"])
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    order["id"] = str(order.pop("_id"))
    return order


@router.post("", response_model=OrderRetailResponse)
async def create_retail_order(
    order_create: OrderRetailCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Создать розничный заказ
    
    Логика:
    1. Проверить наличие на выбранном складе
    2. Зарезервировать товары
    3. Создать заказ
    """
    db = await get_database()
    
    # Проверить существование склада
    warehouse = await db.warehouses.find_one({
        "id": order_create.warehouse_id,
        "seller_id": str(current_user["_id"])
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Склад не найден")
    
    # Рассчитать totals
    subtotal = sum(item.total for item in order_create.items)
    totals = OrderTotalsNew(
        subtotal=subtotal,
        shipping_cost=0,
        marketplace_commission=0,
        seller_payout=subtotal,
        total=subtotal
    )
    
    # Зарезервировать товары
    await reserve_inventory_for_order(
        db,
        order_create.items,
        str(current_user["_id"]),
        order_create.warehouse_id
    )
    
    # Создать заказ
    order_data = {
        "seller_id": str(current_user["_id"]),
        "warehouse_id": order_create.warehouse_id,
        "source": "retail",
        "order_number": f"MM-RETAIL-{str(uuid.uuid4())[:8].upper()}",
        "status": "new",
        "reserve_status": "reserved",
        "customer": order_create.customer.dict(),
        "items": [item.dict() for item in order_create.items],
        "totals": totals.dict(),
        "payment_method": order_create.payment_method,
        "notes": order_create.notes,
        "status_history": [{
            "status": "new",
            "changed_at": datetime.utcnow(),
            "changed_by": str(current_user["_id"]),
            "comment": "Заказ создан"
        }],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.orders_retail.insert_one(order_data)
    
    # Получить созданный заказ
    created_order = await db.orders_retail.find_one({"_id": result.inserted_id})
    created_order["id"] = str(created_order.pop("_id"))
    
    logger.info(f"[RETAIL] Создан заказ {created_order['order_number']}")
    
    return created_order


@router.put("/{order_id}/status")
async def update_retail_order_status(
    order_id: str,
    status_update: OrderStatusUpdateNew,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Обновить статус розничного заказа
    """
    db = await get_database()
    
    # Найти заказ
    order = await db.orders_retail.find_one({
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
    
    # ЛОГИКА РЕЗЕРВОВ (аналогично FBS)
    
    if new_status == "completed" and old_status != "completed":
        # СПИСАНИЕ при завершении
        items = [OrderItemNew(**item) for item in order["items"]]
        await deduct_inventory_for_order(db, items, str(current_user["_id"]), order["order_number"])
        
        update_data["reserve_status"] = "deducted"
        update_data["completed_at"] = datetime.utcnow()
        
        # Синхронизировать остатки на МП
        background_tasks.add_task(sync_stocks_after_order_change, db, items, str(current_user["_id"]))
        
        logger.info(f"[RETAIL] Заказ {order['order_number']}: статус {old_status} → {new_status}, товары списаны")
    
    elif new_status == "cancelled" and order.get("reserve_status") == "reserved":
        # ВОЗВРАТ при отмене
        items = [OrderItemNew(**item) for item in order["items"]]
        await return_inventory_for_order(db, items, str(current_user["_id"]), order["warehouse_id"], order["order_number"])
        
        update_data["reserve_status"] = "returned"
        update_data["cancelled_at"] = datetime.utcnow()
        
        # Синхронизировать остатки на МП
        background_tasks.add_task(sync_stocks_after_order_change, db, items, str(current_user["_id"]))
        
        logger.info(f"[RETAIL] Заказ {order['order_number']}: статус {old_status} → {new_status}, товары возвращены")
    
    # Обновить заказ
    await db.orders_retail.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {k: v for k, v in update_data.items() if k != "$push"},
         "$push": update_data.get("$push", {})}
    )
    
    return {
        "message": f"Статус заказа обновлён: {old_status} → {new_status}",
        "order_number": order["order_number"],
        "new_status": new_status
    }


@router.delete("/{order_id}")
async def delete_retail_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Отменить розничный заказ (alias для update status = cancelled)
    """
    return await update_retail_order_status(
        order_id,
        OrderStatusUpdateNew(status="cancelled", comment="Отменён пользователем"),
        background_tasks,
        current_user
    )
