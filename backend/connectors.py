# Real connectors for marketplaces - FULL BROWSER HEADERS
# Complete implementation with CORS-compatible headers

import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import json
import gzip
import brotli  # For Brotli decompression

logger = logging.getLogger(__name__)

class MarketplaceError(Exception):
    """Custom exception for marketplace API errors"""
    def __init__(self, marketplace: str, status_code: int, message: str, details: Any = None):
        self.marketplace = marketplace
        self.status_code = status_code
        self.message = message
        self.details = details
        super().__init__(f"{marketplace} API Error [{status_code}]: {message}")

class BaseConnector:
    """Base class for marketplace connectors"""
    
    def __init__(self, client_id: str, api_key: str):
        self.client_id = client_id
        self.api_key = api_key
        self.marketplace_name = "Base"
        self.timeout = 30.0
    
    def _get_browser_headers(self) -> Dict[str, str]:
        """Get browser-like headers to bypass CORS/bot detection"""
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
    
    async def _make_request(
        self,
        method: str,
        url: str,
        headers: Dict[str, str],
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request with full browser headers"""
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, 
                verify=True,
                follow_redirects=True
            ) as client:
                logger.info(f"[{self.marketplace_name}] {method} {url}")
                logger.info(f"[{self.marketplace_name}] Headers: {list(headers.keys())}")
                
                if method == "GET":
                    response = await client.get(url, headers=headers, params=params)
                elif method == "POST":
                    logger.info(f"[{self.marketplace_name}] POST JSON data: {json_data}")
                    response = await client.post(url, headers=headers, json=json_data, params=params)
                elif method == "PUT":
                    response = await client.put(url, headers=headers, json=json_data)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                logger.info(f"[{self.marketplace_name}] Response status: {response.status_code}")
                
                # Handle non-200 responses
                if response.status_code not in [200, 201, 204]:
                    error_text = response.text
                    try:
                        error_json = response.json()
                        error_message = error_json.get('message') or error_json.get('error') or error_json.get('detail') or str(error_json)
                        logger.error(f"[{self.marketplace_name}] API Error JSON: {error_json}")
                    except:
                        error_message = error_text[:200] if error_text else "Unknown error"
                    
                    logger.error(f"[{self.marketplace_name}] API Error [{response.status_code}]: {error_message}")
                    raise MarketplaceError(
                        marketplace=self.marketplace_name,
                        status_code=response.status_code,
                        message=error_message,
                        details=error_text
                    )
                
                # Handle 204 No Content (success with empty body)
                if response.status_code == 204:
                    logger.info(f"[{self.marketplace_name}] Success (204 No Content)")
                    return {"success": True, "message": "Updated successfully"}
                
                # Try to parse as JSON
                try:
                    return response.json()
                except Exception as json_error:
                    # If JSON parsing fails, check if response is compressed
                    # Check Content-Encoding header first
                    content_encoding = response.headers.get('content-encoding', '').lower()
                    content = response.content
                    gzip_magic = b'\x1f\x8b'
                    
                    logger.info(f"[{self.marketplace_name}] JSON parsing failed: {json_error}")
                    logger.info(f"[{self.marketplace_name}] Content-Encoding header: '{content_encoding}'")
                    logger.info(f"[{self.marketplace_name}] First 2 bytes: {content[:2].hex() if len(content) >= 2 else 'N/A'}")
                    
                    # Check for compression type
                    has_gzip_header = content_encoding == 'gzip'
                    has_gzip_magic = content[:2] == gzip_magic
                    has_brotli_header = content_encoding == 'br'
                    is_compressed = has_gzip_header or has_gzip_magic or has_brotli_header
                    
                    logger.info(f"[{self.marketplace_name}] Compression check: gzip_header={has_gzip_header}, gzip_magic={has_gzip_magic}, brotli={has_brotli_header}")
                    
                    if is_compressed:
                        try:
                            # Try Brotli first if header indicates it
                            if has_brotli_header:
                                logger.info(f"[{self.marketplace_name}] Detected Brotli-compressed response, decompressing...")
                                decompressed = brotli.decompress(content)
                                decoded = decompressed.decode('utf-8')
                                logger.info(f"[{self.marketplace_name}] Successfully decompressed Brotli: {len(content)} -> {len(decoded)} bytes")
                                return json.loads(decoded)
                            # Try gzip
                            elif has_gzip_header or has_gzip_magic:
                                logger.info(f"[{self.marketplace_name}] Detected gzip-compressed response, decompressing...")
                                decompressed = gzip.decompress(content)
                                decoded = decompressed.decode('utf-8')
                                logger.info(f"[{self.marketplace_name}] Successfully decompressed gzip: {len(content)} -> {len(decoded)} bytes")
                                return json.loads(decoded)
                        except Exception as decompress_error:
                            logger.error(f"[{self.marketplace_name}] Failed to decompress: {decompress_error}")
                            # Fall through to return raw response
                    
                    # Not compressed or decompression failed, return text
                    logger.warning(f"[{self.marketplace_name}] Response is not JSON and not compressed: {response.text[:100]}")
                    return {"raw_response": response.text}
                
        except httpx.TimeoutException as e:
            logger.error(f"[{self.marketplace_name}] Request timeout: {str(e)}")
            raise MarketplaceError(
                marketplace=self.marketplace_name,
                status_code=408,
                message="Request timeout - marketplace server not responding"
            )
        except httpx.ConnectError as e:
            logger.error(f"[{self.marketplace_name}] Connection error: {str(e)}")
            raise MarketplaceError(
                marketplace=self.marketplace_name,
                status_code=503,
                message=f"Cannot connect to marketplace server: {str(e)}"
            )
        except MarketplaceError:
            raise
        except Exception as e:
            logger.error(f"[{self.marketplace_name}] Unexpected error: {str(e)}")
            raise MarketplaceError(
                marketplace=self.marketplace_name,
                status_code=500,
                message=f"Internal error: {str(e)}"
            )

class OzonConnector(BaseConnector):
    """Ozon marketplace connector - REAL API with full headers"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Ozon"
        self.base_url = "https://api-seller.ozon.ru"
    
    def _get_headers(self) -> Dict[str, str]:
        """Get Ozon-specific headers with browser simulation"""
        headers = self._get_browser_headers()
        headers.update({
            "Client-Id": self.client_id,
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
            "Origin": "https://seller.ozon.ru",
            "Referer": "https://seller.ozon.ru/"
        })
        return headers
    
    async def get_products(self) -> List[Dict[str, Any]]:
        """Get products from Ozon with full details (images, attributes) - WITH PAGINATION"""
        logger.info("[Ozon] Fetching ALL products with full details (pagination enabled)")
        
        # Step 1: Get list of all products with pagination
        list_url = f"{self.base_url}/v3/product/list"
        headers = self._get_headers()
        
        logger.info("[Ozon] Step 1: Getting product list with pagination")
        
        all_items = []
        last_id = ""
        page = 1
        
        # Pagination loop to get ALL products
        while True:
            list_payload = {
                "filter": {
                    "visibility": "ALL"
                },
                "last_id": last_id,
                "limit": 1000  # Max limit per request
            }
            
            logger.info(f"[Ozon] Fetching page {page}, last_id: {last_id}")
            
            list_response = await self._make_request("POST", list_url, headers, json_data=list_payload)
            items = list_response.get('result', {}).get('items', [])
            
            logger.info(f"[Ozon] Page {page}: Received {len(items)} products")
            
            if not items:
                break
            
            all_items.extend(items)
            
            # Check if there are more pages
            last_id = list_response.get('result', {}).get('last_id', '')
            if not last_id:
                break
            
            page += 1
        
        logger.info(f"[Ozon] Total products fetched: {len(all_items)}")
        
        all_products = []
        
        try:
            if not all_items:
                return all_products
            
            # Step 2: Get full info for each product (in batches)
            # Use v3 API which returns images correctly
            info_url = f"{self.base_url}/v3/product/info/list"
            
            # Prepare offer IDs from ALL items
            offer_ids = [item.get('offer_id') for item in all_items if item.get('offer_id')]
            
            logger.info(f"[Ozon] Step 2: Getting full info for {len(offer_ids)} products via v3 API (in batches)")
            
            # Process in batches of 100 (API limit)
            batch_size = 100
            for i in range(0, len(offer_ids), batch_size):
                batch = offer_ids[i:i + batch_size]
                logger.info(f"[Ozon] Processing batch {i//batch_size + 1}: {len(batch)} products")
                
                # Get full info - v3 API uses simpler payload
                info_payload = {
                    "offer_id": batch
                }
                
                try:
                    info_response = await self._make_request("POST", info_url, headers, json_data=info_payload)
                    # v3 API returns items directly, not in result.items
                    detailed_items = info_response.get('items', []) or info_response.get('result', {}).get('items', [])
                    logger.info(f"[Ozon] Batch received full info for {len(detailed_items)} products")
                    
                    # Transform to standard format
                    for detailed in detailed_items:
                        # Extract images - v3 API returns images as array of URLs directly
                        images = []
                        images_data = detailed.get('images', [])
                        
                        # Handle both formats: array of strings or array of objects
                        for img in images_data:
                            if isinstance(img, str):
                                images.append(img)
                            elif isinstance(img, dict):
                                img_url = img.get('file_name') or img.get('url')
                                if img_url:
                                    images.append(img_url)
                        
                        # Extract primary image (v3 returns it as array)
                        primary_image = detailed.get('primary_image', [])
                        if isinstance(primary_image, list) and primary_image:
                            for pi in primary_image:
                                if pi and pi not in images:
                                    images.insert(0, pi)
                        elif isinstance(primary_image, str) and primary_image:
                            if primary_image not in images:
                                images.insert(0, primary_image)
                        
                        logger.debug(f"[Ozon] Product {detailed.get('offer_id')}: found {len(images)} images")
                        
                        all_products.append({
                            "id": str(detailed.get('id', '')),
                            "sku": detailed.get('offer_id', ''),
                            "name": detailed.get('name', 'Unnamed product'),
                            "description": detailed.get('description', ''),
                            "price": float(detailed.get('price', 0) or 0),
                            "stock": 0,
                            "images": images,
                            "attributes": detailed.get('attributes', []),
                            "category": detailed.get('category_name', ''),
                            "marketplace": "ozon",
                            "status": 'archived' if detailed.get('is_archived') else 'active',
                            "barcode": detailed.get('barcodes', [''])[0] if detailed.get('barcodes') else ''
                        })
                    
                except MarketplaceError as e:
                    # If batch fails, log and continue with next batch
                    logger.warning(f"[Ozon] Failed to get full info for batch: {e.message}, skipping batch")
                    continue
            
            logger.info(f"[Ozon] Successfully transformed {len(all_products)} products with full details")
            return all_products
            
        except MarketplaceError as e:
            # If /v3/product/info/list fails completely, fallback to basic data
            logger.warning(f"[Ozon] Failed to get full info: {e.message}, using basic data")
            
            for item in all_items:
                all_products.append({
                    "id": str(item.get('product_id', '')),
                    "sku": item.get('offer_id', ''),
                    "name": item.get('offer_id', 'Unnamed product'),
                    "description": '',
                    "price": 0,
                    "stock": 0,
                    "images": [],
                    "attributes": {},
                    "category": '',
                    "marketplace": "ozon",
                    "status": 'archived' if item.get('archived') else 'active',
                    "barcode": ''
                })
            
            logger.info(f"[Ozon] Successfully transformed {len(all_products)} products (basic info only)")
            return all_products
    
    async def get_warehouses(self) -> List[Dict[str, Any]]:
        """Get FBS warehouses from Ozon (seller's own warehouses)"""
        logger.info("[Ozon] Fetching seller FBS warehouses")
        
        # CORRECT endpoint for seller warehouses (FBS)
        url = f"{self.base_url}/v1/warehouse/list"
        headers = self._get_headers()
        
        logger.info(f"[Ozon] Request URL: {url}")
        logger.info(f"[Ozon] Client-Id: {self.client_id[:10]}...")
        
        # Empty payload to get all seller warehouses
        payload = {}
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            
            logger.info(f"[Ozon] Raw response: {response_data}")
            
            # Result contains list of warehouses
            warehouses = response_data.get('result', [])
            logger.info(f"[Ozon] Received {len(warehouses)} total warehouses")
            
            formatted_warehouses = []
            for wh in warehouses:
                # All warehouses from /v1/warehouse/list are seller's warehouses
                formatted_warehouses.append({
                    "id": str(wh.get('warehouse_id', wh.get('id', ''))),
                    "name": wh.get('name', 'Unnamed warehouse'),
                    "is_enabled": wh.get('is_enabled', True),
                    "type": wh.get('type', 'FBS').upper(),
                    "is_fbs": True  # All from this endpoint are seller's warehouses
                })
            
            logger.info(f"[Ozon] Formatted {len(formatted_warehouses)} warehouses")
            return formatted_warehouses
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to fetch warehouses: {e.message}")
            raise
        except Exception as e:
            logger.error(f"[Ozon] Unexpected error: {str(e)}")
            raise MarketplaceError(f"Failed to fetch Ozon warehouses: {str(e)}", 500)
    
    async def search_categories(self, query: str) -> List[Dict[str, Any]]:
        """Search categories by name (quick method)"""
        logger.info(f"[WB] Searching categories: '{query}'")
        
        # Простой поиск: загружаем все категории и фильтруем
        all_categories = await self.get_categories()
        
        # Фильтруем по query (регистронезависимо)
        query_lower = query.lower()
        filtered = [
            cat for cat in all_categories 
            if query_lower in cat.get('name', '').lower()
        ]
        
        logger.info(f"[WB] Found {len(filtered)} categories matching '{query}'")
        return filtered[:100]  # Максимум 100 результатов
    
    async def get_categories(self) -> List[Dict[str, Any]]:
        """Get category tree from Ozon with attributes (recursively flattens tree)"""
        logger.info("[Ozon] Fetching category tree")
        
        url = f"{self.base_url}/v1/description-category/tree"
        headers = self._get_headers()
        payload = {"language": "DEFAULT"}  # or "RU", "EN"
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            
            categories = response_data.get('result', [])
            logger.info(f"[Ozon] Received {len(categories)} top-level categories")
            
            # Рекурсивно развернуть дерево категорий
            def flatten_categories(cats, parent_name='', parent_cat_id=''):
                result = []
                for cat in cats:
                    # ИСПРАВЛЕНО: description_category_id основной ключ для Ozon
                    cat_id = cat.get('description_category_id', cat.get('category_id', ''))
                    cat_name = cat.get('category_name', '')
                    type_id = cat.get('type_id', 0)
                    type_name = cat.get('type_name', '')
                    
                    # Если есть cat_id И cat_name, это родительская категория
                    if cat_id and cat_name:
                        full_name = f"{parent_name} / {cat_name}" if parent_name else cat_name
                        
                        result.append({
                            "id": str(cat_id),
                            "category_id": str(cat_id),  # ДОБАВЛЕНО
                            "description_category_id": cat_id,  # ДОБАВЛЕНО
                            "name": full_name,
                            "category_name": full_name,  # ДОБАВЛЕНО
                            "type_id": type_id,
                            "type_name": type_name,
                            "disabled": cat.get('disabled', False),
                            "marketplace": "ozon"
                        })
                        
                        # Рекурсивно обработать дочерние категории с этим cat_id
                        children = cat.get('children', [])
                        if children:
                            result.extend(flatten_categories(children, full_name, str(cat_id)))
                    
                    # Если нет cat_name но есть type_id, это тип товара (конечная категория)
                    elif type_id and type_name:
                        # Используем type_name как название
                        full_name = f"{parent_name} / {type_name}" if parent_name else type_name
                        
                        result.append({
                            "id": str(parent_cat_id),  # Используем ID родителя
                            "category_id": str(parent_cat_id),  # ДОБАВЛЕНО
                            "description_category_id": parent_cat_id,  # ДОБАВЛЕНО
                            "name": full_name,
                            "category_name": full_name,  # ДОБАВЛЕНО
                            "type_id": type_id,
                            "type_name": type_name,
                            "disabled": cat.get('disabled', False),
                            "marketplace": "ozon"
                        })
                
                return result
            
            formatted_categories = flatten_categories(categories)
            
            logger.info(f"[Ozon] Formatted {len(formatted_categories)} categories (including nested)")
            return formatted_categories
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to fetch categories: {e.message}")
            raise
    
    async def get_category_attributes(self, category_id: int, type_id: int) -> List[Dict[str, Any]]:
        """Get attributes/characteristics for a specific category"""
        logger.info(f"[Ozon] Fetching attributes for category {category_id}, type {type_id}")
        
        url = f"{self.base_url}/v1/description-category/attribute"
        headers = self._get_headers()
        payload = {
            "description_category_id": category_id,
            "type_id": type_id,
            "language": "DEFAULT"
        }
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            
            attributes = response_data.get('result', [])
            logger.info(f"[Ozon] Received {len(attributes)} attributes")
            
            return attributes
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to fetch attributes: {e.message}")
            raise
    
    async def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создать карточку товара на Ozon"""
        logger.info("[Ozon] Creating product card")
        
        # ПРАВИЛЬНЫЙ endpoint v3
        url = f"{self.base_url}/v3/product/import"
        headers = self._get_headers()
        
        # Проверить обязательные поля
        if not product_data.get('ozon_category_id'):
            # КРИТИЧНО: Категория ОБЯЗАТЕЛЬНА! Не используем дефолт!
            logger.error("[Ozon] No category_id specified!")
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message="Категория товара не сопоставлена с Ozon! Перейдите в раздел КАТЕГОРИИ и создайте сопоставление."
            )
        
        if not product_data.get('ozon_type_id'):
            logger.error("[Ozon] No type_id specified!")
            raise MarketplaceError(
                marketplace="Ozon", 
                status_code=400,
                message="Тип товара (type_id) не указан для категории Ozon! Проверьте сопоставление категории."
            )
        
        # Подготовить payload для Ozon v3
        # VAT должен быть в формате 0..1 (0.2 = 20%)
        vat_decimal = product_data.get('vat', 0) / 100 if product_data.get('vat', 0) > 1 else product_data.get('vat', 0)
        
        # ВАЛИДАЦИЯ: description_category_id и type_id ДОЛЖНЫ быть int
        category_id = product_data.get('ozon_category_id')
        type_id = product_data.get('ozon_type_id')
        
        # Преобразовать в int если возможно
        if isinstance(category_id, str):
            try:
                category_id = int(category_id) if category_id.isdigit() else None
            except:
                category_id = None
        elif not isinstance(category_id, int):
            category_id = None
        
        if isinstance(type_id, str):
            try:
                type_id = int(type_id) if type_id.isdigit() else None
            except:
                type_id = None
        elif not isinstance(type_id, int):
            type_id = None
        
        # ВАЛИДАЦИЯ: Если category_id или type_id не удалось получить - ошибка!
        if not category_id:
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message="Неверный формат category_id! Проверьте сопоставление категории с Ozon."
            )
        
        if not type_id:
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message="Неверный формат type_id! Проверьте сопоставление категории с Ozon."
            )
        
        logger.info(f"[Ozon] Validated category_id={category_id}, type_id={type_id}")
        
        # ЦЕНЫ: Ozon ожидает цены в рублях (не копейках)
        # Если price > 1000, вероятно в копейках - делим на 100
        # Если price < 1000, вероятно уже в рублях
        price = product_data.get('price', 0)
        old_price = product_data.get('price_without_discount', 0)
        
        # Умная конвертация
        price_rubles = str(int(price / 100)) if price > 1000 else str(int(price))
        old_price_rubles = str(int(old_price / 100)) if old_price > 1000 else str(int(old_price))
        
        logger.info(f"[Ozon] Price conversion: {price} → {price_rubles}₽, Old: {old_price} → {old_price_rubles}₽")
        
        # ГАБАРИТЫ И ВЕС: Ozon требует обязательно
        # Dimensions в мм из БД → конвертируем в см для Ozon
        dimensions = product_data.get('dimensions', {})
        height_mm = dimensions.get('height', 0)
        width_mm = dimensions.get('width', 0)
        length_mm = dimensions.get('length', 0)
        weight_g = product_data.get('weight', 0)
        
        # Конвертация мм → см (с округлением до целого)
        height_cm = int(height_mm / 10) if height_mm > 0 else 0
        width_cm = int(width_mm / 10) if width_mm > 0 else 0
        depth_cm = int(length_mm / 10) if length_mm > 0 else 0
        
        # ВАЛИДАЦИЯ обязательных полей
        validation_errors = []
        if height_cm <= 0:
            validation_errors.append("Высота (height) обязательна")
        if width_cm <= 0:
            validation_errors.append("Ширина (width) обязательна")
        if depth_cm <= 0:
            validation_errors.append("Длина (depth) обязательна")
        if weight_g <= 0:
            validation_errors.append("Вес (weight) обязателен")
        
        if validation_errors:
            error_msg = "Ошибка валидации Ozon: " + ", ".join(validation_errors)
            logger.error(f"[Ozon] {error_msg}")
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message=error_msg + ". Заполните габариты и вес товара!"
            )
        
        logger.info(f"[Ozon] Dimensions: {height_mm}x{width_mm}x{length_mm} мм → {height_cm}x{width_cm}x{depth_cm} см, Weight: {weight_g} г")
        
        payload = {
            "items": [{
                "offer_id": product_data.get('article', ''),
                "name": product_data.get('name', ''),
                "price": price_rubles,
                "old_price": old_price_rubles,
                "vat": str(vat_decimal),  # В формате 0.2 для 20%
                "height": height_cm,  # ОБЯЗАТЕЛЬНО в см
                "width": width_cm,    # ОБЯЗАТЕЛЬНО в см
                "depth": depth_cm,    # ОБЯЗАТЕЛЬНО в см
                "weight": weight_g,   # ОБЯЗАТЕЛЬНО в граммах
                "images": product_data.get('photos', [])[:10],  # Максимум 10 фото
                "description": product_data.get('description', ''),
                "description_category_id": category_id,  # ВАЛИДИРОВАННЫЙ int
                "type_id": type_id,  # ВАЛИДИРОВАННЫЙ int
                "attributes": self._prepare_ozon_attributes(product_data)
            }]
        }
        
        logger.info(f"[Ozon] Creating product: {product_data.get('name')}")
        logger.info(f"[Ozon] Article: {product_data.get('article')}")
        logger.info(f"[Ozon] Category: {category_id}, Type: {type_id}")
        logger.info(f"[Ozon] Price: {price_rubles}₽, Old price: {old_price_rubles}₽")
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            logger.info(f"[Ozon] ✅ Product created: {response}")
            
            task_id = response.get('result', {}).get('task_id')
            return {
                "success": True,
                "task_id": task_id,
                "message": f"✅ Карточка отправлена на Ozon (task_id: {task_id})"
            }
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to create product: {e.message}")
            raise
    
    def _prepare_ozon_attributes(self, product_data: Dict[str, Any]) -> List[Dict]:
        """Подготовить атрибуты для Ozon из обязательных полей"""
        attributes = []
        
        # Получить обязательные атрибуты из product_data.required_attributes
        required_attrs = product_data.get('required_attributes', {})
        
        # Если есть заполненные обязательные атрибуты, используем их
        for attr_id_str, attr_data in required_attrs.items():
            attr_id = int(attr_id_str)
            
            # Проверить формат значения
            if isinstance(attr_data, dict):
                value_id = attr_data.get('value_id')
                value = attr_data.get('value')
                
                if value_id:
                    # Dictionary-атрибут с value_id
                    attributes.append({
                        "attribute_id": attr_id,
                        "complex_id": 0,
                        "values": [{"id": value_id}]
                    })
                elif value:
                    # Текстовый атрибут
                    attributes.append({
                        "attribute_id": attr_id,
                        "complex_id": 0,
                        "values": [{"value": str(value)}]
                    })
            elif attr_data:
                # Простое значение
                attributes.append({
                    "attribute_id": attr_id,
                    "complex_id": 0,
                    "values": [{"value": str(attr_data)}]
                })
        
        # Если нет обязательных атрибутов, используем старую логику (для совместимости)
        if not attributes:
            logger.warning("[Ozon] No required_attributes provided, using defaults")
            
            # 4298 - Российский размер
            attributes.append({
                "attribute_id": 4298,
                "complex_id": 0,
                "values": [{"value": "42"}]
            })
            
            # 10096 - Цвет товара
            attributes.append({
                "attribute_id": 10096,
                "complex_id": 0,
                "values": [{"value": "Бежевый"}]
            })
            
            # 9163 - Пол
            attributes.append({
                "attribute_id": 9163,
                "complex_id": 0,
                "values": [{"value": "Мужской"}]
            })
            
            # 8292 - Объединить на одной карточке
            attributes.append({
                "attribute_id": 8292,
                "complex_id": 0,
                "values": [{"value": "Да"}]
            })
        
        logger.info(f"[Ozon] Prepared {len(attributes)} attributes for product")
        return attributes

    async def update_stock(self, warehouse_id: str, stocks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Обновить остатки на Ozon
        
        Args:
            warehouse_id: ID склада FBS на Ozon
            stocks: [{offer_id: str, stock: int}, ...]
        """
        url = f"{self.base_url}/v2/products/stocks"
        headers = self._get_headers()
        
        payload = {
            "stocks": [
                {
                    "offer_id": item["offer_id"],
                    "stock": item["stock"],
                    "warehouse_id": int(warehouse_id)
                }
                for item in stocks
            ]
        }
        
        logger.info(f"[Ozon] Updating {len(stocks)} products stock on warehouse {warehouse_id}")
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            logger.info(f"[Ozon] ✅ Stock updated: {response}")
            return {
                "success": True,
                "updated": len(stocks),
                "response": response
            }
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to update stock: {e.message}")
            raise

    async def get_stocks(self, warehouse_id: str = None) -> List[Dict[str, Any]]:
        """
        Получить остатки с Ozon через аналитический API
        
        Args:
            warehouse_id: ID склада FBS (опционально) - НЕ ИСПОЛЬЗУЕТСЯ в аналитике
        
        Returns:
            [{offer_id: str, product_id: int, stock: int, warehouse_id: int}, ...]
        """
        # Используем аналитический API v2 для получения остатков на складах
        url = f"{self.base_url}/v2/analytics/stock_on_warehouses"
        headers = self._get_headers()
        
        payload = {
            "limit": 1000,
            "offset": 0,
            "warehouse_type": "ALL"  # ALL, FBO, FBS, CROSSBORDER
        }
        
        logger.info(f"[Ozon] Getting stocks via analytics API")
        logger.info(f"[Ozon] Request URL: {url}")
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            
            logger.info(f"[Ozon] Raw response keys: {list(response.keys())}")
            
            # Аналитический API возвращает rows с данными
            rows = response.get("result", {}).get("rows", [])
            
            logger.info(f"[Ozon] Got {len(rows)} rows from analytics API")
            
            # Преобразуем в нужный формат
            # ВАЖНО: в аналитике используются item_code (артикул) вместо offer_id
            # И warehouse_name вместо warehouse_id
            stocks = []
            for row in rows:
                stocks.append({
                    "offer_id": row.get("item_code"),  # ВАЖНО: используем item_code как offer_id
                    "product_id": row.get("sku"),  # SKU товара на Ozon
                    "present": row.get("free_to_sell_amount", 0),  # доступно к продаже
                    "reserved": row.get("reserved_amount", 0),  # зарезервировано
                    "warehouse_id": None,  # В аналитике нет warehouse_id
                    "warehouse_name": row.get("warehouse_name", "")
                })
            
            logger.info(f"[Ozon] ✅ Got {len(stocks)} stock records")
            if stocks:
                logger.info(f"[Ozon] Sample stock record: {stocks[0]}")
            
            # Если нужен конкретный склад, но в аналитике его нет - используем fallback
            if warehouse_id and len(stocks) == 0:
                logger.info(f"[Ozon] Analytics returned 0 for warehouse {warehouse_id}, trying fallback...")
                return await self._get_stocks_fallback(warehouse_id)
            
            return stocks
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to get stocks via analytics: {e.message}")
            # Если аналитический API не работает, пробуем запасной вариант
            logger.info(f"[Ozon] Trying fallback method...")
            return await self._get_stocks_fallback(warehouse_id)
    
    async def _get_stocks_fallback(self, warehouse_id: str = None) -> List[Dict[str, Any]]:
        """
        Запасной метод получения остатков - через список товаров
        """
        try:
            # Получаем список всех товаров
            products = await self.get_products()
            
            logger.info(f"[Ozon Fallback] Got {len(products)} products, fetching stocks for each...")
            
            stocks = []
            
            # Для каждого товара получаем остаток
            # Используем batch запросы по 100 товаров
            batch_size = 100
            for i in range(0, len(products), batch_size):
                batch = products[i:i + batch_size]
                offer_ids = [p.get("sku") for p in batch if p.get("sku")]
                
                if not offer_ids:
                    continue
                
                # Используем v3/product/info/stocks с конкретными offer_id
                url = f"{self.base_url}/v3/product/info/stocks"
                headers = self._get_headers()
                
                payload = {
                    "filter": {
                        "offer_id": offer_ids,
                        "visibility": "ALL"
                    },
                    "limit": 100
                }
                
                if warehouse_id:
                    payload["filter"]["warehouse_id"] = [int(warehouse_id)]
                
                try:
                    response = await self._make_request("POST", url, headers, json_data=payload)
                    items = response.get("result", {}).get("items", [])
                    
                    for item in items:
                        item_stocks = item.get("stocks", [])
                        for stock in item_stocks:
                            stocks.append({
                                "offer_id": item.get("offer_id"),
                                "product_id": item.get("product_id"),
                                "present": stock.get("present", 0),
                                "reserved": stock.get("reserved", 0),
                                "warehouse_id": str(stock.get("warehouse_id", "")),
                                "warehouse_name": stock.get("warehouse_name", "")
                            })
                except Exception as e:
                    logger.error(f"[Ozon Fallback] Batch {i} failed: {e}")
                    continue
            
            logger.info(f"[Ozon Fallback] ✅ Got {len(stocks)} stock records")
            return stocks
            
        except Exception as e:
            logger.error(f"[Ozon Fallback] Failed: {e}")
            return []

    async def get_product_prices(self, offer_id: str) -> Dict[str, Any]:
        """
        Получить текущие цены товара с Ozon
        
        Args:
            offer_id: Артикул товара (offer_id)
        
        Returns:
            {
                "offer_id": str,
                "price": float,
                "old_price": float,
                "marketing_price": float,
                "currency_code": str
            }
        """
        logger.info(f"[Ozon] Getting prices for offer_id: {offer_id}")
        
        url = f"{self.base_url}/v4/product/info/prices"
        headers = self._get_headers()
        
        payload = {
            "filter": {
                "offer_id": [offer_id],
                "visibility": "ALL"
            },
            "last_id": "",
            "limit": 1
        }
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            items = response.get("result", {}).get("items", [])
            
            if not items:
                logger.warning(f"[Ozon] No price info found for offer_id: {offer_id}")
                return {
                    "offer_id": offer_id,
                    "price": 0,
                    "old_price": 0,
                    "marketing_price": 0,
                    "currency_code": "RUB"
                }
            
            item = items[0]
            price_info = item.get("price", {})
            
            result = {
                "offer_id": item.get("offer_id", offer_id),
                "product_id": item.get("product_id"),
                "price": float(price_info.get("price", "0")),
                "old_price": float(price_info.get("old_price", "0")),
                "marketing_price": float(price_info.get("marketing_price", "0")),
                "currency_code": price_info.get("currency_code", "RUB"),
                "vat": price_info.get("vat", "0")
            }
            
            logger.info(f"[Ozon] ✅ Got prices: {result['price']}₽ / {result['old_price']}₽")
            return result
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to get prices: {e.message}")
            raise

    async def update_product_prices(self, offer_id: str, price: float, old_price: float, 
                                     marketing_price: str = "UNKNOWN") -> Dict[str, Any]:
        """
        Обновить цены товара на Ozon
        
        Args:
            offer_id: Артикул товара
            price: Цена со скидкой (в рублях)
            old_price: Цена до скидки (в рублях)
            marketing_price: Маркетинговая цена (по умолчанию "UNKNOWN")
        
        Returns:
            {"success": bool, "message": str}
        """
        logger.info(f"[Ozon] Updating prices for {offer_id}: {price}₽ / {old_price}₽")
        
        url = f"{self.base_url}/v1/product/import/prices"
        headers = self._get_headers()
        
        # Валидация
        if price <= 0:
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message="Цена должна быть больше 0"
            )
        
        if old_price <= 0:
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message="Цена до скидки должна быть больше 0"
            )
        
        if price > old_price:
            raise MarketplaceError(
                marketplace="Ozon",
                status_code=400,
                message="Цена со скидкой не может быть больше цены без скидки"
            )
        
        payload = {
            "prices": [{
                "offer_id": offer_id,
                "price": str(int(price)),
                "old_price": str(int(old_price)),
                "currency_code": "RUB"
            }]
        }
        
        # Добавляем marketing_price только если не UNKNOWN
        if marketing_price and marketing_price != "UNKNOWN":
            payload["prices"][0]["marketing_price"] = marketing_price
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            
            # Проверяем результат
            results = response.get("result", [])
            if results and len(results) > 0:
                result = results[0]
                errors = result.get("errors", [])
                
                if errors:
                    error_messages = [f"{e.get('code')}: {e.get('message')}" for e in errors]
                    raise MarketplaceError(
                        marketplace="Ozon",
                        status_code=400,
                        message="; ".join(error_messages)
                    )
            
            logger.info("[Ozon] ✅ Prices updated successfully")
            return {
                "success": True,
                "message": f"✅ Цены обновлены на Ozon: {price}₽ / {old_price}₽"
            }
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to update prices: {e.message}")
            raise


    
    # ========== МЕТОДЫ ДЛЯ РАБОТЫ С ЗАКАЗАМИ ==========
    
    async def get_fbs_orders(self, date_from: datetime, date_to: datetime) -> List[Dict[str, Any]]:
        """
        Получить заказы FBS (со своего склада) за период
        
        API: POST /v3/posting/fbs/list
        Docs: https://docs.ozon.ru/api/seller/#operation/PostingAPI_GetFbsPostingList
        """
        url = f"{self.base_url}/v3/posting/fbs/list"
        headers = self._get_headers()
        
        payload = {
            "dir": "ASC",
            "filter": {
                "since": date_from.isoformat() + "Z",
                "to": date_to.isoformat() + "Z",
                "status": ""  # Все статусы
            },
            "limit": 1000,
            "offset": 0,
            "with": {
                "analytics_data": False,
                "financial_data": False
            }
        }
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            
            # ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ
            logger.info(f"[Ozon FBS] RAW Response: {json.dumps(response, ensure_ascii=False)[:500]}")
            
            result = response.get("result", {})
            postings = result.get("postings", [])
            
            logger.info(f"[Ozon] Получено {len(postings)} FBS заказов")
            logger.info(f"[Ozon] Response keys: {list(response.keys())}")
            logger.info(f"[Ozon] Result keys: {list(result.keys()) if result else 'EMPTY'}")
            
            if len(postings) > 0:
                logger.info(f"[Ozon] Пример заказа: {json.dumps(postings[0], ensure_ascii=False)[:300]}")
            
            return postings
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Ошибка получения FBS заказов: {e.message}")
            raise
    
    async def get_fbo_orders(self, date_from: datetime, date_to: datetime) -> List[Dict[str, Any]]:
        """
        Получить заказы FBO (со склада Ozon) за период
        
        API: POST /v3/posting/fbo/list
        Docs: https://docs.ozon.ru/api/seller/#operation/PostingAPI_GetFboPostingList
        """
        url = f"{self.base_url}/v3/posting/fbo/list"
        headers = self._get_headers()
        
        payload = {
            "dir": "ASC",
            "filter": {
                "since": date_from.isoformat() + "Z",
                "to": date_to.isoformat() + "Z",
                "status": ""  # Все статусы
            },
            "limit": 1000,
            "offset": 0,
            "with": {
                "analytics_data": False,
                "financial_data": False
            }
        }
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            result = response.get("result", {})
            postings = result.get("postings", [])
            
            logger.info(f"[Ozon] Получено {len(postings)} FBO заказов")
            return postings
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Ошибка получения FBO заказов: {e.message}")
            raise
    
    async def get_order_status(self, posting_number: str) -> Dict[str, Any]:
        """
        Получить детали и статус конкретного заказа
        
        API: POST /v3/posting/fbs/get
        Docs: https://docs.ozon.ru/api/seller/#operation/PostingAPI_GetFbsPosting
        """
        url = f"{self.base_url}/v3/posting/fbs/get"
        headers = self._get_headers()
        
        payload = {
            "posting_number": posting_number,
            "with": {
                "analytics_data": False,
                "financial_data": False
            }
        }
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            result = response.get("result", {})
            
            logger.info(f"[Ozon] Получен статус заказа {posting_number}: {result.get('status')}")
            return result
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Ошибка получения статуса заказа {posting_number}: {e.message}")
            raise
    
    def map_ozon_status_to_internal(self, ozon_status: str) -> str:
        """
        Маппинг статусов Ozon на внутренние статусы системы
        
        Ozon статусы:
        - awaiting_packaging: ожидает сборки
        - awaiting_deliver: ожидает отгрузки
        - arbitration: арбитраж
        - client_arbitration: клиентский арбитраж
        - delivering: доставляется
        - driver_pickup: у водителя
        - delivered: доставлен
        - cancelled: отменён
        """
        status_map = {
            "awaiting_registration": "new",
            "awaiting_packaging": "new",
            "awaiting_deliver": "awaiting_shipment",
            "arbitration": "awaiting_shipment",
            "client_arbitration": "awaiting_shipment",
            "delivering": "delivering",  # ← КЛЮЧЕВОЙ СТАТУС ДЛЯ СПИСАНИЯ!
            "driver_pickup": "delivering",
            "delivered": "delivered",
            "cancelled": "cancelled"
        }
        
        return status_map.get(ozon_status, "new")
    
    async def split_order(self, posting_number: str, packages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Разделить FBS заказ на несколько отправлений (Ozon)
        
        Args:
            posting_number: Номер отправления
            packages: [
                {
                    "products": [
                        {"product_id": int, "quantity": int},
                        ...
                    ]
                },
                ...
            ]
        
        Returns:
            {
                "result": [
                    {"posting_number": "new_posting_1"},
                    {"posting_number": "new_posting_2"}
                ]
            }
        """
        logger.info(f"[Ozon] Splitting order {posting_number} into {len(packages)} packages")
        
        url = f"{self.base_url}/v1/posting/fbs/package"
        headers = self._get_headers()
        
        payload = {
            "posting_number": posting_number,
            "packages": packages
        }
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            logger.info(f"[Ozon] Order split successfully: {response_data}")
            return response_data
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to split order: {e.message}")
            raise
    
    async def get_label(self, posting_number: str) -> str:
        """
        Получить этикетку для FBS заказа (Ozon)
        
        Returns:
            URL или base64 строка с PDF этикеткой
        """
        logger.info(f"[Ozon] Getting label for {posting_number}")
        
        url = f"{self.base_url}/v2/posting/fbs/package-label"
        headers = self._get_headers()
        
        payload = {
            "posting_number": [posting_number]
        }
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            
            # Ozon может вернуть либо URL, либо base64
            # Ищем URL в ответе
            label_url = response_data.get('result', {}).get('url')
            
            if label_url:
                logger.info(f"[Ozon] Label URL: {label_url}")
                return label_url
            
            # Если нет URL, проверяем base64
            label_base64 = response_data.get('result', {}).get('file')
            
            if label_base64:
                logger.info(f"[Ozon] Label received as base64 (length: {len(label_base64)})")
                return f"data:application/pdf;base64,{label_base64}"
            
            logger.warning(f"[Ozon] No label found in response")
            return None
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to get label: {e.message}")
            raise



class WildberriesConnector(BaseConnector):
    """Wildberries marketplace connector - REAL API with full headers"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Wildberries"
        self.api_token = api_key
        # Updated domains as of Jan 2025
        self.content_api_url = "https://content-api.wildberries.ru"
        self.marketplace_api_url = "https://marketplace-api.wildberries.ru"
    
    def _get_headers(self) -> Dict[str, str]:
        """Get WB-specific headers with browser simulation"""
        headers = self._get_browser_headers()
        headers.update({
            "Authorization": self.api_token,
            "Content-Type": "application/json",
            "Origin": "https://seller.wildberries.ru",
            "Referer": "https://seller.wildberries.ru/"
        })
        return headers
    
    async def get_products(self) -> List[Dict[str, Any]]:
        """Get products from Wildberries with FULL INFO - REAL API CALL"""
        logger.info("[WB] Fetching products with full details from Content API")
        
        url = f"{self.content_api_url}/content/v2/get/cards/list"
        headers = self._get_headers()
        
        payload = {
            "settings": {
                "cursor": {
                    "limit": 100
                },
                "filter": {
                    "withPhoto": -1
                }
            }
        }
        
        all_products = []
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            
            cards = response_data.get('cards', [])
            logger.info(f"[WB] Received {len(cards)} product cards")
            
            for card in cards:
                # Extract vendor code (артикул продавца)
                vendor_code = card.get('vendorCode', '')
                
                # Extract photos
                photos = []
                for photo in card.get('photos', []):
                    photos.append(photo.get('big', photo.get('c516x688', '')))
                
                # Extract characteristics (характеристики)
                characteristics = []
                for char in card.get('characteristics', []):
                    characteristics.append({
                        "name": char.get('name', ''),
                        "value": char.get('value', '')
                    })
                
                # Extract description
                description = card.get('description', '')
                
                # ИСПРАВЛЕНО: Используем subjectID и subjectName вместо object
                subject_id = card.get('subjectID')
                subject_name = card.get('subjectName', '')
                
                # Extract sizes if available
                sizes = card.get('sizes', [])
                if sizes:
                    for size in sizes:
                        all_products.append({
                            "id": str(card.get('nmID', '')),
                            "sku": vendor_code,  # Артикул продавца
                            "barcode": size.get('skus', [''])[0],  # Баркод
                            "name": card.get('title', 'Unnamed product'),
                            "description": description,
                            "photos": photos,
                            "characteristics": characteristics,
                            "price": 0,
                            "stock": 0,
                            "marketplace": "wb",
                            "size": size.get('techSize', ''),
                            "category": subject_name,  # ИСПРАВЛЕНО
                            "category_id": str(subject_id) if subject_id else '',  # ДОБАВЛЕНО!
                            "brand": card.get('brand', '')
                        })
                else:
                    # Single product without sizes
                    all_products.append({
                        "id": str(card.get('nmID', '')),
                        "sku": vendor_code,
                        "barcode": '',
                        "name": card.get('title', 'Unnamed product'),
                        "description": description,
                        "photos": photos,
                        "characteristics": characteristics,
                        "price": 0,
                        "stock": 0,
                        "marketplace": "wb",
                        "size": '',
                        "category": subject_name,  # ИСПРАВЛЕНО
                        "category_id": str(subject_id) if subject_id else '',  # ДОБАВЛЕНО!
                        "brand": card.get('brand', '')
                    })
            
            logger.info(f"[WB] Successfully transformed {len(all_products)} products with full details")
            return all_products
            
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to fetch products: {e.message}")
            raise
    
    async def get_warehouses(self) -> List[Dict[str, Any]]:
        """Get seller's FBS warehouses from Wildberries (Seller Warehouses API)"""
        logger.info("[WB] Fetching seller's own FBS warehouses")
        
        # CORRECT endpoint for seller's OWN warehouses (Sept 2025 update)
        # Moved from FBS Orders to Product Management section
        url = f"{self.marketplace_api_url}/api/v3/warehouses"
        headers = self._get_headers()
        
        logger.info(f"[WB] Request URL: {url}")
        
        try:
            response_data = await self._make_request("GET", url, headers)
            
            logger.info(f"[WB] Raw response: {response_data}")
            
            warehouses = response_data if isinstance(response_data, list) else []
            logger.info(f"[WB] Received {len(warehouses)} seller warehouses")
            
            formatted_warehouses = []
            for wh in warehouses:
                # Parse seller warehouse data from /api/v3/warehouses
                wh_id = wh.get('id') or wh.get('ID')
                wh_name = wh.get('name')
                
                # Skip if being deleted or invalid
                if wh.get('isDeleting') or not wh_name or not wh_id:
                    continue
                
                formatted_warehouses.append({
                    "id": str(wh_id),
                    "name": wh_name,
                    "address": wh.get('address', ''),
                    "cargo_type": wh.get('cargoType', 1),  # 1=small, 2=oversized, 3=oversized+
                    "is_active": not wh.get('isProcessing', False),  # Not being updated
                    "is_deleting": wh.get('isDeleting', False),
                    "type": "FBS",  # Seller's own warehouses
                    "is_fbs": True
                })
            
            logger.info(f"[WB] Formatted {len(formatted_warehouses)} seller FBS warehouses")
            return formatted_warehouses
            
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to fetch warehouses: {e.message}")
            raise
        except Exception as e:
            logger.error(f"[WB] Unexpected error: {str(e)}")
            raise MarketplaceError(f"Failed to fetch WB warehouses: {str(e)}", 500)
    
    async def search_categories(self, query: str) -> List[Dict[str, Any]]:
        """Search WB categories by name"""
        logger.info(f"[WB] Searching categories: '{query}'")
        
        # Загружаем все категории и фильтруем
        all_categories = await self.get_categories()
        
        # Фильтруем по query (регистронезависимо)
        query_lower = query.lower()
        filtered = [
            cat for cat in all_categories 
            if query_lower in cat.get('name', '').lower()
        ]
        
        logger.info(f"[WB] Found {len(filtered)} categories matching '{query}'")
        return filtered[:100]  # Максимум 100 результатов
    
    async def get_categories(self) -> List[Dict[str, Any]]:
        """Get categories (subjects) from Wildberries - SIMPLIFIED VERSION
        
        Возвращает только parent categories (80 шт).
        Subcategories (subjects) приходят автоматически при импорте товаров через subjectID.
        """
        logger.info("[WB] Fetching parent categories (subjects)")
        
        url = f"{self.content_api_url}/content/v2/object/parent/all"
        headers = self._get_headers()
        
        try:
            response_data = await self._make_request("GET", url, headers)
            parents = response_data.get('data', [])
            logger.info(f"[WB] Received {len(parents)} parent categories")
            
            formatted_categories = []
            for parent in parents:
                formatted_categories.append({
                    "id": str(parent.get('id', '')),
                    "category_id": str(parent.get('id', '')),
                    "name": parent.get('name', 'Unnamed'),
                    "category_name": parent.get('name', 'Unnamed'),
                    "is_visible": parent.get('isVisible', True),
                    "is_parent": True,
                    "parent_id": None,
                    "parent_name": None,
                    "marketplace": "wb"
                })
            
            logger.info(f"[WB] Formatted {len(formatted_categories)} categories")
            return formatted_categories
            
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to fetch categories: {e.message}")
            raise
    
    async def get_category_characteristics(self, subject_id: int) -> List[Dict[str, Any]]:
        """Get characteristics/attributes for a specific subject (category)"""
        logger.info(f"[WB] Fetching characteristics for subject {subject_id}")
        
        url = f"{self.content_api_url}/content/v2/object/charcs/{subject_id}"
        headers = self._get_headers()
        
        try:
            response_data = await self._make_request("GET", url, headers)
            
            characteristics = response_data.get('data', [])
            logger.info(f"[WB] Received {len(characteristics)} characteristics")
            
            return characteristics
            
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to fetch characteristics: {e.message}")
            raise

    
    async def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создать карточку товара на Wildberries"""
        logger.info("[WB] Creating product card")
        
        # Wildberries API v2 для создания карточки
        url = f"{self.content_api_url}/content/v2/cards/upload"
        headers = self._get_headers()
        
        # Подготовить payload для WB
        payload = [{
            "vendorCode": product_data.get('article', ''),  # Артикул
            "countryProduction": product_data.get('country_of_origin', 'Вьетнам'),
            "brand": product_data.get('brand', ''),
            "title": product_data.get('name', ''),
            "description": product_data.get('description', ''),
            "dimensions": {
                "length": product_data.get('dimensions', {}).get('length', 0) / 10,  # В см
                "width": product_data.get('dimensions', {}).get('width', 0) / 10,
                "height": product_data.get('dimensions', {}).get('height', 0) / 10
            },
            "characteristics": []
        }]
        
        logger.info(f"[WB] Creating product: {product_data.get('name')}")
        logger.info(f"[WB] Article: {product_data.get('article')}")
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            logger.info(f"[WB] Product created: {response}")
            return {
                "success": True,
                "message": "Карточка создана на Wildberries"
            }
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to create product: {e.message}")
            raise


    async def update_stock(self, warehouse_id: str, stocks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Обновить остатки на Wildberries
        
        Args:
            warehouse_id: ID склада на WB
            stocks: [{sku: str, amount: int}, ...]
        """
        url = f"{self.marketplace_api_url}/api/v3/stocks/{warehouse_id}"
        headers = self._get_headers()
        
        payload = {
            "stocks": [
                {
                    "sku": item["sku"],
                    "amount": item["amount"]
                }
                for item in stocks
            ]
        }
        
        logger.info(f"[WB] Updating {len(stocks)} products stock on warehouse {warehouse_id}")
        
        try:
            response = await self._make_request("PUT", url, headers, json_data=payload)
            logger.info(f"[WB] ✅ Stock updated: {response}")
            return {
                "success": True,
                "updated": len(stocks),
                "response": response
            }
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to update stock: {e.message}")
            raise



    async def get_stocks(self, warehouse_id: str = None) -> List[Dict[str, Any]]:
        """
        Получить остатки с Wildberries
        
        Args:
            warehouse_id: ID склада (опционально)
        
        Returns:
            [{sku: str, amount: int, warehouseId: int}, ...]
        """
        url = f"{self.marketplace_api_url}/api/v3/stocks/{warehouse_id}" if warehouse_id else f"{self.marketplace_api_url}/api/v3/stocks"
        headers = self._get_headers()
        
        logger.info(f"[WB] Getting stocks from warehouse {warehouse_id or 'all'}")
        
        try:
            response = await self._make_request("GET", url, headers)
            stocks = response.get("stocks", []) if isinstance(response, dict) else response
            logger.info(f"[WB] ✅ Got {len(stocks)} stock records")
            return stocks
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to get stocks: {e.message}")
            raise

    async def get_product_prices(self, nm_id: int) -> Dict[str, Any]:
        """
        Получить текущие цены товара с Wildberries
        
        Args:
            nm_id: ID товара на WB (nmID)
        
        Returns:
            {
                "nm_id": int,
                "price": float,
                "discount_price": float,
                "discount_percent": int
            }
        """
        logger.info(f"[WB] Getting prices for nm_id: {nm_id}")
        
        # WB API v3 для получения цен и скидок
        url = f"{self.content_api_url}/public/api/v1/info"
        headers = self._get_headers()
        
        params = {
            "nm": nm_id
        }
        
        try:
            response = await self._make_request("GET", url, headers, params=params)
            
            if not response or not isinstance(response, list) or len(response) == 0:
                logger.warning(f"[WB] No price info found for nm_id: {nm_id}")
                return {
                    "nm_id": nm_id,
                    "price": 0,
                    "discount_price": 0,
                    "discount_percent": 0
                }
            
            item = response[0]
            price = item.get("price", 0)
            discount = item.get("discount", 0)
            
            # Рассчитываем цену со скидкой
            discount_price = price * (1 - discount / 100) if discount > 0 else price
            
            result = {
                "nm_id": nm_id,
                "price": float(price),
                "discount_price": float(discount_price),
                "discount_percent": int(discount)
            }
            
            logger.info(f"[WB] ✅ Got prices: {result['price']}₽ (скидка {result['discount_percent']}%)")
            return result
            
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to get prices: {e.message}")
            raise

    async def update_product_prices(self, nm_id: int, regular_price: float, 
                                     discount_price: Optional[float] = None) -> Dict[str, Any]:
        """
        Обновить цены товара на Wildberries
        
        Args:
            nm_id: ID товара на WB
            regular_price: Обычная цена (без скидки) в рублях
            discount_price: Цена со скидкой (опционально) в рублях
        
        Returns:
            {"success": bool, "message": str}
        """
        logger.info(f"[WB] Updating prices for nm_id {nm_id}: regular={regular_price}₽, discount={discount_price}₽")
        
        # Новый API WB для установки цен (2024)
        url = f"{self.content_api_url}/public/api/v1/prices"
        headers = self._get_headers()
        
        # Валидация
        if regular_price <= 0:
            raise MarketplaceError(
                marketplace="Wildberries",
                status_code=400,
                message="Обычная цена должна быть больше 0"
            )
        
        if discount_price and discount_price > regular_price:
            raise MarketplaceError(
                marketplace="Wildberries",
                status_code=400,
                message="Цена со скидкой не может быть больше обычной цены"
            )
        
        # Формируем payload
        payload = [{
            "nmId": nm_id,
            "price": int(regular_price)
        }]
        
        # Если есть цена со скидкой, добавляем discount
        if discount_price:
            discount_percent = int(((regular_price - discount_price) / regular_price) * 100)
            payload[0]["discount"] = discount_percent
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            
            logger.info("[WB] ✅ Prices updated successfully")
            return {
                "success": True,
                "message": f"✅ Цены обновлены на Wildberries: {regular_price}₽" + 
                          (f" / {discount_price}₽" if discount_price else "")
            }
            
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to update prices: {e.message}")
            raise

    
    # ========== МЕТОДЫ ДЛЯ РАБОТЫ С ЗАКАЗАМИ ==========
    
    async def get_orders(self, date_from: datetime, date_to: datetime, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Получить заказы Wildberries за период
        
        API: GET /api/v3/orders/new
        Docs: https://openapi.wildberries.ru/#tag/Sborka-Orders
        """
        url = f"{self.marketplace_api_url}/api/v3/orders/new"
        headers = self._get_headers()
        
        params = {
            "limit": limit,
            "dateFrom": int(date_from.timestamp())
        }
        
        try:
            response = await self._make_request("GET", url, headers, params=params)
            orders = response.get("orders", [])
            
            logger.info(f"[Wildberries] Получено {len(orders)} заказов")
            return orders
            
        except MarketplaceError as e:
            logger.error(f"[Wildberries] Ошибка получения заказов: {e.message}")
            raise
    
    async def get_order_status(self, order_id: int) -> Dict[str, Any]:
        """
        Получить статус конкретного заказа
        
        API: GET /api/v3/orders/status
        Docs: https://openapi.wildberries.ru/#tag/Sborka-Orders
        """
        url = f"{self.marketplace_api_url}/api/v3/orders/status"
        headers = self._get_headers()
        
        params = {
            "id": order_id
        }
        
        try:
            response = await self._make_request("GET", url, headers, params=params)
            orders = response.get("orders", [])
            
            if orders and len(orders) > 0:
                order = orders[0]
                logger.info(f"[Wildberries] Получен статус заказа {order_id}")
                return order
            else:
                raise MarketplaceError(
                    marketplace="Wildberries",
                    status_code=404,
                    message=f"Заказ {order_id} не найден"
                )
            
        except MarketplaceError as e:
            logger.error(f"[Wildberries] Ошибка получения статуса заказа {order_id}: {e.message}")
            raise
    
    def map_wb_status_to_internal(self, wb_status: int) -> str:
        """
        Маппинг статусов Wildberries на внутренние статусы системы
        
        WB статусы (коды):
        0: новый
        1: на сборке
        2: в пути к клиенту
        3: доставлен
        4: отменён клиентом
        5: отменён продавцом
        """
        status_map = {
            0: "new",
            1: "awaiting_shipment",
            2: "delivering",  # ← КЛЮЧЕВОЙ СТАТУС ДЛЯ СПИСАНИЯ!
            3: "delivered",
            4: "cancelled",
            5: "cancelled"
        }
        
        return status_map.get(wb_status, "new")

class YandexMarketConnector(BaseConnector):
    """Yandex.Market connector - REAL API with full headers"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Yandex.Market"
        self.campaign_id = client_id
        self.oauth_token = api_key
        self.base_url = "https://api.partner.market.yandex.ru"
    
    def _get_headers(self) -> Dict[str, str]:
        """Get Yandex-specific headers with browser simulation"""
        headers = self._get_browser_headers()
        headers.update({
            "Authorization": f"Bearer {self.oauth_token}",
            "Content-Type": "application/json",
            "Origin": "https://partner.market.yandex.ru",
            "Referer": "https://partner.market.yandex.ru/"
        })
        return headers
    
    async def get_products(self) -> List[Dict[str, Any]]:
        """Get products from Yandex.Market - REAL API CALL"""
        logger.info(f"[Yandex] Fetching products for campaign {self.campaign_id}")
        
        url = f"{self.base_url}/campaigns/{self.campaign_id}/offers"
        headers = self._get_headers()
        
        params = {
            "limit": 200,
            "page_token": ""
        }
        
        all_products = []
        
        try:
            response_data = await self._make_request("GET", url, headers, params=params)
            
            offers = response_data.get('result', {}).get('offers', [])
            logger.info(f"[Yandex] Received {len(offers)} products")
            
            for offer in offers:
                all_products.append({
                    "id": offer.get('id', ''),
                    "sku": offer.get('shopSku', ''),
                    "name": offer.get('name', 'Unnamed product'),
                    "price": float(offer.get('price', 0)),
                    "stock": offer.get('stock', {}).get('count', 0) if isinstance(offer.get('stock'), dict) else 0,
                    "marketplace": "yandex",
                    "status": offer.get('availability', 'UNKNOWN'),
                    "barcode": offer.get('barcodes', [''])[0] if offer.get('barcodes') else ''
                })
            
            logger.info(f"[Yandex] Successfully transformed {len(all_products)} products")
            return all_products
            
        except MarketplaceError as e:
            logger.error(f"[Yandex] Failed to fetch products: {e.message}")
            raise
    
    async def get_warehouses(self) -> List[Dict[str, Any]]:
        """Get seller's FBS warehouses from Yandex.Market"""
        logger.info(f"[Yandex] Fetching seller's FBS warehouses for campaign {self.campaign_id}")
        
        # Get warehouses via business endpoint
        # Note: campaign_id is used as businessId in newer API
        url = f"{self.base_url}/businesses/{self.campaign_id}/warehouses"
        headers = self._get_headers()
        
        logger.info(f"[Yandex] Request URL: {url}")
        
        # POST request with campaignIds
        payload = {
            "campaignIds": [self.campaign_id],
            "components": ["STATUS"]
        }
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            
            logger.info(f"[Yandex] Raw response: {response_data}")
            
            # Parse response
            warehouses = []
            if isinstance(response_data, dict):
                result = response_data.get('result', {})
                warehouses = result.get('warehouses', [])
                if not warehouses:
                    warehouses = response_data.get('warehouses', [])
            elif isinstance(response_data, list):
                warehouses = response_data
            
            logger.info(f"[Yandex] Received {len(warehouses)} warehouses")
            
            formatted_warehouses = []
            for wh in warehouses:
                # Parse warehouse data
                wh_id = wh.get('id') or wh.get('warehouseId')
                wh_name = wh.get('name', 'Unnamed warehouse')
                
                formatted_warehouses.append({
                    "id": str(wh_id),
                    "name": wh_name,
                    "type": "FBS",
                    "is_fbs": True,
                    "address": wh.get('address', ''),
                    "status": wh.get('status', {}).get('value', 'UNKNOWN') if isinstance(wh.get('status'), dict) else 'ACTIVE'
                })
            
            logger.info(f"[Yandex] Formatted {len(formatted_warehouses)} FBS warehouses")
            return formatted_warehouses
            
        except MarketplaceError as e:
            logger.error(f"[Yandex] Failed to fetch warehouses: {e.message}")
            raise
        except Exception as e:
            logger.error(f"[Yandex] Unexpected error: {str(e)}")
            raise MarketplaceError(f"Failed to fetch Yandex warehouses: {str(e)}", 500)


    async def update_stock(self, warehouse_id: str, stocks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Обновить остатки на Yandex.Market
        
        Args:
            warehouse_id: ID склада на Yandex
            stocks: [{sku: str, count: int}, ...]
        """
        url = f"{self.base_url}/campaigns/{self.campaign_id}/offers/stocks"
        headers = self._get_headers()
        
        payload = {
            "skus": [
                {
                    "sku": item["sku"],
                    "warehouseId": int(warehouse_id),
                    "items": [
                        {
                            "count": item["count"],
                            "type": "FIT",
                            "updatedAt": datetime.utcnow().isoformat()
                        }
                    ]
                }
                for item in stocks
            ]
        }
        
        logger.info(f"[Yandex] Updating {len(stocks)} products stock on warehouse {warehouse_id}")
        
        try:
            response = await self._make_request("PUT", url, headers, json_data=payload)
            logger.info(f"[Yandex] ✅ Stock updated: {response}")
            return {
                "success": True,
                "updated": len(stocks),
                "response": response
            }
        except MarketplaceError as e:
            logger.error(f"[Yandex] Failed to update stock: {e.message}")
            raise


    async def get_stocks(self, warehouse_id: str = None) -> List[Dict[str, Any]]:
        """
        Получить остатки с Yandex.Market
        
        Args:
            warehouse_id: ID склада (опционально)
        
        Returns:
            [{sku: str, warehouseId: int, items: [{count: int, type: str}]}, ...]
        """
        url = f"{self.base_url}/campaigns/{self.campaign_id}/offers/stocks"
        headers = self._get_headers()
        
        params = {}
        if warehouse_id:
            params["warehouseId"] = warehouse_id
        
        logger.info(f"[Yandex] Getting stocks from warehouse {warehouse_id or 'all'}")
        
        try:
            response = await self._make_request("GET", url, headers, params=params)
            stocks = response.get("result", {}).get("skus", [])
            logger.info(f"[Yandex] ✅ Got {len(stocks)} stock records")
            return stocks
        except MarketplaceError as e:
            logger.error(f"[Yandex] Failed to get stocks: {e.message}")
            raise

def get_connector(marketplace: str, client_id: str, api_key: str) -> BaseConnector:
    """Factory function to get appropriate connector"""
    
    # ========== МЕТОДЫ ДЛЯ РАБОТЫ С ЗАКАЗАМИ ==========
    
    async def get_orders(self, date_from: datetime, date_to: datetime, campaign_id: str = None) -> List[Dict[str, Any]]:
        """
        Получить заказы Yandex Market за период
        
        API: GET /campaigns/{campaignId}/orders
        Docs: https://yandex.ru/dev/market/partner-api/doc/ru/reference/orders/getOrders
        
        NOTE: campaign_id можно получить из seller_profile.api_keys[].metadata.campaign_id
        """
        if not campaign_id:
            raise MarketplaceError(
                marketplace="YandexMarket",
                status_code=400,
                message="campaign_id обязателен для Yandex Market"
            )
        
        url = f"{self.base_url}/campaigns/{campaign_id}/orders"
        headers = self._get_headers()
        
        params = {
            "status": "PROCESSING,DELIVERY,DELIVERED,CANCELLED",
            "fromDate": date_from.strftime("%d-%m-%Y"),
            "toDate": date_to.strftime("%d-%m-%Y"),
            "page": 1,
            "pageSize": 50
        }
        
        all_orders = []
        
        try:
            # Пагинация (может быть несколько страниц)
            while True:
                response = await self._make_request("GET", url, headers, params=params)
                orders = response.get("orders", [])
                all_orders.extend(orders)
                
                pager = response.get("pager", {})
                current_page = pager.get("currentPage", 1)
                pages_count = pager.get("pagesCount", 1)
                
                if current_page >= pages_count:
                    break
                
                params["page"] = current_page + 1
            
            logger.info(f"[YandexMarket] Получено {len(all_orders)} заказов")
            return all_orders
            
        except MarketplaceError as e:
            logger.error(f"[YandexMarket] Ошибка получения заказов: {e.message}")
            raise
    
    async def get_order_status(self, order_id: str, campaign_id: str = None) -> Dict[str, Any]:
        """
        Получить детали конкретного заказа
        
        API: GET /campaigns/{campaignId}/orders/{orderId}
        Docs: https://yandex.ru/dev/market/partner-api/doc/ru/reference/orders/getOrder
        """
        if not campaign_id:
            raise MarketplaceError(
                marketplace="YandexMarket",
                status_code=400,
                message="campaign_id обязателен для Yandex Market"
            )
        
        url = f"{self.base_url}/campaigns/{campaign_id}/orders/{order_id}"
        headers = self._get_headers()
        
        try:
            response = await self._make_request("GET", url, headers)
            order = response.get("order", {})
            
            logger.info(f"[YandexMarket] Получен статус заказа {order_id}")
            return order
            
        except MarketplaceError as e:
            logger.error(f"[YandexMarket] Ошибка получения статуса заказа {order_id}: {e.message}")
            raise
    
    def map_yandex_status_to_internal(self, yandex_status: str, substatus: str = None) -> str:
        """
        Маппинг статусов Yandex Market на внутренние статусы системы
        
        Yandex статусы:
        - RESERVED: зарезервирован
        - PROCESSING: в обработке
        - DELIVERY: передан в доставку
        - PICKUP: готов к выдаче
        - DELIVERED: доставлен
        - CANCELLED: отменён
        - RETURNED: возвращён
        """
        status_map = {
            "RESERVED": "new",
            "PROCESSING": "awaiting_shipment",
            "DELIVERY": "delivering",  # ← КЛЮЧЕВОЙ СТАТУС ДЛЯ СПИСАНИЯ!
            "PICKUP": "delivering",
            "DELIVERED": "delivered",
            "CANCELLED": "cancelled",
            "RETURNED": "cancelled"
        }
        
        return status_map.get(yandex_status, "new")


    connectors = {
        "ozon": OzonConnector,
        "wb": WildberriesConnector,
        "yandex": YandexMarketConnector
    }
    
    connector_class = connectors.get(marketplace)
    if not connector_class:
        raise ValueError(f"Unknown marketplace: {marketplace}")
    
    return connector_class(client_id, api_key)

