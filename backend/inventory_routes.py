from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from models import (
    Inventory, FBOInventory, InventoryHistory, FBOShipment, FBOShipmentItem,
    InventoryAdjustment, InventoryResponse, FBOInventoryResponse,
    InventoryHistoryResponse, FBOShipmentResponse
)
from auth_utils import get_current_user
from database import get_database

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def update_available_quantity(db: AsyncIOMotorDatabase, product_id: str, seller_id: str):
    """Пересчитать available = quantity - reserved"""
    inventory = await db.inventory.find_one({"product_id": product_id, "seller_id": seller_id})
    if inventory:
        available = inventory["quantity"] - inventory["reserved"]
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {"$set": {"available": available}}
        )
        return available
    return 0


async def log_inventory_movement(
    db: AsyncIOMotorDatabase,
    product_id: str,
    seller_id: str,
    operation_type: str,
    quantity_change: int,
    reason: str,
    user_id: str,
    order_id: Optional[str] = None,
    shipment_id: Optional[str] = None
):
    """Записать движение в историю"""
    movement = {
        "product_id": product_id,
        "seller_id": seller_id,
        "operation_type": operation_type,
        "quantity_change": quantity_change,
        "reason": reason,
        "user_id": user_id,
        "created_at": datetime.utcnow(),
        "order_id": order_id,
        "shipment_id": shipment_id
    }
    await db.inventory_history.insert_one(movement)


async def sync_stock_to_marketplaces(db: AsyncIOMotorDatabase, product_id: str, seller_id: str, new_quantity: int):
    """
    Синхронизировать остатки на все маркетплейсы (FBS)
    TODO: Реализовать вызовы API маркетплейсов через connectors
    """
    # Получить список активных маркетплейсов продавца
    seller_profile = await db.seller_profiles.find_one({"user_id": ObjectId(seller_id)})
    if not seller_profile:
        return
    
    # Получить товар
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        return
    
    # Для каждого маркетплейса, где включен товар
    marketplaces = product.get("marketplaces", {})
    
    # TODO: Вызвать API каждого маркетплейса для обновления остатков
    # Пример:
    # if marketplaces.get("ozon", {}).get("enabled"):
    #     await ozon_connector.update_stock(sku=product["sku"], quantity=new_quantity)
    # if marketplaces.get("wildberries", {}).get("enabled"):
    #     await wb_connector.update_stock(sku=product["sku"], quantity=new_quantity)
    
    print(f"[SYNC] Product {product['sku']} stock updated to {new_quantity} on all marketplaces")


# ============================================================================
# FBS INVENTORY ENDPOINTS
# ============================================================================

@router.get("/fbs", response_model=List[InventoryResponse])
async def get_fbs_inventory(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Получить все остатки FBS (собственный склад) продавца"""
    seller_id = str(current_user["_id"])
    
    # Получить все записи inventory
    cursor = db.inventory.find({"seller_id": seller_id})
    inventory_list = await cursor.to_list(length=1000)
    
    # Обогатить данными о товарах
    result = []
    for inv in inventory_list:
        product = await db.products.find_one({"_id": ObjectId(inv["product_id"])})
        product_name = product.get("minimalmod", {}).get("name", "") if product else ""
        product_image = product.get("minimalmod", {}).get("images", [""])[0] if product else ""
        
        result.append(InventoryResponse(
            id=str(inv["_id"]),
            product_id=inv["product_id"],
            seller_id=inv["seller_id"],
            sku=inv["sku"],
            quantity=inv["quantity"],
            reserved=inv["reserved"],
            available=inv["available"],
            alert_threshold=inv.get("alert_threshold", 10),
            product_name=product_name,
            product_image=product_image
        ))
    
    return result


@router.post("/fbs/{product_id}/adjust")
async def adjust_fbs_inventory(
    product_id: str,
    adjustment: InventoryAdjustment,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Ручная корректировка остатков FBS"""
    seller_id = str(current_user["_id"])
    user_id = str(current_user["_id"])
    
    # Проверить, что товар принадлежит продавцу
    product = await db.products.find_one({"_id": ObjectId(product_id), "seller_id": ObjectId(seller_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Найти или создать запись inventory
    inventory = await db.inventory.find_one({"product_id": product_id, "seller_id": seller_id})
    
    if not inventory:
        # Создать новую запись
        inventory = {
            "product_id": product_id,
            "seller_id": seller_id,
            "sku": product["sku"],
            "quantity": 0,
            "reserved": 0,
            "available": 0,
            "alert_threshold": 10
        }
        result = await db.inventory.insert_one(inventory)
        inventory["_id"] = result.inserted_id
    
    # Применить изменение
    new_quantity = inventory["quantity"] + adjustment.quantity_change
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    
    await db.inventory.update_one(
        {"_id": inventory["_id"]},
        {"$set": {"quantity": new_quantity}}
    )
    
    # Пересчитать available
    new_available = await update_available_quantity(db, product_id, seller_id)
    
    # Записать в историю
    await log_inventory_movement(
        db=db,
        product_id=product_id,
        seller_id=seller_id,
        operation_type="manual_in" if adjustment.quantity_change > 0 else "manual_out",
        quantity_change=adjustment.quantity_change,
        reason=adjustment.reason,
        user_id=user_id
    )
    
    # Синхронизировать с маркетплейсами
    await sync_stock_to_marketplaces(db, product_id, seller_id, new_available)
    
    return {"message": "Inventory adjusted successfully", "new_quantity": new_quantity, "new_available": new_available}


@router.put("/fbs/{product_id}/alert-threshold")
async def update_alert_threshold(
    product_id: str,
    threshold: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Обновить порог алерта для товара"""
    seller_id = str(current_user["_id"])
    
    result = await db.inventory.update_one(
        {"product_id": product_id, "seller_id": seller_id},
        {"$set": {"alert_threshold": threshold}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inventory record not found")
    
    return {"message": "Alert threshold updated"}


# ============================================================================
# FBO INVENTORY ENDPOINTS
# ============================================================================

@router.get("/fbo", response_model=List[FBOInventoryResponse])
async def get_fbo_inventory(
    marketplace: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Получить остатки FBO (склады маркетплейсов)"""
    seller_id = str(current_user["_id"])
    
    query = {"seller_id": seller_id}
    if marketplace:
        query["marketplace"] = marketplace
    
    cursor = db.fbo_inventory.find(query)
    fbo_list = await cursor.to_list(length=1000)
    
    result = []
    for fbo in fbo_list:
        product = await db.products.find_one({"_id": ObjectId(fbo["product_id"])})
        product_name = product.get("minimalmod", {}).get("name", "") if product else ""
        product_image = product.get("minimalmod", {}).get("images", [""])[0] if product else ""
        
        result.append(FBOInventoryResponse(
            id=str(fbo["_id"]),
            product_id=fbo["product_id"],
            seller_id=fbo["seller_id"],
            sku=fbo["sku"],
            marketplace=fbo["marketplace"],
            warehouse_name=fbo["warehouse_name"],
            quantity=fbo["quantity"],
            product_name=product_name,
            product_image=product_image
        ))
    
    return result


@router.post("/fbo/sync")
async def sync_fbo_inventory(
    marketplace: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Принудительная синхронизация остатков FBO с маркетплейсами"""
    seller_id = str(current_user["_id"])
    
    # TODO: Реализовать вызовы API маркетплейсов для получения остатков FBO
    # Пример:
    # if marketplace == "ozon" or marketplace is None:
    #     fbo_stocks = await ozon_connector.get_fbo_stocks()
    #     for stock in fbo_stocks:
    #         await db.fbo_inventory.update_one(
    #             {"product_id": stock["product_id"], "marketplace": "ozon", "warehouse_name": stock["warehouse"]},
    #             {"$set": {"quantity": stock["quantity"]}},
    #             upsert=True
    #         )
    
    return {"message": "FBO inventory sync initiated"}


# ============================================================================
# FBO SHIPMENTS ENDPOINTS
# ============================================================================

@router.post("/fbo/shipments", response_model=FBOShipmentResponse)
async def create_fbo_shipment(
    shipment: FBOShipment,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Создать поставку на склад маркетплейса (FBO)"""
    seller_id = str(current_user["_id"])
    user_id = str(current_user["_id"])
    
    # Проверить, что все товары принадлежат продавцу и есть достаточно остатков
    for item in shipment.items:
        product = await db.products.find_one({"_id": ObjectId(item.product_id), "seller_id": ObjectId(seller_id)})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        inventory = await db.inventory.find_one({"product_id": item.product_id, "seller_id": seller_id})
        if not inventory or inventory["available"] < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for product {product['sku']}. Available: {inventory['available'] if inventory else 0}, Required: {item.quantity}"
            )
    
    # Создать документ поставки
    shipment_doc = {
        "seller_id": seller_id,
        "marketplace": shipment.marketplace,
        "warehouse_name": shipment.warehouse_name,
        "items": [item.dict() for item in shipment.items],
        "status": "draft",
        "created_at": datetime.utcnow(),
        "sent_at": None,
        "received_at": None,
        "created_by": user_id
    }
    result = await db.fbo_shipments.insert_one(shipment_doc)
    shipment_id = str(result.inserted_id)
    
    # Списать остатки с FBS и записать в историю
    for item in shipment.items:
        inventory = await db.inventory.find_one({"product_id": item.product_id, "seller_id": seller_id})
        new_quantity = inventory["quantity"] - item.quantity
        
        await db.inventory.update_one(
            {"_id": inventory["_id"]},
            {"$set": {"quantity": new_quantity}}
        )
        
        await update_available_quantity(db, item.product_id, seller_id)
        
        await log_inventory_movement(
            db=db,
            product_id=item.product_id,
            seller_id=seller_id,
            operation_type="fbo_shipment",
            quantity_change=-item.quantity,
            reason=f"Поставка на FBO #{shipment_id}",
            user_id=user_id,
            shipment_id=shipment_id
        )
    
    # Обновить статус на "sent"
    await db.fbo_shipments.update_one(
        {"_id": result.inserted_id},
        {"$set": {"status": "sent", "sent_at": datetime.utcnow()}}
    )
    
    return FBOShipmentResponse(
        id=shipment_id,
        seller_id=seller_id,
        marketplace=shipment.marketplace,
        warehouse_name=shipment.warehouse_name,
        items=shipment.items,
        status="sent",
        created_at=shipment_doc["created_at"],
        sent_at=datetime.utcnow(),
        received_at=None,
        created_by=user_id
    )


@router.get("/fbo/shipments", response_model=List[FBOShipmentResponse])
async def get_fbo_shipments(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Получить список поставок FBO"""
    seller_id = str(current_user["_id"])
    
    cursor = db.fbo_shipments.find({"seller_id": seller_id}).sort("created_at", -1)
    shipments = await cursor.to_list(length=1000)
    
    result = []
    for shipment in shipments:
        result.append(FBOShipmentResponse(
            id=str(shipment["_id"]),
            seller_id=shipment["seller_id"],
            marketplace=shipment["marketplace"],
            warehouse_name=shipment["warehouse_name"],
            items=[FBOShipmentItem(**item) for item in shipment["items"]],
            status=shipment["status"],
            created_at=shipment["created_at"],
            sent_at=shipment.get("sent_at"),
            received_at=shipment.get("received_at"),
            created_by=shipment["created_by"]
        ))
    
    return result


# ============================================================================
# INVENTORY HISTORY ENDPOINTS
# ============================================================================

@router.get("/history", response_model=List[InventoryHistoryResponse])
async def get_inventory_history(
    product_id: Optional[str] = None,
    operation_type: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Получить историю движений по складу"""
    seller_id = str(current_user["_id"])
    
    query = {"seller_id": seller_id}
    if product_id:
        query["product_id"] = product_id
    if operation_type:
        query["operation_type"] = operation_type
    
    cursor = db.inventory_history.find(query).sort("created_at", -1).limit(limit)
    history = await cursor.to_list(length=limit)
    
    result = []
    for record in history:
        product = await db.products.find_one({"_id": ObjectId(record["product_id"])})
        product_name = product.get("minimalmod", {}).get("name", "") if product else ""
        sku = product.get("sku", "") if product else ""
        
        result.append(InventoryHistoryResponse(
            id=str(record["_id"]),
            product_id=record["product_id"],
            seller_id=record["seller_id"],
            operation_type=record["operation_type"],
            quantity_change=record["quantity_change"],
            reason=record["reason"],
            user_id=record["user_id"],
            created_at=record["created_at"],
            order_id=record.get("order_id"),
            shipment_id=record.get("shipment_id"),
            product_name=product_name,
            sku=sku
        ))
    
    return result
