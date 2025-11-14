# Real connectors for marketplaces - FULL BROWSER HEADERS
# Complete implementation with CORS-compatible headers

import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

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
                if response.status_code not in [200, 201]:
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
                
                try:
                    return response.json()
                except:
                    # If response is not JSON, return text
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
        
        # CORRECT endpoint to get ALL products: /v3/product/list (not /v3/product/info/list)
        # /v3/product/info/list requires specific IDs, while /v3/product/list can get all products
        list_url = f"{self.base_url}/v3/product/list"
        headers = self._get_headers()
        
        # Correct payload format for v3/product/list
        list_payload = {
            "filter": {
                "visibility": "ALL"
            },
            "last_id": "",
            "limit": 100
        }
        
        logger.info(f"[Ozon] Payload being sent: {list_payload}")
        
        all_products = []
        
        try:
            # Get product list with full info
            list_response = await self._make_request("POST", list_url, headers, json_data=list_payload)
            items = list_response.get('result', {}).get('items', [])
            logger.info(f"[Ozon] Received {len(items)} products")
            
            if items:
                logger.info(f"[Ozon] Sample item from /v3/product/list: {items[0]}")
            
            if not items:
                return all_products
            
            # For now, just use the data from /v3/product/list
            # TODO: Fix /v3/product/info/list to get full details (images, attributes)
            for item in items:
                all_products.append({
                    "id": str(item.get('product_id', '')),
                    "sku": item.get('offer_id', ''),
                    "name": item.get('offer_id', 'Unnamed product'),  # /v3/product/list doesn't return name
                    "description": '',
                    "price": 0,  # /v3/product/list doesn't return price
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
                            "category": card.get('object', ''),
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
                        "category": card.get('object', ''),
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

