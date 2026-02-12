"""
Скрипт миграции для шифрования существующих API ключей в базе данных.

ВАЖНО: Перед запуском убедитесь, что:
1. ENCRYPTION_KEY установлен в .env файле
2. Сделана резервная копия базы данных
3. Сервер остановлен

Запуск:
    python backend/scripts/migrate_api_keys_encryption.py
"""
import asyncio
import sys
import os
from pathlib import Path

# Добавляем корень проекта в путь
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from core.security import encrypt_api_key, is_encrypted, decrypt_api_key
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

async def migrate_api_keys():
    """Мигрировать все незашифрованные API ключи"""
    
    # Подключение к MongoDB
    mongo_url = os.getenv("MONGO_URL") or os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "minimalmod")
    
    logger.info(f"Подключение к MongoDB: {mongo_url}")
    logger.info(f"База данных: {database_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[database_name]
    
    try:
        # Проверяем наличие ENCRYPTION_KEY
        encryption_key = os.getenv("ENCRYPTION_KEY")
        if not encryption_key:
            logger.error("❌ ENCRYPTION_KEY не установлен в .env файле!")
            logger.error("💡 Установите ENCRYPTION_KEY в .env перед запуском миграции")
            return False
        
        logger.info("✅ ENCRYPTION_KEY найден")
        
        # Получаем все профили продавцов
        profiles = await db.seller_profiles.find({}).to_list(length=None)
        logger.info(f"Найдено профилей продавцов: {len(profiles)}")
        
        total_keys = 0
        encrypted_keys = 0
        migrated_keys = 0
        errors = 0
        
        for profile in profiles:
            user_id = profile.get("user_id")
            api_keys = profile.get("api_keys", [])
            
            if not api_keys:
                continue
            
            updated_keys = []
            needs_update = False
            
            for key in api_keys:
                total_keys += 1
                api_key_value = key.get("api_key", "")
                
                if not api_key_value:
                    updated_keys.append(key)
                    continue
                
                # Проверяем, зашифрован ли ключ
                if is_encrypted(api_key_value):
                    encrypted_keys += 1
                    updated_keys.append(key)
                    logger.debug(f"Ключ уже зашифрован: {key.get('id', 'unknown')}")
                else:
                    # Шифруем ключ
                    try:
                        encrypted_value = encrypt_api_key(api_key_value)
                        key["api_key"] = encrypted_value
                        updated_keys.append(key)
                        migrated_keys += 1
                        needs_update = True
                        logger.info(f"✅ Зашифрован ключ: {key.get('id', 'unknown')} для marketplace: {key.get('marketplace', 'unknown')}")
                    except Exception as e:
                        errors += 1
                        logger.error(f"❌ Ошибка при шифровании ключа {key.get('id', 'unknown')}: {str(e)}")
                        # Оставляем ключ незашифрованным в случае ошибки
                        updated_keys.append(key)
            
            # Обновляем профиль, если были изменения
            if needs_update:
                try:
                    await db.seller_profiles.update_one(
                        {"_id": profile["_id"]},
                        {"$set": {"api_keys": updated_keys}}
                    )
                    logger.info(f"✅ Обновлен профиль пользователя: {user_id}")
                except Exception as e:
                    logger.error(f"❌ Ошибка при обновлении профиля {user_id}: {str(e)}")
                    errors += 1
        
        # Итоговая статистика
        logger.info("")
        logger.info("=" * 60)
        logger.info("МИГРАЦИЯ ЗАВЕРШЕНА")
        logger.info("=" * 60)
        logger.info(f"Всего ключей обработано: {total_keys}")
        logger.info(f"Уже зашифрованных: {encrypted_keys}")
        logger.info(f"Зашифровано новых: {migrated_keys}")
        logger.info(f"Ошибок: {errors}")
        logger.info("=" * 60)
        
        if errors == 0:
            logger.info("✅ Миграция успешно завершена!")
            return True
        else:
            logger.warning(f"⚠️ Миграция завершена с {errors} ошибками")
            return False
            
    except Exception as e:
        logger.error(f"❌ Критическая ошибка при миграции: {str(e)}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("МИГРАЦИЯ API КЛЮЧЕЙ: ШИФРОВАНИЕ")
    logger.info("=" * 60)
    logger.info("")
    
    # Подтверждение
    response = input("⚠️ ВНИМАНИЕ: Убедитесь, что сделана резервная копия БД!\nПродолжить миграцию? (yes/no): ")
    if response.lower() != "yes":
        logger.info("Миграция отменена")
        sys.exit(0)
    
    logger.info("")
    logger.info("Запуск миграции...")
    logger.info("")
    
    success = asyncio.run(migrate_api_keys())
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
