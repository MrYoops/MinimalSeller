from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import List, Optional, Dict, Any
from bson import ObjectId
from datetime import datetime
import re

from models import (
    ProductCreate, ProductUpdate, ProductResponse,
    BulkImportRequest, AIAdaptRequest, ProductMappingCreate
)
from utils import (
    extract_investor_tag, generate_url_slug,
    calculate_listing_quality_score, prepare_product_response,
    auto_match_products_by_sku
)
from connectors import get_connector

router = APIRouter(prefix="/api", tags=["products"])

# Эти зависимости будут импортированы из server.py
db = None
get_current_user = None
require_role = None

def init_routes(database, current_user_dep, role_dep):
    global db, get_current_user, require_role
    db = database
    get_current_user = current_user_dep
    require_role = role_dep

@router.get("/products", response_model=List[ProductResponse])
async def get_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    tags: Optional[str] = None,  # comma-separated
    status: Optional[str] = None,
    quality: Optional[str] = None,  # high, medium, low
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Получить список товаров с фильтрацией"""
    query = {}
    
    # Продавец видит только свои товары
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    # Поиск
    if search:
        query['$or'] = [
            {'sku': {'$regex': search, '$options': 'i'}},
            {'minimalmod.name': {'$regex': search, '$options': 'i'}}
        ]
    
    # Фильтры
    if category_id:
        query['category_id'] = ObjectId(category_id)
    
    if tags:
        tag_list = [t.strip() for t in tags.split(',')]
        query['minimalmod.tags'] = {'$in': tag_list}
    
    if status:
        query['status'] = status
    
    products = await db.products.find(query).skip(skip).limit(limit).to_list(length=limit)
    
    # Фильтр по качеству (после получения из БД)
    if quality:
        filtered = []
        for p in products:
            score = p.get('listing_quality_score', {}).get('total', 0)
            if quality == 'high' and score >= 80:
                filtered.append(p)
            elif quality == 'medium' and 50 <= score < 80:
                filtered.append(p)
            elif quality == 'low' and score < 50:
                filtered.append(p)
        products = filtered
    
    return [prepare_product_response(p) for p in products]

@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить один товар"""
    product = await db.products.find_one({'_id': ObjectId(product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return prepare_product_response(product)

@router.post("/products", response_model=ProductResponse)
async def create_product(
    product_data: ProductCreate,
    current_user: dict = Depends(get_current_user)
):
    """Создать новый товар"""
    # Проверка уникальности SKU для продавца
    existing = await db.products.find_one({
        'seller_id': current_user['_id'],
        'sku': product_data.sku
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Product with this SKU already exists"
        )
    
    # Извлечение тега инвестора из SKU
    investor_tag = extract_investor_tag(product_data.sku)
    if investor_tag and investor_tag not in product_data.minimalmod.tags:
        product_data.minimalmod.tags.append(investor_tag)
    
    # Генерация URL slug если не указан
    if not product_data.seo.url_slug:
        product_data.seo.url_slug = generate_url_slug(product_data.minimalmod.name)
    
    # Создание документа
    product_dict = product_data.dict()
    product_dict['seller_id'] = current_user['_id']
    product_dict['dates'] = {
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'published_at': datetime.utcnow() if product_data.status == 'active' else None
    }
    
    # Расчет качества
    product_dict['listing_quality_score'] = calculate_listing_quality_score(product_dict)
    
    result = await db.products.insert_one(product_dict)
    product_dict['_id'] = result.inserted_id
    
    return prepare_product_response(product_dict)

@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Обновить товар"""
    product = await db.products.find_one({'_id': ObjectId(product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_dict = product_data.dict(exclude_unset=True)
    
    # Обновление тега инвестора если изменился SKU
    if 'sku' in update_dict and update_dict['sku']:
        investor_tag = extract_investor_tag(update_dict['sku'])
        if investor_tag:
            if 'minimalmod' not in update_dict:
                update_dict['minimalmod'] = product['minimalmod']
            if 'tags' not in update_dict['minimalmod']:
                update_dict['minimalmod']['tags'] = product['minimalmod'].get('tags', [])
            if investor_tag not in update_dict['minimalmod']['tags']:
                update_dict['minimalmod']['tags'].append(investor_tag)
    
    # Обновление URL slug если изменилось название
    if 'minimalmod' in update_dict and 'name' in update_dict['minimalmod']:
        if 'seo' not in update_dict:
            update_dict['seo'] = product.get('seo', {})
        if not update_dict['seo'].get('url_slug'):
            update_dict['seo']['url_slug'] = generate_url_slug(update_dict['minimalmod']['name'])
    
    # Обновление даты изменения
    if 'dates' not in update_dict:
        update_dict['dates'] = product.get('dates', {})
    update_dict['dates']['updated_at'] = datetime.utcnow()
    
    # Обновление даты публикации
    if update_dict.get('status') == 'active' and not update_dict['dates'].get('published_at'):
        update_dict['dates']['published_at'] = datetime.utcnow()
    
    # Пересчет качества
    merged_product = {**product, **update_dict}
    update_dict['listing_quality_score'] = calculate_listing_quality_score(merged_product)
    
    await db.products.update_one(
        {'_id': ObjectId(product_id)},
        {'$set': update_dict}
    )
    
    updated_product = await db.products.find_one({'_id': ObjectId(product_id)})
    return prepare_product_response(updated_product)

@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить товар"""
    product = await db.products.find_one({'_id': ObjectId(product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.products.delete_one({'_id': ObjectId(product_id)})
    return {'message': 'Product deleted successfully'}

@router.post("/products/bulk-import")
async def bulk_import_products(
    import_data: BulkImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Массовый импорт товаров"""
    created_count = 0
    updated_count = 0
    errors = []
    
    for row_index, row in enumerate(import_data.data):
        try:
            # Маппинг данных
            product_data = {}
            for local_field, import_field in import_data.column_mapping.items():
                if import_field in row:
                    product_data[local_field] = row[import_field]
            
            sku = product_data.get('sku')
            if not sku:
                errors.append(f"Row {row_index + 1}: SKU is required")
                continue
            
            # Проверка существования
            existing = await db.products.find_one({
                'seller_id': current_user['_id'],
                'sku': sku
            })
            
            if existing and import_data.update_existing:
                # Обновление
                await db.products.update_one(
                    {'_id': existing['_id']},
                    {'$set': {
                        **product_data,
                        'dates.updated_at': datetime.utcnow()
                    }}
                )
                updated_count += 1
            elif not existing and import_data.create_new:
                # Создание
                investor_tag = extract_investor_tag(sku)
                tags = product_data.get('minimalmod', {}).get('tags', [])
                if investor_tag and investor_tag not in tags:
                    tags.append(investor_tag)
                
                new_product = {
                    **product_data,
                    'seller_id': current_user['_id'],
                    'dates': {
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    },
                    'listing_quality_score': calculate_listing_quality_score(product_data)
                }
                
                await db.products.insert_one(new_product)
                created_count += 1
        
        except Exception as e:
            errors.append(f"Row {row_index + 1}: {str(e)}")
    
    return {
        'created': created_count,
        'updated': updated_count,
        'errors': errors
    }

@router.get("/marketplaces/{marketplace}/products")
async def get_marketplace_products(
    marketplace: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить товары с маркетплейса (mock)"""
    # Получаем API ключи продавца
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    # Находим ключ для маркетплейса
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
    
    # Получаем товары через коннектор
    connector = get_connector(
        marketplace,
        marketplace_key['client_id'],
        marketplace_key['api_key']
    )
    
    products = await connector.get_products()
    return products

@router.post("/product-mappings")
async def create_product_mapping(
    mapping: ProductMappingCreate,
    current_user: dict = Depends(get_current_user)
):
    """Создать связь между товаром и товаром маркетплейса"""
    # Проверка доступа к товару
    product = await db.products.find_one({'_id': ObjectId(mapping.product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    mapping_doc = {
        **mapping.dict(),
        'product_id': ObjectId(mapping.product_id),
        'created_at': datetime.utcnow()
    }
    
    result = await db.product_mappings.insert_one(mapping_doc)
    
    return {'message': 'Mapping created', 'id': str(result.inserted_id)}

@router.post("/product-mappings/auto-match")
async def auto_match_products(
    marketplace: str,
    current_user: dict = Depends(get_current_user)
):
    """Автоматическое сопоставление по SKU"""
    # Получаем локальные товары
    query = {'seller_id': current_user['_id']}
    local_products = await db.products.find(query).to_list(length=1000)
    
    # Получаем товары с маркетплейса
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
    api_keys = profile.get('api_keys', [])
    marketplace_key = next(
        (k for k in api_keys if k['marketplace'] == marketplace),
        None
    )
    
    if not marketplace_key:
        return {'matched': 0, 'mappings': []}
    
    connector = get_connector(
        marketplace,
        marketplace_key['client_id'],
        marketplace_key['api_key']
    )
    
    marketplace_products = await connector.get_products()
    
    # Автоматическое сопоставление
    matches = auto_match_products_by_sku(local_products, marketplace_products)
    
    # Создание mappings
    created_mappings = []
    for match in matches:
        mapping = {
            'product_id': ObjectId(match['product_id']),
            'marketplace': marketplace,
            'marketplace_product_id': match['marketplace_product'].get('id', ''),
            'marketplace_sku': match['marketplace_product'].get('sku', ''),
            'created_at': datetime.utcnow()
        }
        
        result = await db.product_mappings.insert_one(mapping)
        created_mappings.append(str(result.inserted_id))
    
    return {
        'matched': len(matches),
        'mappings': created_mappings
    }

@router.post("/marketplaces/{marketplace}/import-product")
async def import_marketplace_product(
    marketplace: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Импортировать товар с маркетплейса"""
    marketplace_product_id = data.get('marketplace_product_id')
    tag = data.get('tag', '')
    
    # Получаем API ключи
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
    api_keys = profile.get('api_keys', [])
    marketplace_key = next((k for k in api_keys if k['marketplace'] == marketplace), None)
    
    if not marketplace_key:
        raise HTTPException(status_code=400, detail=f"No API key for {marketplace}")
    
    # Получаем товары с МП
    connector = get_connector(marketplace, marketplace_key.get('client_id', ''), marketplace_key['api_key'])
    marketplace_products = await connector.get_products()
    mp_product = next((p for p in marketplace_products if str(p.get('id')) == str(marketplace_product_id)), None)
    
    if not mp_product:
        raise HTTPException(status_code=404, detail="Product not found on marketplace")
    
    # АВТОМАТИЧЕСКОЕ определение категории по названию категории с МП
    category_name = mp_product.get('category', '')
    category = None
    
    if category_name:
        # Ищем категорию по имени (Electronics, Одежда и т.д.)
        category = await db.categories.find_one({'name': {'$regex': category_name, '$options': 'i'}})
    
    # Если не нашли, берем первую доступную
    if not category:
        category = await db.categories.find_one({})
    
    # Создание товара с ПОЛНЫМИ данными
    new_product = {
        'seller_id': current_user['_id'],
        'sku': mp_product.get('sku', f"{marketplace}-{marketplace_product_id}"),
        'price': mp_product.get('price', 0),
        'category_id': category['_id'] if category else None,
        'status': 'draft',
        'visibility': {'show_on_minimalmod': False, 'show_in_search': False, 'is_featured': False},
        'seo': {'meta_title': '', 'meta_description': '', 'url_slug': ''},
        'dates': {'created_at': datetime.utcnow(), 'updated_at': datetime.utcnow()},
        'minimalmod': {
            'name': mp_product.get('name', ''),
            'variant_name': '',
            'description': mp_product.get('description', ''),
            'tags': [tag] if tag else [],
            'images': mp_product.get('images', [])[:8],  # До 8 для сайта
            'attributes': mp_product.get('attributes', {})
        },
        'marketplaces': {
            'images': mp_product.get('images', [])[:10],  # До 10 для МП
            'ozon': {'enabled': False},
            'wildberries': {'enabled': True, 'product_id': str(marketplace_product_id)} if marketplace == 'wb' else {'enabled': False},
            'yandex_market': {'enabled': False}
        },
        'listing_quality_score': {}
    }
    
    # Генерация slug
    new_product['seo']['url_slug'] = generate_url_slug(new_product['minimalmod']['name'])
    
    # Расчет качества
    new_product['listing_quality_score'] = calculate_listing_quality_score(new_product)
    
    result = await db.products.insert_one(new_product)
    
    # Создание mapping
    await db.product_mappings.insert_one({
        'product_id': result.inserted_id,
        'marketplace': marketplace,
        'marketplace_product_id': marketplace_product_id,
        'marketplace_sku': mp_product.get('sku', ''),
        'created_at': datetime.utcnow()
    })
    
    return {
        'message': 'Product imported successfully',
        'product_id': str(result.inserted_id),
        'category': category['name'] if category else 'Без категории'
    }
