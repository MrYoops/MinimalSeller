import logging
from logging.handlers import RotatingFileHandler
import os

def setup_logging():
    """Настройка логирования в файл и консоль"""
    
    # Создать папку для логов
    os.makedirs("logs", exist_ok=True)
    
    # Формат логов
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Handler для файла (с ротацией)
    file_handler = RotatingFileHandler(
        'logs/minimalseller.log',
        maxBytes=10*1024*1024,  # 10 MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    
    # Handler для консоли
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    
    # Настроить root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Отключить debug логи от httpx (слишком много)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    return root_logger
