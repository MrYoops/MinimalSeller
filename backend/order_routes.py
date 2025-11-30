from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import httpx
import os

from models import (
    OrderCreate, OrderResponse, OrderStatusUpdate,
    CDEKLabelRequest, ReturnCreate, ReturnResponse,
    OrderTotals, OrderDates
)
from database import get_database

router = APIRouter(prefix="/api/orders", tags=["orders"])

# CDEK API Configuration
CDEK_API_URL = os.getenv("CDEK_API_URL", "https://api.cdek.ru/v2")
CDEK_CLIENT_ID = os.getenv("CDEK_CLIENT_ID", "")
CDEK_CLIENT_SECRET = os.getenv("CDEK_CLIENT_SECRET", "")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_seller_id() -> str:
    """
    В production это должно извлекать seller_id из JWT токена.
    Для демо возвращаем фиксированный ID.
    """
    # TODO: Implement JWT authentication
    return "demo_seller_id"

def generate_order_number(source: str, order_id: str) -> str:
    """
    Генерирует уникальный номер заказа
    MM-12345 для MinimalMod
    OZ-12345 для Ozon
    WB-12345 для Wildberries
    YM-12345 для Yandex Market
    """
    prefix_map = {
        "minimalmod": "MM",
        "ozon": "OZ",
        "wildberries": "WB",
        "yandex_market": "YM"
    }
    prefix = prefix_map.get(source, "XX")
    # Use last 5 characters of ObjectId
    short_id = order_id[-5:].upper()
    return f"{prefix}-{short_id}"

def calculate_order_totals(items: list, shipping_cost: float, marketplace_commission_rate: float) -> OrderTotals:
    """
    Рассчитывает финансовые итоги заказа
    """
    subtotal = sum(item.price * item.quantity for item in items)
    marketplace_commission = subtotal * marketplace_commission_rate
    seller_payout = subtotal - marketplace_commission
    total = subtotal + shipping_cost
    
    return OrderTotals(
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        marketplace_commission=marketplace_commission,
        seller_payout=seller_payout,
        total=total
    )


async def find_warehouse_for_order(db, user_id, required_quantity: int) -> str:
    """
    Найти склад для заказа по приоритету списания (ФАЗА 3)
    
    Логика:
    1. Получить все склады с use_for_orders=True
    2. Отсортировать по priority (1, 2, 3...)
    3. Найти первый склад с достаточным остатком
    """
    warehouses = await db.warehouses.find({
        "user_id": str(user_id),
        "use_for_orders": True
    }).sort("priority", 1).to_list(length=100)
    
    if not warehouses:
        raise HTTPException(
            status_code=400,
            detail="No warehouses configured for orders"
        )
    
    for wh in warehouses:
        # TODO: Проверить доступный остаток на этом складе
        # Для MVP возвращаем первый склад
        return wh["id"]
    
    return warehouses[0]["id"] if warehouses else None

async def reserve_inventory(db, items: list, seller_id: str):
    """
    Резервирует товары на складе при создании заказа
    """
    for item in items:
        # Find inventory record
        inventory = await db.inventory.find_one({
            "product_id": item.product_id,
            "seller_id": seller_id
        })
        
        if not inventory:
            raise HTTPException(
                status_code=400,
                detail=f"Product {item.sku} not found in inventory"
            )
        
        if inventory["available"] < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {item.sku}. Available: {inventory['available']}, Required: {item.quantity}"
            )
        
        # Reserve stock
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {
                "$inc": {
                    "reserved": item.quantity,
                    "available": -item.quantity
                }
            }
        )

async def release_inventory(db, items: list, seller_id: str):
    """
    Освобождает зарезервированные товары (при отмене заказа)
    """
    for item in items:
        await db.inventory.update_one(
            {
                "product_id": item.product_id,
                "seller_id": seller_id
            },
            {
                "$inc": {
                    "reserved": -item.quantity,
                    "available": item.quantity
                }
            }
        )

async def deduct_inventory(db, items: list, seller_id: str):
    """
    Списывает товары со склада (при отправке заказа)
    """
    for item in items:
        inventory = await db.inventory.find_one({
            "product_id": item.product_id,
            "seller_id": seller_id
        })
        
        # Deduct from quantity and reserved
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {
                "$inc": {
                    "quantity": -item.quantity,
                    "reserved": -item.quantity
                }
            }
        )
        
        # Log inventory movement
        await db.inventory_history.insert_one({
            "product_id": item.product_id,
            "seller_id": seller_id,
            "operation_type": "sale",
            "quantity_change": -item.quantity,
            "reason": f"Заказ #{item.get('order_number', 'N/A')}",
            "user_id": seller_id,
            "created_at": datetime.utcnow(),
            "order_id": item.get("order_id")
        })

async def return_inventory(db, items: list, seller_id: str, order_number: str):
    """
    Возвращает товары на склад (при возврате)
    """
    for item in items:
        await db.inventory.update_one(
            {
                "product_id": item.product_id,
                "seller_id": seller_id
            },
            {
                "$inc": {
                    "quantity": item.quantity,
                    "available": item.quantity
                }
            }
        )
        
        # Log inventory movement
        await db.inventory_history.insert_one({
            "product_id": item.product_id,
            "seller_id": seller_id,
            "operation_type": "return",
            "quantity_change": item.quantity,
            "reason": f"Возврат заказа #{order_number}",
            "user_id": seller_id,
            "created_at": datetime.utcnow()
        })

# ============================================================================
# CDEK API INTEGRATION
# ============================================================================

async def get_cdek_token() -> str:
    """
    Получает токен доступа к API СДЭК
    TODO: Implement token caching
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{CDEK_API_URL}/oauth/token",
            data={
                "grant_type": "client_credentials",
                "client_id": CDEK_CLIENT_ID,
                "client_secret": CDEK_CLIENT_SECRET
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to authenticate with CDEK API")
        
        return response.json()["access_token"]

async def create_cdek_order(order_data: dict, token: str) -> dict:
    """
    Создает заказ в СДЭК и получает накладную
    """
    async with httpx.AsyncClient() as client:
        # Create order
        response = await client.post(
            f"{CDEK_API_URL}/orders",
            headers={"Authorization": f"Bearer {token}"},
            json=order_data
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create CDEK order: {response.text}"
            )
        
        cdek_order = response.json()
        
        # Get label (накладная)
        label_response = await client.get(
            f"{CDEK_API_URL}/print/orders/{cdek_order['entity']['uuid']}.pdf",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if label_response.status_code == 200:
            # Save label to file or S3
            # For now, return the URL
            label_url = f"{CDEK_API_URL}/print/orders/{cdek_order['entity']['uuid']}.pdf"
        else:
            label_url = None
        
        return {
            "uuid": cdek_order["entity"]["uuid"],
            "tracking_number": cdek_order["entity"].get("cdek_number"),
            "label_url": label_url
        }

async def get_cdek_order_status(uuid: str, token: str) -> dict:
    """
    Получает статус заказа из СДЭК
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{CDEK_API_URL}/orders/{uuid}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get CDEK order status")
        
        return response.json()

# ============================================================================
# ORDER CRUD ENDPOINTS
# ============================================================================

@router.get("", response_model=List[OrderResponse])
async def get_orders(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить список заказов продавца с фильтрацией
    """
    db = await get_database()
    
    # Build filter query
    query = {"seller_id": seller_id}
    
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    if date_from:
        query["dates.created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "dates.created_at" in query:
            query["dates.created_at"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["dates.created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    if search:
        query["$or"] = [
            {"order_number": {"$regex": search, "$options": "i"}},
            {"customer.full_name": {"$regex": search, "$options": "i"}},
            {"items.sku": {"$regex": search, "$options": "i"}}
        ]
    
    orders = await db.orders.find(query).sort("dates.created_at", -1).to_list(1000)
    
    # Convert ObjectId to string
    for order in orders:
        order["id"] = str(order.pop("_id"))
    
    return orders

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить детали заказа
    """
    db = await get_database()
    
    order = await db.orders.find_one({
        "_id": ObjectId(order_id),
        "seller_id": seller_id
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["id"] = str(order.pop("_id"))
    return order

@router.post("", response_model=OrderResponse)
async def create_order(
    order: OrderCreate,
    background_tasks: BackgroundTasks,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Создать новый заказ
    """
    db = await get_database()
    
    # Reserve inventory
    await reserve_inventory(db, order.items, seller_id)
    
    # Calculate totals
    # Get commission rate from seller profile
    seller_profile = await db.seller_profiles.find_one({"user_id": seller_id})
    commission_rate = seller_profile.get("commission_rate", 0.15) if seller_profile else 0.15
    
    totals = calculate_order_totals(
        order.items,
        order.shipping.get("cost", 0.0) if hasattr(order.shipping, "cost") else 0.0,
        commission_rate
    )
    
    # Prepare order data
    order_data = order.dict()
    order_data["seller_id"] = seller_id
    order_data["status"] = "new"
    order_data["totals"] = totals.dict()
    order_data["dates"] = OrderDates().dict()
    
    # Insert into database
    result = await db.orders.insert_one(order_data)
    order_id = str(result.inserted_id)
    
    # Generate order number
    order_number = generate_order_number(order.source, order_id)
    await db.orders.update_one(
        {"_id": result.inserted_id},
        {"$set": {"order_number": order_number}}
    )
    
    # Schedule auto-cancellation for unpaid MinimalMod orders
    if order.source == "minimalmod" and order.payment.status == "pending":
        background_tasks.add_task(schedule_auto_cancel, order_id, seller_id)
    
    # Fetch and return created order
    created_order = await db.orders.find_one({"_id": result.inserted_id})
    created_order["id"] = str(created_order.pop("_id"))
    
    return created_order

@router.put("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status_update: OrderStatusUpdate,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Обновить статус заказа
    """
    db = await get_database()
    
    # Check if order exists
    order = await db.orders.find_one({
        "_id": ObjectId(order_id),
        "seller_id": seller_id
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {"status": status_update.status}
    
    # Update relevant date fields
    if status_update.status == "shipped":
        update_data["dates.shipped_at"] = datetime.utcnow()
        # Deduct inventory
        await deduct_inventory(db, order["items"], seller_id)
    elif status_update.status == "delivered":
        update_data["dates.delivered_at"] = datetime.utcnow()
    elif status_update.status == "cancelled":
        update_data["dates.cancelled_at"] = datetime.utcnow()
        # Release reserved inventory
        await release_inventory(db, order["items"], seller_id)
    
    # Update in database
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_data}
    )
    
    return {"message": "Order status updated successfully"}

# ============================================================================
# CDEK INTEGRATION ENDPOINTS
# ============================================================================

@router.post("/{order_id}/create-cdek-label")
async def create_cdek_label(
    order_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Создать накладную СДЭК для заказа
    """
    db = await get_database()
    
    # Get order
    order = await db.orders.find_one({
        "_id": ObjectId(order_id),
        "seller_id": seller_id
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if order is paid
    if order["payment"]["status"] != "paid":
        raise HTTPException(status_code=400, detail="Order must be paid before creating CDEK label")
    
    # Check if label already exists
    if order.get("shipping", {}).get("cdek_order_uuid"):
        raise HTTPException(status_code=400, detail="CDEK label already exists for this order")
    
    # Get CDEK token
    token = await get_cdek_token()
    
    # Prepare CDEK order data
    cdek_order_data = {
        "type": 1,  # Online store order
        "number": order["order_number"],
        "tariff_code": 136,  # Courier delivery
        "sender": {
            "name": "MinimalMod",
            # TODO: Get from seller profile
        },
        "recipient": {
            "name": order["customer"]["full_name"],
            "phones": [{"number": order["customer"]["phone"]}]
        },
        "from_location": {
            # TODO: Get from seller warehouse
            "code": 44  # Moscow
        },
        "to_location": {
            "address": order["shipping"]["address"]
        },
        "packages": [
            {
                "number": "1",
                "weight": 1000,  # TODO: Calculate from products
                "items": [
                    {
                        "name": item["name"],
                        "ware_key": item["sku"],
                        "payment": {"value": item["price"]},
                        "cost": item["price"],
                        "weight": 500,  # TODO: Get from product
                        "amount": item["quantity"]
                    }
                    for item in order["items"]
                ]
            }
        ]
    }
    
    # Create CDEK order
    try:
        cdek_result = await create_cdek_order(cdek_order_data, token)
        
        # Update order with CDEK data
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {
                "$set": {
                    "shipping.cdek_order_uuid": cdek_result["uuid"],
                    "shipping.tracking_number": cdek_result["tracking_number"],
                    "shipping.label_url": cdek_result["label_url"],
                    "shipping.status": "created",
                    "status": "awaiting_shipment"
                }
            }
        )
        
        return {
            "message": "CDEK label created successfully",
            "tracking_number": cdek_result["tracking_number"],
            "label_url": cdek_result["label_url"]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create CDEK label: {str(e)}")

@router.get("/{order_id}/cdek-status")
async def get_cdek_status(
    order_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить статус доставки из СДЭК
    """
    db = await get_database()
    
    # Get order
    order = await db.orders.find_one({
        "_id": ObjectId(order_id),
        "seller_id": seller_id
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if CDEK order exists
    cdek_uuid = order.get("shipping", {}).get("cdek_order_uuid")
    if not cdek_uuid:
        raise HTTPException(status_code=400, detail="No CDEK order found for this order")
    
    # Get CDEK token
    token = await get_cdek_token()
    
    # Get CDEK order status
    try:
        cdek_status = await get_cdek_order_status(cdek_uuid, token)
        
        # Update order status if delivered
        if cdek_status["entity"]["status"]["code"] == "DELIVERED":
            await db.orders.update_one(
                {"_id": ObjectId(order_id)},
                {
                    "$set": {
                        "status": "delivered",
                        "dates.delivered_at": datetime.utcnow(),
                        "shipping.status": "delivered"
                    }
                }
            )
        
        return {
            "status": cdek_status["entity"]["status"]["name"],
            "status_code": cdek_status["entity"]["status"]["code"],
            "tracking_number": cdek_status["entity"].get("cdek_number")
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get CDEK status: {str(e)}")

@router.post("/{order_id}/create-return-label")
async def create_return_label(
    order_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Создать обратную накладную СДЭК для возврата
    """
    # TODO: Implement return label creation
    # Similar to create_cdek_label but with reversed sender/recipient
    return {"message": "Return label creation not yet implemented"}

# ============================================================================
# RETURNS MANAGEMENT
# ============================================================================

@router.get("/returns", response_model=List[ReturnResponse])
async def get_returns(
    status: Optional[str] = Query(None),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить список возвратов
    """
    db = await get_database()
    
    query = {"seller_id": seller_id}
    if status:
        query["status"] = status
    
    returns = await db.returns.find(query).sort("created_at", -1).to_list(1000)
    
    for ret in returns:
        ret["id"] = str(ret.pop("_id"))
    
    return returns

@router.post("/returns")
async def create_return(
    return_data: ReturnCreate,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Создать возврат
    """
    db = await get_database()
    
    # Check if order exists
    order = await db.orders.find_one({
        "_id": ObjectId(return_data.order_id),
        "seller_id": seller_id
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Create return
    return_doc = return_data.dict()
    return_doc["seller_id"] = seller_id
    return_doc["status"] = "pending_review"
    return_doc["created_at"] = datetime.utcnow()
    return_doc["processed_at"] = None
    
    result = await db.returns.insert_one(return_doc)
    
    return {"id": str(result.inserted_id), "message": "Return created successfully"}

@router.put("/returns/{return_id}/accept")
async def accept_return(
    return_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Принять возврат (вернуть товар на склад)
    """
    db = await get_database()
    
    # Get return
    return_doc = await db.returns.find_one({
        "_id": ObjectId(return_id),
        "seller_id": seller_id
    })
    if not return_doc:
        raise HTTPException(status_code=404, detail="Return not found")
    
    # Get order
    order = await db.orders.find_one({"_id": ObjectId(return_doc["order_id"])})
    
    # Return items to inventory
    await return_inventory(db, return_doc["items"], seller_id, order["order_number"])
    
    # Update return status
    await db.returns.update_one(
        {"_id": ObjectId(return_id)},
        {
            "$set": {
                "status": "accepted",
                "processed_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Return accepted and inventory updated"}

@router.put("/returns/{return_id}/reject")
async def reject_return(
    return_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Отклонить возврат (списать товар)
    """
    db = await get_database()
    
    # Get return
    return_doc = await db.returns.find_one({
        "_id": ObjectId(return_id),
        "seller_id": seller_id
    })
    if not return_doc:
        raise HTTPException(status_code=404, detail="Return not found")
    
    # Update return status
    await db.returns.update_one(
        {"_id": ObjectId(return_id)},
        {
            "$set": {
                "status": "rejected",
                "processed_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Return rejected"}

# ============================================================================
# BACKGROUND TASKS
# ============================================================================

async def schedule_auto_cancel(order_id: str, seller_id: str):
    """
    Автоматически отменяет неоплаченный заказ через 1 час
    """
    import asyncio
    await asyncio.sleep(3600)  # Wait 1 hour
    
    db = await get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    
    if order and order["payment"]["status"] == "pending":
        # Cancel order
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {
                "$set": {
                    "status": "cancelled",
                    "dates.cancelled_at": datetime.utcnow()
                }
            }
        )
        
        # Release inventory
        await release_inventory(db, order["items"], seller_id)
