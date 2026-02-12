"""
Парсер позаказного отчета о реализации от Ozon
На основе РЕАЛЬНОЙ структуры файла за ноябрь 2025

Ключевые находки:
- Данные начинаются со строки 15
- Заголовки на строке 13
- Есть ДВА типа баллов: выплаты по лояльности + баллы за скидки
- Формула: Итого = Реализовано + Выплаты_лояльность + Баллы_скидки - Комиссия_Ozon
"""

import pandas as pd
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Union
import logging

logger = logging.getLogger(__name__)


def parse_ozon_order_realization_report(
    file_content: Union[bytes, str],
    seller_id: str
) -> Dict:
    """
    Парсинг позаказного отчета о реализации от Ozon
    
    Args:
        file_content: Содержимое Excel файла (bytes) или путь к файлу (str)
        seller_id: ID продавца
    
    Returns:
        Dict с транзакциями и итогами
    """
    
    try:
        # Читаем Excel файл
        if isinstance(file_content, bytes):
            df = pd.read_excel(BytesIO(file_content), sheet_name=0, header=None)
        else:
            df = pd.read_excel(file_content, sheet_name=0, header=None)
        
        logger.info(f"Файл прочитан: {len(df)} строк")
        
    except Exception as e:
        logger.error(f"Ошибка чтения Excel: {str(e)}")
        raise ValueError(f"Не удалось прочитать Excel файл: {str(e)}")
    
    # Константы структуры файла
    HEADERS_ROW = 13  # Строка с заголовками
    DATA_START_ROW = 15  # Первая строка данных
    
    # Индексы колонок (на основе реального файла)
    COL_INDEX = 0  # № п/п
    COL_NAME = 1  # Название товара
    COL_ARTICLE = 2  # Артикул
    COL_SKU = 3  # SKU
    COL_BARCODE = 4  # Штрих-код
    COL_REALIZED_AMOUNT = 5  # Реализовано на сумму, руб
    COL_LOYALTY_PAYMENTS = 6  # Выплаты по механикам лояльности партнёров
    COL_DISCOUNT_POINTS = 7  # Баллы за скидки
    COL_QUANTITY = 8  # Количество
    COL_PRICE = 9  # Цена реализации
    COL_SALES_REWARD = 10  # Вознаграждение за продажу (справочно)
    COL_PRICE_BEFORE_DISCOUNT = 11  # Цена до скидок (справочно)
    COL_OZON_BASE_COMMISSION = 12  # Базовое вознаграждение Ozon
    COL_TOTAL_TO_ACCRUE = 13  # Итого к начислению
    COL_RETURNED_AMOUNT = 14  # Возвращено на сумму
    COL_POSTING_NUMBER = 21  # Номер отправления
    COL_DATE = 22  # Дата
    
    transactions = []
    skipped_rows = 0
    
    # Парсим данные начиная со строки DATA_START_ROW
    for index in range(DATA_START_ROW, len(df)):
        row = df.iloc[index]
        
        # Проверяем что это строка с данными (есть артикул)
        article = row[COL_ARTICLE]
        if pd.isna(article):
            skipped_rows += 1
            continue
        
        # Пропускаем итоговые строки
        if str(article).startswith('Итого') or str(article).startswith('ИТОГО'):
            logger.info(f"Найдена итоговая строка на позиции {index}")
            break
        
        try:
            # Безопасное извлечение значений
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
                    return int(float(value))
                except:
                    return default
            
            def safe_str(value, default=''):
                if pd.isna(value):
                    return default
                return str(value)
            
            # Парсим дату
            date_value = row[COL_DATE]
            if pd.notna(date_value):
                if isinstance(date_value, datetime):
                    operation_date = date_value
                else:
                    try:
                        operation_date = pd.to_datetime(date_value)
                    except:
                        operation_date = datetime.utcnow()
            else:
                operation_date = datetime.utcnow()
            
            # Создаем транзакцию
            transaction = {
                "seller_id": seller_id,
                "marketplace": "ozon",
                
                # Идентификаторы
                "posting_number": safe_str(row[COL_POSTING_NUMBER]),
                "order_number": safe_str(row[COL_POSTING_NUMBER]),  # Номер отправления = ID заказа
                "sku": safe_str(row[COL_SKU]),
                "article": safe_str(row[COL_ARTICLE]),
                "barcode": safe_str(row[COL_BARCODE]),
                
                # Товар
                "product_name": safe_str(row[COL_NAME]),
                
                # Количество
                "quantity": safe_int(row[COL_QUANTITY]),
                
                # Суммы
                "realized_amount": safe_float(row[COL_REALIZED_AMOUNT]),  # Реализовано на сумму
                "price": safe_float(row[COL_PRICE]),  # Цена за единицу
                
                # БАЛЛЫ (критично важно!)
                "loyalty_payments": safe_float(row[COL_LOYALTY_PAYMENTS]),  # Выплаты по лояльности
                "discount_points": safe_float(row[COL_DISCOUNT_POINTS]),  # Баллы за скидки
                
                # Комиссия Ozon
                "ozon_base_commission": safe_float(row[COL_OZON_BASE_COMMISSION]),
                
                # Итого к начислению (проверочное поле)
                "total_to_accrue": safe_float(row[COL_TOTAL_TO_ACCRUE]),
                
                # Возвраты
                "returned_amount": safe_float(row[COL_RETURNED_AMOUNT]),
                
                # Дата
                "operation_date": operation_date,
                
                # Метаданные
                "document_type": "order_realization",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Проверка формулы
            calculated_total = (
                transaction["realized_amount"] +
                transaction["loyalty_payments"] +
                transaction["discount_points"] -
                transaction["ozon_base_commission"]
            )
            
            # Небольшая погрешность допустима (округление)
            diff = abs(calculated_total - transaction["total_to_accrue"])
            if diff > 0.1:
                logger.warning(
                    f"Расхождение в расчетах для {transaction['article']}: "
                    f"ожидалось {calculated_total:.2f}, получено {transaction['total_to_accrue']:.2f}"
                )
            
            transactions.append(transaction)
            
        except Exception as e:
            logger.error(f"Ошибка парсинга строки {index}: {str(e)}")
            continue
    
    # Подсчитываем итоги
    total_revenue = sum(t["realized_amount"] for t in transactions)
    total_loyalty = sum(t["loyalty_payments"] for t in transactions)
    total_discounts = sum(t["discount_points"] for t in transactions)
    total_commission = sum(t["ozon_base_commission"] for t in transactions)
    total_to_accrue = sum(t["total_to_accrue"] for t in transactions)
    
    result = {
        "transactions": transactions,
        "summary": {
            "total_transactions": len(transactions),
            "skipped_rows": skipped_rows,
            "total_revenue": round(total_revenue, 2),
            "total_loyalty_payments": round(total_loyalty, 2),
            "total_discount_points": round(total_discounts, 2),
            "total_ozon_commission": round(total_commission, 2),
            "total_to_accrue": round(total_to_accrue, 2)
        }
    }
    
    logger.info(f"Успешно распарсено {len(transactions)} транзакций")
    logger.info(f"Итого выручка: {total_revenue:.2f} руб")
    logger.info(f"Итого баллы лояльности: {total_loyalty:.2f} руб")
    logger.info(f"Итого баллы за скидки: {total_discounts:.2f} руб")
    logger.info(f"Итого комиссия Ozon: {total_commission:.2f} руб")
    
    return result
