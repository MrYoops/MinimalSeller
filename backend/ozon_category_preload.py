# -*- coding: utf-8 -*-
"""
Ozon Category Preload System
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class OzonCategoryManager:
    """Менеджер категорий Ozon с кэшированием в БД"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.ozon_categories_cache
    
    async def preload_from_api(self, connector) -> Dict[str, Any]:
        """Предзагрузка категорий с API Ozon"""
        logger.info("[OzonCategoryManager] Preloading categories from API")
        
        try:
            categories = await connector.get_categories()
            
            saved_count = 0
            for category in categories:
                category['loaded_at'] = datetime.utcnow()
                category['source'] = 'api'
                category['marketplace'] = 'ozon'
                
                # ИСПРАВЛЕНО: используем category_id + type_id как уникальный ключ
                unique_key = {
                    'marketplace': 'ozon',
                    'category_id': category['category_id'],
                    'type_id': category.get('type_id', 0)
                }
                
                await self.collection.replace_one(
                    unique_key,
                    category,
                    upsert=True
                )
                saved_count += 1
            
            logger.info(f"[OzonCategoryManager] Saved {saved_count} categories to DB")
            
            return {
                'success': True,
                'loaded': saved_count,
                'message': f'Загружено {saved_count} категорий Ozon'
            }
            
        except Exception as e:
            logger.error(f"[OzonCategoryManager] Preload failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_all_categories(self) -> List[Dict[str, Any]]:
        """Получить все категории из БД"""
        try:
            categories = await self.collection.find({'marketplace': 'ozon'}).to_list(length=20000)
            
            for cat in categories:
                if '_id' in cat:
                    cat.pop('_id')
            
            logger.info(f"[OzonCategoryManager] Retrieved {len(categories)} categories from DB")
            return categories
            
        except Exception as e:
            logger.error(f"[OzonCategoryManager] Failed to get categories: {e}")
            return []
    
    async def search_categories(self, query: str) -> List[Dict[str, Any]]:
        """Поиск категорий в БД"""
        try:
            categories = await self.collection.find({
                'marketplace': 'ozon',
                'name': {'$regex': query, '$options': 'i'}
            }).limit(100).to_list(100)
            
            for cat in categories:
                if '_id' in cat:
                    cat.pop('_id')
            
            logger.info(f"[OzonCategoryManager] Search '{query}': found {len(categories)} categories")
            return categories
            
        except Exception as e:
            logger.error(f"[OzonCategoryManager] Search failed: {e}")
            return []
    
    async def get_stats(self) -> Dict[str, Any]:
        """Статистика загруженных категорий"""
        try:
            total = await self.collection.count_documents({'marketplace': 'ozon'})
            
            last_updated = await self.collection.find_one(
                {'marketplace': 'ozon'},
                sort=[('loaded_at', -1)]
            )
            
            return {
                'total': total,
                'last_updated': last_updated.get('loaded_at') if last_updated else None
            }
            
        except Exception as e:
            logger.error(f"[OzonCategoryManager] Stats failed: {e}")
            return {
                'total': 0,
                'last_updated': None
            }
