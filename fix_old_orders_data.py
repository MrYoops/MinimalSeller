"""
Скрипт для исправления заказов, загруженных со старым кодом

Проблемы:
1. order_number: FBS-OZON-xxxxx вместо реального posting_number
2. created_at: дата импорта вместо реальной даты заказа

Решение:
1. Найти все заказы с паттерном FBS-OZON-*
2. Для каждого заказа использовать external_order_id для обновления:
   - order_number = external_order_id (реальный номер)
   - created_at оставить как есть (реальную дату подтянуть невозможно без API)
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def fix_old_orders():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['minimalmod']
    
    print('=' * 70)
    print('🔧 ИСПРАВЛЕНИЕ ЗАКАЗОВ, ЗАГРУЖЕННЫХ СО СТАРЫМ КОДОМ')
    print('=' * 70)
    print()
    
    # Найти заказы с генерируемым номером
    orders = await db.orders_fbs.find({
        'order_number': {'$regex': '^FBS-OZON-'}
    }).to_list(length=100000)
    
    print(f'Найдено заказов со старым форматом номера: {len(orders)}')
    
    if len(orders) == 0:
        print('✅ Все заказы уже исправлены!')
        client.close()
        return
    
    print()
    print('Обновление...')
    
    updated_count = 0
    errors = []
    
    for order in orders:
        external_id = order.get('external_order_id')
        order_id = order.get('_id')
        old_number = order.get('order_number')
        
        if not external_id:
            errors.append(f'Заказ {order_id}: нет external_order_id')
            continue
        
        # Обновить номер заказа
        try:
            result = await db.orders_fbs.update_one(
                {'_id': order_id},
                {'$set': {
                    'order_number': external_id,  # Настоящий номер
                    'updated_at': datetime.utcnow()
                }}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                if updated_count <= 5:
                    print(f'  ✅ {old_number} → {external_id}')
        except Exception as e:
            errors.append(f'Ошибка обновления {order_id}: {e}')
    
    print()
    print(f'✅ Обновлено: {updated_count} заказов')
    
    if errors:
        print(f'❌ Ошибок: {len(errors)}')
        for err in errors[:5]:
            print(f'  - {err}')
    
    print()
    print('=' * 70)
    print('ГОТОВО!')
    print('=' * 70)
    print()
    print('⚠️  ВНИМАНИЕ:')
    print('   Реальные даты заказов НЕ МОГУТ быть восстановлены.')
    print('   Для получения правильных дат нужно:')
    print('   1. Удалить ВСЕ старые заказы из БД')
    print('   2. Заново загрузить их через "ИМПОРТ ЗАКАЗОВ"')
    print()
    
    client.close()

if __name__ == '__main__':
    asyncio.run(fix_old_orders())
