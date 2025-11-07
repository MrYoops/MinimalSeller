"""
Скрипт для создания тестовых данных в MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from bson import ObjectId
import random

MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "minimalmod"

async def create_test_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    print("🔄 Создание тестовых данных...")
    
    # Получаем seller_id
    seller = await db.users.find_one({"email": "seller@test.com"})
    if not seller:
        print("❌ Seller не найден")
        return
    
    seller_id = seller['_id']
    print(f"✅ Seller ID: {seller_id}")
    
    # 1. Создаем несколько товаров
    products = []
    for i in range(5):
        product = {
            'seller_id': seller_id,
            'sku': f'PRODUCT-{i+1}-db{15+i}',
            'price': 1000 + (i * 500),
            'category_id': None,
            'status': 'active' if i < 3 else 'draft',
            'visibility': {
                'show_on_minimalmod': True,
                'show_in_search': True,
                'is_featured': i == 0
            },
            'seo': {
                'meta_title': f'Product {i+1}',
                'meta_description': '',
                'url_slug': f'product-{i+1}'
            },
            'dates': {
                'created_at': datetime.utcnow() - timedelta(days=i),
                'updated_at': datetime.utcnow(),
                'published_at': datetime.utcnow() if i < 3 else None
            },
            'minimalmod': {
                'name': f'Test Product {i+1}',
                'variant_name': f'Variant {i+1}',
                'description': f'This is a detailed description for test product {i+1}. ' * 5,
                'tags': [f'db{15+i}', 'test', f'category{i%3}'],
                'images': [f'https://via.placeholder.com/400?text=Product{i+1}'],
                'attributes': {'Color': 'Black', 'Size': 'M'}
            },
            'marketplaces': {
                'images': [],
                'ozon': {'enabled': i % 2 == 0, 'name': f'Ozon Product {i+1}', 'description': '', 'category_id': '', 'attributes': {}},
                'wildberries': {'enabled': False, 'name': '', 'description': '', 'category_id': '', 'attributes': {}},
                'yandex_market': {'enabled': False, 'name': '', 'description': '', 'category_id': '', 'attributes': {}}
            },
            'listing_quality_score': {
                'total': 50 + (i * 10),
                'name_score': 15,
                'description_score': 20 + i,
                'images_score': 5,
                'attributes_score': 10
            }
        }
        result = await db.products.insert_one(product)
        product['_id'] = result.inserted_id
        products.append(product)
    
    print(f"✅ Создано {len(products)} товаров")
    
    # 2. Создаем остатки на складе (inventory)
    for product in products[:3]:
        inventory = {
            'product_id': product['_id'],
            'seller_id': seller_id,
            'sku': product['sku'],
            'quantity': 100 + (random.randint(0, 50)),
            'reserved': random.randint(0, 10),
            'available': 0,
            'alert_threshold': 10
        }
        inventory['available'] = inventory['quantity'] - inventory['reserved']
        await db.inventory.insert_one(inventory)
    
    print(f"✅ Создано остатков на складе")
    
    # 3. Создаем историю движений
    for product in products[:2]:
        await db.inventory_history.insert_one({
            'product_id': product['_id'],
            'operation_type': 'manual_in',
            'quantity_change': 100,
            'reason': 'Initial stock',
            'user_id': seller_id,
            'created_at': datetime.utcnow() - timedelta(days=5)
        })
        
        await db.inventory_history.insert_one({
            'product_id': product['_id'],
            'operation_type': 'sale',
            'quantity_change': -5,
            'reason': 'Order #MM-001',
            'user_id': seller_id,
            'created_at': datetime.utcnow() - timedelta(days=2)
        })
    
    print(f"✅ Создана история движений")
    
    # 4. Создаем заказы
    for i in range(3):
        order = {
            'order_number': f'MM-{1000+i}',
            'seller_id': seller_id,
            'source': ['minimalmod', 'ozon', 'wildberries'][i % 3],
            'source_order_id': f'SRC-{i+1}',
            'status': ['new', 'awaiting_shipment', 'shipped'][i],
            'customer': {
                'name': f'Customer {i+1}',
                'email': f'customer{i+1}@test.com',
                'phone': '+79001234567'
            },
            'items': [{
                'product_id': str(products[i]['_id']),
                'sku': products[i]['sku'],
                'name': products[i]['minimalmod']['name'],
                'quantity': 2,
                'price': products[i]['price'],
                'total': products[i]['price'] * 2
            }],
            'totals': {
                'subtotal': products[i]['price'] * 2,
                'shipping_cost': 300,
                'marketplace_commission': 0,
                'seller_payout': products[i]['price'] * 2 + 300,
                'total': products[i]['price'] * 2 + 300
            },
            'payment': {
                'status': 'paid' if i < 2 else 'pending',
                'method': 'card'
            },
            'shipping': {
                'method': 'cdek_courier',
                'address': 'Moscow, Test Street 123',
                'tracking_number': f'CDEK-{i+1}' if i > 0 else '',
                'status': ''
            },
            'dates': {
                'created_at': datetime.utcnow() - timedelta(days=i+1),
                'updated_at': datetime.utcnow(),
                'shipped_at': datetime.utcnow() if i == 2 else None
            }
        }
        await db.orders.insert_one(order)
    
    print(f"✅ Создано 3 заказа")
    
    # 5. Создаем возврат
    await db.returns.insert_one({
        'order_id': ObjectId(),
        'seller_id': seller_id,
        'status': 'pending_review',
        'reason': 'Defective product',
        'items': [{
            'product_id': str(products[0]['_id']),
            'sku': products[0]['sku'],
            'quantity': 1
        }],
        'dates': {
            'created_at': datetime.utcnow() - timedelta(days=1),
            'updated_at': datetime.utcnow()
        }
    })
    
    print(f"✅ Создан возврат")
    
    print("\n🎉 Тестовые данные созданы успешно!")
    print(f"📊 Итого:")
    print(f"   - {len(products)} товаров")
    print(f"   - 3 остатка на складе")
    print(f"   - 4 записи в истории")
    print(f"   - 3 заказа")
    print(f"   - 1 возврат")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_data())
