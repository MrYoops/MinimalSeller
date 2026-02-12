from pydantic import BaseModel
from typing import Optional

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
