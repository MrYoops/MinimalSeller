
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from core.database import get_database
from schemas.product import ProductCreate, ProductUpdate, ProductResponse, BulkImportRequest, ListingQualityScore
from utils import extract_investor_tag
import logging

logger = logging.getLogger(__name__)

class ProductService:
    @staticmethod
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

    @staticmethod
    async def get_all_tags() -> List[str]:
        db = await get_database()
        pipeline = [
            {"$unwind": "$tags"},
            {"$group": {"_id": "$tags"}},
            {"$sort": {"_id": 1}}
        ]
        result = await db.product_catalog.aggregate(pipeline).to_list(None)
        tags = [doc["_id"] for doc in result if doc["_id"]]
        return tags

    @staticmethod
    async def get_products(
        seller_id: str,
        category_id: Optional[str] = None,
        status: Optional[str] = None,
        investor_tag: Optional[str] = None,
        search: Optional[str] = None,
        min_quality: Optional[float] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[dict]:
        db = await get_database()
        
        # Convert seller_id to ObjectId for database query
        try:
            seller_object_id = ObjectId(seller_id)
        except:
            return []
            
        query = {"seller_id": seller_object_id}
        
        # Debug logging
        print(f"🔍 ProductService.get_products: seller_id={seller_id}, seller_object_id={seller_object_id}")
        print(f"🔍 Query: {query}")
        
        if category_id:
            query["category_id"] = category_id
        if status:
            query["status"] = status
        if investor_tag:
            query["investor_tag"] = investor_tag
        if search:
            query["$or"] = [
                {"sku": {"$regex": search, "$options": "i"}},
                {"article": {"$regex": search, "$options": "i"}},
                {"minimalmod.name": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}}
            ]
        if min_quality:
            query["listing_quality_score.total"] = {"$gte": min_quality}
            
        # Use products collection instead of product_catalog
        cursor = db.products.find(query).skip(skip).limit(limit)
        products = await cursor.to_list(length=limit)
        
        for product in products:
            product["id"] = str(product.pop("_id"))
            # Convert ObjectId seller_id to string for response
            if "seller_id" in product and hasattr(product["seller_id"], "__str__"):
                product["seller_id"] = str(product["seller_id"])
            
            # Add name field from minimalmod.name for frontend compatibility
            if not product.get("name") and product.get("minimalmod", {}).get("name"):
                product["name"] = product["minimalmod"]["name"]
            
            # Add article field if missing
            if not product.get("article") and product.get("sku"):
                product["article"] = product["sku"]
            
            # ИСПРАВЛЕНО: Извлечение бренда из разных источников
            if not product.get("brand"):
                # 1. Пробуем из marketplace_data
                marketplace_data = product.get("marketplace_data", {})
                for mp_name, mp_data in marketplace_data.items():
                    if isinstance(mp_data, dict) and mp_data.get("brand"):
                        product["brand"] = mp_data.get("brand")
                        break
                
                # 2. Пробуем из marketplaces.{marketplace}
                if not product.get("brand"):
                    marketplaces = product.get("marketplaces", {})
                    for mp_name, mp_data in marketplaces.items():
                        if isinstance(mp_data, dict) and mp_data.get("brand"):
                            product["brand"] = mp_data.get("brand")
                            break
                
                # 3. Пробуем из minimalmod.attributes
                if not product.get("brand"):
                    minimalmod = product.get("minimalmod", {})
                    attributes = minimalmod.get("attributes", {})
                    if isinstance(attributes, dict):
                        for attr_name, attr_value in attributes.items():
                            attr_name_lower = str(attr_name).lower()
                            if any(keyword in attr_name_lower for keyword in ['бренд', 'brand', 'производитель', 'manufacturer', 'vendor']):
                                if attr_value:
                                    product["brand"] = str(attr_value) if not isinstance(attr_value, dict) else str(attr_value.get('value', ''))
                                    break
            
            # Add category_name field (placeholder for now)
            if not product.get("category_name") and product.get("category_id"):
                product["category_name"] = f"Category {product['category_id']}"
            
            # ИСПРАВЛЕНО: Извлечение price_discounted из разных источников
            if product.get("price_discounted") is None:
                # 1. Пробуем из marketplaces.{marketplace}.discount_price (в рублях)
                marketplaces = product.get("marketplaces", {})
                for mp_name, mp_data in marketplaces.items():
                    if isinstance(mp_data, dict) and mp_data.get("discount_price"):
                        discount_price_rub = float(mp_data.get("discount_price", 0))
                        if discount_price_rub > 0:
                            product["price_discounted"] = discount_price_rub
                            break
                
                # 2. Пробуем из marketplace_data.{marketplace}.discount_price
                if product.get("price_discounted") is None:
                    marketplace_data = product.get("marketplace_data", {})
                    for mp_name, mp_data in marketplace_data.items():
                        if isinstance(mp_data, dict) and mp_data.get("discount_price"):
                            discount_price_rub = float(mp_data.get("discount_price", 0))
                            if discount_price_rub > 0:
                                product["price_discounted"] = discount_price_rub
                                break
                
                # 3. Если есть price и price_with_discount, используем price_with_discount
                if product.get("price_discounted") is None:
                    price_with_discount = product.get("price_with_discount", 0)
                    price_without_discount = product.get("price_without_discount", 0) or product.get("price", 0)
                    if price_with_discount > 0 and price_with_discount < price_without_discount:
                        product["price_discounted"] = price_with_discount
            
            # ИСПРАВЛЕНО: Извлечение price_discounted из разных источников
            price_discounted = product.get("price_discounted")
            if price_discounted is None:
                # 1. Пробуем из marketplaces.{marketplace}.discount_price (в рублях, конвертируем в копейки для совместимости)
                marketplaces = product.get("marketplaces", {})
                for mp_name, mp_data in marketplaces.items():
                    if isinstance(mp_data, dict) and mp_data.get("discount_price"):
                        discount_price_rub = float(mp_data.get("discount_price", 0))
                        if discount_price_rub > 0:
                            # Конвертируем в копейки для совместимости со схемой (но фронтенд ожидает float в рублях)
                            product["price_discounted"] = discount_price_rub  # Оставляем в рублях, т.к. фронтенд ожидает float
                            break
                
                # 2. Пробуем из marketplace_data.{marketplace}.discount_price
                if product.get("price_discounted") is None:
                    marketplace_data = product.get("marketplace_data", {})
                    for mp_name, mp_data in marketplace_data.items():
                        if isinstance(mp_data, dict) and mp_data.get("discount_price"):
                            discount_price_rub = float(mp_data.get("discount_price", 0))
                            if discount_price_rub > 0:
                                product["price_discounted"] = discount_price_rub
                                break
                
                # 3. Если есть price и price_with_discount, используем price_with_discount
                if product.get("price_discounted") is None:
                    price_with_discount = product.get("price_with_discount", 0)
                    price_without_discount = product.get("price_without_discount", 0) or product.get("price", 0)
                    if price_with_discount > 0 and price_with_discount < price_without_discount:
                        product["price_discounted"] = price_with_discount
            
            # Add variants_count field (placeholder for now)
            if not product.get("variants_count"):
                product["variants_count"] = 1
                
            # Add status field if missing
            if not product.get("status"):
                product["status"] = "active"
            
            # Fix minimalmod.attributes validation error - convert array to dict
            if "minimalmod" in product and isinstance(product["minimalmod"], dict):
                if "attributes" in product["minimalmod"] and isinstance(product["minimalmod"]["attributes"], list):
                    # Convert array to dict for validation compatibility
                    attributes_dict = {}
                    for i, attr in enumerate(product["minimalmod"]["attributes"]):
                        if isinstance(attr, dict):
                            attributes_dict[f"attr_{i}"] = attr
                        else:
                            attributes_dict[f"attr_{i}"] = {"value": attr}
                    product["minimalmod"]["attributes"] = attributes_dict
            
        return products

    @staticmethod
    async def get_product(product_id: str, seller_id: str) -> Optional[dict]:
        db = await get_database()
        
        # Convert seller_id to ObjectId for database query
        try:
            seller_object_id = ObjectId(seller_id)
        except:
            return None
            
        # Use products collection
        product = await db.products.find_one({
            "_id": ObjectId(product_id),
            "seller_id": seller_object_id
        })
        if product:
            product["id"] = str(product.pop("_id"))
            # Convert ObjectId seller_id to string for response
            if "seller_id" in product and hasattr(product["seller_id"], "__str__"):
                product["seller_id"] = str(product["seller_id"])
            
            # Add name field from minimalmod.name for frontend compatibility
            if not product.get("name") and product.get("minimalmod", {}).get("name"):
                product["name"] = product["minimalmod"]["name"]
            
            # Add article field if missing
            if not product.get("article") and product.get("sku"):
                product["article"] = product["sku"]
            
            # ИСПРАВЛЕНО: Извлечение бренда из разных источников
            if not product.get("brand"):
                # 1. Пробуем из marketplace_data
                marketplace_data = product.get("marketplace_data", {})
                for mp_name, mp_data in marketplace_data.items():
                    if isinstance(mp_data, dict) and mp_data.get("brand"):
                        product["brand"] = mp_data.get("brand")
                        break
                
                # 2. Пробуем из marketplaces.{marketplace}
                if not product.get("brand"):
                    marketplaces = product.get("marketplaces", {})
                    for mp_name, mp_data in marketplaces.items():
                        if isinstance(mp_data, dict) and mp_data.get("brand"):
                            product["brand"] = mp_data.get("brand")
                            break
                
                # 3. Пробуем из minimalmod.attributes
                if not product.get("brand"):
                    minimalmod = product.get("minimalmod", {})
                    attributes = minimalmod.get("attributes", {})
                    if isinstance(attributes, dict):
                        for attr_name, attr_value in attributes.items():
                            attr_name_lower = str(attr_name).lower()
                            if any(keyword in attr_name_lower for keyword in ['бренд', 'brand', 'производитель', 'manufacturer', 'vendor']):
                                if attr_value:
                                    product["brand"] = str(attr_value) if not isinstance(attr_value, dict) else str(attr_value.get('value', ''))
                                    break
            
            # ИСПРАВЛЕНО: Извлечение price_discounted из разных источников
            if product.get("price_discounted") is None:
                # 1. Пробуем из marketplaces.{marketplace}.discount_price (в рублях)
                marketplaces = product.get("marketplaces", {})
                for mp_name, mp_data in marketplaces.items():
                    if isinstance(mp_data, dict) and mp_data.get("discount_price"):
                        discount_price_rub = float(mp_data.get("discount_price", 0))
                        if discount_price_rub > 0:
                            product["price_discounted"] = discount_price_rub
                            break
                
                # 2. Пробуем из marketplace_data.{marketplace}.discount_price
                if product.get("price_discounted") is None:
                    marketplace_data = product.get("marketplace_data", {})
                    for mp_name, mp_data in marketplace_data.items():
                        if isinstance(mp_data, dict) and mp_data.get("discount_price"):
                            discount_price_rub = float(mp_data.get("discount_price", 0))
                            if discount_price_rub > 0:
                                product["price_discounted"] = discount_price_rub
                                break
                
                # 3. Если есть price и price_with_discount, используем price_with_discount
                if product.get("price_discounted") is None:
                    price_with_discount = product.get("price_with_discount", 0)
                    price_without_discount = product.get("price_without_discount", 0) or product.get("price", 0)
                    if price_with_discount > 0 and price_with_discount < price_without_discount:
                        product["price_discounted"] = price_with_discount
            
            # Fix minimalmod.attributes validation error - convert array to dict
            if "minimalmod" in product and isinstance(product["minimalmod"], dict):
                if "attributes" in product["minimalmod"] and isinstance(product["minimalmod"]["attributes"], list):
                    # Convert array to dict for validation compatibility
                    attributes_dict = {}
                    for i, attr in enumerate(product["minimalmod"]["attributes"]):
                        if isinstance(attr, dict):
                            attributes_dict[f"attr_{i}"] = attr
                        else:
                            attributes_dict[f"attr_{i}"] = {"value": attr}
                    product["minimalmod"]["attributes"] = attributes_dict
                
        return product

    @classmethod
    async def create_product(cls, product: ProductCreate, seller_id: str) -> dict:
        db = await get_database()
        
        # Convert seller_id to ObjectId for database query
        try:
            seller_object_id = ObjectId(seller_id)
        except:
            raise ValueError("Invalid seller_id")
        
        # Debug logging
        print(f"🔍 ProductService.create_product: seller_id={seller_id}, seller_object_id={seller_object_id}")
        
        # Check SKU/Article in product_catalog
        existing = await db.products.find_one({
            "seller_id": seller_object_id,
            "$or": [
                {"sku": product.sku},
                {"article": product.sku}
            ]
        })
        if existing:
            raise ValueError(f"SKU/Article {product.sku} already exists")
            
        if not product.investor_tag:
            product.investor_tag = extract_investor_tag(product.sku)
            
        product_data = product.dict()
        product_data["seller_id"] = seller_object_id  # Use ObjectId, not string!
        # Ensure 'article' exists for compatibility with other modules
        product_data["article"] = product.sku
        product_data["dates"] = {
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "published_at": None
        }
        
        product_data["listing_quality_score"] = cls.calculate_listing_quality_score(product_data).dict()
        
        # Insert into product_catalog
        result = await db.products.insert_one(product_data)
        product_data["_id"] = result.inserted_id
        product_data["id"] = str(result.inserted_id)
        # Convert ObjectId seller_id to string for response
        if "seller_id" in product_data and hasattr(product_data["seller_id"], "__str__"):
            product_data["seller_id"] = str(product_data["seller_id"])
        # Init inventory
        await db.inventory.insert_one({
            "product_id": str(result.inserted_id), # Can be string or ObjectId, kept as string for consistency with some modules
            "product_id_oid": result.inserted_id, # Also save ObjectId
            "seller_id": seller_id,
            "sku": product.sku,
            "article": product.sku, # Add article here too
            "quantity": 0,
            "reserved": 0,
            "available": 0,
            "alert_threshold": 10
        })
        
        created_product = await db.products.find_one({"_id": result.inserted_id})
        if created_product:
            created_product["id"] = str(created_product.pop("_id"))
            # Convert ObjectId seller_id to string for response
            if "seller_id" in created_product and hasattr(created_product["seller_id"], "__str__"):
                created_product["seller_id"] = str(created_product["seller_id"])
        return created_product

    @classmethod
    async def update_product(cls, product_id: str, product: ProductUpdate, seller_id: str) -> Optional[dict]:
        db = await get_database()
        
        # Use product_catalog
        existing = await db.product_catalog.find_one({"_id": ObjectId(product_id), "seller_id": seller_id})
        if not existing:
            return None
            
        update_data = {k: v for k, v in product.dict(exclude_unset=True).items() if v is not None}
        if not update_data:
            return existing
            
        update_data["dates.updated_at"] = datetime.utcnow()
        
        if "sku" in update_data:
             update_data["article"] = update_data["sku"]
             if not update_data.get("investor_tag"):
                update_data["investor_tag"] = extract_investor_tag(update_data["sku"])
            
        merged_data = {**existing, **update_data}
        update_data["listing_quality_score"] = cls.calculate_listing_quality_score(merged_data).dict()
        
        await db.product_catalog.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": update_data}
        )
        
        updated = await db.product_catalog.find_one({"_id": ObjectId(product_id)})
        updated["id"] = str(updated.pop("_id"))
        return updated
    
    @staticmethod
    async def delete_product(product_id: str, seller_id: str) -> bool:
        db = await get_database()
        
        # Convert seller_id to ObjectId for database query
        try:
            seller_object_id = ObjectId(seller_id)
        except:
            return False
        
        # Use products collection
        result = await db.products.delete_one({"_id": ObjectId(product_id), "seller_id": seller_object_id})
        if result.deleted_count > 0:
            # Delete inventory
            await db.inventory.delete_one({"product_id": product_id})
            await db.inventory.delete_one({"product_id": ObjectId(product_id)}) # Try both
            return True
        return False
        
    @classmethod
    async def bulk_import(cls, request: BulkImportRequest, seller_id: str) -> dict:
        db = await get_database()
        created_count = 0
        updated_count = 0
        errors = []
        
        for row_idx, row_data in enumerate(request.data):
            try:
                product_data = {}
                for field, column in request.column_mapping.items():
                    if column in row_data:
                        product_data[field] = row_data[column]
                
                sku = product_data.get("sku") or product_data.get("article")
                if not sku:
                    errors.append(f"Row {row_idx + 1}: Missing SKU/Article")
                    continue
                
                # Ensure sku/article sync
                product_data["sku"] = sku
                product_data["article"] = sku
                
                existing = await db.product_catalog.find_one({
                    "$or": [{"sku": sku}, {"article": sku}],
                    "seller_id": seller_id
                })
                
                if existing:
                    if request.update_existing:
                        await db.product_catalog.update_one(
                            {"_id": existing["_id"]},
                            {"$set": {**product_data, "dates.updated_at": datetime.utcnow()}}
                        )
                        updated_count += 1
                else:
                    if request.create_new:
                        product_data["seller_id"] = seller_id
                        product_data["dates"] = {
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow(),
                            "published_at": None
                        }
                        product_data["investor_tag"] = extract_investor_tag(sku)
                        product_data["listing_quality_score"] = cls.calculate_listing_quality_score(product_data).dict()
                        
                        result = await db.product_catalog.insert_one(product_data)
                        
                        await db.inventory.insert_one({
                            "product_id": str(result.inserted_id),
                            "product_id_oid": result.inserted_id,
                            "seller_id": seller_id,
                            "sku": sku,
                            "article": sku,
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

    @staticmethod
    async def get_marketplace_products(marketplace: str, seller_id: str, api_key_id: Optional[str] = None) -> List[dict]:
        from connectors import get_connector
        from core.security import decrypt_api_key
        db = await get_database()
        
        db = await get_database()
        
        # Get API keys
        # Try finding profile by string or ObjectId user_id to be robust
        profile = await db.seller_profiles.find_one({
            "$or": [
                {"user_id": seller_id},
                {"user_id": ObjectId(seller_id) if ObjectId.is_valid(seller_id) else seller_id}
            ]
        })
        
        if not profile:
            raise ValueError("Seller profile not found. Please configure API keys.")
            
        api_keys = profile.get("api_keys", [])
        
        api_key_data = None
        if api_key_id:
            # Find specific key
            api_key_data = next((k for k in api_keys if k.get("id") == api_key_id), None)
            if not api_key_data:
                 raise ValueError(f"API key with ID {api_key_id} not found.")
            # Ensure marketplace matches
            if api_key_data.get("marketplace") != marketplace:
                 raise ValueError(f"API key {api_key_id} is for {api_key_data.get('marketplace')}, not {marketplace}")
        else:
            # Fallback: Find first key for marketplace
            api_key_data = next((k for k in api_keys if k.get("marketplace") == marketplace), None)
        
        if not api_key_data:
            raise ValueError(f"API key for {marketplace} not found.")
        
        # Decrypt the API key
        encrypted_key = api_key_data.get("api_key", "")
        try:
            api_key = decrypt_api_key(encrypted_key)
        except Exception as e:
            # TEMPORARY: Use key directly if decryption fails
            print(f"⚠️ Decryption failed, using key directly: {e}")
            api_key = encrypted_key
            
        connector = get_connector(
            marketplace,
            api_key_data.get("client_id", ""),
            api_key  # Use decrypted key
        )
        
        try:
            # Use the connector to fetch products
            # Note: For Ozon we implemented get_products in OzonConnector
            # For others we might need to implement it or it might be missing
            if hasattr(connector, 'get_products'):
                return await connector.get_products()
            else:
                 # Fallback or error if not implemented
                 # WB/Yandex might need generic implementation or specific one
                 raise ValueError(f"Fetching products from {marketplace} is not supported yet.")
        except Exception as e:
             raise ValueError(f"Failed to fetch products from {marketplace}: {str(e)}")

    @classmethod
    async def import_from_marketplace(cls, marketplace: str, products: List[dict], seller_id: str) -> dict:
        """
        Import selected products from marketplace to local catalog
        """
        db = await get_database()
        created_count = 0
        updated_count = 0
        errors = []
        
        # Convert seller_id to ObjectId for database query
        try:
            seller_object_id = ObjectId(seller_id)
        except:
            return {"created": 0, "updated": 0, "errors": ["Invalid seller_id"]}
        
        for p in products:
            try:
                sku = p.get('sku') or p.get('offer_id') or p.get('article')
                if not sku:
                    errors.append(f"Product {p.get('name')} missing SKU")
                    continue

                # Check existence in products collection
                existing = await db.products.find_one({
                    "$or": [{"sku": sku}, {"article": sku}],
                    "seller_id": seller_object_id
                })
                
                # Prepare data with proper structure
                # Преобразуем characteristics из массива в словарь если нужно
                attributes = p.get('attributes', {})
                if isinstance(attributes, list):
                    # Если это массив характеристик [{name: '', value: ''}], преобразуем в словарь
                    attributes = {char.get('name', ''): char.get('value', '') for char in attributes if char.get('name')}
                elif not isinstance(attributes, dict):
                    attributes = {}
                
                # Также проверяем поле characteristics
                if not attributes and p.get('characteristics'):
                    chars = p.get('characteristics', [])
                    if isinstance(chars, list):
                        attributes = {char.get('name', ''): char.get('value', '') for char in chars if char.get('name')}
                    elif isinstance(chars, dict):
                        attributes = chars
                
                # ИСПРАВЛЕНО: Автоматическое сопоставление категории через CategorySystem
                category_mapping_id = None
                mp_category_id = p.get('category_id', '')
                mp_category_name = p.get('category', '')
                
                if mp_category_id and mp_category_name:
                    try:
                        from category_system import CategorySystem
                        category_system = CategorySystem(db)
                        
                        # Создаем или находим сопоставление категории
                        if marketplace == 'ozon':
                            mapping_id = await category_system.create_or_update_mapping(
                                internal_name=mp_category_name,
                                ozon_category_id=str(mp_category_id)
                            )
                        elif marketplace in ['wb', 'wildberries']:
                            mapping_id = await category_system.create_or_update_mapping(
                                internal_name=mp_category_name,
                                wb_category_id=str(mp_category_id)
                            )
                        elif marketplace == 'yandex':
                            mapping_id = await category_system.create_or_update_mapping(
                                internal_name=mp_category_name,
                                yandex_category_id=str(mp_category_id)
                            )
                        else:
                            mapping_id = None
                        
                        category_mapping_id = mapping_id
                        logger.info(f"[ProductService] Category mapping created/found: {mapping_id} for {mp_category_name}")
                    except Exception as e:
                        logger.warning(f"[ProductService] Failed to create category mapping: {e}")
                
                # ИСПРАВЛЕНО: Извлечение цен с правильной логикой
                # Для WB: price - обычная цена, discount_price - цена со скидкой (реальная цена продажи)
                # Для Ozon: price - основная цена
                regular_price = float(p.get('price', 0) or 0)
                discount_price = float(p.get('discount_price', 0) or 0)
                
                # Используем discount_price как основную цену если она есть (это реальная цена продажи)
                # Иначе используем regular_price
                price = discount_price if discount_price > 0 else regular_price
                
                # Если цена все еще 0, пробуем другие поля
                if price == 0:
                    price = float(p.get('salePrice', 0) or p.get('sale_price', 0) or 0)
                
                # ИСПРАВЛЕНО: Логирование для отладки
                logger.info(f"[ProductService] Product {sku}: regular_price={regular_price}, discount_price={discount_price}, final_price={price}, brand={p.get('brand', '')}, category={mp_category_name}")
                
                product_data = {
                    "sku": sku,
                    "price": regular_price if regular_price > 0 else price,  # Обычная цена
                    "price_discounted": discount_price if discount_price > 0 and discount_price < (regular_price if regular_price > 0 else price) else None,  # ИСПРАВЛЕНО: Сохраняем только если реально меньше обычной цены
                    "purchase_price": 0.0,
                    "seller_id": seller_object_id,
                    "article": sku,
                    "brand": p.get('brand', ''),  # ИСПРАВЛЕНО: Добавляем бренд
                    "category_mapping_id": category_mapping_id,  # ИСПРАВЛЕНО: Добавляем сопоставление категории
                    "minimalmod": {
                        "name": p.get('name', 'Unknown'),
                        "description": p.get('description', '') or '',  # ИСПРАВЛЕНО: Гарантируем строку
                        "images": p.get('images', []) or p.get('photos', []),  # ИСПРАВЛЕНО: Поддержка обоих полей
                        "attributes": attributes,  # ИСПРАВЛЕНО: Используем преобразованные attributes
                        "tags": [marketplace, "imported"]
                    },
                    "marketplaces": {
                        marketplace: {
                            "enabled": True,
                            "product_id": p.get('id', ''),
                            "sku": sku,
                            "price": regular_price if regular_price > 0 else price,  # Обычная цена
                            "discount_price": discount_price if discount_price > 0 else price,  # Цена со скидкой
                            "stock": p.get('stock', 0),
                            "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                        }
                    },
                    "marketplace_data": {
                        marketplace: {
                            **p,  # Сохраняем все данные с маркетплейса
                            "category": mp_category_name,
                            "category_id": mp_category_id,
                            "brand": p.get('brand', ''),
                            "characteristics": p.get('characteristics', []),
                            "attributes": attributes,
                            "imported_at": datetime.utcnow().isoformat()
                        }
                    },
                    "dates": {
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "published_at": None
                    },
                    "listing_quality_score": cls.calculate_listing_quality_score(p).dict(),
                    "tags": [marketplace, "imported"]
                }
                
                if existing:
                    # ИСПРАВЛЕНО: Извлечение цен и бренда перед обновлением
                    regular_price_update = float(p.get('price', 0) or 0)
                    discount_price_update = float(p.get('discount_price', 0) or 0)
                    
                    # Используем discount_price как основную цену если она есть
                    price_update = discount_price_update if discount_price_update > 0 else regular_price_update
                    if price_update == 0:
                        price_update = existing.get('price', 0)
                    
                    brand = p.get('brand', '') or existing.get('brand', '')
                    
                    # Update existing product with main fields
                    update_fields = {
                        # ИСПРАВЛЕНО: Обновляем основные поля товара
                        "price": regular_price_update if regular_price_update > 0 else (price_update if price_update > 0 else existing.get('price', 0)),
                        "price_discounted": discount_price_update if discount_price_update > 0 else existing.get('price_discounted'),  # ИСПРАВЛЕНО: Обновляем цену со скидкой
                        "brand": brand if brand else existing.get('brand', ''),
                        # Обновляем marketplace данные
                        f"marketplace_data.{marketplace}": p,
                        f"marketplaces.{marketplace}.enabled": True,
                        f"marketplaces.{marketplace}.product_id": p.get('id', ''),
                        f"marketplaces.{marketplace}.sku": sku,
                        f"marketplaces.{marketplace}.price": regular_price_update if regular_price_update > 0 else price_update,  # Обычная цена
                        f"marketplaces.{marketplace}.discount_price": discount_price_update if discount_price_update > 0 else price_update,  # Цена со скидкой
                        f"marketplaces.{marketplace}.stock": p.get('stock', 0),
                        "dates.updated_at": datetime.utcnow()
                    }
                    await db.products.update_one(
                        {"_id": existing["_id"]},
                        {"$set": update_fields}
                    )
                    updated_count += 1
                else:
                    # Create new product
                    result = await db.products.insert_one(product_data)
                    created_count += 1
                    
                    # Init inventory
                    await db.inventory.insert_one({
                        "product_id": str(result.inserted_id),
                        "product_id_oid": result.inserted_id,
                        "seller_id": seller_id,
                        "sku": sku,
                        "article": sku,
                        "quantity": 0,
                        "reserved": 0,
                        "available": 0,
                        "alert_threshold": 10
                    })
                    
            except Exception as e:
                errors.append(f"Error importing {p.get('sku')}: {str(e)}")
                
        return {
            "success": True,
            "created": created_count,
            "updated": updated_count,
            "errors": errors
        }
