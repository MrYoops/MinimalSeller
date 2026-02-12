import pytest
from unittest.mock import AsyncMock, patch
from connectors import WildberriesConnector

@pytest.mark.asyncio
async def test_wb_get_products_success():
    """Тест получения товаров с WB"""
    connector = WildberriesConnector(client_id="", api_key="test_key")
    
    mock_response = {
        "cards": [
            {
                "nmID": 123456,
                "vendorCode": "WB-TEST-001",
                "title": "Test Product WB",
                "photos": [
                    {"big": "https://example.com/photo.jpg", "c516x688": "https://example.com/photo.jpg"}
                ],
                "sizes": [
                    {
                        "skus": ["1234567890"],
                        "techSize": "42"
                    }
                ],
                "subjectID": 123,
                "subjectName": "Test Category"
            }
        ]
    }
    
    with patch.object(connector, '_make_request', new=AsyncMock(return_value=mock_response)):
        products = await connector.get_products()
        
        assert len(products) > 0
        assert products[0]["sku"] == "WB-TEST-001"

@pytest.mark.asyncio
async def test_wb_update_prices():
    """Тест обновления цен на WB"""
    connector = WildberriesConnector(client_id="", api_key="test_key")
    
    prices = [
        {"nm_id": 123456, "price": 2000}
    ]
    
    mock_response = {"success": True}
    
    with patch.object(connector, '_make_request', new=AsyncMock(return_value=mock_response)):
        result = await connector.update_prices(prices)
        
        assert result["success"] == True
