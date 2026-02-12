"""
Скрипт для создания учетной записи продавца
"""
import asyncio
import sys
import os
from datetime import datetime

# Добавляем путь к backend для импорта
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_seller():
    """Создать учетную запись продавца"""
    
    # Подключение к MongoDB
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "minimalmod")
    
    print(f"Подключение к MongoDB: {mongo_url}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Запрашиваем данные у пользователя
        print("\n" + "="*50)
        print("Создание учетной записи продавца")
        print("="*50 + "\n")
        
        email = input("Email: ").strip()
        if not email:
            print("[❌] Email обязателен!")
            return
        
        # Проверяем что email не занят
        existing = await db.users.find_one({"email": email})
        if existing:
            print(f"[❌] Пользователь с email {email} уже существует!")
            return
        
        password = input("Пароль: ").strip()
        if not password or len(password) < 6:
            print("[❌] Пароль должен быть минимум 6 символов!")
            return
        
        full_name = input("Полное имя: ").strip()
        if not full_name:
            full_name = "Seller"
        
        company_name = input("Название компании (необязательно): ").strip()
        inn = input("ИНН (необязательно): ").strip()
        
        # Создаем пользователя
        user = {
            "email": email,
            "password_hash": pwd_context.hash(password),
            "full_name": full_name,
            "role": "seller",
            "is_active": True,  # Автоматически активируем
            "created_at": datetime.utcnow(),
            "last_login_at": None
        }
        
        result = await db.users.insert_one(user)
        user_id = result.inserted_id
        
        print(f"\n[✓] Пользователь создан! ID: {user_id}")
        
        # Создаем профиль продавца
        seller_profile = {
            "user_id": user_id,
            "company_name": company_name or "",
            "inn": inn or "",
            "api_keys": [],
            "commission_rate": 0.15  # 15% по умолчанию
        }
        
        await db.seller_profiles.insert_one(seller_profile)
        print("[✓] Профиль продавца создан!")
        
        print("\n" + "="*50)
        print("✅ Учетная запись продавца успешно создана!")
        print("="*50)
        print(f"\nEmail: {email}")
        print(f"Пароль: {password}")
        print(f"Статус: Активна (можно сразу войти)")
        print("\nТеперь можно войти в систему:")
        print("  → http://localhost:3000")
        print()
        
    except Exception as e:
        print(f"\n[❌] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_seller())
