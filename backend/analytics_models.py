"""
Модели данных для аналитики на основе РЕАЛЬНЫХ документов Ozon
Структура проверена по 15 файлам за ноябрь 2025
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


# ============================================================================
# ТРАНЗАКЦИЯ ИЗ ПОЗАКАЗНОГО ОТЧЕТА (главный документ)
# ============================================================================

class OrderTransaction(BaseModel):
    """
    Транзакция из позаказного отчета о реализации
    Основной источник данных о продажах
    """
    # Идентификаторы
    seller_id: str
    order_number: Optional[str] = None  # Номер заказа/отправления
    sku: str  # Артикул товара
    barcode: Optional[str] = None  # Штрих-код
    
    # Дата операции
    operation_date: datetime
    
    # Товар
    product_name: str
    product_id: Optional[str] = None
    
    # Количество
    quantity_sold: int = 0  # Реализовано
    quantity_returned: int = 0  # Возвращено
    quantity_net: int = 0  # Чистое (sold - returned)
    
    # Суммы продажи
    sale_price: float  # Цена продажи за единицу
    total_sale_amount: float  # Сумма за товары (price × quantity)
    
    # Комиссия Ozon (из позаказного отчета)
    ozon_commission_pct: Optional[float] = None  # Ozon % (если есть)
    ozon_commission_base: float  # Комиссия Ozon, руб
    
    # Услуги (из позаказного отчета)
    logistics_amount: float = 0.0  # Логистика, руб
    other_services: float = 0.0  # Прочее, руб
    penalties: float = 0.0  # Штрафы, руб
    
    # Итого к выплате (из отчета)
    total_payout: float  # Итого, руб
    
    # Дополнительные расходы (из других документов)
    acquiring_fee: float = 0.0  # Эквайринг
    rfbs_logistics: float = 0.0  # Логистика rFBS
    fbo_fbs_services: float = 0.0  # Услуги FBO/FBS
    agent_services: float = 0.0  # Агентские услуги (пропорционально)
    
    # Система баллов
    bonuses_accrued: int = 0  # Начислено баллов покупателю
    bonuses_used: int = 0  # Использовано баллов при оплате
    
    # Метаданные
    marketplace: str = "ozon"
    document_type: str = "order_transaction"  # Тип источника
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# УСЛУГИ ИЗ УПД (Акты выполненных работ)
# ============================================================================

class AgentServicesDocument(BaseModel):
    """
    УПД - Акт выполненных работ
    Услуги маркетплейса (агентские, бонусы, премиум и т.д.)
    """
    seller_id: str
    document_number: str  # № 54810556
    document_date: datetime  # 30.11.2025
    
    # Суммы
    total_amount: float  # Общая сумма
    amount_without_vat: float  # Без НДС
    vat_amount: float  # Сумма НДС
    
    # Детализация услуг
    services: List[Dict]  # [{name: "Бонусы продавца", amount: 1234.56}, ...]
    
    # Период
    period_start: datetime
    period_end: datetime
    
    # Метаданные
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# ЭКВАЙРИНГ (прием платежей)
# ============================================================================

class AcquiringTransaction(BaseModel):
    """
    Комиссия за прием платежей от покупателей
    """
    seller_id: str
    order_number: Optional[str] = None
    sku: Optional[str] = None
    
    # Банк-эквайрер
    bank_name: str  # "ПАО СБЕРБАНК", "АО ТБАНК" и т.д.
    bank_inn: str
    
    # Суммы
    product_cost: float  # Стоимость товара
    acquiring_rate: float  # Ставка (%)
    acquiring_fee: float  # Комиссия в рублях
    
    # Дата
    operation_date: datetime
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# ЛОГИСТИЧЕСКИЕ УСЛУГИ (rFBS)
# ============================================================================

class LogisticsService(BaseModel):
    """
    Детализация логистических услуг по схеме rFBS
    """
    seller_id: str
    order_number: str  # Номер заказа
    
    # Адреса
    origin_address: Optional[str] = None
    destination_address: Optional[str] = None
    distance_km: Optional[float] = None
    
    # Вес
    weight_grams: Optional[float] = None
    
    # Услуги
    logistics_forward: float = 0.0  # Прямой поток (доставка)
    logistics_reverse: float = 0.0  # Обратный поток (возврат)
    insurance: float = 0.0  # Страховка
    prr: float = 0.0  # Предварительные расходы
    storage: float = 0.0  # Хранение
    utilization: float = 0.0  # Утилизация
    paid_waiting: float = 0.0  # Платное ожидание
    easy_return: float = 0.0  # Легкий возврат
    
    # Итого
    total_with_vat: float
    vat_amount: float
    
    # Дата
    operation_date: datetime
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# ПРОГРАММЫ ЛОЯЛЬНОСТИ (баллы Ozon)
# ============================================================================

class LoyaltyProgram(BaseModel):
    """
    Отчет по механикам лояльности партнёров
    Выплаты за программы баллов
    """
    seller_id: str
    
    # Программа
    program_name: str  # "Зеленая цена", "Звездные товары"
    partner_name: str  # "Озон Банк"
    partner_inn: str
    
    # Суммы
    amount_to_accrue: float  # К начислению
    amount_to_return: float  # К возврату
    total_amount: float  # Итого
    
    # Период
    period_start: datetime
    period_end: datetime
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# АГРЕГИРОВАННЫЙ ОТЧЕТ (итоговый)
# ============================================================================

class ProfitReport(BaseModel):
    """
    Сводный отчет о прибыли за период
    Агрегирует данные из всех источников
    """
    seller_id: str
    period_start: datetime
    period_end: datetime
    
    # ДОХОДЫ
    revenue: Dict = {
        "gross_sales": 0.0,  # Валовая выручка
        "returns": 0.0,  # Возвраты
        "net_sales": 0.0  # Чистая выручка
    }
    
    # СЕБЕСТОИМОСТЬ
    cogs: Dict = {
        "total": 0.0,  # Общая себестоимость
        "percentage": 0.0  # % от выручки
    }
    
    # РАСХОДЫ
    expenses: Dict = {
        # Комиссии Ozon
        "commissions": {
            "base_commission": 0.0,  # Базовая (из позаказного)
            "sales_commission": 0.0,  # За продажу (УПД)
            "total": 0.0
        },
        
        # Услуги маркетплейса
        "marketplace_services": {
            "agent_services": 0.0,  # Агентские (УПД - акт)
            "acquiring": 0.0,  # Эквайринг
            "logistics_rfbs": 0.0,  # Логистика rFBS
            "fbo_fbs_services": 0.0,  # FBO/FBS услуги
            "partner_delivery": 0.0,  # Доставка партнерами
            "total": 0.0
        },
        
        # Программы лояльности
        "loyalty_programs": {
            "partner_payments": 0.0,  # Выплаты партнерам
            "total": 0.0
        },
        
        # Прочие
        "other": {
            "mutual_settlements": 0.0,  # Взаимозачеты
            "total": 0.0
        },
        
        # Итого всех расходов
        "total_expenses": 0.0
    }
    
    # ПРИБЫЛЬ
    profit: Dict = {
        "gross_profit": 0.0,  # Валовая
        "gross_margin_pct": 0.0,
        "operating_profit": 0.0,  # Операционная
        "operating_margin_pct": 0.0,
        "net_profit": 0.0,  # Чистая
        "net_margin_pct": 0.0
    }
    
    # Статистика
    statistics: Dict = {
        "total_orders": 0,
        "total_items_sold": 0,
        "total_items_returned": 0
    }
    
    calculated_at: datetime = Field(default_factory=datetime.utcnow)
