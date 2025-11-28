"""
Система категорий с предзагрузкой и сопоставлением
Реализует логику как в SelSup
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from connectors import get_connector, MarketplaceError

logger = logging.getLogger(__name__)


class CategorySystem:
    """
    Система управления категориями с предзагрузкой и кэшированием
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def preload_all_categories(self, client_id: str, api_key: str, marketplace: str) -> Dict[str, Any]:
        """
        Предзагрузить ВСЕ категории с маркетплейса
        Сохраняет в БД для всех пользователей
        """
        logger.info(f"[CategorySystem] Preloading categories for {marketplace}")
        
        try:
            connector = get_connector(marketplace, client_id, api_key)
            all_categories = await connector.get_categories()
            
            logger.info(f"[CategorySystem] Loaded {len(all_categories)} categories from {marketplace}")
            
            # Сохранить в БД
            inserted_count = 0
            updated_count = 0
            
            for category in all_categories:
                cat_id = category.get('id')
                
                # Уникальный ключ: marketplace + category_id
                existing = await self.db.marketplace_categories.find_one({
                    "marketplace": marketplace,
                    "category_id": cat_id
                })
                
                category_doc = {
                    "marketplace": marketplace,
                    "category_id": cat_id,
                    "category_name": category.get('name', ''),
                    "type_id": category.get('type_id'),
                    "type_name": category.get('type_name'),
                    "disabled": category.get('disabled', False),
                    "is_visible": category.get('is_visible', True),
                    "parent_id": category.get('parent_id'),
                    "raw_data": category,
                    "updated_at": datetime.utcnow()
                }
                
                if existing:
                    await self.db.marketplace_categories.update_one(
                        {"_id": existing["_id"]},
                        {"$set": category_doc}
                    )
                    updated_count += 1
                else:
                    category_doc["created_at"] = datetime.utcnow()
                    await self.db.marketplace_categories.insert_one(category_doc)
                    inserted_count += 1
            
            logger.info(f"[CategorySystem] Inserted: {inserted_count}, Updated: {updated_count}")
            
            return {
                "success": True,
                "marketplace": marketplace,
                "total_categories": len(all_categories),
                "inserted": inserted_count,
                "updated": updated_count
            }
            
        except MarketplaceError as e:
            logger.error(f"[CategorySystem] Failed to load categories: {e.message}")
            raise
        except Exception as e:
            logger.error(f"[CategorySystem] Unexpected error: {str(e)}")
            raise
    
    async def search_categories(self, marketplace: str, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Поиск категорий по названию в предзагруженных данных
        """
        logger.info(f"[CategorySystem] Searching {marketplace} categories: '{query}'")
        
        # Поиск по названию (case-insensitive)
        categories = await self.db.marketplace_categories.find(
            {
                "marketplace": marketplace,
                "category_name": {"$regex": query, "$options": "i"},
                "disabled": False
            },
            {"_id": 0}
        ).limit(limit).to_list(length=limit)
        
        logger.info(f"[CategorySystem] Found {len(categories)} matching categories")
        
        return categories
    
    async def get_category_by_id(self, marketplace: str, category_id: str) -> Optional[Dict[str, Any]]:
        """
        Получить категорию по ID
        """
        category = await self.db.marketplace_categories.find_one(
            {
                "marketplace": marketplace,
                "category_id": category_id
            },
            {"_id": 0}
        )
        
        return category
    
    async def create_or_update_mapping(
        self,
        internal_name: str,
        ozon_category_id: Optional[str] = None,
        wb_category_id: Optional[str] = None,
        yandex_category_id: Optional[str] = None
    ) -> str:
        """
        Создать или обновить сопоставление категорий между маркетплейсами
        УМНАЯ ЛОГИКА: Сначала ищет существующий маппинг по category_id МП, 
        если не найден - ищет по internal_name, если все равно нет - создает новый
        Возвращает ID сопоставления
        """
        logger.info(f"[CategorySystem] Creating/updating mapping for '{internal_name}'")
        logger.info(f"  Ozon: {ozon_category_id}, WB: {wb_category_id}, Yandex: {yandex_category_id}")
        
        existing = None
        
        # 1. Поиск по category_id маркетплейса (приоритет!)
        search_conditions = []
        if ozon_category_id:
            search_conditions.append({"marketplace_categories.ozon": ozon_category_id})
        if wb_category_id:
            search_conditions.append({"marketplace_categories.wildberries": wb_category_id})
        if yandex_category_id:
            search_conditions.append({"marketplace_categories.yandex": yandex_category_id})
        
        if search_conditions:
            existing = await self.db.category_mappings.find_one({
                "$or": search_conditions
            })
            if existing:
                logger.info(f"✅ Found existing mapping by marketplace category_id: {existing['_id']}")
        
        # 2. Если не найден по category_id, ищем по internal_name
        if not existing:
            existing = await self.db.category_mappings.find_one({
                "internal_name": internal_name
            })
            if existing:
                logger.info(f"✅ Found existing mapping by internal_name: {existing['_id']}")
        
        mapping_doc = {
            "internal_name": internal_name,
            "marketplace_categories": {
                "ozon": ozon_category_id or existing.get("marketplace_categories", {}).get("ozon") if existing else None,
                "wildberries": wb_category_id or existing.get("marketplace_categories", {}).get("wildberries") if existing else None,
                "yandex": yandex_category_id or existing.get("marketplace_categories", {}).get("yandex") if existing else None
            },
            "updated_at": datetime.utcnow()
        }
        
        if existing:
            # Обновляем существующий маппинг (сливаем данные)
            await self.db.category_mappings.update_one(
                {"_id": existing["_id"]},
                {"$set": mapping_doc}
            )
            mapping_id = str(existing["_id"])
            logger.info(f"✅ Updated existing mapping: {mapping_id}")
        else:
            # Создаем новый маппинг
            mapping_doc["created_at"] = datetime.utcnow()
            result = await self.db.category_mappings.insert_one(mapping_doc)
            mapping_id = str(result.inserted_id)
            logger.info(f"✅ Created new mapping: {mapping_id}")
        
        return mapping_id
    
    async def get_mapping_by_id(self, mapping_id: str) -> Optional[Dict[str, Any]]:
        """
        Получить сопоставление по ID
        """
        from bson import ObjectId
        
        mapping = await self.db.category_mappings.find_one(
            {"_id": ObjectId(mapping_id)},
            {"_id": 0}
        )
        
        return mapping
    
    async def search_mappings(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Поиск сопоставлений по внутреннему названию
        """
        mappings = await self.db.category_mappings.find(
            {
                "internal_name": {"$regex": query, "$options": "i"}
            },
            {"_id": 1, "internal_name": 1, "marketplace_categories": 1, "marketplace_type_ids": 1}
        ).limit(limit).to_list(length=limit)
        
        # Преобразовать _id в строку
        for mapping in mappings:
            mapping["id"] = str(mapping.pop("_id"))
        
        return mappings
    
    async def cache_category_attributes(
        self,
        marketplace: str,
        category_id: str,
        type_id: Optional[int],
        attributes: List[Dict[str, Any]]
    ):
        """
        Кэшировать атрибуты категории
        """
        cache_key = f"{marketplace}_{category_id}"
        if type_id:
            cache_key += f"_{type_id}"
        
        cache_doc = {
            "cache_key": cache_key,
            "marketplace": marketplace,
            "category_id": category_id,
            "type_id": type_id,
            "attributes": attributes,
            "cached_at": datetime.utcnow()
        }
        
        await self.db.category_attributes_cache.replace_one(
            {"cache_key": cache_key},
            cache_doc,
            upsert=True
        )
    
    async def get_cached_attributes(
        self,
        marketplace: str,
        category_id: str,
        type_id: Optional[int] = None,
        max_age_days: int = 7
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Получить кэшированные атрибуты
        Возвращает None если кэш устарел или не найден
        """
        cache_key = f"{marketplace}_{category_id}"
        if type_id:
            cache_key += f"_{type_id}"
        
        cached = await self.db.category_attributes_cache.find_one({"cache_key": cache_key})
        
        if not cached:
            return None
        
        # Проверить возраст кэша
        cache_age = datetime.utcnow() - cached.get('cached_at', datetime.utcnow())
        if cache_age.days >= max_age_days:
            return None
        
        return cached.get('attributes', [])
