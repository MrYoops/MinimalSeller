from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ============================================================================
# INVENTORY MANAGEMENT MODELS
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

# ---------- ОСТАТКИ ТОВАРОВ (ProductStock) ----------

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
