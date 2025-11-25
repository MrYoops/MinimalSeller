"""
Система предзагрузки и кэширования категорий WB
Загружает категории один раз и сохраняет в MongoDB
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class WBCategoryManager:
    """Менеджер категорий WB с кэшированием в БД"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.wb_categories_cache
    
    async def preload_from_api(self, connector) -> Dict[str, Any]:
        """
        Предзагрузка категорий с API WB
        Загружает parent categories (80 шт)
        """
        logger.info("[WBCategoryManager] Preloading categories from API")
        
        try:
            # Получить parent categories
            categories = await connector.get_categories()
            
            # Сохранить в БД
            saved_count = 0
            for category in categories:
                category['loaded_at'] = datetime.utcnow()
                category['source'] = 'api_parent'
                
                # Upsert
                await self.collection.replace_one(
                    {
                        'marketplace': 'wb',
                        'category_id': category['category_id']
                    },
                    category,
                    upsert=True
                )
                saved_count += 1
            
            logger.info(f"[WBCategoryManager] Saved {saved_count} parent categories to DB")
            
            return {
                'success': True,
                'loaded': saved_count,
                'message': f'Загружено {saved_count} родительских категорий WB'
            }
            
        except Exception as e:
            logger.error(f"[WBCategoryManager] Preload failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def add_subject_from_product(self, subject_id: int, subject_name: str, parent_id: int = None):
        """
        Добавить subject (подкатегорию) из товара
        Вызывается автоматически при импорте
        """
        logger.info(f"[WBCategoryManager] Adding subject {subject_id}: {subject_name}")
        
        try:
            category = {
                'marketplace': 'wb',
                'category_id': str(subject_id),
                'id': str(subject_id),
                'name': subject_name,
                'category_name': subject_name,
                'is_parent': False,
                'parent_id': str(parent_id) if parent_id else None,
                'parent_name': None,
                'is_visible': True,
                'source': 'product_import',
                'loaded_at': datetime.utcnow()
            }
            
            # Upsert
            await self.collection.replace_one(
                {
                    'marketplace': 'wb',
                    'category_id': str(subject_id)
                },
                category,
                upsert=True
            )
            
            logger.info(f"[WBCategoryManager] Subject {subject_id} saved")
            return True
            
        except Exception as e:
            logger.error(f"[WBCategoryManager] Failed to add subject: {e}")
            return False
    
    async def get_all_categories(self) -> List[Dict[str, Any]]:
        """
        Получить все категории из БД
        Быстро, без запросов к API
        """
        try:
            categories = await self.collection.find({'marketplace': 'wb'}).to_list(length=10000)
            
            # Убрать _id
            for cat in categories:
                if '_id' in cat:
                    cat.pop('_id')
            
            logger.info(f"[WBCategoryManager] Retrieved {len(categories)} categories from DB")
            return categories
            
        except Exception as e:
            logger.error(f"[WBCategoryManager] Failed to get categories: {e}")
            return []
    
    async def search_categories(self, query: str) -> List[Dict[str, Any]]:
        """
        Поиск категорий в БД
        Быстро, без запросов к API
        """
        try:
            categories = await self.collection.find({
                'marketplace': 'wb',
                'name': {'$regex': query, '$options': 'i'}
            }).limit(100).to_list(100)
            
            # Убрать _id
            for cat in categories:
                if '_id' in cat:
                    cat.pop('_id')
            
            logger.info(f"[WBCategoryManager] Search '{query}': found {len(categories)} categories")
            return categories
            
        except Exception as e:
            logger.error(f"[WBCategoryManager] Search failed: {e}")
            return []
    
    async def get_category_by_id(self, category_id: str) -> Dict[str, Any]:
        """
        Получить категорию по ID из БД
        """
        try:
            category = await self.collection.find_one({
                'marketplace': 'wb',
                'category_id': str(category_id)
            })
            
            if category and '_id' in category:
                category.pop('_id')
            
            return category
            
        except Exception as e:
            logger.error(f"[WBCategoryManager] Get by ID failed: {e}")
            return None
    
    async def get_stats(self) -> Dict[str, Any]:
        """
        Статистика загруженных категорий
        """
        try:
            total = await self.collection.count_documents({'marketplace': 'wb'})
            parents = await self.collection.count_documents({'marketplace': 'wb', 'is_parent': True})
            subjects = await self.collection.count_documents({'marketplace': 'wb', 'is_parent': False})
            
            # Последнее обновление
            last_updated = await self.collection.find_one(
                {'marketplace': 'wb'},
                sort=[('loaded_at', -1)]
            )
            
            return {
                'total': total,
                'parents': parents,
                'subjects': subjects,
                'last_updated': last_updated.get('loaded_at') if last_updated else None
            }
            
        except Exception as e:
            logger.error(f"[WBCategoryManager] Stats failed: {e}")
            return {
                'total': 0,
                'parents': 0,
                'subjects': 0,
                'last_updated': None
            }
