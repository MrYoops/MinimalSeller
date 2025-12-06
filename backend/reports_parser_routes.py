"""
Парсинг Excel отчетов от маркетплейсов (Ozon, Wildberries, Яндекс.Маркет)
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from typing import Optional
from datetime import datetime
import pandas as pd
from io import BytesIO
import uuid

from database import get_database
from auth_utils import get_current_user
from profit_analytics_routes import OzonFinancialTransaction

router = APIRouter(prefix="/api/reports", tags=["reports"])


async def parse_ozon_transaction_excel(file_content: bytes, seller_id: str) -> list:
    """
    Парсинг Excel отчета о транзакциях от Ozon
    
    Поддерживаемые отчеты:
    - Отчет о суммах услуг и расходах на реализацию
    - УПД-1 к отчету о реализации
    - Отчет о перевыставлении услуг
    """
    try:
        df = pd.read_excel(BytesIO(file_content), sheet_name=0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка чтения Excel файла: {str(e)}")
    
    transactions = []
    
    # Попробуем определить тип отчета по колонкам
    columns = [str(col).lower() for col in df.columns]
    
    # Если есть колонки характерные для финансового отчета Ozon
    if any('постинг' in col or 'posting' in col for col in columns):
        # Парсим построчно
        for index, row in df.iterrows():
            try:
                # Базовые поля
                operation_date_str = row.get('Дата операции') or row.get('operation_date')
                posting_number = row.get('Номер отправления') or row.get('posting_number')
                amount = row.get('Цена продажи') or row.get('amount') or 0
                
                if pd.isna(operation_date_str) or pd.isna(posting_number):
                    continue
                
                # Парсим дату
                if isinstance(operation_date_str, str):
                    operation_date = datetime.fromisoformat(operation_date_str.replace('Z', '+00:00'))
                else:
                    operation_date = pd.to_datetime(operation_date_str)
                
                # Расходы
                commission = row.get('Комиссия') or row.get('commission') or 0
                logistics = row.get('Логистика') or row.get('logistics') or 0
                services = row.get('Услуги') or row.get('services') or 0
                
                # Товары
                product_name = row.get('Товар') or row.get('product_name') or ''
                sku = row.get('Артикул') or row.get('sku') or ''
                quantity = row.get('Количество') or row.get('quantity') or 1
                
                transaction = {
                    "seller_id": seller_id,
                    "marketplace": "ozon",
                    "transaction_id": f"EXCEL-{uuid.uuid4()}",
                    "order_id": str(posting_number),
                    "posting_number": str(posting_number),
                    "operation_date": operation_date,
                    "operation_type": "orders",
                    "amount": float(amount) if not pd.isna(amount) else 0.0,
                    "breakdown": {
                        "commission": {
                            "base_commission": float(commission) if not pd.isna(commission) else 0.0,
                            "bonus_commission": 0.0,
                            "total": float(commission) if not pd.isna(commission) else 0.0
                        },
                        "logistics": {
                            "delivery_to_customer": float(logistics) if not pd.isna(logistics) else 0.0,
                            "last_mile": 0.0,
                            "returns": 0.0,
                            "total": float(logistics) if not pd.isna(logistics) else 0.0
                        },
                        "services": {
                            "storage": 0.0,
                            "acquiring": 0.0,
                            "pvz_fee": 0.0,
                            "packaging": 0.0,
                            "total": float(services) if not pd.isna(services) else 0.0
                        },
                        "penalties": {"total": 0.0},
                        "other_charges": {"total": 0.0}
                    },
                    "items": [{
                        "sku": str(sku),
                        "name": str(product_name),
                        "quantity": int(quantity) if not pd.isna(quantity) else 1,
                        "price": float(amount) if not pd.isna(amount) else 0.0
                    }],
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "data_source": "excel",
                    "raw_data": {}
                }
                
                transactions.append(transaction)
                
            except Exception as e:
                print(f"Ошибка парсинга строки {index}: {str(e)}")
                continue
    
    return transactions


@router.post("/upload-excel")
async def upload_excel_report(
    file: UploadFile = File(...),
    marketplace: str = Form(...),
    date_from: str = Form(...),
    date_to: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Загрузить Excel отчет от маркетплейса
    
    Поддерживаемые маркетплейсы: ozon, wb, yandex
    """
    seller_id = str(current_user["_id"])
    
    # Проверяем расширение файла
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(
            status_code=400,
            detail="Неподдерживаемый формат файла. Используйте .xlsx, .xls или .csv"
        )
    
    # Читаем содержимое файла
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка чтения файла: {str(e)}")
    
    # Парсим в зависимости от маркетплейса
    transactions = []
    
    if marketplace == "ozon":
        transactions = await parse_ozon_transaction_excel(content, seller_id)
    elif marketplace == "wb":
        raise HTTPException(status_code=501, detail="Парсинг Wildberries пока не реализован")
    elif marketplace == "yandex":
        raise HTTPException(status_code=501, detail="Парсинг Яндекс.Маркет пока не реализован")
    else:
        raise HTTPException(status_code=400, detail="Неизвестный маркетплейс")
    
    if not transactions:
        raise HTTPException(
            status_code=400,
            detail="Не удалось распарсить транзакции из файла. Проверьте формат отчета."
        )
    
    # Сохраняем в БД
    db = await get_database()
    saved_count = 0
    
    for transaction in transactions:
        result = await db.marketplace_transactions.update_one(
            {
                "seller_id": seller_id,
                "marketplace": marketplace,
                "order_id": transaction["order_id"],
                "operation_date": transaction["operation_date"]
            },
            {"$set": transaction},
            upsert=True
        )
        
        if result.upserted_id or result.modified_count > 0:
            saved_count += 1
    
    # Сохраняем информацию о загруженном отчете
    report_record = {
        "seller_id": seller_id,
        "marketplace": marketplace,
        "report_type": "excel_upload",
        "file_name": file.filename,
        "period_start": datetime.fromisoformat(f"{date_from}T00:00:00"),
        "period_end": datetime.fromisoformat(f"{date_to}T23:59:59"),
        "status": "processed",
        "parsed_data": {
            "total_transactions": len(transactions),
            "transactions_saved": saved_count
        },
        "uploaded_at": datetime.utcnow(),
        "processed_at": datetime.utcnow()
    }
    
    await db.marketplace_reports.insert_one(report_record)
    
    return {
        "status": "success",
        "message": "Отчет успешно загружен и обработан",
        "file_name": file.filename,
        "statistics": {
            "total_rows": len(transactions),
            "saved_transactions": saved_count
        }
    }


@router.get("/list")
async def get_uploaded_reports(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Получить список загруженных отчетов"""
    seller_id = str(current_user["_id"])
    
    db = await get_database()
    
    reports = await db.marketplace_reports.find({
        "seller_id": seller_id
    }).sort("uploaded_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total_count = await db.marketplace_reports.count_documents({"seller_id": seller_id})
    
    for report in reports:
        report["_id"] = str(report["_id"])
        report["uploaded_at"] = report["uploaded_at"].isoformat()
        report["processed_at"] = report.get("processed_at", report["uploaded_at"]).isoformat()
        report["period_start"] = report["period_start"].isoformat()
        report["period_end"] = report["period_end"].isoformat()
    
    return {
        "reports": reports,
        "total_count": total_count
    }
