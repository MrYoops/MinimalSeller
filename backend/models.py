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


# ============================================================================
# PRODUCT CATALOG MODELS (Block 4) - SelSup Style
# ============================================================================

# ---------- КАТЕГОРИИ ТОВАРОВ ----------

class ProductCategoryCreate(BaseModel):
    """Создание категории товаров"""
    name: str
    parent_id: Optional[str] = None  # Для вложенных категорий
    group_by_color: bool = False  # Разделять товары по цвету в этой категории
    group_by_size: bool = False  # Разделять товары по размеру
    common_attributes: Dict[str, Any] = {}  # Общие параметры для всех товаров

class ProductCategoryUpdate(BaseModel):
    """Обновление категории"""
    name: Optional[str] = None
    parent_id: Optional[str] = None
    group_by_color: Optional[bool] = None
    group_by_size: Optional[bool] = None
    common_attributes: Optional[Dict[str, Any]] = None

class ProductCategoryResponse(BaseModel):
    """Ответ с данными категории"""
    id: str
    seller_id: str
    name: str
    parent_id: Optional[str]
    group_by_color: bool
    group_by_size: bool
    common_attributes: Dict[str, Any]
    products_count: int = 0  # Количество товаров в категории
    created_at: datetime
    updated_at: datetime


# ---------- ТОВАРЫ (ОСНОВНАЯ КАРТОЧКА) ----------

class ProductDimensions(BaseModel):
    """Габариты товара"""
    width: int = 0  # Ширина в мм
    height: int = 0  # Высота в мм
    length: int = 0  # Длина в мм

class ProductCatalogCreate(BaseModel):
    """Создание товара (новая структура для каталога)"""
    article: str  # Артикул (уникальный в рамках продавца)
    name: str
    brand: Optional[str] = None
    category_id: Optional[str] = None
    description: Optional[str] = ""
    status: str = "draft"  # draft, active, archived
    is_grouped: bool = False  # Объединенная карточка (с вариациями)
    group_by_color: bool = False  # Разделять по цвету
    group_by_size: bool = False  # Разделять по размеру
    characteristics: Dict[str, Any] = {}  # Характеристики товара (название: значение)
    marketplace_category_id: Optional[str] = None  # ID категории на маркетплейсе
    marketplace: Optional[str] = None  # Маркетплейс источник
    
    # Дополнительные поля (как в SelSup)
    manufacturer: Optional[str] = None  # Производитель
    country_of_origin: Optional[str] = "Вьетнам"  # Страна производства
    label_name: Optional[str] = None  # Название для этикетки
    
    # Цены (на уровне товара, как в SelSup, в копейках)
    price_with_discount: int = 0  # Цена со скидкой
    price_without_discount: int = 0  # Цена без скидки
    price_coefficient: float = 1.0  # Поправочный коэффициент
    purchase_price: int = 0  # Закупочная цена
    additional_expenses: int = 0  # Доп. расходы
    cost_price: int = 0  # Себестоимость (авто-расчет)
    vat: int = 0  # НДС (процент)
    
    # Коммерческие атрибуты (старые поля для совместимости)
    price: int = 0  # Розничная цена в копейках (дубль price_with_discount)
    price_discounted: Optional[int] = None  # Цена со скидкой в копейках (дубль)
    barcode: Optional[str] = None  # Штрих-код
    weight: int = 0  # Вес в граммах
    dimensions: ProductDimensions = Field(default_factory=ProductDimensions)  # Габариты
    
    # Дополнительная информация (как в SelSup)
    gender: Optional[str] = None  # Пол (МУЖСКОЙ, ЖЕНСКИЙ и т.д.)
    season: Optional[str] = None  # Сезон
    composition: Optional[str] = None  # Состав
    care_instructions: Optional[str] = None  # Уход за вещами
    additional_info: Optional[str] = None  # Доп. информация (внутренняя)
    website_link: Optional[str] = None  # Ссылка на сайт

class ProductCatalogUpdate(BaseModel):
    """Обновление товара"""
    article: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    is_grouped: Optional[bool] = None
    group_by_color: Optional[bool] = None
    group_by_size: Optional[bool] = None
    characteristics: Optional[Dict[str, Any]] = None
    marketplace_category_id: Optional[str] = None
    marketplace: Optional[str] = None
    
    # Дополнительные поля (как в SelSup)
    manufacturer: Optional[str] = None
    country_of_origin: Optional[str] = None
    label_name: Optional[str] = None
    
    # Цены (на уровне товара, как в SelSup)
    price_with_discount: Optional[int] = None
    price_without_discount: Optional[int] = None
    price_coefficient: Optional[float] = None
    purchase_price: Optional[int] = None
    additional_expenses: Optional[int] = None
    cost_price: Optional[int] = None
    vat: Optional[int] = None
    
    # Коммерческие атрибуты (старые поля для совместимости)
    price: Optional[int] = None
    price_discounted: Optional[int] = None
    barcode: Optional[str] = None
    weight: Optional[int] = None
    dimensions: Optional[ProductDimensions] = None
    
    # Дополнительная информация
    gender: Optional[str] = None
    season: Optional[str] = None
    composition: Optional[str] = None
    care_instructions: Optional[str] = None
    additional_info: Optional[str] = None
    website_link: Optional[str] = None

class ProductCatalogResponse(BaseModel):
    """Ответ с данными товара"""
    id: str
    seller_id: str
    article: str
    name: str
    brand: Optional[str]
    category_id: Optional[str]
    category_mapping_id: Optional[str] = None  # ID сопоставления категории
    category_name: Optional[str] = None  # Для удобства отображения
    description: str
    status: str
    is_grouped: bool
    group_by_color: bool
    group_by_size: bool
    characteristics: Dict[str, Any] = {}  # Характеристики
    marketplace_category_id: Optional[str] = None
    marketplace: Optional[str] = None
    variants_count: int = 0  # Количество вариаций (цветов/размеров)
    photos_count: int = 0
    tags: List[str] = []  # Теги товара
    created_at: datetime
    updated_at: datetime
    
    # Дополнительные поля (как в SelSup)
    manufacturer: Optional[str] = None
    country_of_origin: Optional[str] = None
    label_name: Optional[str] = None
    
    # Цены (на уровне товара, как в SelSup)
    price_with_discount: float = 0
    price_without_discount: float = 0
    price_coefficient: float = 1.0
    purchase_price: float = 0
    additional_expenses: float = 0
    cost_price: float = 0
    vat: int = 0
    
    # Коммерческие атрибуты (старые поля для совместимости)
    price: int = 0  # Розничная цена в копейках
    price_discounted: Optional[int] = None  # Цена со скидкой в копейках
    barcode: Optional[str] = None  # Штрих-код
    weight: int = 0  # Вес в граммах
    dimensions: ProductDimensions = Field(default_factory=ProductDimensions)  # Габариты
    
    # Дополнительная информация
    gender: Optional[str] = None
    season: Optional[str] = None
    composition: Optional[str] = None
    care_instructions: Optional[str] = None
    additional_info: Optional[str] = None
    website_link: Optional[str] = None
    
    # Данные специфичные для маркетплейсов
    marketplace_specific_data: Optional[Dict[str, Any]] = None


# ---------- ВАРИАЦИИ ТОВАРОВ (ЦВЕТ + РАЗМЕР) ----------

class ProductVariantCreate(BaseModel):
    """Создание вариации товара"""
    color: Optional[str] = None  # Цвет (или вкус, принт)
    size: Optional[str] = None  # Размер (или другой параметр)
    sku: str  # SKU для этой вариации
    barcode: Optional[str] = None
    gtin: Optional[str] = None  # Для маркировки "Честный знак"

class ProductVariantUpdate(BaseModel):
    """Обновление вариации"""
    color: Optional[str] = None
    size: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    gtin: Optional[str] = None

class ProductVariantResponse(BaseModel):
    """Ответ с данными вариации"""
    id: str
    product_id: str
    color: Optional[str]
    size: Optional[str]
    sku: str
    barcode: Optional[str]
    gtin: Optional[str]
    photos_count: int = 0  # Количество фото для этой вариации
    created_at: datetime
    updated_at: datetime


# ---------- ФОТО ТОВАРОВ ----------

class ProductPhotoCreate(BaseModel):
    """Добавление фото товара"""
    url: str
    variant_id: Optional[str] = None  # null = фото для всего товара, иначе для конкретного цвета
    order: int = 0  # Порядок отображения
    marketplaces: Dict[str, bool] = {  # На каких МП показывать
        "wb": True,
        "ozon": True,
        "yandex": True
    }

class ProductPhotoUpdate(BaseModel):
    """Обновление фото"""
    url: Optional[str] = None
    order: Optional[int] = None
    marketplaces: Optional[Dict[str, bool]] = None

class ProductPhotoResponse(BaseModel):
    """Ответ с данными фото"""
    id: str
    product_id: str
    variant_id: Optional[str]
    url: str
    order: int
    marketplaces: Dict[str, bool]
    created_at: datetime


# ---------- ЦЕНЫ ТОВАРОВ ----------

class ProductPriceCreate(BaseModel):
    """Создание/обновление цены"""
    variant_id: Optional[str] = None  # null = для всего товара, иначе для конкретного размера
    purchase_price: int = 0  # Закупочная цена в копейках
    retail_price: int = 0  # Розничная цена в копейках
    price_without_discount: int = 0  # Цена без скидки в копейках
    marketplace_prices: Dict[str, int] = {  # Цены по маркетплейсам в копейках
        "wb": 0,
        "ozon": 0,
        "yandex": 0
    }

class ProductPriceUpdate(BaseModel):
    """Обновление цены"""
    purchase_price: Optional[int] = None  # Закупочная цена в копейках
    retail_price: Optional[int] = None  # Розничная цена в копейках
    price_without_discount: Optional[int] = None  # Цена без скидки в копейках
    marketplace_prices: Optional[Dict[str, int]] = None  # Цены по маркетплейсам в копейках

class ProductPriceResponse(BaseModel):
    """Ответ с данными цены"""
    id: str
    product_id: str
    variant_id: Optional[str]
    variant_color: Optional[str] = None  # Для удобства отображения
    variant_size: Optional[str] = None
    purchase_price: int  # Закупочная цена в копейках
    retail_price: int  # Розничная цена в копейках
    price_without_discount: int  # Цена без скидки в копейках
    marketplace_prices: Dict[str, int]  # Цены по маркетплейсам в копейках
    created_at: datetime
    updated_at: datetime

class BulkPriceUpdate(BaseModel):
    """Массовое изменение цен"""
    product_ids: List[str]  # Список ID товаров
    operation: str  # "increase_percent", "decrease_percent", "increase_amount", "decrease_amount", "set_value"
    value: float  # Процент или сумма
    target_field: str  # "retail_price", "marketplace_prices.wb", "marketplace_prices.ozon", "marketplace_prices.yandex"
    category_id: Optional[str] = None  # Фильтр по категории
    brand: Optional[str] = None  # Фильтр по бренду


# ---------- ОСТАТКИ ТОВАРОВ ----------

class ProductStockCreate(BaseModel):
    """Создание/обновление остатка"""
    variant_id: Optional[str] = None
    warehouse_id: str  # Связь со складом из модуля "СКЛАД"
    quantity: int = 0
    reserved: int = 0
    available: int = 0

class ProductStockUpdate(BaseModel):
    """Обновление остатка"""
    quantity: Optional[int] = None
    reserved: Optional[int] = None
    available: Optional[int] = None

class ProductStockResponse(BaseModel):
    """Ответ с данными остатка"""
    id: str
    product_id: str
    variant_id: Optional[str]
    variant_color: Optional[str] = None
    variant_size: Optional[str] = None
    warehouse_id: str
    warehouse_name: Optional[str] = None  # Для удобства
    quantity: int
    reserved: int
    available: int
    updated_at: datetime


# ---------- КОМПЛЕКТЫ ТОВАРОВ ----------

class ProductKitItem(BaseModel):
    """Товар в комплекте"""
    product_id: str
    variant_id: Optional[str] = None
    quantity: int

class ProductKitCreate(BaseModel):
    """Создание комплекта"""
    name: str
    items: List[ProductKitItem]

class ProductKitUpdate(BaseModel):
    """Обновление комплекта"""
    name: Optional[str] = None
    items: Optional[List[ProductKitItem]] = None

class ProductKitResponse(BaseModel):
    """Ответ с данными комплекта"""
    id: str
    product_id: str
    name: str
    items: List[ProductKitItem]
    calculated_stock: int = 0  # Автоматически рассчитанный остаток
    created_at: datetime
    updated_at: datetime


# ---------- СВЯЗИ С МАРКЕТПЛЕЙСАМИ ----------

class ProductMarketplaceLinkCreate(BaseModel):
    """Создание связи с маркетплейсом"""
    variant_id: Optional[str] = None
    marketplace: str  # "ozon", "wb", "yandex"
    marketplace_product_id: str
    marketplace_sku: Optional[str] = None
    is_active: bool = True

class ProductMarketplaceLinkUpdate(BaseModel):
    """Обновление связи"""
    marketplace_product_id: Optional[str] = None
    marketplace_sku: Optional[str] = None
    is_active: Optional[bool] = None

class ProductMarketplaceLinkResponse(BaseModel):
    """Ответ с данными связи"""
    id: str
    product_id: str
    variant_id: Optional[str]
    marketplace: str
    marketplace_product_id: str
    marketplace_sku: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime



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


# ---------- WAREHOUSE ОБНОВЛЕНИЕ ----------

class WarehouseUpdate(BaseModel):
    """Обновление склада (добавляем return_on_cancel)"""
    name: Optional[str] = None
    address: Optional[str] = None
    comment: Optional[str] = None
    transfer_stock: Optional[bool] = None
    load_orders: Optional[bool] = None
    use_for_orders: Optional[bool] = None
    priority: Optional[int] = None
    fbo_accounting: Optional[bool] = None
    return_on_cancel: Optional[bool] = None  # НОВОЕ ПОЛЕ!
