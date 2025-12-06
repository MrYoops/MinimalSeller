import pandas as pd
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Union
import logging

logger = logging.getLogger(__name__)


def parse_ozon_order_realization_report(file_content: Union[bytes, str], seller_id: str) -> Dict:
    if isinstance(file_content, bytes):
        df = pd.read_excel(BytesIO(file_content), sheet_name=0, header=None)
    else:
        df = pd.read_excel(file_content, sheet_name=0, header=None)
    
    DATA_START = 15
    transactions = []
    
    for index in range(DATA_START, len(df)):
        row = df.iloc[index]
        article = row[2]
        
        if pd.isna(article) or str(article).startswith('Итого'):
            break
        
        def sf(val, d=0.0): return float(val) if pd.notna(val) else d
        def si(val, d=0): return int(float(val)) if pd.notna(val) else d
        def ss(val, d=''): return str(val) if pd.notna(val) else d
        
        date_val = row[22]
        op_date = pd.to_datetime(date_val) if pd.notna(date_val) else datetime.utcnow()
        
        transactions.append({
            "seller_id": seller_id,
            "posting_number": ss(row[21]),
            "sku": ss(row[3]),
            "article": ss(row[2]),
            "product_name": ss(row[1]),
            "quantity": si(row[8]),
            "realized_amount": sf(row[5]),
            "loyalty_payments": sf(row[6]),
            "discount_points": sf(row[7]),
            "price": sf(row[9]),
            "ozon_base_commission": sf(row[12]),
            "total_to_accrue": sf(row[13]),
            "returned_amount": sf(row[14]),
            "operation_date": op_date,
            "document_type": "order_realization",
            "created_at": datetime.utcnow()
        })
    
    totals = {
        "total_transactions": len(transactions),
        "total_revenue": sum(t["realized_amount"] for t in transactions),
        "total_loyalty": sum(t["loyalty_payments"] for t in transactions),
        "total_discounts": sum(t["discount_points"] for t in transactions),
        "total_commission": sum(t["ozon_base_commission"] for t in transactions),
        "total_to_accrue": sum(t["total_to_accrue"] for t in transactions)
    }
    
    return {"transactions": transactions, "summary": totals}


def parse_loyalty_report(file_content: Union[bytes, str], seller_id: str) -> Dict:
    if isinstance(file_content, bytes):
        df = pd.read_excel(BytesIO(file_content), sheet_name=0)
    else:
        df = pd.read_excel(file_content, sheet_name=0)
    
    programs = []
    
    for _, row in df.iterrows():
        if pd.notna(row.get('Партнерская программа')):
            programs.append({
                "seller_id": seller_id,
                "program_name": str(row.get('Партнерская программа', '')),
                "partner_inn": str(row.get('ИНН партнера', '')),
                "to_accrue": float(row.get('К начислению, руб.', 0)),
                "to_return": float(row.get('К возврату, руб.', 0)),
                "total": float(row.get('Итого, руб.', 0)),
                "created_at": datetime.utcnow()
            })
    
    total = sum(p["total"] for p in programs)
    return {"programs": programs, "total_loyalty_expense": total}


def parse_acquiring_report(file_content: Union[bytes, str], seller_id: str) -> Dict:
    if isinstance(file_content, bytes):
        df = pd.read_excel(BytesIO(file_content), sheet_name=0)
    else:
        df = pd.read_excel(file_content, sheet_name=0)
    
    transactions = []
    
    for _, row in df.iterrows():
        if pd.notna(row.get('SKU')):
            transactions.append({
                "seller_id": seller_id,
                "sku": str(row.get('SKU', '')),
                "bank_name": str(row.get('Наименование организации', '')),
                "product_cost": float(row.get('Стоимость товара', 0)),
                "rate": float(row.get('Ставка', 0)),
                "amount": float(row.get('Сумма (RUR)', 0)),
                "created_at": datetime.utcnow()
            })
    
    total = sum(t.get("rate", 0) for t in transactions)
    return {"transactions": transactions, "total_acquiring": total}


def parse_rfbs_logistics_report(file_content: Union[bytes, str], seller_id: str) -> Dict:
    if isinstance(file_content, bytes):
        df = pd.read_excel(BytesIO(file_content), sheet_name=0)
    else:
        df = pd.read_excel(file_content, sheet_name=0)
    
    services = []
    
    # Попробуем найти колонки
    for _, row in df.iterrows():
        # Ищем номер отправления и суммы
        posting = None
        total_amount = 0
        
        for col in df.columns:
            if 'Номер' in str(col) or 'SKU' in str(col):
                posting = row.get(col)
            if 'Логистика прямой поток' in str(col):
                total_amount += float(row.get(col, 0))
            if 'Логистика обратный поток' in str(col):
                total_amount += float(row.get(col, 0))
        
        if posting and pd.notna(posting):
            services.append({
                "seller_id": seller_id,
                "posting_number": str(posting),
                "total_logistics": total_amount,
                "created_at": datetime.utcnow()
            })
    
    total = sum(s.get("total_logistics", 0) for s in services)
    return {"services": services, "total_rfbs_logistics": total}


def parse_fbo_fbs_services_report(file_content: Union[bytes, str], seller_id: str) -> Dict:
    if isinstance(file_content, bytes):
        df = pd.read_excel(BytesIO(file_content), sheet_name=0)
    else:
        df = pd.read_excel(file_content, sheet_name=0)
    
    services = []
    total_sum = 0
    
    for _, row in df.iterrows():
        # Ищем суммы услуг
        for col in df.columns:
            if 'Сумма' in str(col) and 'НДС' not in str(col):
                amount = float(row.get(col, 0))
                if amount > 0:
                    total_sum += amount
    
    return {"services": services, "total_fbo_fbs_services": total_sum}
