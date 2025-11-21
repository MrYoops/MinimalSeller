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
        count = await server.db.marketplace_categories.count_documents({
            "marketplace": marketplace
        })
        
        last_updated = await server.db.marketplace_categories.find_one(
            {"marketplace": marketplace},
            sort=[("updated_at", -1)]
        )
        
        stats[marketplace] = {
            "total_categories": count,
            "last_updated": last_updated.get('updated_at') if last_updated else None
        }
    
    return stats


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
                if query_lower in cat.get('name', '').lower() or query_lower in cat.get('category_name', '').lower()
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