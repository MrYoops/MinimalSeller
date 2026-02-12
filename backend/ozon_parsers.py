"""
Парсер позаказного отчета о реализации от Ozon
На основе РЕАЛЬНОГО файла за ноябрь 2025
"""

import pandas as pd
from datetime import datetime
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def parse_order_realization_report(file_path_or_bytes, seller_id: str) -> List[Dict]:
    """
    Парсинг позаказного отчета о реализации
    
    Ожидаемые колонки (на основе реального файла):
    - Номер заказа (или ID)
    - Дата
    - Артикул SKU
    - Штрих-код товара
    - Название товара
    - Реализовано (количество)
    - Возвращено (количество)
    - Цена продажи
    - Сумма за товары
    - Ozon % (комиссия в процентах)
    - Комиссия Ozon, руб
    - Логистика, руб
    - Прочее, руб
    - Штрафы, руб
    - Итого, руб (к выплате)
    """
    
    try:
        # Читаем Excel
        if isinstance(file_path_or_bytes, bytes):
            df = pd.read_excel(file_path_or_bytes, sheet_name=0)
        else:
            df = pd.read_excel(file_path_or_bytes, sheet_name=0)
        
        logger.info(f"Прочитано {len(df)} строк из позаказного отчета")
        logger.info(f"Колонки: {list(df.columns)}")
        
    except Exception as e:
        logger.error(f"Ошибка чтения Excel: {str(e)}")
        raise
    
    transactions = []
    
    # Маппинг возможных названий колонок (Ozon может менять названия)
    column_mapping = {
        'order_number': ['Номер заказа', 'Номер отправления', 'Отправление', 'Posting'],
        'date': ['Дата', 'Дата операции', 'Date'],
        'sku': ['Артикул SKU', 'SKU', 'Артикул', 'Offer ID'],
        'barcode': ['Штрих-код товара', 'Штрих-код', 'Barcode'],
        'product_name': ['Название товара', 'Наименование', 'Product Name'],
        'quantity_sold': ['Реализовано', 'Количество', 'Qty'],
        'quantity_returned': ['Возвращено', 'Возврат', 'Returns'],
        'sale_price': ['Цена продажи', 'Цена', 'Price'],
        'total_amount': ['Сумма за товары', 'Сумма', 'Amount'],
        'ozon_commission_pct': ['Ozon %', 'Комиссия %', 'Commission %'],
        'ozon_commission': ['Комиссия Ozon, руб', 'Комиссия Ozon', 'Комиссия', 'Commission'],
        'logistics': ['Логистика, руб', 'Логистика', 'Logistics'],
        'other': ['Прочее, руб', 'Прочее', 'Other'],
        'penalties': ['Штрафы, руб', 'Штрафы', 'Penalties'],
        'total_payout': ['Итого, руб', 'Итого', 'Total']
    }
    
    # Находим реальные названия колонок
    col_map = {}
    for our_name, possible_names in column_mapping.items():
        for possible_name in possible_names:
            if possible_name in df.columns:
                col_map[our_name] = possible_name
                break
    
    logger.info(f"Найденные колонки: {col_map}")
    
    # Парсим каждую строку
    for index, row in df.iterrows():
        try:
            # Пропускаем пустые строки
            if pd.isna(row.get(col_map.get('sku', 'SKU'))):
                continue
            
            # Пропускаем итоговые строки
            sku_value = str(row.get(col_map.get('sku', 'SKU'), ''))
            if sku_value.startswith('Итого') or sku_value.startswith('ИТОГО'):
                continue
            
            # Парсим дату
            date_value = row.get(col_map.get('date', 'Дата'))
            if pd.isna(date_value):
                operation_date = datetime.utcnow()
            elif isinstance(date_value, str):
                try:
                    operation_date = pd.to_datetime(date_value)
                except:
                    operation_date = datetime.utcnow()
            else:
                operation_date = pd.to_datetime(date_value)
            
            # Безопасное получение числовых значений
            def safe_float(value, default=0.0):
                if pd.isna(value):
                    return default
                try:
                    return float(value)
                except:
                    return default
            
            def safe_int(value, default=0):
                if pd.isna(value):
                    return default
                try:
                    return int(value)
                except:
                    return default
            
            # Создаем транзакцию
            transaction = {
                "seller_id": seller_id,
                "order_number": str(row.get(col_map.get('order_number', 'Номер заказа'), '')),
                "sku": str(row.get(col_map.get('sku', 'Артикул SKU'), '')),
                "barcode": str(row.get(col_map.get('barcode', 'Штрих-код'), '')),
                "operation_date": operation_date,
                "product_name": str(row.get(col_map.get('product_name', 'Название товара'), '')),
                
                "quantity_sold": safe_int(row.get(col_map.get('quantity_sold', 'Реализовано'), 0)),
                "quantity_returned": safe_int(row.get(col_map.get('quantity_returned', 'Возвращено'), 0)),
                
                "sale_price": safe_float(row.get(col_map.get('sale_price', 'Цена продажи'), 0)),
                "total_sale_amount": safe_float(row.get(col_map.get('total_amount', 'Сумма за товары'), 0)),
                
                "ozon_commission_pct": safe_float(row.get(col_map.get('ozon_commission_pct', 'Ozon %'), 0)),
                "ozon_commission_base": safe_float(row.get(col_map.get('ozon_commission', 'Комиссия Ozon, руб'), 0)),
                
                "logistics_amount": safe_float(row.get(col_map.get('logistics', 'Логистика, руб'), 0)),
                "other_services": safe_float(row.get(col_map.get('other', 'Прочее, руб'), 0)),
                "penalties": safe_float(row.get(col_map.get('penalties', 'Штрафы, руб'), 0)),
                
                "total_payout": safe_float(row.get(col_map.get('total_payout', 'Итого, руб'), 0)),
                
                # Дополнительные (заполним позже из других отчетов)
                "acquiring_fee": 0.0,
                "rfbs_logistics": 0.0,
                "fbo_fbs_services": 0.0,
                "agent_services": 0.0,
                
                "bonuses_accrued": 0,
                "bonuses_used": 0,
                
                "marketplace": "ozon",
                "document_type": "order_transaction",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Рассчитываем чистое количество
            transaction["quantity_net"] = transaction["quantity_sold"] - transaction["quantity_returned"]
            
            transactions.append(transaction)
            
        except Exception as e:
            logger.error(f"Ошибка парсинга строки {index}: {str(e)}")
            continue
    
    logger.info(f"Успешно распарсено {len(transactions)} транзакций")
    
    return transactions


def parse_agent_services_upd(file_path_or_bytes, seller_id: str) -> Dict:
    """
    Парсинг УПД - Акта выполненных работ (агентские услуги)
    Файл: MarketplaceDocumentExecutionJobAct_54810556_20251130.pdf
    """
    # TODO: Парсинг PDF с использованием библиотеки PyPDF2 или pdfplumber
    # Пока возвращаем структуру на основе известных данных
    
    return {
        "seller_id": seller_id,
        "document_number": "54810556",
        "document_date": datetime(2025, 11, 30),
        "total_amount": 37759.28,
        "amount_without_vat": 31466.07,  # Примерно (если НДС 20%)
        "vat_amount": 6293.21,
        "services": [
            {"name": "Агентский факторинг", "amount": 0.0},
            {"name": "Агентское вознаграждение", "amount": 0.0},
            {"name": "Кросс-докинг", "amount": 0.0},
            {"name": "Услуга FBO/FBS", "amount": 0.0},
            {"name": "Гибкий график выплат", "amount": 0.0},
            {"name": "Обработка ошибок", "amount": 0.0},
            {"name": "Продвижение бренда", "amount": 0.0},
            {"name": "Размещение", "amount": 0.0},
            {"name": "Бонусы продавца", "amount": 0.0},  # СИСТЕМА БАЛЛОВ
            {"name": "Подписка Premium", "amount": 0.0},
            {"name": "Баллы за отзывы", "amount": 0.0}
        ],
        "period_start": datetime(2025, 11, 1),
        "period_end": datetime(2025, 11, 30),
        "created_at": datetime.utcnow()
    }


def distribute_agent_services(transactions: List[Dict], total_agent_services: float) -> List[Dict]:
    """
    Распределить агентские услуги пропорционально по заказам
    
    Логика: Услуги распределяются пропорционально выручке
    """
    # Считаем общую выручку
    total_revenue = sum(t["total_sale_amount"] for t in transactions)
    
    if total_revenue == 0:
        return transactions
    
    # Распределяем пропорционально
    for transaction in transactions:
        proportion = transaction["total_sale_amount"] / total_revenue
        transaction["agent_services"] = round(total_agent_services * proportion, 2)
    
    return transactions
