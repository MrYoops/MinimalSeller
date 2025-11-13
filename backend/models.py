from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId

# Product Models
class ProductVisibility(BaseModel):
    show_on_minimalmod: bool = True
    show_in_search: bool = True
    is_featured: bool = False

class ProductSEO(BaseModel):
    meta_title: Optional[str] = ""
    meta_description: Optional[str] = ""
    url_slug: Optional[str] = ""

class ProductDates(BaseModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None

class MinimalModData(BaseModel):
    name: str
    variant_name: Optional[str] = ""
    description: Optional[str] = ""
    tags: List[str] = []
    images: List[str] = []
    attributes: Dict[str, str] = {}

class MarketplaceData(BaseModel):
    enabled: bool = False
    name: Optional[str] = ""
    description: Optional[str] = ""
    category_id: Optional[str] = ""
    attributes: Dict[str, Any] = {}

class MarketplacesData(BaseModel):
    images: List[str] = []
    ozon: MarketplaceData = Field(default_factory=MarketplaceData)
    wildberries: MarketplaceData = Field(default_factory=MarketplaceData)
    yandex_market: MarketplaceData = Field(default_factory=MarketplaceData)

class ListingQualityScore(BaseModel):
    total: float = 0.0
    name_score: float = 0.0
    description_score: float = 0.0
    images_score: float = 0.0
    attributes_score: float = 0.0

class ProductCreate(BaseModel):
    sku: str
    price: float
    purchase_price: float = 0.0  # Закупочная цена (себестоимость)
    category_id: Optional[str] = None
    investor_tag: Optional[str] = None  # Тег инвестора (извлекается из SKU автоматически)
    status: str = "draft"  # draft, active, out_of_stock, archived
    visibility: ProductVisibility = Field(default_factory=ProductVisibility)
    seo: ProductSEO = Field(default_factory=ProductSEO)
    minimalmod: MinimalModData
    marketplaces: MarketplacesData = Field(default_factory=MarketplacesData)

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    price: Optional[float] = None
    purchase_price: Optional[float] = None
    category_id: Optional[str] = None
    investor_tag: Optional[str] = None
    status: Optional[str] = None
    visibility: Optional[ProductVisibility] = None
    seo: Optional[ProductSEO] = None
    minimalmod: Optional[MinimalModData] = None
    marketplaces: Optional[MarketplacesData] = None

class ProductResponse(BaseModel):
    id: str
    seller_id: str
    sku: str
    price: float
    purchase_price: float
    category_id: Optional[str]
    investor_tag: Optional[str]
    status: str
    visibility: ProductVisibility
    seo: ProductSEO
    dates: ProductDates
    minimalmod: MinimalModData
    marketplaces: MarketplacesData
    listing_quality_score: ListingQualityScore

class BulkImportRequest(BaseModel):
    column_mapping: Dict[str, str]
    data: List[Dict[str, Any]]
    update_existing: bool = False
    create_new: bool = True

class AIAdaptRequest(BaseModel):
    text: str
    marketplace: str
    type: str  # "name" or "description"

class ProductMappingCreate(BaseModel):
    product_id: str
    marketplace: str
    marketplace_product_id: str
    marketplace_sku: Optional[str] = None


# ============================================================================
# INVENTORY MANAGEMENT MODELS (Block 3)
# ============================================================================

class Inventory(BaseModel):
    """FBS (собственный склад) - текущие остатки"""
    product_id: str
    seller_id: str
    sku: str
    quantity: int = 0  # Общий остаток на складе FBS
    reserved: int = 0  # Зарезервировано под неоплаченные заказы
    available: int = 0  # Доступно для продажи (quantity - reserved)
    alert_threshold: int = 10  # Порог для уведомлений о низком остатке

class FBOInventory(BaseModel):
    """FBO (склады маркетплейсов) - остатки на складах маркетплейсов"""
    product_id: str
    seller_id: str
    sku: str
    marketplace: str  # "ozon", "wb", "yandex"
    warehouse_name: str  # Название склада маркетплейса
    quantity: int = 0  # Остаток на этом FBO складе

class InventoryHistory(BaseModel):
    """Полный лог всех движений по складу FBS"""
    product_id: str
    seller_id: str
    operation_type: str  # "sale", "return", "manual_in", "manual_out", "fbo_shipment", "order_cancel"
    quantity_change: int  # +10 или -5
    reason: str  # "Заказ #MM-12345", "Поставка на FBO #FS-001"
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    order_id: Optional[str] = None  # Ссылка на заказ (если применимо)
    shipment_id: Optional[str] = None  # Ссылка на поставку FBO (если применимо)

class FBOShipmentItem(BaseModel):
    """Товар в поставке на FBO"""
    product_id: str
    sku: str
    quantity: int

class FBOShipment(BaseModel):
    """Поставка на склад маркетплейса (FBO)"""
    seller_id: str
    marketplace: str  # "ozon", "wb", "yandex"
    warehouse_name: str  # Название склада FBO
    items: List[FBOShipmentItem]
    status: str = "draft"  # draft, sent, received, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_by: str  # user_id

class InventoryAdjustment(BaseModel):
    """Запрос на ручную корректировку остатков"""
    product_id: str
    quantity_change: int  # +50 или -10
    reason: str  # "Инвентаризация", "Брак", "Возврат от покупателя"

class InventoryResponse(BaseModel):
    """Ответ с данными об остатках товара"""
    id: str
    product_id: str
    seller_id: str
    sku: str
    quantity: int
    reserved: int
    available: int
    alert_threshold: int
    product_name: Optional[str] = None  # Для удобства отображения
    product_image: Optional[str] = None

class FBOInventoryResponse(BaseModel):
    """Ответ с данными об остатках FBO"""
    id: str
    product_id: str
    seller_id: str
    sku: str
    marketplace: str
    warehouse_name: str
    quantity: int
    product_name: Optional[str] = None
    product_image: Optional[str] = None

class InventoryHistoryResponse(BaseModel):
    """Ответ с историей движений"""
    id: str
    product_id: str
    seller_id: str
    operation_type: str
    quantity_change: int
    reason: str
    user_id: str
    created_at: datetime
    order_id: Optional[str]
    shipment_id: Optional[str]
    product_name: Optional[str] = None
    sku: Optional[str] = None

class FBOShipmentResponse(BaseModel):
    """Ответ с данными о поставке FBO"""
    id: str
    seller_id: str
    marketplace: str
    warehouse_name: str
    items: List[FBOShipmentItem]
    status: str
    created_at: datetime
    sent_at: Optional[datetime]
    received_at: Optional[datetime]
    created_by: str


# ============================================================================
# ORDER MANAGEMENT MODELS (Block 2)
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
