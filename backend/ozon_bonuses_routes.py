"""
Модуль для работы с системой баллов Ozon
Учет начисленных/использованных бонусов и расчет комиссии 9%
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from database import get_database
from auth_utils import get_current_user

router = APIRouter(prefix="/api/ozon-bonuses", tags=["ozon-bonuses"])


async def calculate_bonus_commission(bonuses_accrued: int) -> float:
    """Рассчитать комиссию 9% от начисленных бонусов"""
    return round(bonuses_accrued * 0.09, 2)


@router.get("/summary")
async def get_bonuses_summary(
    date_from: str = Query(...),
    date_to: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Получить сводку по системе баллов Ozon"""
    seller_id = str(current_user["_id"])
    
    try:
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    db = await get_database()
    
    pipeline = [
        {
            "$match": {
                "seller_id": seller_id,
                "accrued_at": {"$gte": period_start, "$lte": period_end}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_accrued": {"$sum": "$bonuses_accrued"},
                "total_used": {"$sum": "$bonuses_used"},
                "total_commission": {"$sum": "$commission_9pct"},
                "total_returned": {"$sum": {"$cond": ["$order_returned", 1, 0]}},
                "commission_retained": {"$sum": "$commission_retained"}
            }
        }
    ]
    
    result = await db.ozon_bonuses.aggregate(pipeline).to_list(1)
    
    if not result:
        return {
            "total_accrued": 0,
            "total_used": 0,
            "commission_paid": 0,
            "returned_orders_impact": {"commission_not_returned": 0}
        }
    
    data = result[0]
    
    return {
        "total_accrued": data.get("total_accrued", 0),
        "total_used": data.get("total_used", 0),
        "active_balance": data.get("total_accrued", 0) - data.get("total_used", 0),
        "commission_paid": round(data.get("total_commission", 0.0), 2),
        "returned_orders_impact": {
            "orders_count": data.get("total_returned", 0),
            "commission_not_returned": round(data.get("commission_retained", 0.0), 2)
        }
    }
