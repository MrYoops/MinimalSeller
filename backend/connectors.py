# Mock connectors for marketplaces
# Real implementation will be added later

from typing import List, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class BaseConnector:
    """Base class for marketplace connectors"""
    
    def __init__(self, client_id: str, api_key: str):
        self.client_id = client_id
        self.api_key = api_key
        self.marketplace_name = "Base"
    
    async def get_orders(self, date_from: datetime, date_to: datetime) -> List[Dict[str, Any]]:
        """Get orders from marketplace"""
        raise NotImplementedError
    
    async def update_stocks(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update product stocks on marketplace"""
        raise NotImplementedError
    
    async def get_products(self) -> List[Dict[str, Any]]:
        """Get all products from marketplace"""
        raise NotImplementedError
    
    async def get_fbo_stocks(self) -> List[Dict[str, Any]]:
        """Get FBO stocks from marketplace"""
        raise NotImplementedError

class OzonConnector(BaseConnector):
    """Ozon marketplace connector (Mock)"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Ozon"
    
    async def get_orders(self, date_from: datetime, date_to: datetime) -> List[Dict[str, Any]]:
        logger.info(f"[MOCK] Getting orders from Ozon for period {date_from} - {date_to}")
        # Mock data
        return [
            {
                "order_id": "OZON-12345",
                "created_at": datetime.utcnow(),
                "status": "awaiting_deliver",
                "products": [
                    {"sku": "SKU001", "name": "Product 1", "quantity": 2, "price": 1500}
                ],
                "total": 3000
            }
        ]
    
    async def update_stocks(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        logger.info(f"[MOCK] Updating stocks on Ozon for {len(products)} products")
        return {"status": "success", "updated": len(products)}
    
    async def get_products(self) -> List[Dict[str, Any]]:
        logger.info("[MOCK] Getting products from Ozon")
        return []
    
    async def get_fbo_stocks(self) -> List[Dict[str, Any]]:
        logger.info("[MOCK] Getting FBO stocks from Ozon")
        return []

class WildberriesConnector(BaseConnector):
    """Wildberries marketplace connector (Real API)"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Wildberries"
        self.api_token = api_key  # JWT token
        self.base_url = "https://suppliers-api.wildberries.ru"
    
    async def get_products(self) -> List[Dict[str, Any]]:
        """Get all products from Wildberries"""
        logger.info("[WB] Getting products using API token")
        
        # MOCK данные для демонстрации (в продакшене будет реальный API)
        # В реальной системе здесь запрос к suppliers-api.wildberries.ru
        mock_products = [
            {
                "id": "123456789",
                "sku": "WB-PRODUCT-001",
                "name": "Товар 1 с Wildberries",
                "price": 1500,
                "images": ["https://via.placeholder.com/400?text=WB+Product+1"]
            },
            {
                "id": "123456790",
                "sku": "WB-PRODUCT-002",
                "name": "Товар 2 с Wildberries",
                "price": 2500,
                "images": ["https://via.placeholder.com/400?text=WB+Product+2"]
            },
            {
                "id": "123456791",
                "sku": "WB-PRODUCT-003",
                "name": "Товар 3 с Wildberries",
                "price": 3500,
                "images": ["https://via.placeholder.com/400?text=WB+Product+3"]
            }
        ]
        
        logger.info(f"[WB] Returning {len(mock_products)} mock products")
        return mock_products
        
        # РЕАЛЬНЫЙ КОД (раскомментировать для продакшена):
        # import httpx
        # try:
        #     headers = {"Authorization": self.api_token}
        #     async with httpx.AsyncClient(timeout=30.0) as client:
        #         response = await client.get(
        #             "https://suppliers-api.wildberries.ru/content/v1/cards/cursor/list",
        #             headers=headers,
        #             params={"limit": 100}
        #         )
        #         if response.status_code == 200:
        #             data = response.json()
        #             cards = data.get("data", {}).get("cards", [])
        #             products = []
        #             for card in cards:
        #                 products.append({
        #                     "id": str(card.get("nmID", "")),
        #                     "sku": card.get("vendorCode", ""),
        #                     "name": card.get("object", ""),
        #                     "price": 0,
        #                     "images": [card.get("mediaFiles", [{}])[0].get("url", "")] if card.get("mediaFiles") else []
        #                 })
        #             return products
        # except Exception as e:
        #     logger.error(f"[WB API] Error: {str(e)}")
        # return []
    
    async def get_orders(self, date_from: datetime, date_to: datetime) -> List[Dict[str, Any]]:
        logger.info(f"[WB API] Getting orders for period {date_from} - {date_to}")
        # TODO: Implement real orders API
        return []
    
    async def update_stocks(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        logger.info(f"[WB API] Updating stocks for {len(products)} products")
        # TODO: Implement real stocks update
        return {"status": "success", "updated": len(products)}
    
    async def get_fbo_stocks(self) -> List[Dict[str, Any]]:
        logger.info("[WB API] Getting FBO stocks")
        return []

class YandexConnector(BaseConnector):
    """Yandex.Market connector (Mock)"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Yandex.Market"
    
    async def get_orders(self, date_from: datetime, date_to: datetime) -> List[Dict[str, Any]]:
        logger.info(f"[MOCK] Getting orders from Yandex.Market for period {date_from} - {date_to}")
        return []
    
    async def update_stocks(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        logger.info(f"[MOCK] Updating stocks on Yandex.Market for {len(products)} products")
        return {"status": "success", "updated": len(products)}
    
    async def get_products(self) -> List[Dict[str, Any]]:
        logger.info("[MOCK] Getting products from Yandex.Market")
        return []
    
    async def get_fbo_stocks(self) -> List[Dict[str, Any]]:
        logger.info("[MOCK] Getting FBO stocks from Yandex.Market")
        return []

def get_connector(marketplace: str, client_id: str, api_key: str) -> BaseConnector:
    """Factory function to get appropriate connector"""
    connectors = {
        "ozon": OzonConnector,
        "wb": WildberriesConnector,
        "yandex": YandexConnector
    }
    
    connector_class = connectors.get(marketplace.lower())
    if not connector_class:
        raise ValueError(f"Unknown marketplace: {marketplace}")
    
    return connector_class(client_id, api_key)