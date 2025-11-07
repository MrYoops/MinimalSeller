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
    """Wildberries marketplace connector (Mock)"""
    
    def __init__(self, client_id: str, api_key: str):
        super().__init__(client_id, api_key)
        self.marketplace_name = "Wildberries"
    
    async def get_orders(self, date_from: datetime, date_to: datetime) -> List[Dict[str, Any]]:
        logger.info(f"[MOCK] Getting orders from Wildberries for period {date_from} - {date_to}")
        return [
            {
                "order_id": "WB-67890",
                "created_at": datetime.utcnow(),
                "status": "new",
                "products": [
                    {"sku": "SKU002", "name": "Product 2", "quantity": 1, "price": 2500}
                ],
                "total": 2500
            }
        ]
    
    async def update_stocks(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        logger.info(f"[MOCK] Updating stocks on Wildberries for {len(products)} products")
        return {"status": "success", "updated": len(products)}
    
    async def get_products(self) -> List[Dict[str, Any]]:
        logger.info("[MOCK] Getting products from Wildberries")
        return []
    
    async def get_fbo_stocks(self) -> List[Dict[str, Any]]:
        logger.info("[MOCK] Getting FBO stocks from Wildberries")
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