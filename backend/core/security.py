"""
Утилиты для шифрования/дешифрования API ключей
Использует Fernet (симметричное шифрование) из библиотеки cryptography
"""
from cryptography.fernet import Fernet
import base64
import os
import logging

logger = logging.getLogger(__name__)

def get_encryption_key() -> bytes:
    """
    Получить ключ шифрования из переменной окружения.
    Если ключа нет, генерирует новый (только для разработки!).
    """
    encryption_key = os.getenv("ENCRYPTION_KEY")
    
    if not encryption_key:
        logger.warning("⚠️ ENCRYPTION_KEY не установлен! Генерирую временный ключ (НЕ для продакшена!)")
        # Генерируем ключ для разработки
        key = Fernet.generate_key()
        logger.warning(f"⚠️ ВРЕМЕННЫЙ КЛЮЧ: {key.decode()}")
        logger.warning("⚠️ Установите ENCRYPTION_KEY в .env файле!")
        return key
    
    # Если ключ в виде строки, конвертируем в bytes
    if isinstance(encryption_key, str):
        # Проверяем, является ли это валидным Fernet ключом (base64, 32 байта)
        try:
            # Пытаемся декодировать как base64
            decoded = base64.urlsafe_b64decode(encryption_key)
            if len(decoded) == 32:
                return encryption_key.encode()
            else:
                # Если не base64, генерируем ключ из строки
                return base64.urlsafe_b64encode(encryption_key.encode()[:32].ljust(32, b'0'))
        except:
            # Если не base64, генерируем ключ из строки
            return base64.urlsafe_b64encode(encryption_key.encode()[:32].ljust(32, b'0'))
    
    return encryption_key

def get_fernet() -> Fernet:
    """Получить объект Fernet для шифрования/дешифрования"""
    key = get_encryption_key()
    return Fernet(key)

def encrypt_api_key(api_key: str) -> str:
    """
    Зашифровать API ключ
    
    Args:
        api_key: Открытый API ключ
        
    Returns:
        Зашифрованный ключ в виде строки (base64)
    """
    if not api_key:
        return ""
    
    try:
        fernet = get_fernet()
        encrypted = fernet.encrypt(api_key.encode())
        return encrypted.decode()
    except Exception as e:
        logger.error(f"Ошибка при шифровании API ключа: {str(e)}")
        raise

def decrypt_api_key(encrypted_key: str) -> str:
    """
    Расшифровать API ключ
    
    Args:
        encrypted_key: Зашифрованный ключ (base64 строка)
        
    Returns:
        Расшифрованный API ключ
    """
    if not encrypted_key:
        return ""
    
    # Проверяем, не зашифрован ли уже ключ
    # Если ключ не начинается с gAAAAAB (стандартный префикс Fernet), считаем его незашифрованным
    if not encrypted_key.startswith("gAAAAAB"):
        # Это старый незашифрованный ключ - возвращаем как есть
        logger.warning("⚠️ Обнаружен незашифрованный API ключ. Запустите миграцию!")
        return encrypted_key
    
    try:
        fernet = get_fernet()
        decrypted = fernet.decrypt(encrypted_key.encode())
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Ошибка при расшифровке API ключа: {str(e)}")
        # Если не удалось расшифровать, возможно это старый незашифрованный ключ
        logger.warning("⚠️ Попытка вернуть ключ как незашифрованный (для обратной совместимости)")
        return encrypted_key

def is_encrypted(api_key: str) -> bool:
    """
    Проверить, зашифрован ли API ключ
    
    Args:
        api_key: Ключ для проверки
        
    Returns:
        True если ключ зашифрован, False если нет
    """
    if not api_key:
        return False
    # Fernet зашифрованные данные начинаются с gAAAAAB
    return api_key.startswith("gAAAAAB")
