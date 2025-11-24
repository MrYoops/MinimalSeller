"""
API endpoints для новой системы категорий
Реализует логику предзагрузки и сопоставления как в SelSup
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from server import get_current_user
import server
from category_system import CategorySystem
from connectors import get_connector, MarketplaceError

router = APIRouter()
logger = logging.getLogger(__name__)


def get_category_system():
    """Получить инстанс CategorySystem с актуальным db"""
    return CategorySystem(server.db)


# ========== ПОЛУЧИТЬ ВСЕ КАТЕГОРИИ МАРКЕТПЛЕЙСА ==========

@router.get("/api/categories/marketplace/{marketplace}/all")
async def get_all_marketplace_categories(
    marketplace: str,
    limit: int = Query(default=1000, le=5000),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить ВСЕ категории маркетплейса (для страницы категорий)
    Загружает напрямую с API если не предзагружено
    """
    logger.info(f"[AllCategories] Loading all {marketplace} categories")
    
    try:
        # Сначала пытаемся загрузить из кэша
        cached_cats = await server.db.marketplace_categories.find(
            {"marketplace": marketplace, "disabled": False},
            {"_id": 0}
        ).limit(limit).to_list(length=limit)
        
        if cached_cats:
            logger.info(f"[AllCategories] Returning {len(cached_cats)} cached categories")
            return {
                "marketplace": marketplace,
                "total": len(cached_cats),
                "categories": cached_cats,
                "cached": True
            }
        
        # Если кэш пуст - загружаем с API
        logger.info(f"[AllCategories] No cache, fetching from API...")
        
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
                detail=f"No API key found for {marketplace}. Please add integration first."
            )
        
        connector = get_connector(
            marketplace,
            marketplace_key.get('client_id', ''),
            marketplace_key['api_key']
        )
        
        all_categories = await connector.get_categories()
        
        logger.info(f"[AllCategories] Loaded {len(all_categories)} categories from API")
        
        return {
            "marketplace": marketplace,
            "total": len(all_categories),
            "categories": all_categories[:limit],
            "cached": False
        }
        
    except MarketplaceError as e:
        logger.error(f"[AllCategories] Marketplace error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[AllCategories] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== ПОИСК КАТЕГОРИЙ ==========

@router.get("/api/categories/marketplace/{marketplace}/search")
async def search_marketplace_categories(
    marketplace: str,
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """
    Поиск категорий - сначала в предзагруженных, если пусто - напрямую с API
    """
    logger.info(f"[CategorySearch] Searching {marketplace} categories: '{query}'")
    
    try:
        category_system = get_category_system()
        categories = await category_system.search_categories(marketplace, query, limit=50)
        
        # Если в БД пусто - загружаем с API
        if not categories:
            logger.info(f"[CategorySearch] No cached, fetching from API...")
            
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
            
            connector = get_connector(
                marketplace,
                marketplace_key.get('client_id', ''),
                marketplace_key['api_key']
            )
            
            all_categories = await connector.get_categories()
            
            query_lower = query.lower()
            categories = [
                cat for cat in all_categories
                if query_lower in cat.get('name', '').lower() or query_lower in cat.get('category_name', '').lower()
            ][:50]
            
            logger.info(f"[CategorySearch] Found {len(categories)} from API")
        
        return {
            "marketplace": marketplace,
            "query": query,
            "total": len(categories),
            "categories": categories
        }
        
    except MarketplaceError as e:
        logger.error(f"[CategorySearch] Error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[CategorySearch] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== АТРИБУТЫ КАТЕГОРИЙ ==========

@router.get("/api/categories/marketplace/{marketplace}/{category_id}/attributes")
async def get_category_attributes(
    marketplace: str,
    category_id: str,
    type_id: Optional[int] = None,
    is_required: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Получить атрибуты категории"""
    logger.info(f"[Attributes] Get for {marketplace} cat {category_id}")
    
    category_system = get_category_system()
    cached_attrs = await category_system.get_cached_attributes(marketplace, category_id, type_id)
    
    if cached_attrs:
        if is_required is not None:
            cached_attrs = [a for a in cached_attrs if a.get('is_required') == is_required]
        
        return {
            "marketplace": marketplace,
            "category_id": category_id,
            "attributes": cached_attrs,
            "cached": True
        }
    
    # Load from API
    profile = await server.db.seller_profiles.find_one({'user_id': current_user['_id']})
    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    api_keys = profile.get('api_keys', [])
    marketplace_key = next((k for k in api_keys if k['marketplace'] == marketplace), None)
    
    if not marketplace_key:
        raise HTTPException(status_code=400, detail=f"No API key for {marketplace}")
    
    try:
        connector = get_connector(marketplace, marketplace_key.get('client_id', ''), marketplace_key['api_key'])
        
        if marketplace == 'ozon':
            if not type_id:
                raise HTTPException(status_code=400, detail="type_id required for Ozon")
            attributes = await connector.get_category_attributes(int(category_id), type_id)
        elif marketplace == 'wb':
            attributes = await connector.get_category_characteristics(int(category_id))
        else:
            attributes = []
        
        await category_system.cache_category_attributes(marketplace, category_id, type_id, attributes)
        
        if is_required is not None:
            attributes = [a for a in attributes if a.get('is_required') == is_required]
        
        return {
            "marketplace": marketplace,
            "category_id": category_id,
            "attributes": attributes,
            "cached": False
        }
        
    except MarketplaceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== СОПОСТАВЛЕНИЯ ==========

@router.post("/api/categories/mappings")
async def create_category_mapping(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Создать сопоставление"""
    try:
        category_system = get_category_system()
        internal_name = data.get('internal_name')
        if not internal_name:
            raise HTTPException(status_code=400, detail="internal_name required")
        
        mapping_id = await category_system.create_or_update_mapping(
            internal_name=internal_name,
            ozon_category_id=data.get('ozon_category_id'),
            wb_category_id=data.get('wb_category_id'),
            yandex_category_id=data.get('yandex_category_id')
        )
        
        return {"message": "Mapping created", "mapping_id": mapping_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/mappings/search")
async def search_mappings(
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """Поиск сопоставлений"""
    try:
        category_system = get_category_system()
        mappings = await category_system.search_mappings(query, limit=50)
        return {"query": query, "total": len(mappings), "mappings": mappings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== ЗНАЧЕНИЯ АТРИБУТОВ (СЛОВАРИ) ==========

@router.get("/api/categories/marketplace/{marketplace}/{category_id}/attribute-values")
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
    
    cached = await server.db.attribute_values_cache.find_one({"cache_key": cache_key})
    
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
        values = []
        
        # Для Ozon используем /v1/description-category/attribute/values
        if marketplace == 'ozon':
            import httpx
            
            connector = get_connector(marketplace, marketplace_key.get('client_id', ''), marketplace_key['api_key'])
            url = f"{connector.base_url}/v1/description-category/attribute/values"
            
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
        
        await server.db.attribute_values_cache.replace_one(
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


# ========== ПОДБОР КАТЕГОРИИ ПО НАЗВАНИЮ ==========

@router.get("/api/categories/suggest")
async def suggest_category(
    title: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user)
):
    """
    Предложить категорию на основе названия товара
    Анализирует ключевые слова и возвращает релевантные категории
    """
    logger.info(f"[CategorySuggest] Analyzing title: '{title}'")
    
    try:
        # Простой анализ: токенизация и поиск по ключевым словам
        title_lower = title.lower()
        
        # Улучшенный словарь: keyword -> список поисковых запросов для БД
        keywords_map = {
            'мышь': ['мыш', 'mouse'],
            'клавиатура': ['клавиатур', 'keyboard', 'клав'],
            'наушник': ['наушник', 'headphone', 'earphone'],
            'телефон': ['телефон', 'phone', 'смартфон', 'smartphone'],
            'чехол': ['чехол', 'case', 'обложк'],
            'зарядка': ['зарядк', 'charger', 'блок питания'],
            'кабель': ['кабель', 'cable', 'провод'],
            'монитор': ['монитор', 'monitor', 'дисплей', 'экран'],
            'ноутбук': ['ноутбук', 'laptop', 'notebook'],
            'планшет': ['планшет', 'tablet', 'ipad'],
            'часы': ['час', 'watch', 'smartwatch'],
            'колонка': ['колонк', 'speaker'],
            'обувь': ['обув', 'shoes', 'кроссовк', 'ботинк', 'туфл'],
            'одежда': ['одежд', 'clothes', 'футболк', 'рубашк', 'куртк'],
        }
        
        # Найти подходящие ключевые слова (используем стемминг)
        matched_keywords = set()
        for category_key, keywords in keywords_map.items():
            for keyword in keywords:
                if keyword in title_lower:
                    matched_keywords.update(keywords)
                    break
        
        # Поиск в сопоставлениях (mappings)
        category_system = get_category_system()
        suggestions = []
        
        if matched_keywords:
            # Поиск по найденным ключевым словам
            for keyword in matched_keywords:
                mappings = await category_system.search_mappings(keyword, limit=10)
                suggestions.extend(mappings)
        else:
            # Общий поиск по всему названию (первые 3 слова)
            words = title_lower.split()[:3]
            for word in words:
                if len(word) > 2:
                    mappings = await category_system.search_mappings(word, limit=5)
                    suggestions.extend(mappings)
        
        # Убрать дубликаты
        seen = set()
        unique_suggestions = []
        for sugg in suggestions:
            sugg_id = sugg.get('id')
            if sugg_id not in seen:
                seen.add(sugg_id)
                unique_suggestions.append(sugg)
        
        logger.info(f"[CategorySuggest] Found {len(unique_suggestions)} suggestions")
        
        return {
            "title": title,
            "suggestions": unique_suggestions[:10],  # Топ 10
            "total": len(unique_suggestions)
        }
        
    except Exception as e:
        logger.error(f"[CategorySuggest] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
