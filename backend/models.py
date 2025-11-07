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
    category_id: Optional[str] = None
    status: str = "draft"  # draft, active, out_of_stock, archived
    visibility: ProductVisibility = Field(default_factory=ProductVisibility)
    seo: ProductSEO = Field(default_factory=ProductSEO)
    minimalmod: MinimalModData
    marketplaces: MarketplacesData = Field(default_factory=MarketplacesData)

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    price: Optional[float] = None
    category_id: Optional[str] = None
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
    category_id: Optional[str]
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
