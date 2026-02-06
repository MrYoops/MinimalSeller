from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class APIKeyCreate(BaseModel):
    marketplace: str  # ozon, wb, yandex
    client_id: str
    api_key: str
    name: Optional[str] = None  # Название интеграции

class APIKey(BaseModel):
    id: str
    marketplace: str
    client_id: str
    api_key_masked: str
    name: Optional[str] = None  # Название интеграции
    created_at: datetime
