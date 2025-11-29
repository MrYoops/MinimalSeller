from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from bson import ObjectId

from database import get_database
from auth_utils import get_current_user

router = APIRouter(prefix="/api/income-orders", tags=["income-orders"])


@router.get("")
async def get_income_orders(
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Получить список приёмок"""
    db = await get_database()
    
    query = {"user_id": str(current_user["_id"])}  # Convert to string
    
    if status:
        query["status"] = status
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    
    income_orders = await db.income_orders.find(query).sort(
        "created_at", -1
    ).to_list(length=1000)
    
    # Обогатить данными о складе и поставщике
    for order in income_orders:
        if "_id" in order:
            order["_id"] = str(order["_id"])
        if "user_id" in order:
            order["user_id"] = str(order["user_id"])
        
        if order.get("warehouse_id"):
            warehouse = await db.warehouses.find_one({"id": order["warehouse_id"]})
            order["warehouse_name"] = warehouse.get("name") if warehouse else ""
        
        if order.get("supplier_id"):
            supplier = await db.suppliers.find_one({"id": order["supplier_id"]})
            order["supplier_name"] = supplier.get("name") if supplier else ""
    
    return income_orders


@router.get("/{order_id}")
async def get_income_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить детали приёмки"""
    db = await get_database()
    
    order = await db.income_orders.find_one({
        "id": order_id,
        "user_id": str(current_user["_id"])  # Convert to string
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Income order not found")
    
    # Convert ObjectId
    if "_id" in order:
        order["_id"] = str(order["_id"])
    if "user_id" in order:
        order["user_id"] = str(order["user_id"])
    
    # Обогатить данными
    if order.get("warehouse_id"):
        warehouse = await db.warehouses.find_one({"id": order["warehouse_id"]})
        order["warehouse_name"] = warehouse.get("name") if warehouse else ""
    
    if order.get("supplier_id"):
        supplier = await db.suppliers.find_one({"id": order["supplier_id"]})
        order["supplier_name"] = supplier.get("name") if supplier else ""
    
    return order


@router.post("", status_code=201)
async def create_income_order(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Создать приёмку (черновик)"""
    db = await get_database()
    
    warehouse_id = data.get("warehouse_id")
    supplier_id = data.get("supplier_id")
    
    if warehouse_id:
        warehouse = await db.warehouses.find_one({
            "id": warehouse_id,
            "user_id": current_user["_id"]
        })
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")
    
    if supplier_id:
        supplier = await db.suppliers.find_one({
            "id": supplier_id,
            "user_id": current_user["_id"]
        })
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
    
    order = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "supplier_id": supplier_id,
        "warehouse_id": warehouse_id,
        "status": "draft",
        "items": data.get("items", []),
        "total_quantity": 0,
        "total_amount": 0,
        "accepted_at": None,
        "accepted_by": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Calculate totals
    for item in order["items"]:
        order["total_quantity"] += item.get("quantity", 0)
        order["total_amount"] += item.get("total", 0)
    
    await db.income_orders.insert_one(order)
    
    return {
        "message": "Income order created successfully",
        "order": order
    }


@router.put("/{order_id}")
async def update_income_order(
    order_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Обновить приёмку (только черновик)"""
    db = await get_database()
    
    order = await db.income_orders.find_one({
        "id": order_id,
        "user_id": current_user["_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Income order not found")
    
    if order.get("status") != "draft":
        raise HTTPException(
            status_code=400,
            detail="Cannot update accepted income order"
        )
    
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if "supplier_id" in data:
        update_data["supplier_id"] = data["supplier_id"]
    if "warehouse_id" in data:
        update_data["warehouse_id"] = data["warehouse_id"]
    if "items" in data:
        update_data["items"] = data["items"]
        
        # Recalculate totals
        total_quantity = 0
        total_amount = 0
        for item in data["items"]:
            total_quantity += item.get("quantity", 0)
            total_amount += item.get("total", 0)
        
        update_data["total_quantity"] = total_quantity
        update_data["total_amount"] = total_amount
    
    await db.income_orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    return {
        "message": "Income order updated successfully"
    }


@router.post("/{order_id}/accept")
async def accept_income_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Оприходовать приёмку (изменить остатки)"""
    db = await get_database()
    
    order = await db.income_orders.find_one({
        "id": order_id,
        "user_id": current_user["_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Income order not found")
    
    if order.get("status") != "draft":
        raise HTTPException(
            status_code=400,
            detail="Income order already accepted"
        )
    
    # Process each item
    for item in order.get("items", []):
        product_article = item.get("article")
        quantity = item.get("quantity", 0)
        
        if quantity <= 0:
            continue
        
        # Find product by article
        product = await db.product_catalog.find_one({
            "article": product_article,
            "seller_id": current_user["_id"]
        })
        
        if not product:
            continue
        
        product_id = product["_id"]
        
        # Find or create inventory record
        inventory = await db.inventory.find_one({
            "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
            "seller_id": current_user["_id"]
        })
        
        if not inventory:
            inventory = {
                "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
                "seller_id": current_user["_id"],
                "sku": product_article,
                "quantity": 0,
                "reserved": 0,
                "available": 0,
                "alert_threshold": 10
            }
            result = await db.inventory.insert_one(inventory)
            inventory["_id"] = result.inserted_id
        
        # Update quantity
        new_quantity = inventory["quantity"] + quantity
        new_available = new_quantity - inventory["reserved"]
        
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {"$set": {
                "quantity": new_quantity,
                "available": new_available
            }}
        )
        
        # Log to inventory_history
        await db.inventory_history.insert_one({
            "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
            "seller_id": current_user["_id"],
            "operation_type": "income",
            "quantity_change": quantity,
            "reason": f"Приёмка #{order_id[:8]}",
            "user_id": current_user["_id"],
            "created_at": datetime.utcnow(),
            "order_id": None,
            "shipment_id": order_id
        })
    
    # Update order status
    await db.income_orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "accepted",
            "accepted_at": datetime.utcnow().isoformat(),
            "accepted_by": str(current_user["_id"]),
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {
        "message": "Income order accepted successfully",
        "items_processed": len(order.get("items", []))
    }


@router.post("/{order_id}/cancel")
async def cancel_income_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Отменить оприходование (откат остатков)"""
    db = await get_database()
    
    order = await db.income_orders.find_one({
        "id": order_id,
        "user_id": current_user["_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Income order not found")
    
    if order.get("status") != "accepted":
        raise HTTPException(
            status_code=400,
            detail="Income order is not accepted"
        )
    
    # Reverse inventory changes
    for item in order.get("items", []):
        product_article = item.get("article")
        quantity = item.get("quantity", 0)
        
        if quantity <= 0:
            continue
        
        product = await db.product_catalog.find_one({
            "article": product_article,
            "seller_id": current_user["_id"]
        })
        
        if not product:
            continue
        
        product_id = product["_id"]
        
        inventory = await db.inventory.find_one({
            "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
            "seller_id": current_user["_id"]
        })
        
        if inventory:
            new_quantity = max(0, inventory["quantity"] - quantity)
            new_available = new_quantity - inventory["reserved"]
            
            await db.inventory.update_one(
                {"_id": inventory["_id"]},
                {"$set": {
                    "quantity": new_quantity,
                    "available": new_available
                }}
            )
            
            await db.inventory_history.insert_one({
                "product_id": ObjectId(product_id) if isinstance(product_id, str) else product_id,
                "seller_id": current_user["_id"],
                "operation_type": "income_cancel",
                "quantity_change": -quantity,
                "reason": f"Отмена приёмки #{order_id[:8]}",
                "user_id": current_user["_id"],
                "created_at": datetime.utcnow(),
                "order_id": None,
                "shipment_id": order_id
            })
    
    # Update order status back to draft
    await db.income_orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "draft",
            "accepted_at": None,
            "accepted_by": None,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {
        "message": "Income order cancelled successfully"
    }


@router.delete("/{order_id}")
async def delete_income_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить приёмку (только черновик)"""
    db = await get_database()
    
    order = await db.income_orders.find_one({
        "id": order_id,
        "user_id": current_user["_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Income order not found")
    
    if order.get("status") != "draft":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete accepted income order. Cancel it first."
        )
    
    await db.income_orders.delete_one({"id": order_id})
    
    return {
        "message": "Income order deleted successfully"
    }
