
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from backend.core.database import get_database
from backend.schemas.product import ProductCreate, ProductUpdate, ProductResponse, BulkImportRequest, ListingQualityScore
from backend.utils import extract_investor_tag

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
                {"article": {"$regex": search, "$options": "i"}},
                {"minimalmod.name": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}}
            ]
        if min_quality:
            query["listing_quality_score.total"] = {"$gte": min_quality}
            
        # Use product_catalog instead of products
        cursor = db.product_catalog.find(query).skip(skip).limit(limit)
        products = await cursor.to_list(length=limit)
        
        for product in products:
            product["id"] = str(product.pop("_id"))
            
        return products

    @staticmethod
    async def get_product(product_id: str, seller_id: str) -> Optional[dict]:
        db = await get_database()
        # Use product_catalog
        product = await db.product_catalog.find_one({
            "_id": ObjectId(product_id),
            "seller_id": seller_id
        })
        if product:
            product["id"] = str(product.pop("_id"))
        return product

    @classmethod
    async def create_product(cls, product: ProductCreate, seller_id: str) -> dict:
        db = await get_database()
        
        # Check SKU/Article in product_catalog
        existing = await db.product_catalog.find_one({
            "$or": [{"sku": product.sku}, {"article": product.sku}], 
            "seller_id": seller_id
        })
        if existing:
            raise ValueError(f"SKU/Article {product.sku} already exists")
            
        if not product.investor_tag:
            product.investor_tag = extract_investor_tag(product.sku)
            
        product_data = product.dict()
        product_data["seller_id"] = seller_id
        # Ensure 'article' exists for compatibility with other modules
        product_data["article"] = product.sku
        product_data["dates"] = {
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "published_at": None
        }
        
        product_data["listing_quality_score"] = cls.calculate_listing_quality_score(product_data).dict()
        
        # Insert into product_catalog
        result = await db.product_catalog.insert_one(product_data)
        
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
        
        created_product = await db.product_catalog.find_one({"_id": result.inserted_id})
        created_product["id"] = str(created_product.pop("_id"))
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
        # Use product_catalog
        result = await db.product_catalog.delete_one({"_id": ObjectId(product_id), "seller_id": seller_id})
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
        from backend.connectors import get_connector
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
            
        connector = get_connector(
            marketplace,
            api_key_data.get("client_id", ""),
            api_key_data["api_key"]
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
        
        for p in products:
            try:
                sku = p.get('sku') or p.get('offer_id') or p.get('article')
                if not sku:
                    errors.append(f"Product {p.get('name')} missing SKU")
                    continue

                # Check existence
                existing = await db.product_catalog.find_one({
                    "$or": [{"sku": sku}, {"article": sku}],
                    "seller_id": seller_id
                })
                
                # Prepare data
                product_data = {
                    "sku": sku,
                    "article": sku,
                    "name": p.get('name'),
                    "description": p.get('description'),
                    "price": p.get('price'),
                    "minimalmod": {
                        "name": p.get('name'),
                        "description": p.get('description'),
                        "images": p.get('images', []),
                        "attributes": p.get('attributes', {})
                    },
                    "marketplace_data": {
                        marketplace: p
                    }
                }
                
                if existing:
                    # Update existing (merge marketplace data)
                    update_fields = {
                       f"marketplace_data.{marketplace}": p,
                       "dates.updated_at": datetime.utcnow()
                    }
                    await db.product_catalog.update_one(
                        {"_id": existing["_id"]},
                        {"$set": update_fields}
                    )
                    updated_count += 1
                else:
                    # Create new
                    product_data["seller_id"] = seller_id
                    product_data["status"] = "active"
                    product_data["dates"] = {
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "published_at": None
                    }
                    product_data["investor_tag"] = extract_investor_tag(sku)
                    product_data["listing_quality_score"] = cls.calculate_listing_quality_score(product_data).dict()
                    
                    result = await db.product_catalog.insert_one(product_data)
                    
                    # Init inventory
                    await db.inventory.insert_one({
                        "product_id": str(result.inserted_id),
                        "product_id_oid": result.inserted_id,
                        "seller_id": seller_id,
                        "sku": sku,
                        "article": sku,
                        "quantity": p.get('stock', 0), # Init with stock from MP if available
                        "reserved": 0,
                        "available": p.get('stock', 0),
                        "alert_threshold": 10
                    })
                    created_count += 1
                    
            except Exception as e:
                errors.append(f"Error importing {p.get('sku')}: {str(e)}")
                
        return {
            "success": True,
            "created": created_count,
            "updated": updated_count,
            "errors": errors
        }
