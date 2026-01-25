from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "minimalmod"
    
    # JWT
    JWT_SECRET: str = "CHANGE_ME"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Ozon
    OZON_CLIENT_ID: str = ""
    OZON_API_KEY: str = ""
    
    # Wildberries
    WB_API_KEY: str = ""
    
    # Яндекс.Маркет
    YANDEX_API_KEY: str = ""
    YANDEX_CAMPAIGN_ID: str = ""
    
    # Security
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    RATE_LIMIT_CALLS: int = 100
    RATE_LIMIT_PERIOD: int = 60
    
    # Legacy support (для обратной совместимости)
    MONGO_URL: str = ""
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 0
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    def get_mongo_url(self) -> str:
        """Получить MongoDB URL с поддержкой legacy переменных"""
        if self.MONGO_URL:
            return self.MONGO_URL
        return self.MONGODB_URL
    
    def get_secret_key(self) -> str:
        """Получить SECRET_KEY с поддержкой legacy переменных"""
        if self.SECRET_KEY and self.SECRET_KEY != "CHANGE_ME":
            return self.SECRET_KEY
        if self.JWT_SECRET and self.JWT_SECRET != "CHANGE_ME":
            return self.JWT_SECRET
        return "CHANGE_ME"
    
    def get_token_expire_minutes(self) -> int:
        """Получить время истечения токена в минутах"""
        if self.ACCESS_TOKEN_EXPIRE_MINUTES > 0:
            return self.ACCESS_TOKEN_EXPIRE_MINUTES
        return self.JWT_EXPIRATION_HOURS * 60

settings = Settings()

def validate_settings():
    """Проверка критичных настроек при запуске"""
    errors = []
    
    secret_key = settings.get_secret_key()
    if secret_key == "CHANGE_ME" or len(secret_key) < 32:
        errors.append("⚠️ JWT_SECRET не изменен или слишком короткий! Установите случайную строку минимум 32 символа в .env")
    
    mongo_url = settings.get_mongo_url()
    if not mongo_url:
        errors.append("❌ MONGODB_URL не указан!")
    
    if errors:
        print("\n❌ ОШИБКИ КОНФИГУРАЦИИ:")
        for error in errors:
            print(f"  {error}")
        print("\n💡 Создайте файл backend/.env по образцу backend/.env.example\n")
        return False
    
    return True
