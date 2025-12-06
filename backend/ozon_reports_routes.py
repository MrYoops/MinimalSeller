from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
import logging
import pandas as pd
from io import BytesIO

from database import get_database
from auth_utils import get_current_user
from ozon_all_parsers import (
    parse_ozon_order_realization_report,
    parse_loyalty_report,
    parse_acquiring_report,
    parse_rfbs_logistics_report,
    parse_fbo_fbs_services_report
)

router = APIRouter(prefix="/api/ozon-reports", tags=["ozon-reports"])
logger = logging.getLogger(__name__)


@router.post("/upload-order-realization")
async def upload_order_realization_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат")
    
    content = await file.read()
    
    try:
        result = parse_ozon_order_realization_report(content, seller_id)
    except Exception as e:
        logger.error(f"Parsing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка парсинга: {str(e)}")
    
    db = await get_database()
    
    report_meta = {
        "seller_id": seller_id,
        "report_type": "order_realization",
        "file_name": file.filename,
        "uploaded_at": datetime.utcnow(),
        "summary": result["summary"]
    }
    
    report_record = await db.ozon_reports.insert_one(report_meta)
    report_id = str(report_record.inserted_id)
    
    saved_count = 0
    for transaction in result["transactions"]:
        transaction["report_id"] = report_id
        update_result = await db.ozon_transactions.update_one(
            {"seller_id": seller_id, "posting_number": transaction["posting_number"], "sku": transaction["sku"]},
            {"$set": transaction},
            upsert=True
        )
        if update_result.upserted_id:
            saved_count += 1
    
    return {
        "status": "success",
        "statistics": {"transactions_parsed": len(result["transactions"]), "transactions_saved": saved_count},
        "summary": result["summary"]
    }


@router.post("/upload-loyalty-report")
async def upload_loyalty_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    content = await file.read()
    
    try:
        result = parse_loyalty_report(content, seller_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка: {str(e)}")
    
    db = await get_database()
    
    for program in result["programs"]:
        await db.ozon_loyalty_programs.update_one(
            {"seller_id": seller_id, "program_name": program["program_name"]},
            {"$set": program},
            upsert=True
        )
    
    return {"status": "success", "total_expense": result["total_loyalty_expense"]}


@router.post("/upload-acquiring-report")
async def upload_acquiring_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    content = await file.read()
    
    try:
        result = parse_acquiring_report(content, seller_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка: {str(e)}")
    
    db = await get_database()
    
    for txn in result["transactions"]:
        txn["seller_id"] = seller_id
        await db.ozon_acquiring.insert_one(txn)
    
    return {"status": "success", "total_acquiring": result["total_acquiring"]}


@router.get("/calculate-profit")
async def calculate_profit_from_reports(
    period_start: str,
    period_end: str,
    tag_filter: Optional[str] = Query(None),
    product_filter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    
    try:
        date_from = datetime.fromisoformat(f"{period_start}T00:00:00")
        date_to = datetime.fromisoformat(f"{period_end}T23:59:59")
    except:
        raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    db = await get_database()
    
    match_filter = {
        "seller_id": seller_id,
        "operation_date": {"$gte": date_from, "$lte": date_to}
    }
    
    if tag_filter:
        match_filter["article"] = {"$regex": tag_filter, "$options": "i"}
    
    if product_filter:
        match_filter["product_name"] = {"$regex": product_filter, "$options": "i"}
    
    transactions = await db.ozon_transactions.find(match_filter).to_list(10000)
    
    if not transactions:
        return {
            "period": {"from": period_start, "to": period_end},
            "message": "Нет данных",
            "revenue": {"gross_revenue": 0},
            "expenses": {"total": 0},
            "profit": {"net_profit": 0, "net_margin_pct": 0}
        }
    
    total_realized = sum(t["realized_amount"] for t in transactions)
    total_loyalty = sum(t["loyalty_payments"] for t in transactions)
    total_discounts = sum(t["discount_points"] for t in transactions)
    total_commission = sum(t["ozon_base_commission"] for t in transactions)
    
    # Получаем дополнительные расходы
    loyalty_programs = await db.ozon_loyalty_programs.find({"seller_id": seller_id}).to_list(100)
    total_loyalty_expense = sum(p.get("total", 0) for p in loyalty_programs)
    
    acquiring_records = await db.ozon_acquiring.find({"seller_id": seller_id}).to_list(1000)
    total_acquiring = sum(a.get("rate", 0) for a in acquiring_records)
    
    # Расчеты
    gross_revenue = total_realized + total_loyalty + total_discounts
    total_expenses = total_commission + total_loyalty_expense + total_acquiring
    net_profit = gross_revenue - total_expenses
    net_margin = (net_profit / gross_revenue * 100) if gross_revenue > 0 else 0
    
    return {
        "period": {"from": period_start, "to": period_end},
        "statistics": {"total_transactions": len(transactions)},
        "revenue": {
            "realized": round(total_realized, 2),
            "loyalty_payments": round(total_loyalty, 2),
            "discount_points": round(total_discounts, 2),
            "gross_revenue": round(gross_revenue, 2)
        },
        "expenses": {
            "ozon_base_commission": round(total_commission, 2),
            "loyalty_programs": round(total_loyalty_expense, 2),
            "acquiring": round(total_acquiring, 2),
            "total": round(total_expenses, 2)
        },
        "profit": {
            "net_profit": round(net_profit, 2),
            "net_margin_pct": round(net_margin, 2)
        }
    }


@router.get("/sales-report")
async def get_sales_report(
    period_start: str,
    period_end: str,
    tag_filter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    date_from = datetime.fromisoformat(f"{period_start}T00:00:00")
    date_to = datetime.fromisoformat(f"{period_end}T23:59:59")
    
    db = await get_database()
    match_filter = {
        "seller_id": seller_id,
        "operation_date": {"$gte": date_from, "$lte": date_to}
    }
    
    if tag_filter:
        match_filter["article"] = {"$regex": tag_filter, "$options": "i"}
    
    transactions = await db.ozon_transactions.find(match_filter).to_list(10000)
    
    by_product = {}
    for t in transactions:
        sku = t["sku"]
        if sku not in by_product:
            by_product[sku] = {
                "sku": sku,
                "article": t["article"],
                "product_name": t["product_name"],
                "quantity": 0,
                "revenue": 0,
                "commission": 0
            }
        by_product[sku]["quantity"] += t["quantity"]
        by_product[sku]["revenue"] += t["realized_amount"]
        by_product[sku]["commission"] += t["ozon_base_commission"]
    
    products = sorted(list(by_product.values()), key=lambda x: x["revenue"], reverse=True)
    
    return {
        "period": {"from": period_start, "to": period_end},
        "products": products,
        "total_products": len(products),
        "total_quantity": sum(p["quantity"] for p in products),
        "total_revenue": sum(p["revenue"] for p in products)
    }


@router.get("/transactions-list")
async def get_transactions_list(
    period_start: str,
    period_end: str,
    tag_filter: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    date_from = datetime.fromisoformat(f"{period_start}T00:00:00")
    date_to = datetime.fromisoformat(f"{period_end}T23:59:59")
    
    db = await get_database()
    match_filter = {
        "seller_id": seller_id,
        "operation_date": {"$gte": date_from, "$lte": date_to}
    }
    
    if tag_filter:
        match_filter["article"] = {"$regex": tag_filter, "$options": "i"}
    
    transactions = await db.ozon_transactions.find(match_filter).sort("operation_date", -1).skip(offset).limit(limit).to_list(limit)
    total_count = await db.ozon_transactions.count_documents(match_filter)
    
    for t in transactions:
        t["_id"] = str(t["_id"])
        t["operation_date"] = t["operation_date"].isoformat()
        t["created_at"] = t["created_at"].isoformat()
    
    return {
        "transactions": transactions,
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }


@router.get("/export-excel")
async def export_to_excel(
    period_start: str,
    period_end: str,
    tag_filter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    date_from = datetime.fromisoformat(f"{period_start}T00:00:00")
    date_to = datetime.fromisoformat(f"{period_end}T23:59:59")
    
    db = await get_database()
    match_filter = {
        "seller_id": seller_id,
        "operation_date": {"$gte": date_from, "$lte": date_to}
    }
    
    if tag_filter:
        match_filter["article"] = {"$regex": tag_filter, "$options": "i"}
    
    transactions = await db.ozon_transactions.find(match_filter).to_list(10000)
    
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Лист 1: Сводка
        total_realized = sum(t["realized_amount"] for t in transactions)
        total_loyalty = sum(t["loyalty_payments"] for t in transactions)
        total_discounts = sum(t["discount_points"] for t in transactions)
        total_commission = sum(t["ozon_base_commission"] for t in transactions)
        
        # Дополнительные расходы
        loyalty_programs = await db.ozon_loyalty_programs.find({"seller_id": seller_id}).to_list(100)
        total_loyalty_expense = sum(p.get("total", 0) for p in loyalty_programs)
        
        acquiring_records = await db.ozon_acquiring.find({"seller_id": seller_id}).to_list(1000)
        total_acquiring = sum(a.get("rate", 0) for a in acquiring_records)
        
        gross_revenue = total_realized + total_loyalty + total_discounts
        total_expenses = total_commission + total_loyalty_expense + total_acquiring
        net_profit = gross_revenue - total_expenses
        margin = (net_profit / gross_revenue * 100) if gross_revenue > 0 else 0
        
        summary_data = {
            "Показатель": [
                "Период", "Транзакций", "",
                "ВЫРУЧКА", "Реализовано", "+ Выплаты по лояльности", "+ Баллы за скидки",
                "= Валовая выручка", "",
                "РАСХОДЫ", "Комиссия Ozon базовая", "Выплаты партнерам (лояльность)", "Эквайринг",
                "= Итого расходов", "",
                "ПРИБЫЛЬ", "Чистая прибыль", "Маржа %"
            ],
            "Значение": [
                f"{period_start} - {period_end}", len(transactions), "",
                "", total_realized, total_loyalty, total_discounts,
                gross_revenue, "",
                "", total_commission, total_loyalty_expense, total_acquiring,
                total_expenses, "",
                "", net_profit, margin
            ]
        }
        
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Сводка', index=False)
        
        # Лист 2: Детализация
        details = []
        for t in transactions:
            details.append({
                "Дата": t["operation_date"].isoformat() if isinstance(t["operation_date"], datetime) else str(t["operation_date"]),
                "Отправление": t["posting_number"],
                "Артикул": t["article"],
                "SKU": t["sku"],
                "Товар": t["product_name"][:80],
                "Кол-во": t["quantity"],
                "Цена": t["price"],
                "Реализовано": t["realized_amount"],
                "Лояльность": t["loyalty_payments"],
                "Баллы": t["discount_points"],
                "Комиссия": t["ozon_base_commission"],
                "Итого": t["total_to_accrue"]
            })
        
        df_details = pd.DataFrame(details)
        df_details.to_excel(writer, sheet_name='Детализация', index=False)
    
    output.seek(0)
    filename = f"ozon_report_{period_start}_{period_end}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
