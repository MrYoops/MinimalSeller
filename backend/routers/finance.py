from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from collections import defaultdict

from core.database import get_database

router = APIRouter(prefix="/api/finance", tags=["finance"])

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_seller_id() -> str:
    """Get current seller ID from JWT token"""
    # TODO: Implement JWT authentication
    return "demo_seller_id"

def calculate_profit(order: dict) -> float:
    """
    Рассчитывает прибыль с заказа
    Прибыль = Выручка - Себестоимость - Комиссия маркетплейса - Логистика
    """
    revenue = order["totals"]["subtotal"]
    
    # Calculate cost of goods
    cost_of_goods = 0.0
    for item in order["items"]:
        # TODO: Get purchase_price from product
        cost_of_goods += item.get("purchase_price", 0) * item["quantity"]
    
    commission = order["totals"]["marketplace_commission"]
    shipping = order["totals"]["shipping_cost"]
    
    profit = revenue - cost_of_goods - commission - shipping
    return profit

def calculate_roi(profit: float, cost: float) -> float:
    """Рассчитывает ROI (Return on Investment)"""
    if cost == 0:
        return 0.0
    return (profit / cost) * 100

# ============================================================================
# DASHBOARD ENDPOINTS
# ============================================================================

@router.get("/dashboard")
async def get_financial_dashboard(
    period: str = Query("month", regex="^(day|week|month|year)$"),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить финансовый дашборд
    Возвращает: выручку, прибыль, ROI, количество заказов
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get orders in period
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Calculate metrics
    total_revenue = sum(order["totals"]["subtotal"] for order in orders)
    total_profit = sum(calculate_profit(order) for order in orders)
    total_orders = len(orders)
    
    # Calculate total cost
    total_cost = 0.0
    for order in orders:
        for item in order["items"]:
            total_cost += item.get("purchase_price", 0) * item["quantity"]
    
    roi = calculate_roi(total_profit, total_cost) if total_cost > 0 else 0.0
    
    # Average order value
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0.0
    
    # Get previous period for comparison
    prev_start = start_date - (now - start_date)
    prev_orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": prev_start, "$lt": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    prev_revenue = sum(order["totals"]["subtotal"] for order in prev_orders)
    prev_profit = sum(calculate_profit(order) for order in prev_orders)
    
    # Calculate growth
    revenue_growth = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0.0
    profit_growth = ((total_profit - prev_profit) / prev_profit * 100) if prev_profit > 0 else 0.0
    
    return {
        "period": period,
        "metrics": {
            "revenue": {
                "value": round(total_revenue, 2),
                "growth": round(revenue_growth, 2)
            },
            "profit": {
                "value": round(total_profit, 2),
                "growth": round(profit_growth, 2)
            },
            "roi": {
                "value": round(roi, 2)
            },
            "orders": {
                "value": total_orders,
                "growth": round(((total_orders - len(prev_orders)) / len(prev_orders) * 100) if len(prev_orders) > 0 else 0.0, 2)
            },
            "avg_order_value": {
                "value": round(avg_order_value, 2)
            }
        }
    }

@router.get("/revenue-chart")
async def get_revenue_chart(
    period: str = Query("month", regex="^(week|month|year)$"),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить данные для графика выручки
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
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Group by period
    data_points = defaultdict(lambda: {"revenue": 0.0, "profit": 0.0, "orders": 0})
    
    for order in orders:
        date = order["dates"]["created_at"]
        if group_by == "day":
            key = date.strftime("%Y-%m-%d")
        else:  # month
            key = date.strftime("%Y-%m")
        
        data_points[key]["revenue"] += order["totals"]["subtotal"]
        data_points[key]["profit"] += calculate_profit(order)
        data_points[key]["orders"] += 1
    
    # Convert to list and sort
    chart_data = [
        {
            "date": key,
            "revenue": round(value["revenue"], 2),
            "profit": round(value["profit"], 2),
            "orders": value["orders"]
        }
        for key, value in sorted(data_points.items())
    ]
    
    return {
        "period": period,
        "group_by": group_by,
        "data": chart_data
    }

@router.get("/marketplace-breakdown")
async def get_marketplace_breakdown(
    period: str = Query("month", regex="^(day|week|month|year)$"),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить разбивку по маркетплейсам
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get orders
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Group by marketplace
    marketplace_data = defaultdict(lambda: {
        "revenue": 0.0,
        "profit": 0.0,
        "orders": 0,
        "commission": 0.0
    })
    
    for order in orders:
        source = order["source"]
        marketplace_data[source]["revenue"] += order["totals"]["subtotal"]
        marketplace_data[source]["profit"] += calculate_profit(order)
        marketplace_data[source]["orders"] += 1
        marketplace_data[source]["commission"] += order["totals"]["marketplace_commission"]
    
    # Convert to list
    breakdown = [
        {
            "marketplace": key,
            "revenue": round(value["revenue"], 2),
            "profit": round(value["profit"], 2),
            "orders": value["orders"],
            "commission": round(value["commission"], 2),
            "avg_commission_rate": round((value["commission"] / value["revenue"] * 100) if value["revenue"] > 0 else 0.0, 2)
        }
        for key, value in marketplace_data.items()
    ]
    
    # Sort by revenue
    breakdown.sort(key=lambda x: x["revenue"], reverse=True)
    
    return {
        "period": period,
        "breakdown": breakdown
    }

@router.get("/product-profitability")
async def get_product_profitability(
    period: str = Query("month", regex="^(day|week|month|year)$"),
    limit: int = Query(20, ge=1, le=100),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить топ товаров по прибыльности
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get orders
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Group by product
    product_data = defaultdict(lambda: {
        "sku": "",
        "name": "",
        "revenue": 0.0,
        "cost": 0.0,
        "profit": 0.0,
        "quantity_sold": 0,
        "orders": 0
    })
    
    for order in orders:
        for item in order["items"]:
            product_id = item["product_id"]
            product_data[product_id]["sku"] = item["sku"]
            product_data[product_id]["name"] = item["name"]
            product_data[product_id]["revenue"] += item["price"] * item["quantity"]
            product_data[product_id]["cost"] += item.get("purchase_price", 0) * item["quantity"]
            product_data[product_id]["quantity_sold"] += item["quantity"]
            product_data[product_id]["orders"] += 1
    
    # Calculate profit and ROI
    for product_id, data in product_data.items():
        data["profit"] = data["revenue"] - data["cost"]
        data["roi"] = calculate_roi(data["profit"], data["cost"])
    
    # Convert to list and sort by profit
    products = [
        {
            "product_id": key,
            "sku": value["sku"],
            "name": value["name"],
            "revenue": round(value["revenue"], 2),
            "cost": round(value["cost"], 2),
            "profit": round(value["profit"], 2),
            "roi": round(value["roi"], 2),
            "quantity_sold": value["quantity_sold"],
            "orders": value["orders"]
        }
        for key, value in product_data.items()
    ]
    
    products.sort(key=lambda x: x["profit"], reverse=True)
    
    return {
        "period": period,
        "products": products[:limit]
    }

@router.get("/investor-report")
async def get_investor_report(
    investor_tag: str,
    period: str = Query("month", regex="^(day|week|month|year)$"),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить отчет для инвестора
    Показывает прибыль по товарам с определенным investor_tag
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get products with this investor tag
    products = await db.products.find({
        "seller_id": seller_id,
        "investor_tag": investor_tag
    }).to_list(1000)
    
    product_ids = [str(p["_id"]) for p in products]
    
    # Get orders containing these products
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]},
        "items.product_id": {"$in": product_ids}
    }).to_list(10000)
    
    # Calculate metrics
    total_revenue = 0.0
    total_cost = 0.0
    total_quantity = 0
    
    for order in orders:
        for item in order["items"]:
            if item["product_id"] in product_ids:
                total_revenue += item["price"] * item["quantity"]
                total_cost += item.get("purchase_price", 0) * item["quantity"]
                total_quantity += item["quantity"]
    
    total_profit = total_revenue - total_cost
    roi = calculate_roi(total_profit, total_cost)
    
    return {
        "investor_tag": investor_tag,
        "period": period,
        "metrics": {
            "revenue": round(total_revenue, 2),
            "cost": round(total_cost, 2),
            "profit": round(total_profit, 2),
            "roi": round(roi, 2),
            "quantity_sold": total_quantity,
            "products_count": len(products)
        }
    }

@router.get("/expenses")
async def get_expenses(
    period: str = Query("month", regex="^(day|week|month|year)$"),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить структуру расходов
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get orders
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Calculate expenses
    total_cost_of_goods = 0.0
    total_marketplace_commission = 0.0
    total_shipping = 0.0
    
    for order in orders:
        for item in order["items"]:
            total_cost_of_goods += item.get("purchase_price", 0) * item["quantity"]
        
        total_marketplace_commission += order["totals"]["marketplace_commission"]
        total_shipping += order["totals"]["shipping_cost"]
    
    total_expenses = total_cost_of_goods + total_marketplace_commission + total_shipping
    
    return {
        "period": period,
        "expenses": {
            "cost_of_goods": {
                "value": round(total_cost_of_goods, 2),
                "percentage": round((total_cost_of_goods / total_expenses * 100) if total_expenses > 0 else 0.0, 2)
            },
            "marketplace_commission": {
                "value": round(total_marketplace_commission, 2),
                "percentage": round((total_marketplace_commission / total_expenses * 100) if total_expenses > 0 else 0.0, 2)
            },
            "shipping": {
                "value": round(total_shipping, 2),
                "percentage": round((total_shipping / total_expenses * 100) if total_expenses > 0 else 0.0, 2)
            },
            "total": round(total_expenses, 2)
        }
    }

@router.get("/cash-flow")
async def get_cash_flow(
    period: str = Query("month", regex="^(week|month|year)$"),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить данные о денежном потоке (cash flow)
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
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Group by period
    cash_flow_data = defaultdict(lambda: {"income": 0.0, "expenses": 0.0, "net": 0.0})
    
    for order in orders:
        date = order["dates"]["created_at"]
        if group_by == "day":
            key = date.strftime("%Y-%m-%d")
        else:  # month
            key = date.strftime("%Y-%m")
        
        # Income = seller payout
        income = order["totals"]["seller_payout"]
        
        # Expenses = cost of goods
        expenses = 0.0
        for item in order["items"]:
            expenses += item.get("purchase_price", 0) * item["quantity"]
        
        cash_flow_data[key]["income"] += income
        cash_flow_data[key]["expenses"] += expenses
        cash_flow_data[key]["net"] += (income - expenses)
    
    # Convert to list and sort
    chart_data = [
        {
            "date": key,
            "income": round(value["income"], 2),
            "expenses": round(value["expenses"], 2),
            "net": round(value["net"], 2)
        }
        for key, value in sorted(cash_flow_data.items())
    ]
    
    return {
        "period": period,
        "group_by": group_by,
        "data": chart_data
    }
