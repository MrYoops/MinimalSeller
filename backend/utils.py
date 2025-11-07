import re
from typing import List, Dict, Any
from datetime import datetime

def extract_investor_tag(sku: str) -> str:
    """
    Извлекает тег инвестора из SKU.
    Пример: "PRODUCT-NAME-db15" -> "db15"
    """
    parts = sku.split('-')
    if len(parts) > 1:
        last_part = parts[-1]
        # Проверяем, что последняя часть выглядит как тег (буквы+цифры)
        if re.match(r'^[a-z]{2,}\d+$', last_part.lower()):
            return last_part.lower()
    return ""

def generate_url_slug(name: str) -> str:
    """
    Генерирует URL slug из названия товара.
    Пример: "Product Name 123" -> "product-name-123"
    """
    slug = name.lower()
    # Заменяем пробелы на дефисы
    slug = re.sub(r'\s+', '-', slug)
    # Убираем все кроме букв, цифр и дефисов
    slug = re.sub(r'[^a-z0-9\-]', '', slug)
    # Убираем множественные дефисы
    slug = re.sub(r'-+', '-', slug)
    # Убираем дефисы в начале и конце
    slug = slug.strip('-')
    return slug

def calculate_listing_quality_score(product: Dict[str, Any]) -> Dict[str, float]:
    """
    Рассчитывает оценку качества карточки товара.
    """
    minimalmod = product.get('minimalmod', {})
    
    # Оценка названия (0-25)
    name = minimalmod.get('name', '')
    name_score = min(25, len(name.split()) * 5)  # 5 баллов за слово, max 25
    
    # Оценка описания (0-30)
    description = minimalmod.get('description', '')
    desc_words = len(description.split())
    if desc_words >= 50:
        description_score = 30
    elif desc_words >= 30:
        description_score = 20
    elif desc_words >= 10:
        description_score = 10
    else:
        description_score = 5
    
    # Оценка изображений (0-25)
    images = minimalmod.get('images', [])
    images_score = min(25, len(images) * 5)  # 5 баллов за изображение, max 25
    
    # Оценка атрибутов (0-20)
    attributes = minimalmod.get('attributes', {})
    attributes_score = min(20, len(attributes) * 4)  # 4 балла за атрибут, max 20
    
    total = name_score + description_score + images_score + attributes_score
    
    return {
        'total': total,
        'name_score': name_score,
        'description_score': description_score,
        'images_score': images_score,
        'attributes_score': attributes_score
    }

def get_quality_level(score: float) -> str:
    """
    Возвращает уровень качества на основе оценки.
    """
    if score >= 80:
        return "high"
    elif score >= 50:
        return "medium"
    else:
        return "low"

def prepare_product_response(product: Dict[str, Any]) -> Dict[str, Any]:
    """
    Подготавливает товар для ответа API.
    """
    product['id'] = str(product.pop('_id'))
    product['seller_id'] = str(product['seller_id'])
    if product.get('category_id'):
        product['category_id'] = str(product['category_id'])
    return product

def auto_match_products_by_sku(
    local_products: List[Dict[str, Any]], 
    marketplace_products: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Автоматически сопоставляет товары по SKU.
    """
    matches = []
    marketplace_map = {p['sku']: p for p in marketplace_products if 'sku' in p}
    
    for local_product in local_products:
        local_sku = local_product.get('sku', '')
        if local_sku in marketplace_map:
            matches.append({
                'product_id': str(local_product['_id']),
                'marketplace_product': marketplace_map[local_sku]
            })
    
    return matches
