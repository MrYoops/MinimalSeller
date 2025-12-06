"""
Seed script для добавления тестовых финансовых транзакций
Это позволит протестировать отчет по прибыли
"""

import asyncio
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = "minimalmod"

async def seed_financial_transactions():
    """Добавить тестовые финансовые транзакции"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    print("🌱 Начинаю добавление тестовых финансовых транзакций...")
    
    # Получаем тестового продавца
    seller = await db.users.find_one({"email": "seller@test.com"})
    if not seller:
        print("❌ Тестовый продавец не найден")
        return
    
    seller_id = str(seller["_id"])
    print(f"✓ Найден продавец: {seller_id}")
    
    # Очищаем старые транзакции этого продавца
    result = await db.marketplace_transactions.delete_many({"seller_id": seller_id})
    print(f"✓ Удалено {result.deleted_count} старых транзакций")
    
    # Создаем тестовые транзакции за последние 30 дней
    transactions = []
    base_date = datetime.utcnow() - timedelta(days=30)
    
    for i in range(1, 51):  # 50 транзакций
        order_date = base_date + timedelta(days=i % 30, hours=i % 24)
        
        # Случайные суммы
        amount = 2000 + (i * 100)
        commission_base = amount * 0.15  # 15% комиссия
        logistics_delivery = amount * 0.08  # 8% логистика
        logistics_last_mile = amount * 0.03  # 3% последняя миля
        service_storage = 50.0
        service_acquiring = amount * 0.02  # 2% эквайринг
        service_pvz = 30.0
        service_packaging = 15.0
        penalties = 0.0 if i % 10 != 0 else 100.0  # Каждый 10-й заказ со штрафом
        
        transaction = {
            "seller_id": seller_id,
            "marketplace": "ozon",
            
            # Идентификаторы
            "transaction_id": f"TX{1000000 + i}",
            "order_id": f"FBS-OZON-TEST-{1000 + i}",
            "posting_number": f"{10000000 + i}-0001-1",
            
            # Основные данные
            "operation_date": order_date,
            "operation_type": "OperationAgentDeliveredToCustomer",
            
            # Финансы
            "amount": amount,
            
            # Детализация расходов
            "breakdown": {
                "commission": {
                    "base_commission": commission_base,
                    "bonus_commission": 0.0,  # Пока без бонусов
                    "total": commission_base
                },
                "logistics": {
                    "delivery_to_customer": logistics_delivery,
                    "last_mile": logistics_last_mile,
                    "returns": 0.0,
                    "total": logistics_delivery + logistics_last_mile
                },
                "services": {
                    "storage": service_storage,
                    "acquiring": service_acquiring,
                    "pvz_fee": service_pvz,
                    "packaging": service_packaging,
                    "total": service_storage + service_acquiring + service_pvz + service_packaging
                },
                "penalties": {
                    "total": penalties
                },
                "other_charges": {
                    "total": 0.0
                }
            },
            
            # Товары
            "items": [
                {
                    "sku": f"TEST-SKU-{i}",
                    "name": f"Тестовый товар #{i}",
                    "quantity": 1,
                    "price": amount,
                    "purchase_price": amount * 0.60,  # Себестоимость 60% от цены продажи
                    "total_sale": amount,
                    "total_cost": amount * 0.60
                }
            ],
            
            # Метаданные
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "data_source": "seed",
            "raw_data": {}
        }
        
        transactions.append(transaction)
    
    # Вставляем все транзакции
    result = await db.marketplace_transactions.insert_many(transactions)
    print(f"✓ Добавлено {len(result.inserted_ids)} транзакций")
    
    # Подсчитаем итоги
    pipeline = [
        {"$match": {"seller_id": seller_id}},
        {"$group": {
            "_id": None,
            "total_amount": {"$sum": "$amount"},
            "total_commission": {"$sum": "$breakdown.commission.total"},
            "total_logistics": {"$sum": "$breakdown.logistics.total"},
            "total_services": {"$sum": "$breakdown.services.total"},
            "count": {"$sum": 1}
        }}
    ]
    
    result = await db.marketplace_transactions.aggregate(pipeline).to_list(1)
    if result:
        data = result[0]
        total_revenue = data["total_amount"]
        total_expenses = (
            data["total_commission"] +
            data["total_logistics"] +
            data["total_services"]
        )
        total_profit = total_revenue - total_expenses
        
        print("\n📊 Сводка по тестовым данным:")
        print(f"  Транзакций: {data['count']}")
        print(f"  Выручка: {total_revenue:,.2f} ₽")
        print(f"  Расходы: {total_expenses:,.2f} ₽")
        print(f"  Прибыль: {total_profit:,.2f} ₽")
        print(f"  Маржа: {(total_profit / total_revenue * 100):.2f}%")
    
    print("\n✅ Тестовые данные успешно добавлены!")
    print("Теперь можно протестировать отчет по прибыли")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_financial_transactions())
