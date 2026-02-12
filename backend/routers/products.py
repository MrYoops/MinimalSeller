from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from bson import ObjectId
from datetime import datetime
import logging

from services.product_service import ProductService
from services.auth_service import AuthService
from schemas.user import UserRole
from schemas.product import ProductResponse, ProductCreate, ProductUpdate
from category_system import CategorySystem
from pydantic import BaseModel
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/products", tags=["Products"])

# AI Client
try:
    from openai import OpenAI
    client = OpenAI() if os.getenv('OPENAI_API_KEY') else None
except Exception:
    client = None

# ============================================================================
# TAGS ENDPOINTS (Must be before /{product_id})
# ============================================================================

@router.get("/tags")
async def get_tags_root():
    """
    Get all tags (Frontend uses this path)
    """
    return {"tags": await ProductService.get_all_tags()}

@router.get("/tags/list")
async def get_all_tags():
    return {"tags": await ProductService.get_all_tags()}

@router.post("/tags/add")
async def add_tag_to_products(
    request: dict,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    """Add tag to multiple products"""
    product_ids = request.get("product_ids", [])
    tag = request.get("tag")
    
    await ProductService.add_tags_to_products(product_ids, [tag], str(current_user["_id"]))
    return {"message": "Tags added"}

@router.post("/tags/remove")
async def remove_tag_from_products(
    request: dict,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    """Remove tag from multiple products"""
    product_ids = request.get("product_ids", [])
    tag = request.get("tag")
    
    await ProductService.remove_tags_from_products(product_ids, [tag], str(current_user["_id"]))
    return {"message": "Tags removed"}

# ============================================================================
# MARKETPLACES ENDPOINTS (Must be before /{product_id})
# ============================================================================

@router.get("/marketplaces/{marketplace}/products")
async def get_marketplace_products(
    marketplace: str,
    api_key_id: Optional[str] = Query(None),
    current_user: dict = Depends(AuthService.get_current_user)
):
    """
    Fetch products from a marketplace (Ozon, WB, Yandex) for import selection.
    Использует локальные тестовые данные вместо внешних API.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"[MARKETPLACE] Request received: marketplace={marketplace}, api_key_id={api_key_id}, user={current_user['_id']}")
    
    try:
        from core.database import get_database
        db = await get_database()
        
        seller_id = str(current_user["_id"])
        from bson import ObjectId
        seller_object_id = ObjectId(seller_id)
        
        # Если api_key_id не указан, используем первый доступный
        if not api_key_id:
            from core.database import get_database
            db = await get_database()
            profile = await db.seller_profiles.find_one({
                "$or": [
                    {"user_id": seller_id},
                    {"user_id": seller_object_id}
                ]
            })
            if profile and profile.get("api_keys"):
                api_key_id = profile["api_keys"][0].get("id")
                logger.info(f"[MARKETPLACE] Using first available API key: {api_key_id}")
        
        # Получаем тестовые товары из локальной коллекции
        # Ищем по integration_id или по marketplace + seller_id
        query = {
            "marketplace": marketplace,
            "seller_id": seller_object_id
        }
        
        # Если указан api_key_id, добавляем в фильтр
        if api_key_id:
            query["integration_id"] = api_key_id
        
        products = await db.marketplace_products.find(query).to_list(None)
        
        # Конвертируем ObjectId в string и добавляем sku
        for product in products:
            product["id"] = str(product.pop("_id", product.get("id")))
            if "seller_id" in product and hasattr(product["seller_id"], "__str__"):
                product["seller_id"] = str(product["seller_id"])
            # Добавляем sku для совместимости с фронтендом
            if "article" in product and "sku" not in product:
                product["sku"] = product["article"]
        
        logger.info(f"[MARKETPLACE] Found {len(products)} products from {marketplace} (api_key_id: {api_key_id})")
        
        # Возвращаем в том же формате, что и раньше
        return {"marketplace": marketplace, "products": products}
        
    except ValueError as e:
        logger.error(f"[MARKETPLACE] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[MARKETPLACE] Exception: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {str(e)}")

class MarketplaceImportRequest(BaseModel):
    products: List[dict]

class ProductMarketplaceImportRequest(BaseModel):
    product: dict
    duplicate_action: str = "link_only"  # link_only, create_new, update_existing

@router.post("/marketplaces/{marketplace}/import")
async def import_marketplace_products(
    marketplace: str,
    request: MarketplaceImportRequest,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    """
    Import selected marketplace products to local catalog
    """
    try:
        result = await ProductService.import_from_marketplace(marketplace, request.products, str(current_user["_id"]))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import products: {str(e)}")

@router.post("/import-from-marketplace")
async def import_from_marketplace(
    request: ProductMarketplaceImportRequest,
    current_user: dict = Depends(AuthService.require_role(UserRole.SELLER))
):
    """
    Import single product from marketplace with duplicate handling
    Улучшенная логика синхронизации по артикулам
    """
    try:
        from core.database import get_database
        from datetime import datetime
        
        db = await get_database()
        seller_id = str(current_user["_id"])
        
        # Extract product data
        product_data = request.product
        sku = product_data.get('sku') or product_data.get('offer_id') or product_data.get('article')
        marketplace = product_data.get('marketplace', 'unknown')
        
        if not sku:
            raise HTTPException(status_code=400, detail="Product missing SKU/offer_id/article")
        
        print(f"[SYNC] Processing product: {sku} from {marketplace} (action: {request.duplicate_action})")
        
        # Convert seller_id to ObjectId
        try:
            seller_object_id = ObjectId(seller_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid seller_id")
        
        # Check for existing product by article/sku
        existing = await db.products.find_one({
            "$or": [{"sku": sku}, {"article": sku}],
            "seller_id": seller_object_id
        })
        
        if existing and request.duplicate_action == "link_only":
            # ИСПРАВЛЕНО: Извлечение цен и бренда перед обновлением
            regular_price = float(product_data.get('price', 0) or 0)
            discount_price = float(product_data.get('discount_price', 0) or 0)
            
            # Используем discount_price как основную цену если она есть
            price = discount_price if discount_price > 0 else regular_price
            if price == 0:
                price = existing.get('price', 0)
            
            brand = product_data.get('brand', '') or existing.get('brand', '')
            
            # Just link the marketplace data AND update main fields
            print(f"[SYNC] Linking existing product: {existing.get('article')}, regular_price={regular_price}, discount_price={discount_price}, final_price={price}, brand={brand}")
            update_result = await db.products.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        # ИСПРАВЛЕНО: Обновляем основные поля товара
                        "price": regular_price if regular_price > 0 else (price if price > 0 else existing.get('price', 0)),
                        "price_discounted": discount_price if discount_price > 0 else existing.get('price_discounted'),  # ИСПРАВЛЕНО: Обновляем цену со скидкой
                        "brand": brand if brand else existing.get('brand', ''),
                        # Обновляем marketplace данные
                        f"marketplace_data.{marketplace}": product_data,
                        f"marketplaces.{marketplace}.enabled": True,
                        f"marketplaces.{marketplace}.product_id": product_data.get('id', ''),
                        f"marketplaces.{marketplace}.sku": sku,
                        f"marketplaces.{marketplace}.price": regular_price if regular_price > 0 else price,  # Обычная цена
                        f"marketplaces.{marketplace}.discount_price": discount_price if discount_price > 0 else price,  # Цена со скидкой
                        f"marketplaces.{marketplace}.stock": product_data.get('stock', 0),
                        "dates.updated_at": datetime.utcnow()
                    }
                }
            )
            return {
                "status": "linked", 
                "product_id": str(existing["_id"]),
                "message": f"Товар {sku} успешно связан с {marketplace}"
            }
        
        elif existing and request.duplicate_action == "create_new":
            # Force create new product even if duplicate exists
            print(f"[SYNC] Creating new product for duplicate: {sku}")
            # Modify SKU to make it unique
            original_sku = sku
            counter = 1
            while True:
                test_sku = f"{original_sku}_COPY_{counter}"
                existing_test = await db.products.find_one({
                    "$or": [{"sku": test_sku}, {"article": test_sku}],
                    "seller_id": seller_object_id
                })
                if not existing_test:
                    sku = test_sku
                    break
                counter += 1
        elif existing:
            return {
                "status": "duplicate_found", 
                "message": f"Товар с артикулом {sku} уже существует. Выберите действие."
            }
        
        # ИСПРАВЛЕНО: Преобразуем characteristics из массива в словарь если нужно
        attributes = product_data.get('attributes', {})
        if isinstance(attributes, list):
            # Если это массив характеристик [{name: '', value: ''}], преобразуем в словарь
            attributes = {char.get('name', ''): char.get('value', '') for char in attributes if char.get('name')}
        elif not isinstance(attributes, dict):
            attributes = {}
        
        # Также проверяем поле characteristics
        if not attributes and product_data.get('characteristics'):
            chars = product_data.get('characteristics', [])
            if isinstance(chars, list):
                attributes = {char.get('name', ''): char.get('value', '') for char in chars if char.get('name')}
            elif isinstance(chars, dict):
                attributes = chars
        
        # ИСПРАВЛЕНО: Автоматическое сопоставление категории через CategorySystem
        category_mapping_id = None
        category_id = None
        category_system = CategorySystem(db)
        
        mp_category_id = product_data.get('category_id', '')
        mp_category_name = product_data.get('category', '')
        
        if mp_category_id and mp_category_name:
            try:
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
                logger.info(f"[IMPORT] Category mapping created/found: {mapping_id} for {mp_category_name}")
            except Exception as e:
                logger.warning(f"[IMPORT] Failed to create category mapping: {e}")
        
        # ИСПРАВЛЕНО: Извлечение цен с правильной логикой
        # Для WB: price - обычная цена, discount_price - цена со скидкой (реальная цена продажи)
        # Для Ozon: price - основная цена
        regular_price = float(product_data.get('price', 0) or 0)
        discount_price = float(product_data.get('discount_price', 0) or 0)
        
        # Используем discount_price как основную цену если она есть (это реальная цена продажи)
        # Иначе используем regular_price
        price = discount_price if discount_price > 0 else regular_price
        
        # Если цена все еще 0, пробуем другие поля
        if price == 0:
            price = float(product_data.get('salePrice', 0) or product_data.get('sale_price', 0) or 0)
        
        # ИСПРАВЛЕНО: Логирование для отладки
        logger.info(f"[IMPORT] Product {sku}: regular_price={regular_price}, discount_price={discount_price}, final_price={price}, brand={product_data.get('brand', '')}, category={mp_category_name}")
        
        # Create new product
        print(f"[SYNC] Creating new product: {sku}")
        new_product = {
            "sku": sku,
            "price": regular_price if regular_price > 0 else price,  # Обычная цена
            "price_discounted": discount_price if discount_price > 0 and discount_price < (regular_price if regular_price > 0 else price) else None,  # ИСПРАВЛЕНО: Сохраняем только если реально меньше обычной цены
            "purchase_price": 0.0,
            "seller_id": seller_object_id,
            "article": sku,
            "brand": product_data.get('brand', ''),  # ИСПРАВЛЕНО: Добавляем бренд
            "category_mapping_id": category_mapping_id,  # ИСПРАВЛЕНО: Добавляем сопоставление категории
            "minimalmod": {
                "name": product_data.get('name', 'Unknown'),
                "description": product_data.get('description', '') or '',  # ИСПРАВЛЕНО: Гарантируем строку
                "images": product_data.get('images', []) or product_data.get('photos', []),  # Поддержка обоих полей
                "attributes": attributes,  # ИСПРАВЛЕНО: Используем преобразованные attributes
                "tags": [marketplace, "imported"]
            },
            "marketplaces": {
                marketplace: {
                    "enabled": True,
                    "product_id": product_data.get('id', ''),
                    "sku": sku,
                    "price": regular_price if regular_price > 0 else price,  # Обычная цена
                    "discount_price": discount_price if discount_price > 0 else price,  # Цена со скидкой
                    "stock": product_data.get('stock', 0),
                    "warehouse_id": "7f0c027c-f7a4-492c-aaa5-86b1c9f659b7"
                }
            },
            "marketplace_data": {
                marketplace: {
                    **product_data,  # Сохраняем все данные с маркетплейса
                    "category": mp_category_name,
                    "category_id": mp_category_id,
                    "brand": product_data.get('brand', ''),
                    "characteristics": product_data.get('characteristics', []),
                    "attributes": attributes,
                    "imported_at": datetime.utcnow().isoformat()
                }
            },
            "dates": {
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "published_at": None
            },
            "listing_quality_score": ProductService.calculate_listing_quality_score(product_data).dict(),
            "tags": [marketplace, "imported"]
        }
        
        result = await db.products.insert_one(new_product)
        
        # Initialize inventory
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
        
        print(f"[SYNC] Successfully created product: {sku}")
        
        return {
            "status": "created",
            "product_id": str(result.inserted_id),
            "sku": sku,
            "message": f"Товар {sku} успешно создан и импортирован из {marketplace}"
        }
        
    except Exception as e:
        print(f"[SYNC] ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import product: {str(e)}")

# ============================================================================
# PRODUCTS CRUD
# ============================================================================

@router.get("", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    investor_tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_quality: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    sort_by: Optional[str] = Query("created_at"),
    ascending: Optional[bool] = Query(False),
    current_user: dict = Depends(AuthService.get_current_user)
):
    skip = (page - 1) * limit
    return await ProductService.get_products(
        seller_id=str(current_user["_id"]),
        category_id=category_id,
        status=status,
        investor_tag=investor_tag,
        search=search,
        min_quality=min_quality,
        skip=skip,
        limit=limit
    )

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    product = await ProductService.get_product(product_id, str(current_user["_id"]))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("", response_model=ProductResponse)
async def create_product(
    product: ProductCreate,
    current_user: dict = Depends(AuthService.get_current_user)
):
    return await ProductService.create_product(product, str(current_user["_id"]))

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product: ProductUpdate,
    current_user: dict = Depends(AuthService.get_current_user)
):
    return await ProductService.update_product(product_id, product, str(current_user["_id"]))

@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    success = await ProductService.delete_product(product_id, str(current_user["_id"]))
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

# ============================================================================
# PRODUCT PHOTOS ENDPOINTS
# ============================================================================

@router.get("/{product_id}/photos")
async def get_product_photos(
    product_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Get photos for a product"""
    try:
        product = await ProductService.get_product(product_id, str(current_user["_id"]))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Extract photos from minimalmod.images and marketplace_data
        photos = []
        
        # From minimalmod
        minimalmod_images = product.get("minimalmod", {}).get("images", [])
        for img in minimalmod_images:
            if isinstance(img, str):
                photos.append({"url": img})
            elif isinstance(img, dict):
                url = img.get("url") or img.get("file_name") or img.get("src")
                if url:
                    photos.append({"url": url})
        
        # From marketplace_data
        marketplace_data = product.get("marketplace_data", {})
        for marketplace, data in marketplace_data.items():
            if isinstance(data, dict) and data.get("images"):
                for img in data["images"]:
                    if isinstance(img, str):
                        photos.append({"url": img, "source": marketplace})
                    elif isinstance(img, dict):
                        url = img.get("url") or img.get("file_name") or img.get("src")
                        if url:
                            photos.append({"url": url, "source": marketplace})
        
        return photos
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get photos: {str(e)}")

@router.get("/{product_id}/variants")
async def get_product_variants(
    product_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Get variants for a product"""
    try:
        product = await ProductService.get_product(product_id, str(current_user["_id"]))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Extract variants from marketplace_data
        variants = []
        marketplace_data = product.get("marketplace_data", {})
        
        for marketplace, data in marketplace_data.items():
            if isinstance(data, dict) and data.get("variants"):
                for variant in data["variants"]:
                    variants.append({
                        **variant,
                        "source": marketplace
                    })
        
        return variants
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get variants: {str(e)}")
