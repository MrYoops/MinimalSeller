from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from bson import ObjectId
from passlib.context import CryptContext

from backend.core.database import get_database

router = APIRouter(prefix="/api/admin", tags=["admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_admin_id() -> str:
    """
    Get current admin ID from JWT token
    TODO: Implement JWT authentication with role check
    """
    # TODO: Check if user has admin role
    return "admin_user_id"

# ============================================================================
# SELLER MANAGEMENT
# ============================================================================

@router.get("/sellers")
async def get_all_sellers(
    status: Optional[str] = Query(None, regex="^(active|inactive|pending)$"),
    search: Optional[str] = Query(None),
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Получить список всех продавцов
    """
    db = await get_database()
    
    # Build query
    query = {"role": "seller"}
    
    if status:
        if status == "active":
            query["is_active"] = True
        elif status == "inactive":
            query["is_active"] = False
        elif status == "pending":
            query["is_active"] = False
    
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    
    # Get sellers
    sellers = await db.users.find(query).to_list(1000)
    
    # Get seller profiles
    result = []
    for seller in sellers:
        profile = await db.seller_profiles.find_one({"user_id": str(seller["_id"])})
        
        result.append({
            "id": str(seller["_id"]),
            "email": seller["email"],
            "full_name": seller["full_name"],
            "is_active": seller.get("is_active", False),
            "created_at": seller.get("created_at"),
            "last_login_at": seller.get("last_login_at"),
            "company_name": profile.get("company_name") if profile else None,
            "inn": profile.get("inn") if profile else None,
            "commission_rate": profile.get("commission_rate", 0.15) if profile else 0.15
        })
    
    return {
        "total": len(result),
        "sellers": result
    }

@router.get("/sellers/{seller_id}")
async def get_seller_details(
    seller_id: str,
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Получить детальную информацию о продавце
    """
    db = await get_database()
    
    # Get seller
    seller = await db.users.find_one({"_id": ObjectId(seller_id), "role": "seller"})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Get profile
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    
    # Get statistics
    total_products = await db.products.count_documents({"seller_id": seller_id})
    total_orders = await db.orders.count_documents({"seller_id": seller_id})
    
    # Get revenue (last 30 days)
    start_date = datetime.utcnow() - timedelta(days=30)
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    total_revenue = sum(order["totals"]["subtotal"] for order in orders)
    platform_commission = sum(order["totals"]["marketplace_commission"] for order in orders)
    
    return {
        "id": str(seller["_id"]),
        "email": seller["email"],
        "full_name": seller["full_name"],
        "is_active": seller.get("is_active", False),
        "created_at": seller.get("created_at"),
        "last_login_at": seller.get("last_login_at"),
        "profile": {
            "company_name": profile.get("company_name") if profile else None,
            "inn": profile.get("inn") if profile else None,
            "commission_rate": profile.get("commission_rate", 0.15) if profile else 0.15,
            "api_keys": len(profile.get("api_keys", [])) if profile else 0
        },
        "statistics": {
            "total_products": total_products,
            "total_orders": total_orders,
            "revenue_30d": round(total_revenue, 2),
            "platform_commission_30d": round(platform_commission, 2)
        }
    }

@router.put("/sellers/{seller_id}/activate")
async def activate_seller(
    seller_id: str,
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Активировать продавца
    """
    db = await get_database()
    
    result = await db.users.update_one(
        {"_id": ObjectId(seller_id), "role": "seller"},
        {"$set": {"is_active": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    return {"message": "Seller activated successfully"}

@router.put("/sellers/{seller_id}/deactivate")
async def deactivate_seller(
    seller_id: str,
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Деактивировать продавца
    """
    db = await get_database()
    
    result = await db.users.update_one(
        {"_id": ObjectId(seller_id), "role": "seller"},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    return {"message": "Seller deactivated successfully"}

@router.put("/sellers/{seller_id}/commission")
async def update_seller_commission(
    seller_id: str,
    commission_rate: float = Query(..., ge=0.0, le=1.0),
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Обновить комиссию продавца
    """
    db = await get_database()
    
    result = await db.seller_profiles.update_one(
        {"user_id": seller_id},
        {"$set": {"commission_rate": commission_rate}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    return {"message": "Commission rate updated successfully"}

@router.delete("/sellers/{seller_id}")
async def delete_seller(
    seller_id: str,
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Удалить продавца (только если нет активных заказов)
    """
    db = await get_database()
    
    # Check for active orders
    active_orders = await db.orders.count_documents({
        "seller_id": seller_id,
        "status": {"$in": ["new", "awaiting_shipment", "shipped"]}
    })
    
    if active_orders > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete seller with {active_orders} active orders"
        )
    
    # Delete seller and related data
    await db.users.delete_one({"_id": ObjectId(seller_id)})
    await db.seller_profiles.delete_one({"user_id": seller_id})
    await db.products.delete_many({"seller_id": seller_id})
    await db.inventory.delete_many({"seller_id": seller_id})
    
    return {"message": "Seller deleted successfully"}

# ============================================================================
# PLATFORM STATISTICS
# ============================================================================

@router.get("/statistics/overview")
async def get_platform_overview(
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Получить общую статистику платформы
    """
    db = await get_database()
    
    # Count sellers
    total_sellers = await db.users.count_documents({"role": "seller"})
    active_sellers = await db.users.count_documents({"role": "seller", "is_active": True})
    
    # Count products
    total_products = await db.products.count_documents({})
    
    # Count orders (last 30 days)
    start_date = datetime.utcnow() - timedelta(days=30)
    total_orders_30d = await db.orders.count_documents({
        "dates.created_at": {"$gte": start_date}
    })
    
    # Calculate revenue
    orders = await db.orders.find({
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(100000)
    
    total_revenue = sum(order["totals"]["subtotal"] for order in orders)
    platform_commission = sum(order["totals"]["marketplace_commission"] for order in orders)
    
    return {
        "sellers": {
            "total": total_sellers,
            "active": active_sellers,
            "inactive": total_sellers - active_sellers
        },
        "products": {
            "total": total_products
        },
        "orders_30d": {
            "total": total_orders_30d,
            "revenue": round(total_revenue, 2),
            "platform_commission": round(platform_commission, 2)
        }
    }

@router.get("/statistics/revenue-chart")
async def get_platform_revenue_chart(
    period: str = Query("month", regex="^(week|month|year)$"),
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Получить график выручки платформы
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "week":
        start_date = now - timedelta(weeks=1)
        group_by = "day"
    elif period == "month":
        start_date = now - timedelta(days=30)
        group_by = "day"
    else:  # year
        start_date = now - timedelta(days=365)
        group_by = "month"
    
    # Get orders
    orders = await db.orders.find({
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(100000)
    
    # Group by period
    from collections import defaultdict
    data_points = defaultdict(lambda: {"revenue": 0.0, "commission": 0.0, "orders": 0})
    
    for order in orders:
        date = order["dates"]["created_at"]
        if group_by == "day":
            key = date.strftime("%Y-%m-%d")
        else:  # month
            key = date.strftime("%Y-%m")
        
        data_points[key]["revenue"] += order["totals"]["subtotal"]
        data_points[key]["commission"] += order["totals"]["marketplace_commission"]
        data_points[key]["orders"] += 1
    
    # Convert to list and sort
    chart_data = [
        {
            "date": key,
            "revenue": round(value["revenue"], 2),
            "commission": round(value["commission"], 2),
            "orders": value["orders"]
        }
        for key, value in sorted(data_points.items())
    ]
    
    return {
        "period": period,
        "group_by": group_by,
        "data": chart_data
    }

@router.get("/statistics/top-sellers")
async def get_top_sellers(
    period: str = Query("month", regex="^(week|month|year)$"),
    limit: int = Query(10, ge=1, le=50),
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Получить топ продавцов по выручке
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get orders
    orders = await db.orders.find({
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(100000)
    
    # Group by seller
    from collections import defaultdict
    seller_stats = defaultdict(lambda: {"revenue": 0.0, "orders": 0, "commission": 0.0})
    
    for order in orders:
        seller_id = order["seller_id"]
        seller_stats[seller_id]["revenue"] += order["totals"]["subtotal"]
        seller_stats[seller_id]["orders"] += 1
        seller_stats[seller_id]["commission"] += order["totals"]["marketplace_commission"]
    
    # Get seller details and convert to list
    top_sellers = []
    for seller_id, stats in seller_stats.items():
        seller = await db.users.find_one({"_id": ObjectId(seller_id)})
        if seller:
            top_sellers.append({
                "seller_id": seller_id,
                "email": seller["email"],
                "full_name": seller["full_name"],
                "revenue": round(stats["revenue"], 2),
                "orders": stats["orders"],
                "commission": round(stats["commission"], 2)
            })
    
    # Sort by revenue
    top_sellers.sort(key=lambda x: x["revenue"], reverse=True)
    
    return {
        "period": period,
        "sellers": top_sellers[:limit]
    }

# ============================================================================
# SYSTEM SETTINGS
# ============================================================================

@router.get("/settings")
async def get_platform_settings(
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Получить настройки платформы
    """
    db = await get_database()
    
    settings = await db.platform_settings.find_one({})
    
    if not settings:
        # Default settings
        settings = {
            "default_commission_rate": 0.15,
            "auto_approve_sellers": False,
            "maintenance_mode": False,
            "min_order_value": 0.0,
            "max_commission_rate": 0.30
        }
    else:
        settings["id"] = str(settings.pop("_id"))
    
    return settings

@router.put("/settings")
async def update_platform_settings(
    default_commission_rate: Optional[float] = Query(None, ge=0.0, le=1.0),
    auto_approve_sellers: Optional[bool] = None,
    maintenance_mode: Optional[bool] = None,
    min_order_value: Optional[float] = Query(None, ge=0.0),
    max_commission_rate: Optional[float] = Query(None, ge=0.0, le=1.0),
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Обновить настройки платформы
    """
    db = await get_database()
    
    update_data = {}
    if default_commission_rate is not None:
        update_data["default_commission_rate"] = default_commission_rate
    if auto_approve_sellers is not None:
        update_data["auto_approve_sellers"] = auto_approve_sellers
    if maintenance_mode is not None:
        update_data["maintenance_mode"] = maintenance_mode
    if min_order_value is not None:
        update_data["min_order_value"] = min_order_value
    if max_commission_rate is not None:
        update_data["max_commission_rate"] = max_commission_rate
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No settings to update")
    
    # Update or insert
    await db.platform_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Settings updated successfully"}

# ============================================================================
# AUDIT LOG
# ============================================================================

@router.get("/audit-log")
async def get_audit_log(
    limit: int = Query(100, ge=1, le=1000),
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Получить журнал аудита действий администраторов
    """
    db = await get_database()
    
    # Get audit log entries
    logs = await db.audit_log.find({}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for log in logs:
        log["id"] = str(log.pop("_id"))
    
    return {
        "total": len(logs),
        "logs": logs
    }

@router.post("/audit-log")
async def create_audit_log_entry(
    action: str,
    entity_type: str,
    entity_id: str,
    details: Optional[dict] = None,
    admin_id: str = Depends(get_current_admin_id)
):
    """
    Создать запись в журнале аудита
    """
    db = await get_database()
    
    log_entry = {
        "admin_id": admin_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "timestamp": datetime.utcnow()
    }
    
    await db.audit_log.insert_one(log_entry)
    
    return {"message": "Audit log entry created"}
