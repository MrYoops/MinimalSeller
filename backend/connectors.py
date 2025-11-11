# Real connectors for marketplaces - NO MOCK DATA!
# Full implementation with error handling

import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import asyncio

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
    
    async def _make_request(
        self,
        method: str,
        url: str,
        headers: Dict[str, str],
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=True) as client:
                logger.info(f"[{self.marketplace_name}] {method} {url}")
                
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
                        error_message = error_json.get('message') or error_json.get('error') or error_json.get('detail') or error_text
                    except:
                        error_message = error_text
                    
                    logger.error(f"[{self.marketplace_name}] API Error: {error_message}")
                    raise MarketplaceError(
                        marketplace=self.marketplace_name,
                        status_code=response.status_code,
                        message=error_message,
                        details=error_text
                    )
                
                return response.json()
                
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
                message="Cannot connect to marketplace server"
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

# Connectors in next file

class OzonConnector(BaseConnector):
    """Ozon marketplace connector - REAL API"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Ozon"
        self.base_url = "https://api-seller.ozon.ru"
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Client-Id": self.client_id,
            "Api-Key": self.api_key,
            "Content-Type": "application/json"
        }
    
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
                    "status": item.get('status', {}).get('state', 'unknown'),
                    "barcode": item.get('barcode', '')
                })
            
            logger.info(f"[Ozon] Successfully transformed {len(all_products)} products")
            return all_products
            
        except MarketplaceError as e:
            logger.error(f"[Ozon] Failed to fetch products: {e.message}")
            raise

class WildberriesConnector(BaseConnector):
    """Wildberries marketplace connector - REAL API"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Wildberries"
        self.api_token = api_key
        self.content_api_url = "https://content-api.wildberries.ru"
        self.marketplace_api_url = "https://marketplace-api.wildberries.ru"
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": self.api_token,
            "Content-Type": "application/json"
        }
    
    async def get_products(self) -> List[Dict[str, Any]]:
        """Get products from Wildberries - REAL API CALL"""
        logger.info("[WB] Fetching products from Content API (v2/get/cards/list)")
        
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
            logger.info(f"[WB] Received {len(cards)} products")
            
            for card in cards:
                sizes = card.get('sizes', [])
                for size in sizes:
                    all_products.append({
                        "id": str(card.get('nmID', '')),
                        "sku": size.get('skus', [''])[0],
                        "name": card.get('title', 'Unnamed product'),
                        "price": 0,
                        "stock": 0,
                        "marketplace": "wb",
                        "barcode": size.get('skus', [''])[0],
                        "size": size.get('techSize', '')
                    })
            
            logger.info(f"[WB] Successfully transformed {len(all_products)} products")
            return all_products
            
        except MarketplaceError as e:
            logger.error(f"[WB] Failed to fetch products: {e.message}")
            raise
