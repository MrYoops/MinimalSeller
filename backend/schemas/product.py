
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .common import PyObjectId

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
    price: float = 0.0
    purchase_price: float = 0.0
    category_id: Optional[str] = None
    investor_tag: Optional[str] = None
    status: str = "draft"
    visibility: ProductVisibility = Field(default_factory=ProductVisibility)
    seo: ProductSEO = Field(default_factory=ProductSEO)
    dates: ProductDates = Field(default_factory=ProductDates)
    minimalmod: MinimalModData = Field(default_factory=lambda: MinimalModData(name="Unnamed"))
    marketplaces: MarketplacesData = Field(default_factory=MarketplacesData)
    marketplace_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    listing_quality_score: ListingQualityScore = Field(default_factory=ListingQualityScore)
    tags: List[str] = []

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

class BulkTagsRequestModel(BaseModel):
    product_ids: List[str]
    tag: str
