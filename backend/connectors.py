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
        """Get products from Ozon with full details (images, attributes)"""
        logger.info("[Ozon] Fetching products with full details")
        
        # Step 1: Get list of all products
        list_url = f"{self.base_url}/v3/product/list"
        headers = self._get_headers()
        
        list_payload = {
            "filter": {
                "visibility": "ALL"
            },
            "last_id": "",
            "limit": 100
        }
        
        logger.info(f"[Ozon] Step 1: Getting product list")
        
        all_products = []
        
        try:
            # Get product list
            list_response = await self._make_request("POST", list_url, headers, json_data=list_payload)
            items = list_response.get('result', {}).get('items', [])
            logger.info(f"[Ozon] Received {len(items)} products")
            
            if not items:
                return all_products
            
            # Step 2: Get full info for each product (in batches)
            info_url = f"{self.base_url}/v2/product/info/list"
            
            # Prepare product IDs
            product_ids = [item.get('product_id') for item in items if item.get('product_id')]
            offer_ids = [item.get('offer_id') for item in items if item.get('offer_id')]
            
            logger.info(f"[Ozon] Step 2: Getting full info for {len(offer_ids)} products")
            
            # Get full info
            info_payload = {
                "offer_id": offer_ids[:100],  # Max 100 per request
                "product_id": [],
                "sku": []
            }
            
            try:
                info_response = await self._make_request("POST", info_url, headers, json_data=info_payload)
                detailed_items = info_response.get('result', {}).get('items', [])
                logger.info(f"[Ozon] Received full info for {len(detailed_items)} products")
                
                # Transform to standard format
                for detailed in detailed_items:
                    # Extract images
                    images = []
                    for img in detailed.get('images', []):
                        img_url = img.get('file_name') or img.get('url')
                        if img_url:
                            images.append(img_url)
                    
                    # Extract primary image
                    primary_image = detailed.get('primary_image', '')
                    if primary_image and primary_image not in images:
                        images.insert(0, primary_image)
                    
                    all_products.append({
                        "id": str(detailed.get('id', '')),
                        "sku": detailed.get('offer_id', ''),
                        "name": detailed.get('name', 'Unnamed product'),
                        "description": detailed.get('description', ''),
                        "price": 0,
                        "stock": 0,
                        "images": images,
                        "attributes": detailed.get('attributes', []),
                        "category": detailed.get('category_name', ''),
                        "marketplace": "ozon",
                        "status": 'archived' if detailed.get('archived') else 'active',
                        "barcode": detailed.get('barcode', '')
                    })
                
                logger.info(f"[Ozon] Successfully transformed {len(all_products)} products with full details")
                return all_products
                
            except MarketplaceError as e:
                # If /v2/product/info/list fails, fallback to basic data
                logger.warning(f"[Ozon] Failed to get full info: {e.message}, using basic data")
                
                for item in items:
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
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to fetch products: {e.message}")
            raise
    
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
            # Используем дефолтную категорию для кроссовок
            product_data['ozon_category_id'] = 15621048  # Повседневная обувь
            logger.warning("[Ozon] No category specified, using default: 15621048 (Повседневная обувь)")
        
        if not product_data.get('ozon_type_id'):
            product_data['ozon_type_id'] = 91248  # Кроссовки
            logger.warning("[Ozon] No type_id specified, using default: 91248 (Кроссовки)")
        
        # Подготовить payload для Ozon v3
        # VAT должен быть в формате 0..1 (0.2 = 20%)
        vat_decimal = product_data.get('vat', 0) / 100 if product_data.get('vat', 0) > 1 else product_data.get('vat', 0)
        
        # ВАЛИДАЦИЯ: description_category_id и type_id ДОЛЖНЫ быть int
        category_id = product_data.get('ozon_category_id')
        type_id = product_data.get('ozon_type_id')
        
        # Преобразовать в int если возможно
        if isinstance(category_id, str):
            try:
                category_id = int(category_id) if category_id.isdigit() else 15621048
            except:
                category_id = 15621048
        elif not category_id or not isinstance(category_id, int):
            category_id = 15621048
        
        if isinstance(type_id, str):
            try:
                type_id = int(type_id) if type_id.isdigit() else 91248
            except:
                type_id = 91248
        elif not type_id or not isinstance(type_id, int):
            type_id = 91248
        
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
        Получить остатки с Ozon
        
        Args:
            warehouse_id: ID склада FBS (опционально)
        
        Returns:
            [{offer_id: str, product_id: int, stock: int, warehouse_id: int}, ...]
        """
        url = f"{self.base_url}/v3/product/info/stocks"
        headers = self._get_headers()
        
        payload = {
            "filter": {},
            "last_id": "",
            "limit": 1000
        }
        
        if warehouse_id:
            payload["filter"]["warehouse_id"] = int(warehouse_id)
        
        logger.info(f"[Ozon] Getting stocks from warehouse {warehouse_id or 'all'}")
        
        try:
            response = await self._make_request("POST", url, headers, json_data=payload)
            stocks = response.get("result", {}).get("stocks", [])
            logger.info(f"[Ozon] ✅ Got {len(stocks)} stock records")
            return stocks
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to get stocks: {e.message}")
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
    connectors = {
        "ozon": OzonConnector,
        "wb": WildberriesConnector,
        "yandex": YandexMarketConnector
    }
    
    connector_class = connectors.get(marketplace)
    if not connector_class:
        raise ValueError(f"Unknown marketplace: {marketplace}")
    
    return connector_class(client_id, api_key)

