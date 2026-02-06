from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class MarketplacePrices(BaseModel):
    """Цены для конкретного маркетплейса"""
    price: Optional[float] = None  # Цена со скидкой (Ozon) или обычная цена (WB)
    old_price: Optional[float] = None  # Цена до скидки (Ozon)
    regular_price: Optional[float] = None  # Обычная цена (WB)
    discount_price: Optional[float] = None  # Цена со скидкой (WB)
    last_updated: Optional[datetime] = None
    last_synced: Optional[datetime] = None

class ProductPricing(BaseModel):
    """Полная информация о ценах товара"""
    product_id: str
    article: str
    name: str
    ozon: Optional[MarketplacePrices] = None
    wb: Optional[MarketplacePrices] = None
    min_allowed_price: Optional[float] = None
    cost_price: Optional[float] = None

class PricingUpdate(BaseModel):
    """Обновление цен для маркетплейса"""
    marketplace: str  # "ozon" или "wb"
    price: Optional[float] = None
    old_price: Optional[float] = None
    regular_price: Optional[float] = None
    discount_price: Optional[float] = None

class BulkPricingUpdate(BaseModel):
    """Массовое обновление цен"""
    action: str  # "increase_percent", "decrease_percent", "set_fixed"
    value: float  # Процент или фиксированная сумма
    marketplace: str  # "ozon", "wb", "all"
    product_ids: Optional[List[str]] = None  # None = все товары

class PriceAlert(BaseModel):
    """Алерт о цене"""
    id: str
    product_id: str
    product_name: str
    article: str
    marketplace: str
    alert_type: str  # "price_below_minimum", "price_changed"
    current_mp_price: float
    our_min_price: float
    is_in_promo: bool = False
    promo_name: Optional[str] = None
    detected_at: datetime
    is_resolved: bool = False

# ---------- ЦЕНЫ ТОВАРОВ (ProductPrice MODELS) ----------

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
