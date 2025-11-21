"""
API endpoints для системы категорий с сопоставлением маркетплейсов
Реализует логику как в SelSup
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import logging
from server import get_current_user
import server
from connectors import get_connector, MarketplaceError

router = APIRouter()
logger = logging.getLogger(__name__)

# ========== МОДЕЛИ ==========

class CategoryMapping(dict):
    """Сопоставление категорий между маркетплейсами"""
    pass

class CategoryWithMappings(dict):
    """Категория с сопоставлениями"""
    pass


# ========== ПОИСК КАТЕГОРИЙ МАРКЕТПЛЕЙСОВ ==========

@router.get("/api/categories/search/{marketplace}")
async def search_marketplace_categories(
    marketplace: str,
    query: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user)
):
    """
    Поиск категорий на маркетплейсе (Ozon, WB, Yandex)
    Возвращает список категорий с ID для выбора
    """
    logger.info(f"[Categories] Searching {marketplace} categories: '{query}'")
    
    # Получить API ключи продавца
    profile = await server.db.seller_profiles.find_one({'user_id': current_user['_id']})
    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    # Найти ключ для этого маркетплейса
    api_keys = profile.get('api_keys', [])
    marketplace_key = next(
        (k for k in api_keys if k['marketplace'] == marketplace),
        None
    )
    
    if not marketplace_key:
        raise HTTPException(
            status_code=400,
            detail=f"No API key found for {marketplace}. Please add integration first."
        )
    
    try:
        # Получить connector
        connector = get_connector(
            marketplace,
            marketplace_key.get('client_id', ''),
            marketplace_key['api_key']
        )
        
        # Получить все категории
        all_categories = await connector.get_categories()
        
        # Фильтровать по запросу (case-insensitive)
        query_lower = query.lower()
        filtered = [
            cat for cat in all_categories
            if query_lower in cat.get('name', '').lower()
        ]
        
        logger.info(f"[Categories] Found {len(filtered)} categories matching '{query}'")
        
        return {
            "marketplace": marketplace,
            "query": query,
            "categories": filtered[:50]  # Ограничиваем 50 результатами
        }
        
    except MarketplaceError as e:
        logger.error(f"[Categories] Marketplace error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[Categories] Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== ПОЛУЧЕНИЕ ОБЯЗАТЕЛЬНЫХ АТРИБУТОВ ==========

@router.get("/api/categories/{marketplace}/{category_id}/attributes")
async def get_category_attributes(
    marketplace: str,
    category_id: str,
    type_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить обязательные атрибуты для категории маркетплейса
    Кэширует данные в БД
    """
    logger.info(f"[Attributes] Getting attributes for {marketplace} category {category_id}")
    
    # Проверить кэш
    cache_key = f"{marketplace}_{category_id}"
    if type_id:
        cache_key += f"_{type_id}"
    
    cached = await server.db.category_attributes_cache.find_one({"cache_key": cache_key})
    
    # Если кэш свежий (менее 7 дней), вернуть из кэша
    if cached:
        cache_age = datetime.utcnow() - cached.get('cached_at', datetime.utcnow())
        if cache_age.days < 7:
            logger.info(f"[Attributes] Returning cached attributes (age: {cache_age.days} days)")
            return {
                "marketplace": marketplace,
                "category_id": category_id,
                "attributes": cached.get('attributes', []),
                "cached": True
            }
    
    # Получить API ключи
    profile = await server.db.seller_profiles.find_one({'user_id': current_user['_id']})
    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    api_keys = profile.get('api_keys', [])
    marketplace_key = next(
        (k for k in api_keys if k['marketplace'] == marketplace),
        None
    )
    
    if not marketplace_key:
        raise HTTPException(
            status_code=400,
            detail=f"No API key found for {marketplace}"
        )
    
    try:
        connector = get_connector(
            marketplace,
            marketplace_key.get('client_id', ''),
            marketplace_key['api_key']
        )
        
        # Получить атрибуты в зависимости от маркетплейса
        if marketplace == 'ozon':
            if not type_id:
                raise HTTPException(status_code=400, detail="type_id required for Ozon")
            
            attributes = await connector.get_category_attributes(
                category_id=int(category_id),
                type_id=type_id
            )
        elif marketplace == 'wb':
            attributes = await connector.get_category_characteristics(
                subject_id=int(category_id)
            )
        else:
            attributes = []
        
        # Сохранить в кэш
        cache_doc = {
            "cache_key": cache_key,
            "marketplace": marketplace,
            "category_id": category_id,
            "type_id": type_id,
            "attributes": attributes,
            "cached_at": datetime.utcnow()
        }
        
        await server.db.category_attributes_cache.replace_one(
            {"cache_key": cache_key},
            cache_doc,
            upsert=True
        )
        
        logger.info(f"[Attributes] Cached {len(attributes)} attributes")
        
        return {
            "marketplace": marketplace,
            "category_id": category_id,
            "attributes": attributes,
            "cached": False
        }
        
    except MarketplaceError as e:
        logger.error(f"[Attributes] Marketplace error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[Attributes] Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== ПОЛУЧЕНИЕ СЛОВАРЕЙ ЗНАЧЕНИЙ ДЛЯ АТРИБУТОВ ==========

@router.get("/api/categories/{marketplace}/{category_id}/attribute-values")
async def get_attribute_values(
    marketplace: str,
    category_id: str,
    attribute_id: int,
    type_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить словарь возможных значений для dictionary-атрибута
    Например, для атрибута "Цвет товара" вернёт список цветов с value_id
    """
    logger.info(f"[AttributeValues] Getting values for {marketplace} attribute {attribute_id}")
    
    # Проверить кэш
    cache_key = f"{marketplace}_{category_id}_{attribute_id}"
    if type_id:
        cache_key += f"_{type_id}"
    
    cached = await db.attribute_values_cache.find_one({"cache_key": cache_key})
    
    if cached:
        cache_age = datetime.utcnow() - cached.get('cached_at', datetime.utcnow())
        if cache_age.days < 7:
            logger.info(f"[AttributeValues] Returning cached values (age: {cache_age.days} days)")
            return {
                "marketplace": marketplace,
                "attribute_id": attribute_id,
                "values": cached.get('values', []),
                "cached": True
            }
    
    # Получить API ключи
    profile = await server.db.seller_profiles.find_one({'user_id': current_user['_id']})
    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    api_keys = profile.get('api_keys', [])
    marketplace_key = next(
        (k for k in api_keys if k['marketplace'] == marketplace),
        None
    )
    
    if not marketplace_key:
        raise HTTPException(
            status_code=400,
            detail=f"No API key found for {marketplace}"
        )
    
    try:
        # Для Ozon используем /v2/category/attribute/values
        if marketplace == 'ozon':
            import httpx
            
            url = f"{get_connector(marketplace, marketplace_key.get('client_id', ''), marketplace_key['api_key']).base_url}/v2/category/attribute/values"
            
            headers = {
                "Client-Id": marketplace_key.get('client_id', ''),
                "Api-Key": marketplace_key['api_key'],
                "Content-Type": "application/json"
            }
            
            payload = {
                "description_category_id": int(category_id),
                "type_id": type_id or 0,
                "attribute_id": attribute_id,
                "language": "DEFAULT",
                "last_value_id": 0,
                "limit": 1000
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Ozon API error: {response.text}"
                    )
                
                data = response.json()
                values = data.get('result', [])
        
        elif marketplace == 'wb':
            # Wildberries возвращает возможные значения в get_category_characteristics
            connector = get_connector(
                marketplace,
                marketplace_key.get('client_id', ''),
                marketplace_key['api_key']
            )
            
            characteristics = await connector.get_category_characteristics(int(category_id))
            
            # Найти нужный атрибут
            target_char = next(
                (c for c in characteristics if c.get('id') == attribute_id),
                None
            )
            
            if target_char:
                values = target_char.get('values', [])
            else:
                values = []
        else:
            values = []
        
        # Сохранить в кэш
        cache_doc = {
            "cache_key": cache_key,
            "marketplace": marketplace,
            "category_id": category_id,
            "attribute_id": attribute_id,
            "type_id": type_id,
            "values": values,
            "cached_at": datetime.utcnow()
        }
        
        await db.attribute_values_cache.replace_one(
            {"cache_key": cache_key},
            cache_doc,
            upsert=True
        )
        
        logger.info(f"[AttributeValues] Cached {len(values)} values for attribute {attribute_id}")
        
        return {
            "marketplace": marketplace,
            "attribute_id": attribute_id,
            "values": values,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"[AttributeValues] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== СОХРАНЕНИЕ СОПОСТАВЛЕНИЯ КАТЕГОРИЙ ==========

@router.post("/api/catalog/products/{product_id}/category-mappings")
async def save_category_mappings(
    product_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Сохранить сопоставление категорий для товара
    Хранит ID категорий для каждого маркетплейса
    """
    logger.info(f"[CategoryMapping] Saving mappings for product {product_id}")
    
    # Проверить товар
    product = await db.product_catalog.find_one({
        "_id": product_id,
        "seller_id": current_user['_id']
    }, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Обновить сопоставления
    mappings = {
        "ozon": {
            "category_id": data.get('ozon_category_id'),
            "type_id": data.get('ozon_type_id'),
            "category_name": data.get('ozon_category_name', '')
        },
        "wb": {
            "category_id": data.get('wb_category_id'),
            "category_name": data.get('wb_category_name', '')
        },
        "yandex": {
            "category_id": data.get('yandex_category_id'),
            "category_name": data.get('yandex_category_name', '')
        }
    }
    
    await db.product_catalog.update_one(
        {"_id": product_id},
        {
            "$set": {
                "category_mappings": mappings,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    logger.info(f"[CategoryMapping] Saved mappings for product {product_id}")
    
    return {
        "message": "Category mappings saved successfully",
        "mappings": mappings
    }
