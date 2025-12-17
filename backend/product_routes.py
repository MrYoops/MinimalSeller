from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel
import re
import os
try:
    from openai import OpenAI
    client = OpenAI() if os.getenv('OPENAI_API_KEY') else None
except Exception:
    client = None

from models import (
    ProductCreate, ProductUpdate, ProductResponse,
    BulkImportRequest, AIAdaptRequest, ProductMappingCreate,
    ListingQualityScore
)
from database import get_database

# Модели для работы с тегами
class BulkTagsRequest(BaseModel):
    product_ids: List[str]
    tag: str

router = APIRouter(prefix="/api/products", tags=["products"])

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def extract_investor_tag(sku: str) -> Optional[str]:
    """
    Извлекает тег инвестора из SKU.
    Формат SKU: INV001-PRODUCT-123
    Возвращает: INV001
    """
    match = re.match(r'^([A-Z]{3}\d{3})-', sku)
    if match:
        return match.group(1)
    return None

def calculate_listing_quality_score(product_data: dict) -> ListingQualityScore:
    """
    Рассчитывает качество листинга товара (0-100)
    """
    scores = ListingQualityScore()
    
    # Name score (0-25)
    name = product_data.get('minimalmod', {}).get('name', '')
    if len(name) >= 10:
        scores.name_score = 25.0
    elif len(name) >= 5:
        scores.name_score = 15.0
    else:
        scores.name_score = 5.0
    
    # Description score (0-25)
    description = product_data.get('minimalmod', {}).get('description', '')
    if len(description) >= 200:
        scores.description_score = 25.0
    elif len(description) >= 100:
        scores.description_score = 15.0
    elif len(description) >= 50:
        scores.description_score = 10.0
    else:
        scores.description_score = 0.0
    
    # Images score (0-25)
    images = product_data.get('minimalmod', {}).get('images', [])
    if len(images) >= 5:
        scores.images_score = 25.0
    elif len(images) >= 3:
        scores.images_score = 15.0
    elif len(images) >= 1:
        scores.images_score = 10.0
    else:
        scores.images_score = 0.0
    
    # Attributes score (0-25)
    attributes = product_data.get('minimalmod', {}).get('attributes', {})
    if len(attributes) >= 5:
        scores.attributes_score = 25.0
    elif len(attributes) >= 3:
        scores.attributes_score = 15.0
    elif len(attributes) >= 1:
        scores.attributes_score = 10.0
    else:
        scores.attributes_score = 0.0
    
    scores.total = scores.name_score + scores.description_score + scores.images_score + scores.attributes_score
    
    return scores

async def get_current_seller_id() -> str:
    """
    В production это должно извлекать seller_id из JWT токена.
    Для демо возвращаем фиксированный ID.
    """
    # TODO: Implement JWT authentication
    return "demo_seller_id"

# ============================================================================
# PRODUCT CRUD ENDPOINTS
# ============================================================================

@router.get("", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    investor_tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_quality: Optional[float] = Query(None),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить список товаров продавца с фильтрацией
    """
    db = await get_database()
    
    # Build filter query
    query = {"seller_id": seller_id}
    
    if category_id:
        query["category_id"] = category_id
    if status:
        query["status"] = status
    if investor_tag:
        query["investor_tag"] = investor_tag
    if search:
        query["$or"] = [
            {"sku": {"$regex": search, "$options": "i"}},
            {"minimalmod.name": {"$regex": search, "$options": "i"}}
        ]
    if min_quality:
        query["listing_quality_score.total"] = {"$gte": min_quality}
    
    products = await db.products.find(query).to_list(1000)
    
    # Convert ObjectId to string
    for product in products:
        product["id"] = str(product.pop("_id"))
    
    return products

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить детали товара
    """
    db = await get_database()
    
    product = await db.products.find_one({
        "_id": ObjectId(product_id),
        "seller_id": seller_id
    })
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product["id"] = str(product.pop("_id"))
    return product

@router.post("", response_model=ProductResponse)
async def create_product(
    product: ProductCreate,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Создать новый товар
    """
    db = await get_database()
    
    # Check if SKU already exists
    existing = await db.products.find_one({"sku": product.sku, "seller_id": seller_id})
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    # Extract investor tag from SKU if not provided
    if not product.investor_tag:
        product.investor_tag = extract_investor_tag(product.sku)
    
    # Prepare product data
    product_data = product.dict()
    product_data["seller_id"] = seller_id
    product_data["dates"] = {
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "published_at": None
    }
    
    # Calculate listing quality score
    product_data["listing_quality_score"] = calculate_listing_quality_score(product_data).dict()
    
    # Insert into database
    result = await db.products.insert_one(product_data)
    
    # Create inventory record
    await db.inventory.insert_one({
        "product_id": str(result.inserted_id),
        "seller_id": seller_id,
        "sku": product.sku,
        "quantity": 0,
        "reserved": 0,
        "available": 0,
        "alert_threshold": 10
    })
    
    # Fetch and return created product
    created_product = await db.products.find_one({"_id": result.inserted_id})
    created_product["id"] = str(created_product.pop("_id"))
    
    return created_product

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product: ProductUpdate,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Обновить товар
    """
    db = await get_database()
    
    # Check if product exists
    existing = await db.products.find_one({
        "_id": ObjectId(product_id),
        "seller_id": seller_id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Prepare update data
    update_data = {k: v for k, v in product.dict(exclude_unset=True).items() if v is not None}
    update_data["dates.updated_at"] = datetime.utcnow()
    
    # Extract investor tag from SKU if SKU is being updated
    if "sku" in update_data and not update_data.get("investor_tag"):
        update_data["investor_tag"] = extract_investor_tag(update_data["sku"])
    
    # Recalculate listing quality score
    merged_data = {**existing, **update_data}
    update_data["listing_quality_score"] = calculate_listing_quality_score(merged_data).dict()
    
    # Update in database
    await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": update_data}
    )
    
    # Fetch and return updated product
    updated_product = await db.products.find_one({"_id": ObjectId(product_id)})
    updated_product["id"] = str(updated_product.pop("_id"))
    
    return updated_product

@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Удалить товар
    """
    db = await get_database()
    
    # Check if product exists
    existing = await db.products.find_one({
        "_id": ObjectId(product_id),
        "seller_id": seller_id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Delete product
    await db.products.delete_one({"_id": ObjectId(product_id)})
    
    # Delete inventory record
    await db.inventory.delete_one({"product_id": product_id})
    
    return {"message": "Product deleted successfully"}

# ============================================================================
# BULK IMPORT
# ============================================================================

@router.post("/bulk-import")
async def bulk_import_products(
    request: BulkImportRequest,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Массовый импорт товаров из Excel/CSV
    """
    db = await get_database()
    
    created_count = 0
    updated_count = 0
    errors = []
    
    for row_idx, row_data in enumerate(request.data):
        try:
            # Map columns to product fields
            product_data = {}
            for field, column in request.column_mapping.items():
                if column in row_data:
                    product_data[field] = row_data[column]
            
            # Check if SKU exists
            sku = product_data.get("sku")
            if not sku:
                errors.append(f"Row {row_idx + 1}: Missing SKU")
                continue
            
            existing = await db.products.find_one({"sku": sku, "seller_id": seller_id})
            
            if existing:
                if request.update_existing:
                    # Update existing product
                    await db.products.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {**product_data, "dates.updated_at": datetime.utcnow()}}
                    )
                    updated_count += 1
            else:
                if request.create_new:
                    # Create new product
                    product_data["seller_id"] = seller_id
                    product_data["dates"] = {
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "published_at": None
                    }
                    product_data["investor_tag"] = extract_investor_tag(sku)
                    product_data["listing_quality_score"] = calculate_listing_quality_score(product_data).dict()
                    
                    result = await db.products.insert_one(product_data)
                    
                    # Create inventory record
                    await db.inventory.insert_one({
                        "product_id": str(result.inserted_id),
                        "seller_id": seller_id,
                        "sku": sku,
                        "quantity": 0,
                        "reserved": 0,
                        "available": 0,
                        "alert_threshold": 10
                    })
                    
                    created_count += 1
        
        except Exception as e:
            errors.append(f"Row {row_idx + 1}: {str(e)}")
    
    return {
        "created": created_count,
        "updated": updated_count,
        "errors": errors
    }

# ============================================================================
# AI FEATURES
# ============================================================================

@router.post("/ai/adapt-name")
async def ai_adapt_name(request: AIAdaptRequest):
    """
    Адаптация названия товара для маркетплейса с помощью AI
    """
    try:
        marketplace_rules = {
            "ozon": "Ozon требует короткие, информативные названия с ключевыми словами в начале. Максимум 255 символов.",
            "wildberries": "Wildberries предпочитает названия с указанием бренда, типа товара и основных характеристик. Максимум 60 символов.",
            "yandex_market": "Yandex Market требует структурированные названия: Бренд + Тип + Модель + Характеристики. Максимум 255 символов."
        }
        
        rules = marketplace_rules.get(request.marketplace, "")
        
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": f"Ты эксперт по оптимизации товарных карточек для маркетплейсов. {rules}"},
                {"role": "user", "content": f"Адаптируй это название для {request.marketplace}: {request.text}"}
            ],
            temperature=0.7,
            max_tokens=100
        )
        
        adapted_text = response.choices[0].message.content.strip()
        
        return {"adapted_text": adapted_text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI adaptation failed: {str(e)}")

@router.post("/ai/optimize-description")
async def ai_optimize_description(request: AIAdaptRequest):
    """
    Оптимизация описания товара для маркетплейса с помощью AI
    """
    try:
        marketplace_rules = {
            "ozon": "Ozon требует подробные описания с маркированными списками преимуществ и характеристик.",
            "wildberries": "Wildberries предпочитает краткие описания с акцентом на выгоды для покупателя.",
            "yandex_market": "Yandex Market требует структурированные описания с разделами: О товаре, Характеристики, Применение."
        }
        
        rules = marketplace_rules.get(request.marketplace, "")
        
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": f"Ты эксперт по оптимизации товарных карточек для маркетплейсов. {rules}"},
                {"role": "user", "content": f"Оптимизируй это описание для {request.marketplace}: {request.text}"}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        optimized_text = response.choices[0].message.content.strip()
        
        return {"optimized_text": optimized_text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI optimization failed: {str(e)}")

# ============================================================================
# MARKETPLACE INTEGRATION
# ============================================================================

@router.get("/marketplaces/{marketplace}/products")
async def get_marketplace_products(
    marketplace: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить список товаров с маркетплейса для сопоставления
    
    TODO: Implement real marketplace API integration
    """
    # This is a placeholder. In production, this should call actual marketplace APIs
    return {
        "marketplace": marketplace,
        "products": [],
        "message": "Marketplace integration not yet implemented"
    }

@router.post("/mappings")
async def create_product_mapping(
    mapping: ProductMappingCreate,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Создать сопоставление товара с товаром на маркетплейсе
    """
    db = await get_database()
    
    # Check if product exists
    product = await db.products.find_one({
        "_id": ObjectId(mapping.product_id),
        "seller_id": seller_id
    })
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create mapping
    mapping_data = mapping.dict()
    mapping_data["seller_id"] = seller_id
    mapping_data["created_at"] = datetime.utcnow()
    
    await db.product_mappings.insert_one(mapping_data)
    
    return {"message": "Mapping created successfully"}

@router.post("/mappings/auto-match")
async def auto_match_products(
    marketplace: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Автоматическое сопоставление товаров по SKU
    
    TODO: Implement intelligent matching algorithm
    """
    # This is a placeholder. In production, this should:
    # 1. Fetch products from marketplace
    # 2. Match by SKU or other identifiers
    # 3. Create mappings automatically
    
    return {
        "matched": 0,
        "message": "Auto-matching not yet implemented"
    }

# ============================================================================
# TAGS MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/tags")
async def get_all_tags():
    """
    Получить список всех уникальных тегов из товаров
    """
    db = await get_database()
    products_collection = db.product_catalog
    
    # Получаем все уникальные теги
    pipeline = [
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags"}},
        {"$sort": {"_id": 1}}
    ]
    
    result = await products_collection.aggregate(pipeline).to_list(None)
    tags = [doc["_id"] for doc in result if doc["_id"]]
    
    return {"tags": tags}


@router.post("/tags")
async def create_tag(tag_name: str):
    """
    Создать новый тег (фактически просто валидация имени)
    """
    if not tag_name or len(tag_name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Имя тега не может быть пустым")
    
    tag_name = tag_name.strip()
    
    # Проверяем, что тег еще не существует
    db = await get_database()
    products_collection = db.product_catalog
    
    existing = await products_collection.find_one({"tags": tag_name})
    if existing:
        raise HTTPException(status_code=400, detail="Тег уже существует")
    
    return {"tag": tag_name, "message": "Тег создан. Присвойте его товарам для использования."}


@router.delete("/tags/{tag_name}")
async def delete_tag(tag_name: str):
    """
    Удалить тег из всех товаров
    """
    db = await get_database()
    products_collection = db.product_catalog
    
    # Удаляем тег из всех товаров
    result = await products_collection.update_many(
        {"tags": tag_name},
        {"$pull": {"tags": tag_name}}
    )
    
    return {
        "deleted": True,
        "modified_count": result.modified_count,
        "message": f"Тег '{tag_name}' удален из {result.modified_count} товаров"
    }


@router.post("/bulk-assign-tags")
async def bulk_assign_tags(product_ids: List[str], tag: str):
    """
    Массово присвоить тег товарам
    """
    if not tag or len(tag.strip()) == 0:
        raise HTTPException(status_code=400, detail="Имя тега не может быть пустым")
    
    if not product_ids or len(product_ids) == 0:
        raise HTTPException(status_code=400, detail="Не выбраны товары")
    
    tag = tag.strip()
    
    db = await get_database()
    products_collection = db.product_catalog
    
    # Добавляем тег к выбранным товарам (используем $addToSet чтобы избежать дубликатов)
    result = await products_collection.update_many(
        {"_id": {"$in": product_ids}},
        {"$addToSet": {"tags": tag}}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count,
        "message": f"Тег '{tag}' присвоен {result.modified_count} товарам"
    }


@router.post("/bulk-remove-tags")
async def bulk_remove_tags(product_ids: List[str], tag: str):
    """
    Массово удалить тег у товаров
    """
    if not tag or len(tag.strip()) == 0:
        raise HTTPException(status_code=400, detail="Имя тега не может быть пустым")
    
    if not product_ids or len(product_ids) == 0:
        raise HTTPException(status_code=400, detail="Не выбраны товары")
    
    tag = tag.strip()
    
    db = await get_database()
    products_collection = db.product_catalog
    
    # Удаляем тег у выбранных товаров
    result = await products_collection.update_many(
        {"_id": {"$in": product_ids}},
        {"$pull": {"tags": tag}}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count,
        "message": f"Тег '{tag}' удален у {result.modified_count} товаров"
    }
