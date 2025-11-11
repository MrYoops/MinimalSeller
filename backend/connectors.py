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
        """Get products from Ozon - REAL API CALL"""
        logger.info("[Ozon] Fetching products from API (v3/product/list)")
        
        url = f"{self.base_url}/v3/product/list"
        headers = self._get_headers()
        
        payload = {
            "filter": {
                "visibility": "ALL"
            },
            "last_id": "",
            "limit": 100
        }
        
        all_products = []
        
        try:
            response_data = await self._make_request("POST", url, headers, json_data=payload)
            
            items = response_data.get('result', {}).get('items', [])
            logger.info(f"[Ozon] Received {len(items)} products")
            
            # Transform to unified format
            for item in items:
                all_products.append({
                    "id": str(item.get('product_id', '')),
                    "sku": item.get('offer_id', ''),
                    "name": item.get('name', 'Unnamed product'),
                    "price": float(item.get('price', 0)),
                    "stock": 0,
                    "marketplace": "ozon",
                    "status": item.get('status', {}).get('state', 'unknown') if isinstance(item.get('status'), dict) else str(item.get('status', 'unknown')),
                    "barcode": item.get('barcode', '')
                })
            
            logger.info(f"[Ozon] Successfully transformed {len(all_products)} products")
            return all_products
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to fetch products: {e.message}")
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
