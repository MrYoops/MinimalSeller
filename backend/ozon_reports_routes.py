"""
Routes для загрузки и обработки отчетов Ozon
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
from datetime import datetime
import logging

from database import get_database
from auth_utils import get_current_user
from ozon_report_parser import parse_ozon_order_realization_report

router = APIRouter(prefix="/api/ozon-reports", tags=["ozon-reports"])
logger = logging.getLogger(__name__)


@router.post("/upload-order-realization")
async def upload_order_realization_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Загрузить позаказный отчет о реализации от Ozon
    
    Это ГЛАВНЫЙ отчет с детализацией по каждому заказу.
    Содержит информацию о:
    - Выручке
    - Баллах (лояльность + скидки)
    - Комиссии Ozon
    - Количестве товаров
    """
    seller_id = str(current_user["_id"])
    
    # Проверка расширения файла
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Неподдерживаемый формат. Используйте .xlsx или .xls"
        )
    
    # Читаем файл
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Ошибка чтения файла: {str(e)}"
        )
    
    # Парсим
    try:
        result = parse_ozon_order_realization_report(content, seller_id)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Ошибка парсинга отчета: {str(e)}"
        )
    
    # Сохраняем в БД
    db = await get_database()
    
    # Сохраняем метаинформацию о загруженном отчете
    report_meta = {
        "seller_id": seller_id,
        "report_type": "order_realization",
        "file_name": file.filename,
        "uploaded_at": datetime.utcnow(),
        "processed_at": datetime.utcnow(),
        "status": "processed",
        "summary": result["summary"]
    }
    
    report_record = await db.ozon_reports.insert_one(report_meta)
    report_id = str(report_record.inserted_id)
    
    # Сохраняем транзакции
    saved_count = 0
    updated_count = 0
    
    for transaction in result["transactions"]:
        transaction["report_id"] = report_id
        
        # Upsert - обновляем если уже есть такое отправление
        update_result = await db.ozon_transactions.update_one(
            {
                "seller_id": seller_id,
                "posting_number": transaction["posting_number"],
                "sku": transaction["sku"]
            },
            {"$set": transaction},
            upsert=True
        )
        
        if update_result.upserted_id:
            saved_count += 1
        else:
            updated_count += 1
    
    return {
        "status": "success",
        "message": "Отчет успешно загружен и обработан",
        "report_id": report_id,
        "file_name": file.filename,
        "statistics": {
            "transactions_parsed": len(result["transactions"]),
            "transactions_saved": saved_count,
            "transactions_updated": updated_count
        },
        "summary": result["summary"]
    }


@router.get("/calculate-profit")
async def calculate_profit_from_reports(
    period_start: str,
    period_end: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Рассчитать чистую прибыль на основе загруженных отчетов
    
    Использует данные из позаказного отчета и других документов
    """
    seller_id = str(current_user["_id"])
    
    try:
        date_from = datetime.fromisoformat(f"{period_start}T00:00:00")
        date_to = datetime.fromisoformat(f"{period_end}T23:59:59")
    except:
        raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    db = await get_database()
    
    # Получаем все транзакции за период
    transactions = await db.ozon_transactions.find({
        "seller_id": seller_id,
        "operation_date": {"$gte": date_from, "$lte": date_to}
    }).to_list(10000)
    
    if not transactions:
        return {
            "period": {"from": period_start, "to": period_end},
            "message": "Нет данных. Загрузите позаказный отчет о реализации.",
            "revenue": {"total": 0},
            "expenses": {"total": 0},
            "profit": {"total": 0}
        }
    
    # Рассчитываем метрики
    total_revenue = sum(t["realized_amount"] for t in transactions)
    total_loyalty = sum(t["loyalty_payments"] for t in transactions)
    total_discounts = sum(t["discount_points"] for t in transactions)
    total_commission = sum(t["ozon_base_commission"] for t in transactions)
    total_to_accrue = sum(t["total_to_accrue"] for t in transactions)
    
    # Чистая прибыль (пока без учета дополнительных услуг)
    net_profit = total_to_accrue
    net_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    return {
        "period": {"from": period_start, "to": period_end},
        "statistics": {
            "total_transactions": len(transactions)
        },
        "revenue": {
            "realized": round(total_revenue, 2),
            "loyalty_payments": round(total_loyalty, 2),
            "discount_points": round(total_discounts, 2),
            "gross_revenue": round(total_revenue + total_loyalty + total_discounts, 2)
        },
        "expenses": {
            "ozon_base_commission": round(total_commission, 2),
            "total": round(total_commission, 2)
        },
        "profit": {
            "net_profit": round(net_profit, 2),
            "net_margin_pct": round(net_margin, 2)
        }
    }
