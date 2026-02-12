import pytest
from unittest.mock import AsyncMock, patch
from connectors import OzonConnector, MarketplaceError

@pytest.mark.asyncio
async def test_ozon_get_products_success():
    """Тест успешного получения товаров с Ozon"""
    connector = OzonConnector(client_id="test_client", api_key="test_key")
    
    # Mock ответа API
    mock_response = {
        "result": {
            "items": [
                {
                    "product_id": 123,
                    "offer_id": "TEST-001",
                    "name": "Test Product"
                }
            ],
            "last_id": ""
        }
    }
    
    with patch.object(connector, '_make_request', new=AsyncMock(return_value=mock_response)):
        products = await connector.get_products()
        
        assert len(products) > 0
        assert products[0]["sku"] == "TEST-001"
        assert products[0]["name"] == "Test Product"

@pytest.mark.asyncio
async def test_ozon_create_product_missing_category():
    """Тест создания товара без категории - должна быть ошибка"""
    connector = OzonConnector(client_id="test_client", api_key="test_key")
    
    product_data = {
        "article": "TEST-001",
        "name": "Test Product"
        # Нет ozon_category_id!
    }
    
    with pytest.raises(MarketplaceError) as exc_info:
        await connector.create_product(product_data)
    
    assert "категори" in exc_info.value.message.lower()

@pytest.mark.asyncio
async def test_ozon_update_stock_success(sample_product_data):
    """Тест обновления остатков"""
    connector = OzonConnector(client_id="test_client", api_key="test_key")
    
    stocks = [
        {"offer_id": "TEST-001", "stock": 10}
    ]
    
    mock_response = {"success": True}
    
    with patch.object(connector, '_make_request', new=AsyncMock(return_value=mock_response)):
        result = await connector.update_stock(warehouse_id="123", stocks=stocks)
        
        assert result["success"] == True
        assert result["updated"] == 1
