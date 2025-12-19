# Yandex Market Analytics Module
# Provides financial analytics for Yandex Market orders

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
import aiohttp

from database import get_database
from auth_utils import get_current_user

router = APIRouter(prefix="/api/yandex-analytics", tags=["yandex-analytics"])


async def get_yandex_credentials(seller_id: str) -> Dict[str, Any]:
    """Get Yandex Market API credentials for seller"""
    db = await get_database()
    
    from bson import ObjectId
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    if not profile:
        try:
            profile = await db.seller_profiles.find_one({"user_id": ObjectId(seller_id)})
        except:
            pass
    
    if not profile or not profile.get("api_keys"):
        raise HTTPException(status_code=404, detail="API ключи не найдены")
    
    for key in profile.get("api_keys", []):
        if key.get("marketplace") == "yandex":
            return {
                "api_key": key.get("api_key"),
                "campaign_id": key.get("client_id"),
                "business_id": key.get("business_id"),
                "campaigns": key.get("campaigns", [])
            }
    
    raise HTTPException(status_code=404, detail="Яндекс.Маркет API ключ не найден")


async def fetch_yandex_orders(
    api_key: str,
    campaign_id: str,
    date_from: str,
    date_to: str,
    status: Optional[str] = None
) -> List[Dict]:
    """Fetch orders from Yandex Market API"""
    url = f"https://api.partner.market.yandex.ru/campaigns/{campaign_id}/orders"
    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json"
    }
    
    params = {
        "fromDate": date_from,
        "toDate": date_to
    }
    if status:
        params["status"] = status
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, params=params) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise HTTPException(status_code=resp.status, detail=f"Yandex API error: {error_text}")
            
            data = await resp.json()
            return data.get("orders", [])


def format_date_for_yandex(date_str: str) -> str:
    """Convert YYYY-MM-DD to DD-MM-YYYY format for Yandex API"""
    parts = date_str.split("-")
    return f"{parts[2]}-{parts[1]}-{parts[0]}"


def analyze_orders(orders: List[Dict]) -> Dict[str, Any]:
    """Analyze orders and calculate financial metrics"""
    
    result = {
        "orders_count": len(orders),
        "by_status": defaultdict(lambda: {"count": 0, "revenue": 0}),
        "income": {
            "buyer_total": 0,
            "before_discount": 0,
            "subsidies": 0
        },
        "items_sold": 0,
        "cancelled_count": 0,
        "delivered_count": 0,
        "regions": defaultdict(int)
    }
    
    for order in orders:
        status = order.get("status", "UNKNOWN")
        buyer_total = order.get("buyerTotal", 0)
        before_discount = order.get("buyerTotalBeforeDiscount", 0)
        
        result["by_status"][status]["count"] += 1
        result["by_status"][status]["revenue"] += buyer_total
        
        # Count subsidies
        for subsidy in order.get("subsidies", []):
            result["income"]["subsidies"] += subsidy.get("amount", 0)
        
        # Only count delivered orders as revenue
        if status == "DELIVERED":
            result["income"]["buyer_total"] += buyer_total
            result["income"]["before_discount"] += before_discount
            result["delivered_count"] += 1
            
            # Count items
            for item in order.get("items", []):
                result["items_sold"] += item.get("count", 1)
        
        if status in ["CANCELLED", "CANCELLED_BEFORE_PROCESSING"]:
            result["cancelled_count"] += 1
        
        # Track regions
        delivery = order.get("delivery", {})
        region = delivery.get("region", {})
        region_name = region.get("name", "Неизвестно")
        result["regions"][region_name] += 1
    
    return result


@router.get("/economics")
async def get_yandex_economics(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    campaign_id: Optional[str] = Query(None, description="Specific campaign ID"),
    compare_previous: bool = Query(False, description="Compare with previous period"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get Yandex Market economics report.
    """
    seller_id = str(current_user["_id"])
    
    credentials = await get_yandex_credentials(seller_id)
    
    # Use provided campaign_id or default
    target_campaign = campaign_id or credentials["campaign_id"]
    
    # Convert dates to Yandex format
    yandex_date_from = format_date_for_yandex(date_from)
    yandex_date_to = format_date_for_yandex(date_to)
    
    # Fetch all orders for the period
    orders = await fetch_yandex_orders(
        credentials["api_key"],
        target_campaign,
        yandex_date_from,
        yandex_date_to
    )
    
    # Analyze orders
    analysis = analyze_orders(orders)
    
    # Calculate metrics
    total_revenue = analysis["income"]["buyer_total"]
    total_before_discount = analysis["income"]["before_discount"]
    total_subsidies = analysis["income"]["subsidies"]
    discount_given = total_before_discount - total_revenue
    
    result = {
        "period": {
            "from": date_from,
            "to": date_to,
            "days": (datetime.fromisoformat(date_to) - datetime.fromisoformat(date_from)).days + 1
        },
        "campaign_id": target_campaign,
        "summary": {
            "total_orders": analysis["orders_count"],
            "delivered_orders": analysis["delivered_count"],
            "cancelled_orders": analysis["cancelled_count"],
            "items_sold": analysis["items_sold"],
            "revenue": round(total_revenue, 2),
            "revenue_before_discount": round(total_before_discount, 2),
            "discount_given": round(discount_given, 2),
            "subsidies_from_yandex": round(total_subsidies, 2)
        },
        "by_status": {
            status: {
                "count": data["count"],
                "revenue": round(data["revenue"], 2)
            }
            for status, data in analysis["by_status"].items()
        },
        "top_regions": dict(sorted(
            analysis["regions"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10])
    }
    
    # Compare with previous period
    if compare_previous:
        try:
            period_days = (datetime.fromisoformat(date_to) - datetime.fromisoformat(date_from)).days + 1
            prev_start = (datetime.fromisoformat(date_from) - timedelta(days=period_days)).strftime("%Y-%m-%d")
            prev_end = (datetime.fromisoformat(date_from) - timedelta(days=1)).strftime("%Y-%m-%d")
            
            prev_orders = await fetch_yandex_orders(
                credentials["api_key"],
                target_campaign,
                format_date_for_yandex(prev_start),
                format_date_for_yandex(prev_end)
            )
            
            prev_analysis = analyze_orders(prev_orders)
            prev_revenue = prev_analysis["income"]["buyer_total"]
            prev_delivered = prev_analysis["delivered_count"]
            
            def calc_change(current, previous):
                if previous == 0:
                    return 100 if current > 0 else 0
                return round((current - previous) / abs(previous) * 100, 1)
            
            result["comparison"] = {
                "previous_period": {
                    "from": prev_start,
                    "to": prev_end
                },
                "changes": {
                    "revenue_change_pct": calc_change(total_revenue, prev_revenue),
                    "orders_change_pct": calc_change(analysis["delivered_count"], prev_delivered),
                    "prev_revenue": round(prev_revenue, 2),
                    "prev_orders": prev_delivered
                }
            }
        except Exception as e:
            result["comparison"] = {"error": str(e)}
    
    return result


@router.get("/orders")
async def get_yandex_orders_list(
    date_from: str = Query(...),
    date_to: str = Query(...),
    status: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get list of Yandex Market orders"""
    seller_id = str(current_user["_id"])
    credentials = await get_yandex_credentials(seller_id)
    
    target_campaign = campaign_id or credentials["campaign_id"]
    
    orders = await fetch_yandex_orders(
        credentials["api_key"],
        target_campaign,
        format_date_for_yandex(date_from),
        format_date_for_yandex(date_to),
        status
    )
    
    # Simplify orders for response
    simplified = []
    for order in orders:
        simplified.append({
            "id": order.get("id"),
            "status": order.get("status"),
            "created_date": order.get("creationDate"),
            "buyer_total": order.get("buyerTotal", 0),
            "buyer_total_before_discount": order.get("buyerTotalBeforeDiscount", 0),
            "items_count": sum(item.get("count", 1) for item in order.get("items", [])),
            "items": [
                {
                    "name": item.get("offerName"),
                    "sku": item.get("shopSku"),
                    "price": item.get("buyerPrice", 0),
                    "count": item.get("count", 1)
                }
                for item in order.get("items", [])
            ],
            "delivery_region": order.get("delivery", {}).get("region", {}).get("name", ""),
            "subsidies": sum(s.get("amount", 0) for s in order.get("subsidies", []))
        })
    
    return {
        "orders": simplified,
        "total_count": len(simplified)
    }


@router.get("/campaigns")
async def get_yandex_campaigns(
    current_user: dict = Depends(get_current_user)
):
    """Get list of available Yandex Market campaigns"""
    seller_id = str(current_user["_id"])
    credentials = await get_yandex_credentials(seller_id)
    
    # Return stored campaigns
    campaigns = credentials.get("campaigns", [])
    
    # Also try to fetch campaign info
    result_campaigns = []
    
    headers = {
        "Api-Key": credentials["api_key"],
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        for campaign in campaigns:
            campaign_id = campaign.get("id")
            url = f"https://api.partner.market.yandex.ru/campaigns/{campaign_id}"
            
            try:
                async with session.get(url, headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        camp_info = data.get("campaign", {})
                        result_campaigns.append({
                            "id": campaign_id,
                            "name": campaign.get("name", camp_info.get("domain", "")),
                            "type": campaign.get("type", camp_info.get("placementType", "")),
                            "status": camp_info.get("apiAvailability", "UNKNOWN")
                        })
                    else:
                        result_campaigns.append(campaign)
            except:
                result_campaigns.append(campaign)
    
    return {
        "business_id": credentials.get("business_id"),
        "campaigns": result_campaigns
    }
