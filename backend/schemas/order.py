from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ============================================================================
# ORDER MANAGEMENT MODELS
# ============================================================================

class OrderCustomer(BaseModel):
    """Информация о покупателе"""
    full_name: str
    phone: str
    email: Optional[str] = None

class OrderItem(BaseModel):
    """Товар в заказе"""
    product_id: str
    sku: str
    name: str
    image: Optional[str] = None
    price: float
    quantity: int
    total: float

class OrderTotals(BaseModel):
    """Финансовые итоги заказа"""
    subtotal: float  # Сумма товаров
    shipping_cost: float = 0.0  # Стоимость доставки
    marketplace_commission: float = 0.0  # Комиссия маркетплейса
    seller_payout: float  # К выплате продавцу
    total: float  # Итого к оплате покупателем

class OrderPayment(BaseModel):
    """Информация об оплате"""
    status: str  # "pending", "paid", "failed", "refunded"
    method: Optional[str] = None  # "card", "cash_on_delivery", "sbp"
    paid_at: Optional[datetime] = None

class OrderShipping(BaseModel):
    """Информация о доставке"""
    method: str  # "cdek_courier", "cdek_pvz", "pickup"
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    cdek_order_uuid: Optional[str] = None  # ID заказа в СДЭК
    tracking_number: Optional[str] = None
    label_url: Optional[str] = None  # Ссылка на PDF-накладную
    status: Optional[str] = None  # Статус доставки от СДЭК
    estimated_delivery: Optional[datetime] = None

class OrderDates(BaseModel):
    """Даты заказа"""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

class OrderCreate(BaseModel):
    """Создание заказа"""
    source: str  # "minimalmod", "ozon", "wildberries", "yandex_market"
    source_order_id: Optional[str] = None
    customer: OrderCustomer
    items: List[OrderItem]
    shipping: OrderShipping
    payment: OrderPayment

class OrderResponse(BaseModel):
    """Ответ с данными заказа"""
    id: str
    order_number: str
    seller_id: str
    source: str
    source_order_id: Optional[str]
    status: str
    customer: OrderCustomer
    items: List[OrderItem]
    totals: OrderTotals
    payment: OrderPayment
    shipping: OrderShipping
    dates: OrderDates

class OrderStatusUpdate(BaseModel):
    """Обновление статуса заказа"""
    status: str  # "new", "awaiting_shipment", "shipped", "delivered", "cancelled"

class CDEKLabelRequest(BaseModel):
    """Запрос на создание накладной СДЭК"""
    order_id: str

class ReturnItem(BaseModel):
    """Товар в возврате"""
    product_id: str
    sku: str
    name: str
    quantity: int
    reason: str

class ReturnCreate(BaseModel):
    """Создание возврата"""
    order_id: str
    items: List[ReturnItem]
    reason: str

class ReturnResponse(BaseModel):
    """Ответ с данными возврата"""
    id: str
    order_id: str
    seller_id: str
    status: str  # "pending_review", "accepted", "rejected"
    reason: str
    items: List[ReturnItem]
    created_at: datetime
    processed_at: Optional[datetime] = None


# ============================================================================
# НОВАЯ СИСТЕМА ЗАКАЗОВ (FBS / FBO / RETAIL)
# ============================================================================

# ---------- ОБЩИЕ МОДЕЛИ ----------

class OrderItemNew(BaseModel):
    """Товар в заказе (новая система)"""
    product_id: str  # ID товара в системе
    article: str  # Артикул товара
    name: str
    image: Optional[str] = None
    price: float  # Цена за единицу
    quantity: int
    total: float  # Общая стоимость (price * quantity)

class OrderCustomerNew(BaseModel):
    """Информация о покупателе"""
    full_name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None

class OrderTotalsNew(BaseModel):
    """Финансовые итоги заказа"""
    subtotal: float  # Сумма товаров
    shipping_cost: float = 0.0  # Стоимость доставки
    marketplace_commission: float = 0.0  # Комиссия МП
    seller_payout: float  # К выплате продавцу
    total: float  # Итого

class OrderStatusHistory(BaseModel):
    """История изменения статусов"""
    status: str
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    changed_by: Optional[str] = None  # user_id или "system"
    comment: Optional[str] = None


# ---------- FBS ЗАКАЗЫ (со своего склада) ----------

class OrderFBS(BaseModel):
    """Заказ FBS - со своего склада"""
    seller_id: str
    warehouse_id: str  # Склад с use_for_orders=True
    
    # Источник
    marketplace: str  # "ozon", "wb", "yandex"
    external_order_id: str  # ID заказа на МП
    order_number: str  # MM-FBS-12345
    
    # Статусы
    status: str  # "new", "awaiting_shipment", "delivering", "delivered", "cancelled"
    reserve_status: str  # "reserved", "deducted", "returned", "none"
    
    # Данные
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew
    
    # История
    status_history: List[OrderStatusHistory] = []
    
    # Даты
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

class OrderFBSCreate(BaseModel):
    """Создание FBS заказа (через API синхронизацию)"""
    marketplace: str
    external_order_id: str
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew
    
class OrderFBSResponse(BaseModel):
    """Ответ с данными FBS заказа"""
    id: str
    seller_id: str
    warehouse_id: str
    marketplace: str
    external_order_id: str
    order_number: str
    status: str
    reserve_status: str
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew
    status_history: List[OrderStatusHistory]
    created_at: datetime
    updated_at: datetime
    delivered_at: Optional[datetime]
    cancelled_at: Optional[datetime]


# ---------- FBO ЗАКАЗЫ (со склада МП) ----------

class OrderFBO(BaseModel):
    """Заказ FBO - со склада маркетплейса (только аналитика)"""
    seller_id: str
    
    # Источник
    marketplace: str  # "ozon", "wb", "yandex"
    external_order_id: str  # ID заказа на МП
    order_number: str  # MM-FBO-12345
    warehouse_name: str  # Название склада МП
    
    # Статус (read-only, только для отображения)
    status: str  # "processing", "shipped", "delivered", "cancelled"
    
    # Данные
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew
    
    # Даты
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

class OrderFBOCreate(BaseModel):
    """Создание FBO заказа (через API синхронизацию)"""
    marketplace: str
    external_order_id: str
    warehouse_name: str
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew

class OrderFBOResponse(BaseModel):
    """Ответ с данными FBO заказа"""
    id: str
    seller_id: str
    marketplace: str
    external_order_id: str
    order_number: str
    warehouse_name: str
    status: str
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew
    created_at: datetime
    updated_at: datetime
    delivered_at: Optional[datetime]
    cancelled_at: Optional[datetime]


# ---------- РОЗНИЧНЫЕ ЗАКАЗЫ ----------

class OrderRetail(BaseModel):
    """Розничный заказ (ручное создание)"""
    seller_id: str
    warehouse_id: str  # Выбор вручную при создании
    
    # Источник
    source: str = "retail"  # Всегда "retail"
    order_number: str  # MM-RETAIL-12345
    
    # Статусы
    status: str  # "new", "processing", "completed", "cancelled"
    reserve_status: str  # "reserved", "deducted", "returned", "none"
    
    # Данные
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew
    
    # Доп. информация
    payment_method: Optional[str] = "cash"  # "cash", "card", "transfer"
    notes: Optional[str] = None
    
    # История
    status_history: List[OrderStatusHistory] = []
    
    # Даты
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

class OrderRetailCreate(BaseModel):
    """Создание розничного заказа"""
    warehouse_id: str  # Обязательно выбрать склад
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    payment_method: Optional[str] = "cash"
    notes: Optional[str] = None

class OrderRetailResponse(BaseModel):
    """Ответ с данными розничного заказа"""
    id: str
    seller_id: str
    warehouse_id: str
    source: str
    order_number: str
    status: str
    reserve_status: str
    customer: OrderCustomerNew
    items: List[OrderItemNew]
    totals: OrderTotalsNew
    payment_method: Optional[str]
    notes: Optional[str]
    status_history: List[OrderStatusHistory]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]


# ---------- ОБНОВЛЕНИЕ СТАТУСОВ ----------

class OrderStatusUpdateNew(BaseModel):
    """Обновление статуса заказа"""
    status: str
    comment: Optional[str] = None


# ---------- ЗАПРОСЫ СИНХРОНИЗАЦИИ ----------

class OrderSyncRequest(BaseModel):
    """Запрос на синхронизацию заказов с МП"""
    marketplace: str  # "ozon", "wb", "yandex", "all"
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    force: bool = False  # Принудительная синхронизация всех


# ---------- РАЗДЕЛЕНИЕ ЗАКАЗОВ ----------

class OrderItemSplit(BaseModel):
    """Товар для разделения"""
    article: str
    quantity: int

class OrderBoxSplit(BaseModel):
    """Короб для разделения"""
    box_number: int
    items: List[OrderItemSplit]

class OrderSplitRequest(BaseModel):
    """Запрос на разделение заказа"""
    boxes: List[OrderBoxSplit]
