import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from bson import ObjectId

MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "minimalmod"

async def create_marketing_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    print("🚀 Создание маркетинговых данных...")
    
    seller = await db.users.find_one({"email": "seller@test.com"})
    if not seller:
        print("❌ Seller не найден")
        return
    
    seller_id = seller['_id']
    products = await db.products.find({'seller_id': seller_id}).to_list(length=100)
    
    # Промокоды
    promocodes = [
        {
            'seller_id': seller_id,
            'code': 'SUMMER10',
            'discount_type': 'percent',
            'discount_value': 10,
            'min_order_amount': 1000,
            'max_uses': 100,
            'current_uses': 5,
            'expires_at': datetime.utcnow() + timedelta(days=30),
            'status': 'active',
            'created_at': datetime.utcnow() - timedelta(days=5)
        },
        {
            'seller_id': seller_id,
            'code': 'NEWCLIENT',
            'discount_type': 'fixed',
            'discount_value': 500,
            'min_order_amount': 2000,
            'max_uses': 50,
            'current_uses': 0,
            'expires_at': datetime.utcnow() + timedelta(days=60),
            'status': 'pending_approval',
            'created_at': datetime.utcnow()
        }
    ]
    
    for promo in promocodes:
        await db.promocodes.insert_one(promo)
    
    print(f"✅ Создано 2 промокода")
    
    # Вопросы о товарах
    if products:
        for i in range(3):
            question = {
                'product_id': products[i % len(products)]['_id'],
                'customer_name': f'Customer {i+1}',
                'customer_email': f'customer{i+1}@test.com',
                'question': f'Question about this product: Is this product suitable for daily use?',
                'answer': 'Yes, this product is perfect for daily use!' if i == 0 else None,
                'status': 'answered' if i == 0 else 'pending',
                'created_at': datetime.utcnow() - timedelta(days=i),
                'answered_at': datetime.utcnow() - timedelta(hours=12) if i == 0 else None
            }
            await db.product_questions.insert_one(question)
        
        print(f"✅ Создано 3 вопроса о товарах")
        
        # Отзывы
        for i in range(4):
            review = {
                'product_id': products[i % len(products)]['_id'],
                'customer_name': f'Buyer {i+1}',
                'customer_email': f'buyer{i+1}@test.com',
                'rating': 4 + (i % 2),
                'text': f'Great product! Very satisfied with the quality. Would recommend!',
                'seller_reply': 'Thank you for your feedback!' if i < 2 else None,
                'status': 'answered' if i < 2 else 'pending',
                'created_at': datetime.utcnow() - timedelta(days=i+1),
                'replied_at': datetime.utcnow() - timedelta(hours=6) if i < 2 else None
            }
            await db.product_reviews.insert_one(review)
        
        print(f"✅ Создано 4 отзыва")
    
    print("\n🎉 Маркетинговые данные созданы!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_marketing_data())
