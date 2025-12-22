"""
Скрипт для полной перезагрузки заказов с правильными датами

ВНИМАНИЕ! Этот скрипт:
1. Удалит ВСЕ существующие заказы FBS
2. Заново загрузит их через API Ozon с правильными датами

Используйте только если уверены!
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def prepare_reload():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['minimalmod']
    
    print('=' * 70)
    print('⚠️  ПОДГОТОВКА К ПЕРЕЗАГРУЗКЕ ЗАКАЗОВ')
    print('=' * 70)
    print()
    
    # Статистика текущих заказов
    count = await db.orders_fbs.count_documents({})
    
    print(f'Текущее количество заказов FBS: {count}')
    print()
    
    if count == 0:
        print('✅ База уже пуста, можно загружать заказы.')
        client.close()
        return
    
    print('Для полной перезагрузки с правильными датами выполните:')
    print()
    print('1. УДАЛИТЬ все старые заказы:')
    print('   python3 -c "import asyncio; from motor.motor_asyncio import AsyncIOMotorClient; ')
    print('   client = AsyncIOMotorClient(\"mongodb://localhost:27017\"); ')
    print('   db = client[\"minimalmod\"]; ')
    print('   asyncio.run(db.orders_fbs.delete_many({}))"')
    print()
    print('2. Перейти в раздел "Заказы FBS"')
    print('3. Нажать "ИМПОРТ ЗАКАЗОВ"')
    print('4. Выбрать нужную интеграцию и период')
    print('5. Нажать "ЗАГРУЗИТЬ ЗАКАЗЫ"')
    print()
    print('Новые заказы будут загружены с ПРАВИЛЬНЫМИ датами и номерами!')
    print()
    
    # Спросить подтверждение
    print('Хотите УДАЛИТЬ все заказы прямо сейчас? (yes/no)')
    print('ВНИМАНИЕ: Это действие НЕОБРАТИМО!')
    print()
    print('[Для запуска удаления выполните команду вручную]')
    
    client.close()

if __name__ == '__main__':
    asyncio.run(prepare_reload())
