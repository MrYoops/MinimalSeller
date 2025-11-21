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


# ========== ПРЕДЗАГРУЗКА КАТЕГОРИЙ ==========

@router.post("/api/admin/categories/preload")
async def preload_categories(
    marketplace: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Предзагрузить категории с маркетплейса (admin only)
    Запускается в фоне для всех маркетплейсов
    """
    logger.info(f"[CategoryPreload] Starting preload for {marketplace}")
    
    # Получить API ключи текущего пользователя
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
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
    
    # Запустить предзагрузку в фоне
    background_tasks.add_task(
        get_category_system().preload_all_categories,
        marketplace_key.get('client_id', ''),
        marketplace_key['api_key'],
        marketplace
    )
    
    return {
        "message": f"Category preload started for {marketplace}",
        "status": "in_progress"
    }


@router.get("/api/admin/categories/preload/status")
async def get_preload_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Получить статус предзагрузки категорий
    """
    stats = {}
    
    for marketplace in ['ozon', 'wb', 'yandex']:
        count = await db.marketplace_categories.count_documents({
            "marketplace": marketplace
        })
        
        last_updated = await db.marketplace_categories.find_one(
            {"marketplace": marketplace},
            sort=[("updated_at", -1)]
        )
        
        stats[marketplace] = {
            "total_categories": count,
            "last_updated": last_updated.get('updated_at') if last_updated else None
        }
    
    return stats


# ========== ПОИСК КАТЕГОРИЙ ==========

@router.get("/api/categories/marketplace/{marketplace}/search")
async def search_marketplace_categories(
    marketplace: str,
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """
    Поиск категорий - сначала в предзагруженных, если пусто - напрямую с API
    Автопоиск по названию товара
    """
    logger.info(f"[CategorySearch] Searching {marketplace} categories: '{query}'")
    
    try:
        category_system = get_category_system()
        
        # Сначала попробуем поискать в предзагруженных
        categories = await category_system.search_categories(marketplace, query, limit=50)
        
        # Если в БД пусто - загружаем напрямую с API
        if not categories:
            logger.info(f"[CategorySearch] No cached categories, fetching from API...")
            
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
                    detail=f"No API key found for {marketplace}. Please add integration first."
                )
            
            # Получить категории напрямую с API
            connector = get_connector(
                marketplace,
                marketplace_key.get('client_id', ''),
                marketplace_key['api_key']
            )
            
            all_categories = await connector.get_categories()
            
            # Фильтровать по запросу
            query_lower = query.lower()
            categories = [
                cat for cat in all_categories
                if query_lower in cat.get('name', '').lower()
            ][:50]
            
            logger.info(f"[CategorySearch] Loaded {len(categories)} categories from API")
        
        return {
            "marketplace": marketplace,
            "query": query,
            "total": len(categories),
            "categories": categories
        }
        
    except MarketplaceError as e:
        logger.error(f"[CategorySearch] Marketplace error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[CategorySearch] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
        category_system = get_category_system()
        
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

    marketplace: str,
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """
    Поиск категорий - сначала в предзагруженных, если пусто - напрямую с API
    Автопоиск по названию товара
    """
    logger.info(f"[CategorySearch] Searching {marketplace} categories: '{query}'")
    
    try:
        category_system = get_category_system()
        
        # Сначала попробуем поискать в предзагруженных
        categories = await category_system.search_categories(marketplace, query, limit=50)
        
        # Если в БД пусто - загружаем напрямую с API
        if not categories:
            logger.info(f"[CategorySearch] No cached categories, fetching from API...")
            
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
                    detail=f"No API key found for {marketplace}. Please add integration first."
                )
            
            # Получить категории напрямую с API
            connector = get_connector(
                marketplace,
                marketplace_key.get('client_id', ''),
                marketplace_key['api_key']
            )
            
            all_categories = await connector.get_categories()
            
            # Фильтровать по запросу
            query_lower = query.lower()
            categories = [
                cat for cat in all_categories
                if query_lower in cat.get('name', '').lower()
            ][:50]
            
            logger.info(f"[CategorySearch] Loaded {len(categories)} categories from API")
        
        return {
            "marketplace": marketplace,
            "query": query,
            "total": len(categories),
            "categories": categories
        }
        
    except MarketplaceError as e:
        logger.error(f"[CategorySearch] Marketplace error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[CategorySearch] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/marketplace/{marketplace}/{category_id}")
async def get_category_details(
    marketplace: str,
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить детали категории по ID
    """
    try:
        category_system = get_category_system()
        category = category_system = get_category_system(); await category_system.get_category_by_id(marketplace, category_id)
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return category
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CategoryDetails] Error: {str(e)}")
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
    """
    Получить атрибуты категории
    Сначала проверяет кэш, если нет - загружает с API
    """
    logger.info(f"[Attributes] Getting attributes for {marketplace} category {category_id}")
    
    # Проверить кэш
    cached_attrs = category_system = get_category_system(); await category_system.get_cached_attributes(marketplace, category_id, type_id)
    
    if cached_attrs:
        logger.info(f"[Attributes] Returning {len(cached_attrs)} cached attributes")
        
        # Фильтровать по is_required если указано
        if is_required is not None:
            cached_attrs = [
                attr for attr in cached_attrs
                if attr.get('is_required') == is_required
            ]
        
        return {
            "marketplace": marketplace,
            "category_id": category_id,
            "type_id": type_id,
            "attributes": cached_attrs,
            "cached": True
        }
    
    # Кэш пустой - загрузить с API
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
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
        
        # Получить атрибуты
        if marketplace == 'ozon':
            if not type_id:
                raise HTTPException(status_code=400, detail="type_id required for Ozon")
            
            attributes = await connector.get_category_attributes(
                category_id=int(category_id),
                type_id=type_id
            )
        elif marketplace == 'wb':
            attributes = await connector.get_category_characteristics(int(category_id))
        else:
            attributes = []
        
        # Кэшировать
        category_system = get_category_system(); await category_system.cache_category_attributes(
            marketplace, category_id, type_id, attributes
        )
        
        # Фильтровать по is_required если указано
        if is_required is not None:
            attributes = [
                attr for attr in attributes
                if attr.get('is_required') == is_required
            ]
        
        logger.info(f"[Attributes] Loaded {len(attributes)} attributes from API")
        
        return {
            "marketplace": marketplace,
            "category_id": category_id,
            "type_id": type_id,
            "attributes": attributes,
            "cached": False
        }
        
    except MarketplaceError as e:
        logger.error(f"[Attributes] Marketplace error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"[Attributes] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== СОПОСТАВЛЕНИЕ КАТЕГОРИЙ ==========

@router.post("/api/categories/mappings")
async def create_category_mapping(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Создать сопоставление категорий между маркетплейсами
    """
    logger.info(f"[Mapping] Creating category mapping")
    
    try:
        internal_name = data.get('internal_name')
        if not internal_name:
            raise HTTPException(status_code=400, detail="internal_name required")
        
        mapping_id = category_system = get_category_system(); await category_system.create_or_update_mapping(
            internal_name=internal_name,
            ozon_category_id=data.get('ozon_category_id'),
            wb_category_id=data.get('wb_category_id'),
            yandex_category_id=data.get('yandex_category_id')
        )
        
        return {
            "message": "Category mapping created successfully",
            "mapping_id": mapping_id
        }
        
    except Exception as e:
        logger.error(f"[Mapping] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/mappings/search")
async def search_category_mappings(
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """
    Поиск сопоставлений категорий
    """
    try:
        mappings = category_system = get_category_system(); await category_system.search_mappings(query, limit=50)
        
        return {
            "query": query,
            "total": len(mappings),
            "mappings": mappings
        }
        
    except Exception as e:
        logger.error(f"[MappingSearch] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/mappings/{mapping_id}")
async def get_category_mapping(
    mapping_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить сопоставление по ID
    """
    try:
        mapping = category_system = get_category_system(); await category_system.get_mapping_by_id(mapping_id)
        
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        return mapping
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MappingGet] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== СОХРАНЕНИЕ КАТЕГОРИЙ ДЛЯ ТОВАРА ==========

@router.put("/api/catalog/products/{product_id}/categories")
async def update_product_categories(
    product_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Обновить категории товара для всех маркетплейсов
    Сохраняет category_id, type_id, и характеристики для каждого маркетплейса
    """
    logger.info(f"[ProductCategories] Updating categories for product {product_id}")
    
    # Проверить товар
    product = await db.product_catalog.find_one({
        "_id": product_id,
        "seller_id": current_user['_id']
    })
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Обновить marketplace_data
    marketplace_data = product.get('marketplace_data', {})
    
    for mp in ['ozon', 'wb', 'yandex']:
        mp_data = data.get(mp, {})
        if mp_data:
            if mp not in marketplace_data:
                marketplace_data[mp] = {}
            
            marketplace_data[mp].update({
                "category_id": mp_data.get('category_id'),
                "category_name": mp_data.get('category_name', ''),
                "type_id": mp_data.get('type_id'),
                "attributes": mp_data.get('attributes', {}),
                "updated_at": datetime.utcnow().isoformat()
            })
    
    await db.product_catalog.update_one(
        {"_id": product_id},
        {
            "$set": {
                "marketplace_data": marketplace_data,
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    )
    
    logger.info(f"[ProductCategories] Categories updated for product {product_id}")
    
    return {
        "message": "Product categories updated successfully",
        "product_id": product_id
    }
