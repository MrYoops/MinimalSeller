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
        await db.ozon_acquiring.insert_one(txn)
    
    return {"status": "success", "total_acquiring": result["total_acquiring"]}


@router.post("/upload-rfbs-logistics")
async def upload_rfbs_logistics_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    content = await file.read()
    
    try:
        result = parse_rfbs_logistics_report(content, seller_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка: {str(e)}")
    
    db = await get_database()
    
    for service in result["services"]:
        await db.ozon_rfbs_logistics.update_one(
            {"seller_id": seller_id, "posting_number": service["posting_number"]},
            {"$set": service},
            upsert=True
        )
    
    return {"status": "success", "total_logistics": result["total_rfbs_logistics"]}


@router.post("/upload-fbo-fbs-services")
async def upload_fbo_fbs_services_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    seller_id = str(current_user["_id"])
    content = await file.read()
    
    try:
        result = parse_fbo_fbs_services_report(content, seller_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка: {str(e)}")
    
    db = await get_database()
    
    await db.ozon_fbo_fbs_services.update_one(
        {"seller_id": seller_id},
        {"$set": {"total": result["total_fbo_fbs_services"], "updated_at": datetime.utcnow()}},
        upsert=True
    )
    
    return {"status": "success", "total_services": result["total_fbo_fbs_services"]}


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
    
    # ДОХОДЫ - Продажи
    total_realized = sum(t["realized_amount"] for t in transactions)
    total_loyalty = sum(t["loyalty_payments"] for t in transactions)
    total_discounts = sum(t["discount_points"] for t in transactions)
    total_accrued = sum(t.get("total_to_accrue", 0) for t in transactions)
    
    # ВОЗВРАТЫ
    total_returned_amount = sum(t.get("returned_amount", 0) for t in transactions)
    total_returned_loyalty = sum(t.get("returned_loyalty_payments", 0) for t in transactions)
    total_returned_discounts = sum(t.get("returned_discount_points", 0) for t in transactions)
    total_returned_commission = sum(t.get("returned_commission", 0) for t in transactions)
    total_returned = sum(t.get("total_returned", 0) for t in transactions)
    total_returned_qty = sum(t.get("returned_quantity", 0) for t in transactions)
    
    # ИТОГОВАЯ ВЫРУЧКА (валовая - возвраты)
    gross_revenue = total_realized + total_loyalty + total_discounts
    net_revenue = total_accrued - total_returned
    
    # РАСХОДЫ - базовые (комиссия уже вычтена в total_accrued, но вернулась с возвратами)
    total_commission = sum(t["ozon_base_commission"] for t in transactions)
    
    # РАСХОДЫ - дополнительные
    loyalty_programs = await db.ozon_loyalty_programs.find({"seller_id": seller_id}).to_list(100)
    total_loyalty_expense = sum(p.get("total", 0) for p in loyalty_programs)
    
    acquiring_records = await db.ozon_acquiring.find({"seller_id": seller_id}).to_list(1000)
    total_acquiring = sum(a.get("rate", 0) for a in acquiring_records)
    
    rfbs_logistics = await db.ozon_rfbs_logistics.find({"seller_id": seller_id}).to_list(1000)
    total_rfbs = sum(r.get("total_logistics", 0) for r in rfbs_logistics)
    
    fbo_fbs_record = await db.ozon_fbo_fbs_services.find_one({"seller_id": seller_id})
    total_fbo_fbs = fbo_fbs_record.get("total", 0) if fbo_fbs_record else 0
    
    # РУЧНЫЕ РАСХОДЫ (УПД, агентские услуги и т.д.)
    manual_expenses = await db.ozon_manual_expenses.find({
        "seller_id": seller_id,
        "expense_date": {"$gte": date_from, "$lte": date_to}
    }).to_list(1000)
    total_manual_expenses = sum(e.get("amount", 0) for e in manual_expenses)
    
    # Группируем по типам для детализации
    manual_by_type = {}
    for e in manual_expenses:
        exp_type = e.get("expense_type", "Прочее")
        manual_by_type[exp_type] = manual_by_type.get(exp_type, 0) + e.get("amount", 0)
    
    # СЕБЕСТОИМОСТЬ (COGS)
    total_cogs = 0
    cogs_items_count = 0
    cogs_missing_count = 0
    
    for t in transactions:
        article = t.get("article", "")
        quantity = t.get("quantity", 0)
        returned_qty = t.get("returned_quantity", 0)
        net_qty = quantity - returned_qty  # Чистое количество проданных товаров
        
        if net_qty > 0 and article:
            product = await db.product_catalog.find_one({
                "seller_id": seller_id,
                "article": article
            })
            
            if product and product.get("purchase_price"):
                cogs = product["purchase_price"] * net_qty
                total_cogs += cogs
                cogs_items_count += 1
            else:
                cogs_missing_count += 1
    
    # ИТОГОВЫЕ РАСХОДЫ (включая ручные)
    total_expenses = total_commission + total_loyalty_expense + total_acquiring + total_rfbs + total_fbo_fbs + total_manual_expenses
    
    # ПРИБЫЛЬ
    # Валовая прибыль = Чистая выручка - Себестоимость
    gross_profit = net_revenue - total_cogs
    gross_margin = (gross_profit / net_revenue * 100) if net_revenue > 0 else 0
    
    # Операционная прибыль = Валовая прибыль - Расходы
    operating_profit = gross_profit - total_expenses
    operating_margin = (operating_profit / net_revenue * 100) if net_revenue > 0 else 0
    
    # НАЛОГИ
    tax_settings = await db.tax_settings.find_one({"seller_id": seller_id})
    tax_amount = 0
    tax_system = None
    tax_rate = 0
    
    if tax_settings and tax_settings.get("tax_system"):
        tax_system = tax_settings["tax_system"]
        tax_rate = tax_settings.get("rate", 0)
        
        # Расчет налоговой базы в зависимости от системы
        if tax_system == "usn_income":
            # УСН Доходы - 6% от валовой выручки
            tax_base = gross_revenue
            tax_amount = tax_base * (tax_rate / 100)
        elif tax_system == "usn_income_expense":
            # УСН Доходы минус Расходы - 15% от (выручка - расходы - COGS)
            tax_base = max(0, net_revenue - total_cogs - total_expenses)
            tax_amount = tax_base * (tax_rate / 100)
        elif tax_system == "osn":
            # ОСН - упрощенно 20% от прибыли (НДС уже учтен в ценах)
            tax_base = operating_profit
            tax_amount = tax_base * (tax_rate / 100)
        elif tax_system in ["patent", "eshn"]:
            # Патент/ЕСХН - 6% от доходов
            tax_base = gross_revenue
            tax_amount = tax_base * (tax_rate / 100)
    
    # Чистая прибыль = Операционная прибыль - Налоги
    net_profit = operating_profit - tax_amount
    net_margin = (net_profit / net_revenue * 100) if net_revenue > 0 else 0
    
    return {
        "period": {"from": period_start, "to": period_end},
        "statistics": {
            "total_transactions": len(transactions),
            "total_returned_items": total_returned_qty,
            "cogs_coverage": {
                "items_with_price": cogs_items_count,
                "items_missing_price": cogs_missing_count,
                "coverage_pct": round((cogs_items_count / (cogs_items_count + cogs_missing_count) * 100), 1) 
                                if (cogs_items_count + cogs_missing_count) > 0 else 0
            }
        },
        "revenue": {
            # Продажи
            "realized": round(total_realized, 2),
            "loyalty_payments": round(total_loyalty, 2),
            "discount_points": round(total_discounts, 2),
            "gross_revenue": round(gross_revenue, 2),
            "total_accrued": round(total_accrued, 2),
            
            # Возвраты
            "returns": {
                "returned_amount": round(total_returned_amount, 2),
                "returned_loyalty": round(total_returned_loyalty, 2),
                "returned_discounts": round(total_returned_discounts, 2),
                "returned_commission_back": round(total_returned_commission, 2),
                "total_returned": round(total_returned, 2),
                "returned_quantity": total_returned_qty
            },
            
            # Итого
            "net_revenue": round(net_revenue, 2)
        },
        "cogs": {
            "total": round(total_cogs, 2),
            "percentage": round((total_cogs / net_revenue * 100), 2) if net_revenue > 0 else 0
        },
        "expenses": {
            "ozon_base_commission": round(total_commission, 2),
            "loyalty_programs": round(total_loyalty_expense, 2),
            "acquiring": round(total_acquiring, 2),
            "rfbs_logistics": round(total_rfbs, 2),
            "fbo_fbs_services": round(total_fbo_fbs, 2),
            "manual_expenses": round(total_manual_expenses, 2),
            "manual_by_type": {k: round(v, 2) for k, v in manual_by_type.items()},
            "total": round(total_expenses, 2)
        },
        "profit": {
            "gross_profit": round(gross_profit, 2),
            "gross_margin_pct": round(gross_margin, 2),
            "operating_profit": round(operating_profit, 2),
            "operating_margin_pct": round(operating_margin, 2),
            "net_profit": round(net_profit, 2),
            "net_margin_pct": round(net_margin, 2)
        },
        "taxes": {
            "system": tax_system,
            "rate": tax_rate,
            "amount": round(tax_amount, 2)
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
        # РАСЧЕТ ДОХОДОВ
        total_realized = sum(t["realized_amount"] for t in transactions)
        total_loyalty = sum(t["loyalty_payments"] for t in transactions)
        total_discounts = sum(t["discount_points"] for t in transactions)
        total_commission = sum(t["ozon_base_commission"] for t in transactions)
        total_accrued = sum(t.get("total_to_accrue", 0) for t in transactions)
        
        # ВОЗВРАТЫ
        total_returned = sum(t.get("total_returned", 0) for t in transactions)
        total_returned_qty = sum(t.get("returned_quantity", 0) for t in transactions)
        
        # СЕБЕСТОИМОСТЬ (COGS)
        total_cogs = 0
        for t in transactions:
            article = t.get("article", "")
            quantity = t.get("quantity", 0)
            returned_qty = t.get("returned_quantity", 0)
            net_qty = quantity - returned_qty
            
            if net_qty > 0 and article:
                product = await db.product_catalog.find_one({
                    "seller_id": seller_id,
                    "article": article
                })
                if product and product.get("purchase_price"):
                    total_cogs += product["purchase_price"] * net_qty
        
        # РАСХОДЫ
        loyalty_programs = await db.ozon_loyalty_programs.find({"seller_id": seller_id}).to_list(100)
        total_loyalty_expense = sum(p.get("total", 0) for p in loyalty_programs)
        
        acquiring_records = await db.ozon_acquiring.find({"seller_id": seller_id}).to_list(1000)
        total_acquiring = sum(a.get("rate", 0) for a in acquiring_records)
        
        rfbs_logistics = await db.ozon_rfbs_logistics.find({"seller_id": seller_id}).to_list(1000)
        total_rfbs = sum(r.get("total_logistics", 0) for r in rfbs_logistics)
        
        fbo_fbs_record = await db.ozon_fbo_fbs_services.find_one({"seller_id": seller_id})
        total_fbo_fbs = fbo_fbs_record.get("total", 0) if fbo_fbs_record else 0
        
        # Ручные расходы
        manual_expenses = await db.ozon_manual_expenses.find({
            "seller_id": seller_id,
            "expense_date": {"$gte": date_from, "$lte": date_to}
        }).to_list(1000)
        total_manual = sum(e.get("amount", 0) for e in manual_expenses)
        
        # НАЛОГИ
        tax_settings = await db.tax_settings.find_one({"seller_id": seller_id})
        tax_amount = 0
        tax_label = "Не установлен"
        if tax_settings and tax_settings.get("tax_system"):
            tax_system = tax_settings["tax_system"]
            tax_rate = tax_settings.get("rate", 0)
            gross_revenue = total_realized + total_loyalty + total_discounts
            
            if tax_system == "usn_income":
                tax_amount = gross_revenue * (tax_rate / 100)
                tax_label = f"УСН Доходы {tax_rate}%"
            elif tax_system == "usn_income_expense":
                net_revenue = total_accrued - total_returned
                total_expenses_calc = total_commission + total_loyalty_expense + total_acquiring + total_rfbs + total_fbo_fbs + total_manual
                tax_base = max(0, net_revenue - total_cogs - total_expenses_calc)
                tax_amount = tax_base * (tax_rate / 100)
                tax_label = f"УСН Доходы-Расходы {tax_rate}%"
            else:
                tax_label = f"{tax_system.upper()} {tax_rate}%"
        
        # ИТОГОВЫЕ РАСЧЕТЫ
        gross_revenue = total_realized + total_loyalty + total_discounts
        net_revenue = total_accrued - total_returned
        gross_profit = net_revenue - total_cogs
        total_expenses = total_commission + total_loyalty_expense + total_acquiring + total_rfbs + total_fbo_fbs + total_manual
        operating_profit = gross_profit - total_expenses
        net_profit = operating_profit - tax_amount
        margin = (net_profit / net_revenue * 100) if net_revenue > 0 else 0
        
        summary_data = {
            "Показатель": [
                "Период", "Транзакций", "",
                "=== ДОХОДЫ ===", 
                "Реализовано", 
                "+ Выплаты лояльность", 
                "+ Баллы скидки", 
                "= Валовая выручка",
                "- Возвраты",
                "= Чистая выручка", "",
                "=== СЕБЕСТОИМОСТЬ ===",
                "- COGS",
                "= Валовая прибыль", "",
                "=== РАСХОДЫ ===",
                "- Комиссия Ozon", 
                "- Выплаты партнерам", 
                "- Эквайринг", 
                "- Логистика rFBS", 
                "- Услуги FBO/FBS",
                "- Ручные расходы",
                "= Итого расходов", "",
                "=== ПРИБЫЛЬ ===",
                "= Операционная прибыль",
                f"- Налог ({tax_label})",
                "= Чистая прибыль", 
                "Маржа %"
            ],
            "Значение": [
                f"{period_start} - {period_end}", len(transactions), "",
                "",
                total_realized, 
                total_loyalty, 
                total_discounts, 
                gross_revenue,
                -total_returned,
                net_revenue, "",
                "",
                -total_cogs,
                gross_profit, "",
                "",
                -total_commission, 
                -total_loyalty_expense, 
                -total_acquiring, 
                -total_rfbs, 
                -total_fbo_fbs,
                -total_manual,
                -total_expenses, "",
                "",
                operating_profit,
                -tax_amount,
                net_profit, 
                margin
            ]
        }
        
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Сводка', index=False)
        
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
                "Итого начислено": t["total_to_accrue"],
                "Возвращено кол-во": t.get("returned_quantity", 0),
                "Возвращено сумма": t.get("total_returned", 0)
            })
        
        df_details = pd.DataFrame(details)
        df_details.to_excel(writer, sheet_name='Детализация', index=False)
        
        # Лист с ручными расходами
        if manual_expenses:
            expenses_list = []
            for e in manual_expenses:
                expenses_list.append({
                    "Дата": e["expense_date"].isoformat() if isinstance(e["expense_date"], datetime) else str(e["expense_date"]),
                    "Тип": e.get("expense_type", ""),
                    "Сумма": e.get("amount", 0),
                    "№ документа": e.get("document_number", ""),
                    "Описание": e.get("description", "")
                })
            df_expenses = pd.DataFrame(expenses_list)
            df_expenses.to_excel(writer, sheet_name='Ручные расходы', index=False)
    
    output.seek(0)
    filename = f"ozon_report_{period_start}_{period_end}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# УПРАВЛЕНИЕ ЗАКУПОЧНЫМИ ЦЕНАМИ (COGS)
# ============================================================================

@router.get("/products-with-prices")
async def get_products_with_purchase_prices(
    current_user: dict = Depends(get_current_user)
):
    """Получить список товаров с закупочными ценами для управления COGS"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    # Получаем товары из каталога
    products = await db.product_catalog.find(
        {"seller_id": seller_id},
        {"article": 1, "name": 1, "price": 1, "purchase_price": 1, "marketplace": 1}
    ).to_list(1000)
    
    result = []
    for p in products:
        result.append({
            "_id": str(p.get("_id", "")),
            "article": p.get("article", ""),
            "name": p.get("name", "")[:100],  # Ограничиваем длину
            "price": p.get("price", 0),
            "purchase_price": p.get("purchase_price", 0),
            "marketplace": p.get("marketplace", ""),
            "margin_pct": ((p.get("price", 0) - p.get("purchase_price", 0)) / p.get("price", 1) * 100) 
                          if p.get("price", 0) > 0 and p.get("purchase_price") else 0
        })
    
    return {
        "products": result,
        "total": len(result),
        "with_price": sum(1 for p in result if p["purchase_price"] > 0)
    }


@router.post("/update-purchase-prices")
async def update_purchase_prices(
    updates: dict,  # {"article1": 100.50, "article2": 200.00}
    current_user: dict = Depends(get_current_user)
):
    """Массовое обновление закупочных цен"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    updated_count = 0
    errors = []
    
    for article, price in updates.items():
        try:
            price_float = float(price)
            if price_float < 0:
                errors.append(f"{article}: цена не может быть отрицательной")
                continue
            
            result = await db.product_catalog.update_one(
                {"seller_id": seller_id, "article": article},
                {"$set": {"purchase_price": price_float, "updated_at": datetime.utcnow()}}
            )
            
            if result.matched_count > 0:
                updated_count += 1
            else:
                errors.append(f"{article}: товар не найден")
        except Exception as e:
            errors.append(f"{article}: {str(e)}")
    
    return {
        "status": "success",
        "updated": updated_count,
        "errors": errors if errors else None
    }


@router.post("/import-purchase-prices")
async def import_purchase_prices_from_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Импорт закупочных цен из CSV/Excel файла"""
    seller_id = str(current_user["_id"])
    
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Поддерживаются только CSV и Excel файлы")
    
    content = await file.read()
    
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
        
        # Проверяем наличие нужных колонок
        required_cols = ['article', 'purchase_price']
        if not all(col in df.columns for col in required_cols):
            raise HTTPException(
                status_code=400,
                detail=f"Файл должен содержать колонки: {', '.join(required_cols)}"
            )
        
        # Преобразуем в словарь
        updates = {}
        for _, row in df.iterrows():
            article = str(row['article']).strip()
            price = float(row['purchase_price'])
            if article and price >= 0:
                updates[article] = price
        
        # Используем существующий endpoint для обновления
        db = await get_database()
        updated_count = 0
        errors = []
        
        for article, price in updates.items():
            try:
                result = await db.product_catalog.update_one(
                    {"seller_id": seller_id, "article": article},
                    {"$set": {"purchase_price": price, "updated_at": datetime.utcnow()}}
                )
                if result.matched_count > 0:
                    updated_count += 1
                else:
                    errors.append(f"{article}: товар не найден")
            except Exception as e:
                errors.append(f"{article}: {str(e)}")
        
        return {
            "status": "success",
            "imported": len(updates),
            "updated": updated_count,
            "errors": errors[:10] if errors else None  # Показываем только первые 10 ошибок
        }
        
    except Exception as e:
        logger.error(f"Import error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка импорта: {str(e)}")


# ============================================================================
# РУЧНОЕ УПРАВЛЕНИЕ РАСХОДАМИ
# ============================================================================


@router.get("/tags-list")
async def get_tags_list(
    current_user: dict = Depends(get_current_user)
):
    """Получить список уникальных тегов/артикулов из транзакций"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    # Получаем уникальные артикулы
    articles = await db.ozon_transactions.distinct("article", {"seller_id": seller_id})
    
    return {
        "tags": sorted([a for a in articles if a]),
        "total": len(articles)
    }


@router.post("/add-expense")
async def add_manual_expense(
    expense_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Добавить ручной расход (УПД, агентские услуги и т.д.)"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    # Валидация
    required_fields = ["expense_date", "expense_type", "amount"]
    for field in required_fields:
        if field not in expense_data:
            raise HTTPException(status_code=400, detail=f"Поле {field} обязательно")
    
    try:
        expense_date = datetime.fromisoformat(expense_data["expense_date"])
    except:
        raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    amount = float(expense_data["amount"])
    if amount < 0:
        raise HTTPException(status_code=400, detail="Сумма не может быть отрицательной")
    
    expense = {
        "seller_id": seller_id,
        "expense_date": expense_date,
        "expense_type": expense_data["expense_type"],
        "amount": amount,
        "description": expense_data.get("description", ""),
        "document_number": expense_data.get("document_number", ""),
        "created_at": datetime.utcnow()
    }
    
    result = await db.ozon_manual_expenses.insert_one(expense)
    expense["_id"] = str(result.inserted_id)
    expense["expense_date"] = expense["expense_date"].isoformat()
    expense["created_at"] = expense["created_at"].isoformat()
    
    return {
        "status": "success",
        "expense": expense
    }


@router.get("/expenses")
async def get_manual_expenses(
    period_start: Optional[str] = Query(None),
    period_end: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Получить список ручных расходов"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    match_filter = {"seller_id": seller_id}
    
    if period_start and period_end:
        try:
            date_from = datetime.fromisoformat(f"{period_start}T00:00:00")
            date_to = datetime.fromisoformat(f"{period_end}T23:59:59")
            match_filter["expense_date"] = {"$gte": date_from, "$lte": date_to}
        except:
            pass
    
    expenses = await db.ozon_manual_expenses.find(match_filter).sort("expense_date", -1).to_list(1000)
    
    for e in expenses:
        e["_id"] = str(e["_id"])


# ============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================================================

@router.get("/products-list")
async def get_products_list(
    current_user: dict = Depends(get_current_user)
):
    """Получить список уникальных товаров из транзакций"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    # Получаем уникальные товары из транзакций
    pipeline = [
        {"$match": {"seller_id": seller_id}},
        {"$group": {
            "_id": "$article",
            "product_name": {"$first": "$product_name"},
            "sku": {"$first": "$sku"},
            "total_quantity": {"$sum": "$quantity"},
            "total_revenue": {"$sum": "$realized_amount"}
        }},
        {"$sort": {"total_revenue": -1}},
        {"$limit": 200}
    ]
    
    products = await db.ozon_transactions.aggregate(pipeline).to_list(200)
    
    result = []
    for p in products:
        result.append({
            "article": p["_id"],
            "name": p["product_name"][:80] if p["product_name"] else "",
            "sku": p.get("sku", ""),
            "display": f"{p['_id']} - {p['product_name'][:50]}" if p['product_name'] else p['_id']
        })
    


@router.get("/trends")
async def get_trends_data(
    period_start: str,
    period_end: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить данные для графиков - динамика по дням"""
    seller_id = str(current_user["_id"])
    
    try:
        date_from = datetime.fromisoformat(f"{period_start}T00:00:00")
        date_to = datetime.fromisoformat(f"{period_end}T23:59:59")
    except:
        raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    db = await get_database()
    
    # Агрегируем транзакции по дням
    pipeline = [
        {
            "$match": {
                "seller_id": seller_id,
                "operation_date": {"$gte": date_from, "$lte": date_to}
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$operation_date"
                    }
                },
                "revenue": {"$sum": "$realized_amount"},
                "loyalty": {"$sum": "$loyalty_payments"},
                "discounts": {"$sum": "$discount_points"},
                "commission": {"$sum": "$ozon_base_commission"},
                "returns": {"$sum": "$total_returned"},
                "transactions_count": {"$sum": 1}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]
    
    daily_data = await db.ozon_transactions.aggregate(pipeline).to_list(100)
    
    # Преобразуем для фронтенда
    trends = []
    for day in daily_data:
        gross_revenue = day["revenue"] + day["loyalty"] + day["discounts"]
        net_revenue = gross_revenue - day["returns"]
        profit = net_revenue - day["commission"]
        
        trends.append({
            "date": day["_id"],
            "revenue": round(gross_revenue, 2),
            "net_revenue": round(net_revenue, 2),
            "commission": round(day["commission"], 2),
            "returns": round(day["returns"], 2),
            "profit": round(profit, 2),
            "transactions": day["transactions_count"]
        })
    
    return {
        "trends": trends,
        "total_days": len(trends)
    }



@router.delete("/expense/{expense_id}")
async def delete_manual_expense(
    expense_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить ручной расход"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    from bson import ObjectId
    
    result = await db.ozon_manual_expenses.delete_one({
        "_id": ObjectId(expense_id),
        "seller_id": seller_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Расход не найден")
    
    return {"status": "success", "deleted": expense_id}



# ============================================================================
# НАСТРОЙКИ НАЛОГООБЛОЖЕНИЯ
# ============================================================================

@router.get("/tax-settings")
async def get_tax_settings(
    current_user: dict = Depends(get_current_user)
):
    """Получить настройки налогообложения"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    settings = await db.tax_settings.find_one({"seller_id": seller_id})
    
    if not settings:
        # Возвращаем настройки по умолчанию
        return {
            "tax_system": None,
            "rate": 0,
            "effective_from": None
        }
    
    settings["_id"] = str(settings["_id"])
    if settings.get("effective_from"):
        settings["effective_from"] = settings["effective_from"].isoformat()
    
    return settings


@router.post("/tax-settings")
async def save_tax_settings(
    settings_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Сохранить настройки налогообложения"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    # Валидация
    if "tax_system" not in settings_data:
        raise HTTPException(status_code=400, detail="Укажите систему налогообложения")
    
    tax_system = settings_data["tax_system"]
    
    # Определяем ставку по системе
    tax_rates = {
        "usn_income": 6.0,
        "usn_income_expense": 15.0,
        "osn": 20.0,
        "patent": 6.0,
        "eshn": 6.0
    }
    
    rate = tax_rates.get(tax_system, 0)
    
    settings = {
        "seller_id": seller_id,
        "tax_system": tax_system,
        "rate": rate,
        "effective_from": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.tax_settings.update_one(
        {"seller_id": seller_id},
        {"$set": settings},
        upsert=True
    )
    
    return {
        "status": "success",
        "settings": {
            "tax_system": tax_system,
            "rate": rate
        }
    }


# ============================================================================
# ИСТОРИЯ ЗАГРУЖЕННЫХ ОТЧЕТОВ
# ============================================================================

@router.get("/reports-history")
async def get_reports_history(
    current_user: dict = Depends(get_current_user)
):
    """Получить историю загруженных отчетов"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    reports = await db.ozon_reports.find(
        {"seller_id": seller_id}
    ).sort("uploaded_at", -1).to_list(100)
    
    for r in reports:
        r["_id"] = str(r["_id"])
        r["uploaded_at"] = r["uploaded_at"].isoformat()
    
    return {
        "reports": reports,
        "total": len(reports)
    }


@router.delete("/report/{report_id}")
async def delete_report(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить отчет и все связанные транзакции"""
    seller_id = str(current_user["_id"])
    db = await get_database()
    
    from bson import ObjectId
    
    # Проверяем существование отчета
    report = await db.ozon_reports.find_one({
        "_id": ObjectId(report_id),
        "seller_id": seller_id
    })
    
    if not report:
        raise HTTPException(status_code=404, detail="Отчет не найден")
    
    # Удаляем связанные транзакции
    trans_result = await db.ozon_transactions.delete_many({
        "seller_id": seller_id,
        "report_id": report_id
    })
    
    # Удаляем сам отчет
    await db.ozon_reports.delete_one({
        "_id": ObjectId(report_id)
    })
    
    return {
        "status": "success",
        "deleted_report": report_id,
        "deleted_transactions": trans_result.deleted_count
    }

