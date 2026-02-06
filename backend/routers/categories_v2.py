from backend.core.database import db
"""
API endpoints для новой системы категорий
Реализует логику предзагрузки и сопоставления как в SelSup
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from backend.auth_utils import get_current_user
from backend.category_system import CategorySystem
from backend.connectors import get_connector, MarketplaceError
from backend.wb_category_preload import WBCategoryManager
from backend.ozon_category_preload import OzonCategoryManager

router = APIRouter()
logger = logging.getLogger(__name__)


def get_category_system():
    """Получить инстанс CategorySystem с актуальным db"""
    return CategorySystem(db)


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
        cached_cats = await db.marketplace_categories.find(
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
    Поиск категорий - СНАЧАЛА ИЗ КЭША (БД), потом с API если пусто
    Для WB всегда из кэша (быстро)
    """
    logger.info(f"[CategorySearch] Searching {marketplace} categories: '{query}'")
    
    try:
        # Для WB используем кэш всегда
        if marketplace == 'wb':
            manager = WBCategoryManager(db)
            categories = await manager.search_categories(query)
            
            logger.info(f"[CategorySearch] WB from cache: {len(categories)} results")
            
            return {
                "marketplace": marketplace,
                "query": query,
                "total": len(categories),
                "categories": categories,
                "cached": True
            }
        
        # Для Ozon используем кэш всегда
        if marketplace == 'ozon':
            manager = OzonCategoryManager(db)
            categories = await manager.search_categories(query)
            
            logger.info(f"[CategorySearch] Ozon from cache: {len(categories)} results")
            
            return {
                "marketplace": marketplace,
                "query": query,
                "total": len(categories),
                "categories": categories,
                "cached": True
            }
        
        # Для других МП - старая логика (поиск в category_tree_cache)
        category_system = get_category_system()
        categories = await category_system.search_categories(marketplace, query, limit=50)
        
        # Если в БД пусто - загружаем с API
        if not categories:
            logger.info(f"[CategorySearch] No cached, fetching from API...")
            
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
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
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
                logger.warning(f"[Attributes] Ozon type_id missing for category {category_id}, cannot load attributes")
                return {
                    "marketplace": marketplace,
                    "category_id": category_id,
                    "attributes": [],
                    "cached": False,
                    "error": "type_id required for Ozon categories"
                }
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


@router.post("/api/categories/mappings/auto-suggest")
async def auto_suggest_category_mapping(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Автоматически подобрать категории на других маркетплейсах
    на основе уже выбранной категории одного маркетплейса
    """
    try:
        source_marketplace = data.get('source_marketplace')  # ozon, wb, yandex
        source_category_id = data.get('source_category_id')
        source_category_name = data.get('source_category_name')
        
        if not source_marketplace or not source_category_id:
            raise HTTPException(status_code=400, detail="source_marketplace and source_category_id required")
        
        logger.info(f"[AutoSuggest] Finding matches for {source_marketplace} category {source_category_id}: {source_category_name}")
        
        suggestions = {}
        
        # Список маркетплейсов для поиска
        target_marketplaces = ['ozon', 'wb', 'yandex']
        target_marketplaces.remove(source_marketplace)
        
        for target_mp in target_marketplaces:
            # Поиск по названию категории в кэше
            search_query = {"marketplace": target_mp, "disabled": False}
            
            if source_category_name:
                # Разбиваем название на ключевые слова
                keywords = source_category_name.lower().split()
                # Ищем категории, содержащие хотя бы одно из ключевых слов
                search_query["$or"] = [
                    {"category_name": {"$regex": kw, "$options": "i"}} for kw in keywords if len(kw) > 3
                ]
            
            if search_query.get("$or"):
                matches = await db[f"{target_mp}_categories_cache"].find(
                    search_query
                ).limit(5).to_list(length=5)
                
                if matches:
                    # Сортируем по релевантности (количество совпадающих слов)
                    scored_matches = []
                    for match in matches:
                        match_name = match.get('category_name', '').lower()
                        score = sum(1 for kw in keywords if kw.lower() in match_name)
                        scored_matches.append({
                            "category_id": match.get('category_id') or match.get('id'),
                            "category_name": match.get('category_name') or match.get('name'),
                            "type_id": match.get('type_id'),
                            "score": score
                        })
                    
                    # Сортируем по score
                    scored_matches.sort(key=lambda x: x['score'], reverse=True)
                    suggestions[target_mp] = scored_matches[:3]  # Топ 3
                else:
                    suggestions[target_mp] = []
            else:
                suggestions[target_mp] = []
        
        return {
            "source": {
                "marketplace": source_marketplace,
                "category_id": source_category_id,
                "category_name": source_category_name
            },
            "suggestions": suggestions
        }
        
    except Exception as e:
        logger.error(f"[AutoSuggest] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/mappings")
async def get_all_mappings(
    current_user: dict = Depends(get_current_user)
):
    """Получить все сопоставления категорий"""
    try:
        mappings_cursor = db.category_mappings.find({}).sort("internal_name", 1)
        mappings = []
        
        async for mapping in mappings_cursor:
            mapping["id"] = str(mapping.pop("_id"))
            mappings.append(mapping)
        
        return mappings
        
    except Exception as e:
        logger.error(f"[GetAllMappings] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/mappings/search")
async def search_mappings(
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """Поиск сопоставлений - универсальный поиск по внутреннему имени И по категориям маркетплейсов"""
    try:
        results = []
        
        # 1. Поиск по внутреннему имени категории
        regex = {"$regex": query, "$options": "i"}
        mappings = await db.category_mappings.find({
            "internal_name": regex
        }).limit(20).to_list(length=20)
        
        for mapping in mappings:
            mapping["id"] = str(mapping.pop("_id"))
            mapping["match_type"] = "internal"
            results.append(mapping)
        
        # 2. Поиск по категориям маркетплейсов в кэше
        for marketplace in ['ozon', 'wb', 'yandex']:
            cache_collection = f"{marketplace}_categories_cache"
            
            # Ищем категорию в кэше маркетплейса
            mp_categories = await db[cache_collection].find({
                "$or": [
                    {"category_name": regex},
                    {"name": regex}
                ]
            }).limit(10).to_list(length=10)
            
            for mp_cat in mp_categories:
                cat_id = str(mp_cat.get('category_id') or mp_cat.get('id'))
                
                # Найти mapping где есть эта категория маркетплейса
                mapping = await db.category_mappings.find_one({
                    f"marketplace_categories.{marketplace}": cat_id
                })
                
                if mapping and str(mapping['_id']) not in [r.get('id') for r in results]:
                    mapping["id"] = str(mapping.pop("_id"))
                    mapping["match_type"] = f"marketplace_{marketplace}"
                    mapping["matched_category_name"] = mp_cat.get('category_name') or mp_cat.get('name')
                    results.append(mapping)
        
        return {"query": query, "total": len(results), "mappings": results}
    except Exception as e:
        logger.error(f"[SearchMappings] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/mappings/{mapping_id}")
async def get_mapping_by_id(
    mapping_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить mapping по ID"""
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        
        # Пробуем конвертировать в ObjectId
        try:
            object_id = ObjectId(mapping_id)
        except InvalidId:
            # Если не получилось, ищем по строковому id
            mapping = await db.category_mappings.find_one({"id": mapping_id})
        else:
            mapping = await db.category_mappings.find_one({"_id": object_id})
        
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        mapping["id"] = str(mapping.pop("_id"))
        return mapping
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GetMapping] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/categories/mappings/{mapping_id}")
async def delete_mapping(
    mapping_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить сопоставление категории"""
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        
        # Пробуем конвертировать в ObjectId
        try:
            object_id = ObjectId(mapping_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid mapping ID format")
        
        result = await db.category_mappings.delete_one({"_id": object_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        logger.info(f"[DeleteMapping] Deleted mapping: {mapping_id}")
        return {"message": "Mapping deleted successfully", "mapping_id": mapping_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DeleteMapping] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/categories/mappings/quick-update")
async def quick_update_mapping(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Быстрое обновление маппинга - добавить категорию МП к существующему маппингу
    Используется когда пользователь выбирает категорию из QuickMatcher
    """
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        
        mapping_id = data.get('mapping_id')
        marketplace = data.get('marketplace')
        category_id = data.get('category_id')
        type_id = data.get('type_id')
        
        if not mapping_id or not marketplace or not category_id:
            raise HTTPException(status_code=400, detail="mapping_id, marketplace, and category_id required")
        
        logger.info(f"[QuickUpdate] Updating mapping {mapping_id}: {marketplace} -> {category_id}")
        
        # Конвертируем mapping_id в ObjectId
        try:
            object_id = ObjectId(mapping_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid mapping ID format")
        
        # Проверяем существование маппинга
        mapping = await db.category_mappings.find_one({"_id": object_id})
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        # Маппинг ключей для БД
        db_key_map = {
            'ozon': 'ozon',
            'wb': 'wildberries',
            'yandex': 'yandex'
        }
        db_key = db_key_map.get(marketplace, marketplace)
        
        # Обновляем категорию МП
        update_doc = {
            f"marketplace_categories.{db_key}": category_id,
            "updated_at": datetime.utcnow()
        }
        
        # Для Ozon добавляем type_id
        if type_id and marketplace == 'ozon':
            if "marketplace_type_ids" not in mapping:
                mapping["marketplace_type_ids"] = {}
            update_doc[f"marketplace_type_ids.{db_key}"] = type_id
        
        await db.category_mappings.update_one(
            {"_id": object_id},
            {"$set": update_doc}
        )
        
        logger.info(f"✅ [QuickUpdate] Mapping updated: {marketplace} category {category_id} added")
        
        # Возвращаем обновленный маппинг
        updated_mapping = await db.category_mappings.find_one({"_id": object_id})
        updated_mapping["id"] = str(updated_mapping.pop("_id"))
        
        return {
            "message": f"Категория {marketplace} добавлена в маппинг",
            "mapping": updated_mapping
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[QuickUpdate] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ========== WB ПРЕДЗАГРУЗКА КАТЕГОРИЙ ==========

@router.post("/api/categories/wb/preload")
async def preload_wb_categories(
    current_user: dict = Depends(get_current_user)
):
    """
    Предзагрузка категорий WB в базу данных
    Загружает parent categories (80 шт) и сохраняет
    Subjects добавляются автоматически при импорте товаров
    """
    logger.info("[WB Preload] Starting category preload")
    
    # ИСПРАВЛЕНО: Ищем ЛЮБОЙ WB ключ в системе
    all_profiles = await db.seller_profiles.find({}).to_list(100)
    
    api_key = None
    for profile in all_profiles:
        wb_keys = [k for k in profile.get('api_keys', []) if k.get('marketplace') == 'wb']
        if wb_keys:
            api_key = wb_keys[0]
            logger.info(f"[WB Preload] Found WB key in profile")
            break
    
    if not api_key:
        raise HTTPException(status_code=400, detail="No WB API key found in system")
    
    try:
        from backend.connectors import WildberriesConnector
        
        # Создать коннектор
        connector = WildberriesConnector(api_key.get('client_id', ''), api_key['api_key'])
        
        # Менеджер категорий
        manager = WBCategoryManager(db)
        
        # Предзагрузить
        result = await manager.preload_from_api(connector)
        
        return result
        
    except Exception as e:
        logger.error(f"[WB Preload] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/wb/cached")
async def get_cached_wb_categories(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Получить категорий WB из кэша (БД)
    Быстро, без запросов к API
    """
    try:
        manager = WBCategoryManager(db)
        
        if search:
            categories = await manager.search_categories(search)
        else:
            categories = await manager.get_all_categories()
        
        return {
            "categories": categories,
            "total": len(categories),
            "cached": True
        }
        
    except Exception as e:
        logger.error(f"[WB Cached] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/wb/stats")
async def get_wb_categories_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Статистика предзагруженных категорий WB
    """
    try:
        manager = WBCategoryManager(db)
        stats = await manager.get_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"[WB Stats] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== ЗНАЧЕНИЯ АТРИБУТОВ (СЛОВАРИ) ==========


# ========== OZON ПРЕДЗАГРУЗКА КАТЕГОРИЙ ==========

@router.post("/api/categories/ozon/preload")
async def preload_ozon_categories(
    current_user: dict = Depends(get_current_user)
):
    """Предзагрузка категорий Ozon в базу данных"""
    logger.info("[Ozon Preload] Starting category preload")
    
    # ИСПРАВЛЕНО: Ищем ЛЮБОЙ Ozon ключ в системе
    all_profiles = await db.seller_profiles.find({}).to_list(100)
    
    api_key = None
    for profile in all_profiles:
        ozon_keys = [k for k in profile.get('api_keys', []) if k.get('marketplace') == 'ozon']
        if ozon_keys:
            api_key = ozon_keys[0]
            logger.info(f"[Ozon Preload] Found Ozon key in profile")
            break
    
    if not api_key:
        raise HTTPException(status_code=400, detail="No Ozon API key found in system")
    
    try:
        from backend.connectors import OzonConnector
        
        connector = OzonConnector(api_key.get('client_id', ''), api_key['api_key'])
        manager = OzonCategoryManager(db)
        
        result = await manager.preload_from_api(connector)
        return result
        
    except Exception as e:
        logger.error(f"[Ozon Preload] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/ozon/cached")
async def get_cached_ozon_categories(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Получить категории Ozon из кэша"""
    try:
        manager = OzonCategoryManager(db)
        
        if search:
            categories = await manager.search_categories(search)
        else:
            categories = await manager.get_all_categories()
        
        return {
            "categories": categories,
            "total": len(categories),
            "cached": True
        }
        
    except Exception as e:
        logger.error(f"[Ozon Cached] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/categories/ozon/stats")
async def get_ozon_categories_stats(
    current_user: dict = Depends(get_current_user)
):
    """Статистика категорий Ozon"""
    try:
        manager = OzonCategoryManager(db)
        stats = await manager.get_stats()
        return stats
        
    except Exception as e:
        logger.error(f"[Ozon Stats] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
