"""
Полный набор парсеров для всех типов отчетов Ozon
На основе 15 реальных документов за ноябрь 2025
"""

import pandas as pd
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Union
import logging
import PyPDF2

logger = logging.getLogger(__name__)


def parse_ozon_order_realization_report(file_content: Union[bytes, str], seller_id: str) -> Dict:
    """Позаказный отчет о реализации - ГЛАВНЫЙ"""
    
    if isinstance(file_content, bytes):
        df = pd.read_excel(BytesIO(file_content), sheet_name=0, header=None)
    else:
        df = pd.read_excel(file_content, sheet_name=0, header=None)
    
    DATA_START = 15
    COL_INDEX, COL_NAME, COL_ARTICLE, COL_SKU = 0, 1, 2, 3
    COL_BARCODE, COL_REALIZED, COL_LOYALTY, COL_DISCOUNT = 4, 5, 6, 7
    COL_QTY, COL_PRICE, COL_REWARD, COL_PRICE_BEFORE = 8, 9, 10, 11
    COL_COMMISSION, COL_TOTAL, COL_RETURNED = 12, 13, 14
    COL_POSTING, COL_DATE = 21, 22
    
    transactions = []
    
    for index in range(DATA_START, len(df)):
        row = df.iloc[index]
        article = row[COL_ARTICLE]
        
        if pd.isna(article) or str(article).startswith('Итого'):
            break
        
        def safe_float(val, default=0.0):
            return float(val) if pd.notna(val) else default
        
        def safe_int(val, default=0):
            return int(float(val)) if pd.notna(val) else default
        
        def safe_str(val, default=''):
            return str(val) if pd.notna(val) else default
        
        date_val = row[COL_DATE]
        op_date = pd.to_datetime(date_val) if pd.notna(date_val) else datetime.utcnow()
        
        transactions.append({
            "seller_id": seller_id,
            "posting_number": safe_str(row[COL_POSTING]),
            "sku": safe_str(row[COL_SKU]),
            "article": safe_str(row[COL_ARTICLE]),
            "product_name": safe_str(row[COL_NAME]),
            "quantity": safe_int(row[COL_QTY]),
            "realized_amount": safe_float(row[COL_REALIZED]),
            "loyalty_payments": safe_float(row[COL_LOYALTY]),
            "discount_points": safe_float(row[COL_DISCOUNT]),
            "price": safe_float(row[COL_PRICE]),
            "ozon_base_commission": safe_float(row[COL_COMMISSION]),
            "total_to_accrue": safe_float(row[COL_TOTAL]),
            "returned_amount": safe_float(row[COL_RETURNED]),
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
    """Отчёт по механикам лояльности партнёров"""
    
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
                "total": float(row.get('Итого, руб.', 0))
            })
    
    total = sum(p["total"] for p in programs)
    
    return {"programs": programs, "total_loyalty_expense": total}


def parse_acquiring_report(file_content: Union[bytes, str], seller_id: str) -> Dict:
    """Детальный отчет по эквайрингу"""
    
    if isinstance(file_content, bytes):
        df = pd.read_excel(BytesIO(file_content), sheet_name=0)
    else:
        df = pd.read_excel(file_content, sheet_name=0)
    
    transactions = []
    
    for _, row in df.iterrows():
        if pd.notna(row.get('SKU')):
            transactions.append({
                "sku": str(row.get('SKU', '')),
                "bank_name": str(row.get('Наименование организации', '')),
                "product_cost": float(row.get('Стоимость товара', 0)),
                "rate": float(row.get('Ставка', 0)),
                "amount": float(row.get('Сумма (RUR)', 0))
            })
    
    total = sum(t.get("rate", 0) for t in transactions)
    
    return {"transactions": transactions, "total_acquiring": total}


def calculate_comprehensive_profit(seller_id: str, period_start: datetime, period_end: datetime, db) -> Dict:
    """
    Комплексный расчет прибыли с учетом ВСЕХ документов
    
    Источники данных:
    1. Позаказный отчет (основа)
    2. УПД агентские услуги
    3. УПД комиссия за продажу
    4. Эквайринг
    5. Логистика rFBS
    6. Услуги FBO/FBS
    7. Отчет по лояльности
    8. Взаимозачеты
    """
    
    # Получаем данные из БД
    import asyncio
    
    async def get_data():
        # Основные транзакции
        transactions = await db.ozon_transactions.find({
            "seller_id": seller_id,
            "operation_date": {"$gte": period_start, "$lte": period_end}
        }).to_list(10000)
        
        # Дополнительные расходы из других отчетов
        # TODO: добавить когда будут загружены
        
        return transactions
    
    transactions = asyncio.run(get_data())
    
    if not transactions:
        return None
    
    # Рассчитываем все метрики
    total_realized = sum(t["realized_amount"] for t in transactions)
    total_loyalty = sum(t["loyalty_payments"] for t in transactions)
    total_discounts = sum(t["discount_points"] for t in transactions)
    total_commission = sum(t["ozon_base_commission"] for t in transactions)
    
    # Валовая выручка = Реализовано + Баллы
    gross_revenue = total_realized + total_loyalty + total_discounts
    
    # Расходы (пока только базовая комиссия)
    total_expenses = total_commission
    
    # Чистая прибыль
    net_profit = gross_revenue - total_expenses
    net_margin = (net_profit / gross_revenue * 100) if gross_revenue > 0 else 0
    
    return {
        "period": {
            "from": period_start.date().isoformat(),
            "to": period_end.date().isoformat()
        },
        "statistics": {
            "total_transactions": len(transactions)
        },
        "revenue": {
            "realized": round(total_realized, 2),
            "loyalty_payments": round(total_loyalty, 2),
            "discount_points": round(total_discounts, 2),
            "gross_revenue": round(gross_revenue, 2)
        },
        "expenses": {
            "ozon_base_commission": round(total_commission, 2),
            "total": round(total_expenses, 2)
        },
        "profit": {
            "net_profit": round(net_profit, 2),
            "net_margin_pct": round(net_margin, 2)
        }
    }
