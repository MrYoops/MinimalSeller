import pytest
from motor.motor_asyncio import AsyncIOMotorClient

@pytest.fixture
def mock_db():
    """Mock базы данных для тестов"""
    return AsyncIOMotorClient("mongodb://localhost:27017").test_db

@pytest.fixture
def sample_product_data():
    """Примерные данные товара для тестов"""
    return {
        "article": "TEST-001",
        "name": "Test Product",
        "price": 1500,
        "ozon_category_id": 12345,
        "ozon_type_id": 67890,
        "dimensions": {
            "height": 100,
            "width": 200,
            "length": 300
        },
        "weight": 500,
        "photos": ["https://example.com/photo1.jpg"]
    }
