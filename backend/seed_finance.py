import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import random

MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "minimalmod"

async def create_finance_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    print("💰 Создание финансовых данных...")
    
    seller = await db.users.find_one({"email": "seller@test.com"})
    if not seller:
        print("❌ Seller не найден")
        return
    
    seller_id = seller['_id']
    
    # Получаем товары
    products = await db.products.find({'seller_id': seller_id}).to_list(length=100)
    
    # Создаем финансовые транзакции
    marketplaces = ['ozon', 'wildberries', 'yandex_market']
    
    for i in range(30):
        product = random.choice(products) if products else None
        if not product:
            continue
            
        revenue = random.uniform(1000, 5000)
        commission = revenue * 0.15
        logistics = random.uniform(100, 300)
        cogs = revenue * 0.4
        
        transaction = {
            'seller_id': seller_id,
            'marketplace': random.choice(marketplaces),
            'transaction_date': datetime.utcnow() - timedelta(days=random.randint(0, 30)),
            'sku': product['sku'],
            'revenue': round(revenue, 2),
            'costs': {
                'commission': round(commission, 2),
                'logistics': round(logistics, 2),
                'storage': round(random.uniform(50, 150), 2),
                'advertising': round(random.uniform(0, 200), 2),
                'penalties': 0
            },
            'cogs': round(cogs, 2),
            'net_profit': 0
        }
        
        total_costs = sum(transaction['costs'].values())
        transaction['net_profit'] = round(revenue - total_costs - cogs, 2)
        
        await db.finance_transactions.insert_one(transaction)
    
    print(f"✅ Создано 30 финансовых транзакций")
    
    # Создаем запросы на выплату
    for i in range(3):
        payout = {
            'seller_id': seller_id,
            'amount': 10000 + (i * 5000),
            'status': ['pending', 'approved', 'paid'][i],
            'created_at': datetime.utcnow() - timedelta(days=i*2),
            'updated_at': datetime.utcnow()
        }
        await db.payout_requests.insert_one(payout)
    
    print(f"✅ Создано 3 запроса на выплату")
    
    # Создаем категории
    categories = [
        {'name': 'Electronics', 'parent_id': None},
        {'name': 'Clothing', 'parent_id': None},
        {'name': 'Home & Garden', 'parent_id': None}
    ]
    
    for cat in categories:
        cat['order'] = 0
        cat['created_at'] = datetime.utcnow()
        await db.categories.insert_one(cat)
    
    print(f"✅ Создано 3 категории")
    
    print("\n🎉 Финансовые данные созданы!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_finance_data())
