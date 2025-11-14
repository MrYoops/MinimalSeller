from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Dict
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
from bson import ObjectId
import logging

load_dotenv()

app = FastAPI(title="MinimalMod API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request: {request.method} {request.url.path} from {request.client.host}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "minimalmod")
SECRET_KEY = "your-secret-key-min-32-chars-long-change-me-please"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

client = None
db = None

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

class UserRole:
    ADMIN = "admin"
    SELLER = "seller"

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None
    inn: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

class APIKeyCreate(BaseModel):
    marketplace: str  # ozon, wb, yandex
    client_id: str
    api_key: str

class APIKey(BaseModel):
    id: str
    marketplace: str
    client_id: str
    api_key_masked: str
    created_at: datetime

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    return user

def require_role(required_role: str):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] != required_role and required_role != "any":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker

# Startup/Shutdown
@app.on_event("startup")
async def startup_db_client():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    logger.info(f"Connected to MongoDB at {MONGO_URL}")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    
    # Create default admin if not exists
    admin_exists = await db.users.find_one({"role": UserRole.ADMIN})
    if not admin_exists:
        admin_user = {
            "email": "admin@minimalmod.com",
            "password_hash": get_password_hash("admin123"),
            "full_name": "Administrator",
            "role": UserRole.ADMIN,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login_at": None
        }
        await db.users.insert_one(admin_user)
        logger.info("Default admin created: admin@minimalmod.com / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")

# Routes
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "MinimalMod API"
    }

@app.post("/api/auth/register", response_model=dict)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "role": UserRole.SELLER,
        "is_active": False,  # Requires admin approval
        "created_at": datetime.utcnow(),
        "last_login_at": None
    }
    result = await db.users.insert_one(user)
    
    # Create seller profile
    seller_profile = {
        "user_id": result.inserted_id,
        "company_name": user_data.company_name or "",
        "inn": user_data.inn or "",
        "api_keys": [],
        "commission_rate": 0.15  # Default 15%
    }
    await db.seller_profiles.insert_one(seller_profile)
    
    return {
        "message": "Registration successful. Waiting for admin approval.",
        "email": user_data.email
    }

@app.post("/api/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    logger.info(f"Login attempt for email: {credentials.email}")
    user = await db.users.find_one({"email": credentials.email})
    
    if not user:
        logger.warning(f"User not found: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    logger.info(f"User found: {user.get('email')}, checking password...")
    # Try both field names for compatibility
    password_hash = user.get("password_hash") or user.get("hashed_password")
    if not password_hash:
        logger.error(f"No password hash found for user: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    password_valid = verify_password(credentials.password, password_hash)
    logger.info(f"Password valid: {password_valid}")
    
    if not password_valid:
        logger.warning(f"Invalid password for user: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not activated. Waiting for admin approval."
        )
    
    # Update last login
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login_at": datetime.utcnow()}}
    )
    
    # Create token
    access_token = create_access_token(
        data={"sub": str(user["_id"]), "role": user["role"]}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }

@app.get("/api/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(
        id=str(current_user["_id"]),
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        is_active=current_user["is_active"],
        created_at=current_user["created_at"],
        last_login_at=current_user.get("last_login_at")
    )

# Admin endpoints
@app.get("/api/admin/users", response_model=List[User])
async def get_all_users(current_user: dict = Depends(require_role(UserRole.ADMIN))):
    users = await db.users.find().to_list(length=1000)
    return [
        User(
            id=str(user["_id"]),
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            is_active=user["is_active"],
            created_at=user["created_at"],
            last_login_at=user.get("last_login_at")
        )
        for user in users
    ]

@app.put("/api/admin/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User approved successfully"}

@app.put("/api/admin/users/{user_id}/block")
async def block_user(
    user_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User blocked successfully"}

@app.put("/api/admin/users/{user_id}/commission")
async def set_commission(
    user_id: str,
    commission_rate: float,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    result = await db.seller_profiles.update_one(
        {"user_id": ObjectId(user_id)},
        {"$set": {"commission_rate": commission_rate}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    return {"message": "Commission rate updated successfully"}

# Seller endpoints - API Keys
@app.get("/api/seller/api-keys", response_model=List[APIKey])
async def get_api_keys(current_user: dict = Depends(require_role(UserRole.SELLER))):
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        return []
    
    api_keys = profile.get("api_keys", [])
    result = []
    
    for key in api_keys:
        # Handle both old ObjectId format and new UUID format
        key_id = str(key.get("id", "")) or str(key.get("_id", ""))
        
        # Parse created_at - handle both datetime and ISO string
        created_at = key.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except:
                created_at = datetime.utcnow()
        elif not isinstance(created_at, datetime):
            created_at = datetime.utcnow()
        
        result.append(APIKey(
            id=key_id,
            marketplace=key["marketplace"],
            client_id=key.get("client_id", ""),
            api_key_masked="***" + key["api_key"][-4:] if len(key.get("api_key", "")) > 4 else "***",
            created_at=created_at
        ))
    
    return result

@app.post("/api/seller/api-keys/test")
async def test_api_key(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """REAL API connection test - no mock data!"""
    from connectors import get_connector, MarketplaceError
    
    marketplace = data.get('marketplace')
    client_id = data.get('client_id', '')
    api_key = data.get('api_key', '')
    
    logger.info(f"🔍 REAL API test for {marketplace}")
    logger.info(f"   Client ID: {client_id[:20] if client_id else 'N/A'}...")
    logger.info(f"   API Key: {api_key[:20] if api_key else 'N/A'}...")
    
    # Validation
    if not marketplace or marketplace not in ["ozon", "wb", "yandex"]:
        return {
            'success': False,
            'message': '❌ Invalid marketplace'
        }
    
    if marketplace == 'ozon':
        if not client_id or not api_key:
            return {
                'success': False,
                'message': '❌ Fill Client ID and API Key for Ozon'
            }
    elif marketplace == 'wb':
        if not api_key:
            return {
                'success': False,
                'message': '❌ Fill API Token for Wildberries'
            }
    elif marketplace == 'yandex':
        if not client_id or not api_key:
            return {
                'success': False,
                'message': '❌ Fill Campaign ID and Token for Yandex'
            }
    
    try:
        # REAL API CALL
        connector = get_connector(marketplace, client_id, api_key)
        products = await connector.get_products()
        
        logger.info(f"✅ REAL API test passed! Found {len(products)} products")
        
        return {
            'success': True,
            'message': f'✅ Connection successful! Found {len(products)} products from {marketplace.upper()}.',
            'products_count': len(products)
        }
        
    except MarketplaceError as e:
        logger.error(f"❌ API test failed: {e.message}")
        return {
            'success': False,
            'message': f'❌ {e.marketplace} API Error [{e.status_code}]: {e.message}'
        }
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        return {
            'success': False,
            'message': f'❌ Unexpected error: {str(e)}'
        }

@app.post("/api/seller/api-keys")
async def add_api_key(
    key_data: APIKeyCreate,
    current_user: dict = Depends(require_role(UserRole.SELLER))
):
    import uuid
    
    # Validate marketplace
    if key_data.marketplace not in ["ozon", "wb", "yandex"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid marketplace. Use: ozon, wb, or yandex"
        )
    
    # Validate API key is not empty
    if not key_data.api_key or key_data.api_key.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key is required and cannot be empty"
        )
    
    # Generate UUID for key ID
    key_id = str(uuid.uuid4())
    
    new_key = {
        "id": key_id,
        "marketplace": key_data.marketplace,
        "client_id": key_data.client_id,
        "api_key": key_data.api_key,  # In production, encrypt this
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Проверяем существование профиля продавца, создаём если нет
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        await db.seller_profiles.insert_one({
            "user_id": current_user["_id"],
            "api_keys": []
        })
        logger.info(f"Created new seller profile for user {current_user['_id']}")
    
    # Update seller profile - добавляем ключ
    result = await db.seller_profiles.update_one(
        {"user_id": current_user["_id"]},
        {"$push": {"api_keys": new_key}}
    )
    
    if result.modified_count == 0 and result.matched_count == 0:
        logger.error(f"Failed to add API key for user {current_user['_id']}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add API key"
        )
    
    logger.info(f"✅ API key added successfully: {key_id} for user {current_user['_id']}")
    
    return {
        "message": "API key added successfully",
        "key_id": key_id,
        "key": {
            "id": key_id,
            "marketplace": new_key["marketplace"],
            "client_id": new_key["client_id"],
            "api_key_masked": "***" + new_key["api_key"][-4:] if len(new_key["api_key"]) > 4 else "***",
            "created_at": new_key["created_at"]
        }
    }

@app.delete("/api/seller/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(require_role(UserRole.SELLER))
):
    logger.info(f"🗑️ Attempting to delete API key {key_id} for user {current_user['_id']}")
    
    # Try to delete by UUID first, then by ObjectId for backward compatibility
    result = await db.seller_profiles.update_one(
        {"user_id": current_user["_id"]},
        {"$pull": {"api_keys": {"id": key_id}}}
    )
    
    logger.info(f"UUID deletion attempt: matched={result.matched_count}, modified={result.modified_count}")
    
    # If UUID deletion didn't work, try ObjectId (for old data)
    if result.modified_count == 0:
        try:
            result = await db.seller_profiles.update_one(
                {"user_id": current_user["_id"]},
                {"$pull": {"api_keys": {"_id": ObjectId(key_id)}}}
            )
            logger.info(f"ObjectId deletion attempt: matched={result.matched_count}, modified={result.modified_count}")
        except Exception as e:
            logger.error(f"ObjectId deletion failed: {e}")
    
    if result.modified_count == 0:
        logger.error(f"❌ Failed to delete API key {key_id}")
        raise HTTPException(status_code=404, detail="API key not found")
    
    logger.info(f"✅ API key {key_id} deleted successfully")
    return {"message": "API key deleted successfully"}
@app.put("/api/seller/api-keys/{key_id}")
async def update_api_key(
    key_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(require_role(UserRole.SELLER))
):
    logger.info(f"✏️ Updating API key {key_id} for user {current_user['_id']}")
    logger.info(f"   Update data: {update_data}")
    
    # Получаем текущие ключи
    profile = await db.seller_profiles.find_one({"user_id": current_user["_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_keys = profile.get("api_keys", [])
    key_index = None
    
    # Находим ключ по ID
    for i, key in enumerate(api_keys):
        if key.get("id") == key_id or str(key.get("_id")) == key_id:
            key_index = i
            break
    
    if key_index is None:
        logger.error(f"❌ API key {key_id} not found")
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Обновляем поля (только те что переданы)
    if "name" in update_data:
        api_keys[key_index]["name"] = update_data["name"]
    if "auto_sync_stock" in update_data:
        api_keys[key_index]["auto_sync_stock"] = update_data["auto_sync_stock"]
    if "auto_update_prices" in update_data:
        api_keys[key_index]["auto_update_prices"] = update_data["auto_update_prices"]
    if "auto_get_orders" in update_data:
        api_keys[key_index]["auto_get_orders"] = update_data["auto_get_orders"]
    
    # Сохраняем обновлённый массив
    result = await db.seller_profiles.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"api_keys": api_keys}}
    )
    
    if result.modified_count == 0:
        logger.warning(f"⚠️ No changes made to API key {key_id}")
    else:
        logger.info(f"✅ API key {key_id} updated successfully")
    
    return {
        "message": "API key updated successfully",
        "key_id": key_id
    }


# ========== PRODUCT MANAGEMENT ROUTES ==========
from models import ProductCreate, ProductUpdate
from utils import (
    extract_investor_tag, generate_url_slug,
    calculate_listing_quality_score, prepare_product_response
)

@app.get("/api/products")
async def get_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    tags: Optional[str] = None,
    status: Optional[str] = None,
    quality: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Получить список товаров с фильтрацией"""
    query = {}
    
    # Продавец видит только свои товары
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    # Поиск
    if search:
        query['$or'] = [
            {'sku': {'$regex': search, '$options': 'i'}},
            {'minimalmod.name': {'$regex': search, '$options': 'i'}}
        ]
    
    # Фильтры
    if category_id:
        query['category_id'] = ObjectId(category_id)
    
    if tags:
        tag_list = [t.strip() for t in tags.split(',')]
        query['minimalmod.tags'] = {'$in': tag_list}
    
    if status:
        query['status'] = status
    
    products = await db.products.find(query).skip(skip).limit(limit).to_list(length=limit)
    
    # Фильтр по качеству
    if quality:
        filtered = []
        for p in products:
            score = p.get('listing_quality_score', {}).get('total', 0)
            if quality == 'high' and score >= 80:
                filtered.append(p)
            elif quality == 'medium' and 50 <= score < 80:
                filtered.append(p)
            elif quality == 'low' and score < 50:
                filtered.append(p)
        products = filtered
    
    return [prepare_product_response(p) for p in products]

@app.get("/api/products/{product_id}")
async def get_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить один товар"""
    product = await db.products.find_one({'_id': ObjectId(product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return prepare_product_response(product)

@app.post("/api/products")
async def create_product(
    product_data: ProductCreate,
    current_user: dict = Depends(get_current_user)
):
    """Создать новый товар"""
    # Проверка уникальности SKU
    existing = await db.products.find_one({
        'seller_id': current_user['_id'],
        'sku': product_data.sku
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Product with this SKU already exists"
        )
    
    # Извлечение тега инвестора
    investor_tag = extract_investor_tag(product_data.sku)
    if investor_tag and investor_tag not in product_data.minimalmod.tags:
        product_data.minimalmod.tags.append(investor_tag)
    
    # Генерация URL slug
    if not product_data.seo.url_slug:
        product_data.seo.url_slug = generate_url_slug(product_data.minimalmod.name)
    
    # Создание документа
    product_dict = product_data.dict()
    product_dict['seller_id'] = current_user['_id']
    product_dict['dates'] = {
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'published_at': datetime.utcnow() if product_data.status == 'active' else None
    }
    
    # Расчет качества
    product_dict['listing_quality_score'] = calculate_listing_quality_score(product_dict)
    
    result = await db.products.insert_one(product_dict)
    product_dict['_id'] = result.inserted_id
    
    return prepare_product_response(product_dict)

@app.put("/api/products/{product_id}")
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Обновить товар"""
    product = await db.products.find_one({'_id': ObjectId(product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_dict = product_data.dict(exclude_unset=True)
    update_dict['dates'] = product.get('dates', {})
    update_dict['dates']['updated_at'] = datetime.utcnow()
    
    # Пересчет качества
    merged_product = {**product, **update_dict}
    update_dict['listing_quality_score'] = calculate_listing_quality_score(merged_product)
    
    await db.products.update_one(
        {'_id': ObjectId(product_id)},
        {'$set': update_dict}
    )
    
    updated_product = await db.products.find_one({'_id': ObjectId(product_id)})
    return prepare_product_response(updated_product)

@app.delete("/api/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить товар"""
    product = await db.products.find_one({'_id': ObjectId(product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.products.delete_one({'_id': ObjectId(product_id)})
    return {'message': 'Product deleted successfully'}

# ========== INVENTORY MANAGEMENT ROUTES ==========

@app.get("/api/inventory")
async def get_inventory(
    current_user: dict = Depends(get_current_user)
):
    """Получить остатки на складе FBS"""
    query = {}
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    inventory = await db.inventory.find(query).to_list(length=1000)
    
    # Обогащаем данными о товарах
    for item in inventory:
        product = await db.products.find_one({'_id': item['product_id']})
        if product:
            item['product_name'] = product['minimalmod']['name']
            item['product_image'] = product['minimalmod']['images'][0] if product['minimalmod']['images'] else ''
        item['id'] = str(item.pop('_id'))
        item['product_id'] = str(item['product_id'])
        item['seller_id'] = str(item['seller_id'])
    
    return inventory

@app.get("/api/inventory/fbo")
async def get_fbo_inventory(
    current_user: dict = Depends(get_current_user)
):
    """Получить остатки на складах маркетплейсов (FBO)"""
    query = {}
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    fbo_inventory = await db.fbo_inventory.find(query).to_list(length=1000)
    
    for item in fbo_inventory:
        product = await db.products.find_one({'_id': item['product_id']})
        if product:
            item['product_name'] = product['minimalmod']['name']
        item['id'] = str(item.pop('_id'))
        item['product_id'] = str(item['product_id'])
        item['seller_id'] = str(item['seller_id'])
    
    return fbo_inventory

@app.post("/api/inventory/{product_id}/adjust")
async def adjust_inventory(
    product_id: str,
    adjustment: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Ручная корректировка остатков"""
    quantity_change = adjustment.get('quantity_change', 0)
    reason = adjustment.get('reason', 'Manual adjustment')
    product = await db.products.find_one({'_id': ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Найти или создать запись в inventory
    inventory = await db.inventory.find_one({
        'product_id': ObjectId(product_id),
        'seller_id': product['seller_id']
    })
    
    if not inventory:
        inventory = {
            'product_id': ObjectId(product_id),
            'seller_id': product['seller_id'],
            'sku': product['sku'],
            'quantity': 0,
            'reserved': 0,
            'available': 0,
            'alert_threshold': 10
        }
        result = await db.inventory.insert_one(inventory)
        inventory['_id'] = result.inserted_id
    
    # Обновить остатки
    new_quantity = inventory['quantity'] + quantity_change
    new_available = new_quantity - inventory['reserved']
    
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    await db.inventory.update_one(
        {'_id': inventory['_id']},
        {'$set': {
            'quantity': new_quantity,
            'available': new_available
        }}
    )
    
    # Записать в историю
    await db.inventory_history.insert_one({
        'product_id': ObjectId(product_id),
        'operation_type': 'manual_in' if quantity_change > 0 else 'manual_out',
        'quantity_change': quantity_change,
        'reason': reason,
        'user_id': current_user['_id'],
        'created_at': datetime.utcnow()
    })
    
    return {'message': 'Inventory adjusted', 'new_quantity': new_quantity}

@app.get("/api/inventory/history")
async def get_inventory_history(
    product_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Получить историю движений по складу"""
    query = {}
    
    if product_id:
        query['product_id'] = ObjectId(product_id)
    
    # Для продавца фильтруем через его товары
    if current_user['role'] == 'seller':
        seller_products = await db.products.find(
            {'seller_id': current_user['_id']},
            {'_id': 1}
        ).to_list(length=10000)
        product_ids = [p['_id'] for p in seller_products]
        query['product_id'] = {'$in': product_ids}
    
    history = await db.inventory_history.find(query).sort('created_at', -1).limit(100).to_list(length=100)
    
    for item in history:
        product = await db.products.find_one({'_id': item['product_id']})
        if product:
            item['product_name'] = product['minimalmod']['name']
            item['sku'] = product['sku']
        item['id'] = str(item.pop('_id'))
        item['product_id'] = str(item['product_id'])
        item['user_id'] = str(item['user_id'])
    
    return history

# ========== ORDER MANAGEMENT ROUTES ==========

@app.get("/api/orders")
async def get_orders(
    status: Optional[str] = None,
    source: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Получить список заказов"""
    query = {}
    
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    if status:
        query['status'] = status
    
    if source:
        query['source'] = source
    
    orders = await db.orders.find(query).sort('dates.created_at', -1).to_list(length=100)
    
    for order in orders:
        order['id'] = str(order.pop('_id'))
        order['seller_id'] = str(order['seller_id'])
    
    return orders

@app.get("/api/orders/{order_id}")
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить детали заказа"""
    order = await db.orders.find_one({'_id': ObjectId(order_id)})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(order['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    order['id'] = str(order.pop('_id'))
    order['seller_id'] = str(order['seller_id'])
    
    return order

@app.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Изменить статус заказа"""
    order = await db.orders.find_one({'_id': ObjectId(order_id)})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Проверка доступа
    if current_user['role'] == 'seller' and str(order['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.orders.update_one(
        {'_id': ObjectId(order_id)},
        {'$set': {'status': status, 'dates.updated_at': datetime.utcnow()}}
    )
    
    return {'message': 'Order status updated'}

@app.get("/api/returns")
async def get_returns(
    current_user: dict = Depends(get_current_user)
):
    """Получить список возвратов"""
    query = {}
    
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    returns = await db.returns.find(query).sort('dates.created_at', -1).to_list(length=100)
    
    for ret in returns:
        ret['id'] = str(ret.pop('_id'))
        ret['order_id'] = str(ret['order_id'])
        ret['seller_id'] = str(ret['seller_id'])
    
    return returns

# ========== FINANCE & ANALYTICS ROUTES (БЛОК 4) ==========

@app.get("/api/finance/dashboard")
async def get_finance_dashboard(
    period: Optional[str] = "30d",
    marketplace: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Финансовый дашборд с ключевыми метриками"""
    query = {}
    
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    if marketplace:
        query['marketplace'] = marketplace
    
    transactions = await db.finance_transactions.find(query).to_list(length=10000)
    
    total_revenue = sum(t.get('revenue', 0) for t in transactions)
    total_costs = sum(
        t.get('costs', {}).get('commission', 0) +
        t.get('costs', {}).get('logistics', 0) +
        t.get('costs', {}).get('storage', 0) +
        t.get('costs', {}).get('advertising', 0) +
        t.get('costs', {}).get('penalties', 0)
        for t in transactions
    )
    total_cogs = sum(t.get('cogs', 0) for t in transactions)
    gross_profit = total_revenue - total_cogs
    net_profit = gross_profit - total_costs
    margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    return {
        'revenue': total_revenue,
        'costs': total_costs,
        'cogs': total_cogs,
        'gross_profit': gross_profit,
        'net_profit': net_profit,
        'margin': round(margin, 2),
        'transactions_count': len(transactions)
    }

@app.get("/api/finance/transactions")
async def get_finance_transactions(
    current_user: dict = Depends(get_current_user)
):
    """Получить список финансовых транзакций"""
    query = {}
    
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    transactions = await db.finance_transactions.find(query).sort('transaction_date', -1).limit(100).to_list(length=100)
    
    for t in transactions:
        t['id'] = str(t.pop('_id'))
        t['seller_id'] = str(t['seller_id'])
    
    return transactions

@app.post("/api/finance/upload-report")
async def upload_finance_report(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Загрузка и парсинг финансового отчета"""
    marketplace = data.get('marketplace')
    transactions_data = data.get('transactions', [])
    
    created_count = 0
    
    for trans in transactions_data:
        transaction = {
            'seller_id': current_user['_id'],
            'marketplace': marketplace,
            'transaction_date': datetime.fromisoformat(trans.get('date', datetime.utcnow().isoformat())),
            'sku': trans.get('sku', ''),
            'revenue': float(trans.get('revenue', 0)),
            'costs': {
                'commission': float(trans.get('commission', 0)),
                'logistics': float(trans.get('logistics', 0)),
                'storage': float(trans.get('storage', 0)),
                'advertising': float(trans.get('advertising', 0)),
                'penalties': float(trans.get('penalties', 0))
            },
            'cogs': float(trans.get('cogs', 0)),
            'net_profit': 0
        }
        
        # Расчет чистой прибыли
        total_costs = sum(transaction['costs'].values())
        transaction['net_profit'] = transaction['revenue'] - total_costs - transaction['cogs']
        
        await db.finance_transactions.insert_one(transaction)
        created_count += 1
    
    return {'message': f'{created_count} transactions imported', 'count': created_count}

@app.get("/api/payouts")
async def get_payouts(
    current_user: dict = Depends(get_current_user)
):
    """Получить запросы на выплату"""
    query = {}
    
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    payouts = await db.payout_requests.find(query).sort('created_at', -1).to_list(length=100)
    
    for p in payouts:
        p['id'] = str(p.pop('_id'))
        p['seller_id'] = str(p['seller_id'])
    
    return payouts

@app.post("/api/payouts/request")
async def request_payout(
    amount: float,
    current_user: dict = Depends(require_role(UserRole.SELLER))
):
    """Запросить выплату"""
    payout = {
        'seller_id': current_user['_id'],
        'amount': amount,
        'status': 'pending',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = await db.payout_requests.insert_one(payout)
    
    return {'message': 'Payout request created', 'id': str(result.inserted_id)}

@app.put("/api/admin/payouts/{payout_id}/approve")
async def approve_payout(
    payout_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Одобрить выплату"""
    await db.payout_requests.update_one(
        {'_id': ObjectId(payout_id)},
        {'$set': {'status': 'approved', 'updated_at': datetime.utcnow()}}
    )
    return {'message': 'Payout approved'}

@app.put("/api/admin/payouts/{payout_id}/paid")
async def mark_payout_paid(
    payout_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Отметить выплату как выплаченную"""
    await db.payout_requests.update_one(
        {'_id': ObjectId(payout_id)},
        {'$set': {'status': 'paid', 'updated_at': datetime.utcnow()}}
    )
    return {'message': 'Payout marked as paid'}

@app.put("/api/admin/payouts/{payout_id}/reject")
async def reject_payout(
    payout_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Отклонить выплату"""
    await db.payout_requests.update_one(
        {'_id': ObjectId(payout_id)},
        {'$set': {'status': 'rejected', 'updated_at': datetime.utcnow()}}
    )
    return {'message': 'Payout rejected'}

# ========== ADMIN PLATFORM MANAGEMENT (БЛОК 6) ==========

@app.get("/api/admin/dashboard")
async def get_admin_dashboard(
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Глобальная аналитика платформы"""
    # Подсчет метрик
    total_sellers = await db.users.count_documents({'role': 'seller', 'is_active': True})
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    
    # Финансовые метрики
    transactions = await db.finance_transactions.find().to_list(length=100000)
    total_revenue = sum(t.get('revenue', 0) for t in transactions)
    total_net_profit = sum(t.get('net_profit', 0) for t in transactions)
    
    return {
        'total_sellers': total_sellers,
        'total_products': total_products,
        'total_orders': total_orders,
        'total_revenue': total_revenue,
        'total_net_profit': total_net_profit
    }

@app.get("/api/admin/categories")
async def get_categories(
    current_user: dict = Depends(get_current_user)
):
    """Получить список категорий"""
    categories = await db.categories.find().sort('order', 1).to_list(length=1000)
    
    for cat in categories:
        cat['id'] = str(cat.pop('_id'))
        if cat.get('parent_id'):
            cat['parent_id'] = str(cat['parent_id'])
    
    return categories

@app.post("/api/admin/categories")
async def create_category(
    data: Dict[str, Any],
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Создать категорию"""
    category = {
        'name': data.get('name'),
        'parent_id': ObjectId(data.get('parent_id')) if data.get('parent_id') else None,
        'order': 0,
        'attributes': data.get('attributes', []),  # Характеристики категории
        'marketplace_mapping': {
            'ozon': data.get('ozon_attributes', {}),
            'wildberries': data.get('wb_attributes', {}),
            'yandex': data.get('yandex_attributes', {})
        },
        'created_at': datetime.utcnow()
    }
    
    result = await db.categories.insert_one(category)
    
    return {'message': 'Category created', 'id': str(result.inserted_id)}

@app.delete("/api/admin/categories/{category_id}")
async def delete_category(
    category_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Удалить категорию"""
    await db.categories.delete_one({'_id': ObjectId(category_id)})
    return {'message': 'Category deleted'}

@app.get("/api/admin/cms/pages")
async def get_cms_pages(
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Получить список CMS страниц"""
    pages = await db.cms_pages.find().to_list(length=100)
    
    for page in pages:
        page['id'] = str(page.pop('_id'))
    
    return pages

@app.put("/api/admin/cms/pages/{page_id}")
async def update_cms_page(
    page_id: str,
    content: Dict[str, Any],
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Обновить CMS страницу"""
    await db.cms_pages.update_one(
        {'_id': ObjectId(page_id)},
        {'$set': {'content': content, 'updated_at': datetime.utcnow()}}
    )
    return {'message': 'Page updated'}

# ========== MARKETING & PROMOTIONS (БЛОК 7) ==========

@app.get("/api/promocodes")
async def get_promocodes(
    current_user: dict = Depends(get_current_user)
):
    """Получить промокоды"""
    query = {}
    if current_user['role'] == 'seller':
        query['seller_id'] = current_user['_id']
    
    promocodes = await db.promocodes.find(query).to_list(length=100)
    
    for promo in promocodes:
        promo['id'] = str(promo.pop('_id'))
        promo['seller_id'] = str(promo['seller_id'])
    
    return promocodes

@app.post("/api/promocodes")
async def create_promocode(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Создать промокод"""
    promocode = {
        'seller_id': current_user['_id'],
        'code': data.get('code', '').upper(),
        'discount_type': data.get('discount_type', 'percent'),
        'discount_value': float(data.get('discount_value', 0)),
        'min_order_amount': float(data.get('min_order_amount', 0)),
        'max_uses': int(data.get('max_uses', 0)),
        'current_uses': 0,
        'expires_at': datetime.fromisoformat(data.get('expires_at')) if data.get('expires_at') else None,
        'status': 'pending_approval',
        'created_at': datetime.utcnow()
    }
    
    result = await db.promocodes.insert_one(promocode)
    return {'message': 'Promocode created, waiting for approval', 'id': str(result.inserted_id)}

@app.put("/api/admin/promocodes/{promo_id}/approve")
async def approve_promocode(
    promo_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Одобрить промокод"""
    await db.promocodes.update_one(
        {'_id': ObjectId(promo_id)},
        {'$set': {'status': 'active'}}
    )
    return {'message': 'Promocode approved'}

@app.put("/api/admin/promocodes/{promo_id}/reject")
async def reject_promocode(
    promo_id: str,
    reason: str = "",
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Отклонить промокод"""
    await db.promocodes.update_one(
        {'_id': ObjectId(promo_id)},
        {'$set': {'status': 'rejected', 'rejection_reason': reason}}
    )
    return {'message': 'Promocode rejected'}

@app.get("/api/promotions")
async def get_promotions(
    current_user: dict = Depends(get_current_user)
):
    """Получить акции"""
    promotions = await db.promotions.find().to_list(length=100)
    
    for promo in promotions:
        promo['id'] = str(promo.pop('_id'))
    
    return promotions

@app.post("/api/promotions/{promo_id}/participate")
async def participate_in_promotion(
    promo_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Подать заявку на участие в акции"""
    participation = {
        'promotion_id': ObjectId(promo_id),
        'seller_id': current_user['_id'],
        'product_ids': [ObjectId(pid) for pid in data.get('product_ids', [])],
        'discount': float(data.get('discount', 0)),
        'status': 'pending_approval',
        'created_at': datetime.utcnow()
    }
    
    result = await db.promotion_participations.insert_one(participation)
    return {'message': 'Participation request submitted', 'id': str(result.inserted_id)}

# ========== COMMUNICATION (БЛОК 8) ==========

@app.get("/api/questions")
async def get_product_questions(
    product_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Получить вопросы о товарах"""
    query = {}
    
    if current_user['role'] == 'seller':
        # Получаем товары продавца
        seller_products = await db.products.find(
            {'seller_id': current_user['_id']},
            {'_id': 1}
        ).to_list(length=10000)
        product_ids = [p['_id'] for p in seller_products]
        query['product_id'] = {'$in': product_ids}
    
    if product_id:
        query['product_id'] = ObjectId(product_id)
    
    questions = await db.product_questions.find(query).sort('created_at', -1).to_list(length=100)
    
    for q in questions:
        q['id'] = str(q.pop('_id'))
        q['product_id'] = str(q['product_id'])
        
        # Добавляем информацию о товаре
        product = await db.products.find_one({'_id': ObjectId(q['product_id'])})
        if product:
            q['product_name'] = product['minimalmod']['name']
            q['product_sku'] = product['sku']
    
    return questions

@app.post("/api/questions/{question_id}/answer")
async def answer_question(
    question_id: str,
    answer: str,
    current_user: dict = Depends(get_current_user)
):
    """Ответить на вопрос"""
    question = await db.product_questions.find_one({'_id': ObjectId(question_id)})
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Проверка доступа (продавец может отвечать только на вопросы о своих товарах)
    product = await db.products.find_one({'_id': question['product_id']})
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.product_questions.update_one(
        {'_id': ObjectId(question_id)},
        {'$set': {
            'answer': answer,
            'answered_at': datetime.utcnow(),
            'status': 'answered'
        }}
    )
    
    return {'message': 'Answer posted'}

@app.get("/api/reviews")
async def get_product_reviews(
    product_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Получить отзывы о товарах"""
    query = {}
    
    if current_user['role'] == 'seller':
        seller_products = await db.products.find(
            {'seller_id': current_user['_id']},
            {'_id': 1}
        ).to_list(length=10000)
        product_ids = [p['_id'] for p in seller_products]
        query['product_id'] = {'$in': product_ids}
    
    if product_id:
        query['product_id'] = ObjectId(product_id)
    
    reviews = await db.product_reviews.find(query).sort('created_at', -1).to_list(length=100)
    
    for r in reviews:
        r['id'] = str(r.pop('_id'))
        r['product_id'] = str(r['product_id'])
        
        product = await db.products.find_one({'_id': ObjectId(r['product_id'])})
        if product:
            r['product_name'] = product['minimalmod']['name']
            r['product_sku'] = product['sku']
    
    return reviews

@app.post("/api/reviews/{review_id}/reply")
async def reply_to_review(
    review_id: str,
    reply: str,
    current_user: dict = Depends(get_current_user)
):
    """Ответить на отзыв"""
    review = await db.product_reviews.find_one({'_id': ObjectId(review_id)})
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    product = await db.products.find_one({'_id': review['product_id']})
    if current_user['role'] == 'seller' and str(product['seller_id']) != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.product_reviews.update_one(
        {'_id': ObjectId(review_id)},
        {'$set': {
            'seller_reply': reply,
            'replied_at': datetime.utcnow(),
            'status': 'answered'
        }}
    )
    
    return {'message': 'Reply posted'}

@app.delete("/api/admin/questions/{question_id}")
async def delete_question(
    question_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Удалить вопрос (модерация)"""
    await db.product_questions.delete_one({'_id': ObjectId(question_id)})
    return {'message': 'Question deleted'}

@app.delete("/api/admin/reviews/{review_id}")
async def delete_review(
    review_id: str,
    current_user: dict = Depends(require_role(UserRole.ADMIN))
):
    """Удалить отзыв (модерация)"""
    await db.product_reviews.delete_one({'_id': ObjectId(review_id)})
    return {'message': 'Review deleted'}

# ========== MARKETPLACE PRODUCTS LOADING ==========

@app.get("/api/marketplaces/{marketplace}/products")
async def get_marketplace_products(
    marketplace: str,
    current_user: dict = Depends(get_current_user)
):
    """Get products from marketplace - REAL API CALL"""
    from connectors import get_connector, MarketplaceError
    
    logger.info(f"📦 REAL API: Loading products from {marketplace}")
    
    # Get seller's API keys
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    # Find API key for this marketplace
    api_keys = profile.get('api_keys', [])
    marketplace_key = next(
        (k for k in api_keys if k['marketplace'] == marketplace),
        None
    )
    
    if not marketplace_key:
        raise HTTPException(
            status_code=400,
            detail=f"No API key found for {marketplace}. Please add integration first."
        )
    
    try:
        # REAL API CALL
        connector = get_connector(
            marketplace,
            marketplace_key.get('client_id', ''),
            marketplace_key['api_key']
        )
        
        logger.info(f"[{marketplace}] Fetching products via REAL API...")
        products = await connector.get_products()
        
        logger.info(f"✅ Successfully loaded {len(products)} REAL products from {marketplace}")
        return products
        
    except MarketplaceError as e:
        logger.error(f"❌ Marketplace API error: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail=f"{e.marketplace} API Error: {e.message}"
        )
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )

# ========== FBO SHIPMENTS ==========

@app.post("/api/inventory/fbo-shipment")
async def create_fbo_shipment(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Создать поставку на FBO"""
    marketplace = data.get('marketplace')
    warehouse = data.get('warehouse')
    products_data = data.get('products', [])
    
    # Создаем документ поставки
    shipment = {
        'seller_id': current_user['_id'],
        'marketplace': marketplace,
        'warehouse': warehouse,
        'status': 'created',
        'products': [],
        'created_at': datetime.utcnow()
    }
    
    total_items = 0
    
    # Обрабатываем каждый товар
    for prod in products_data:
        product_id = prod.get('id')
        quantity = int(prod.get('quantity', 0))
        
        if quantity <= 0:
            continue
        
        # Списываем с FBS
        inventory = await db.inventory.find_one({'product_id': ObjectId(product_id)})
        
        if inventory:
            new_qty = inventory['quantity'] - quantity
            if new_qty < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for product {prod.get('sku')}"
                )
            
            # Обновляем остатки FBS
            await db.inventory.update_one(
                {'_id': inventory['_id']},
                {'$set': {
                    'quantity': new_qty,
                    'available': new_qty - inventory['reserved']
                }}
            )
            
            # Записываем в историю
            await db.inventory_history.insert_one({
                'product_id': ObjectId(product_id),
                'operation_type': 'fbo_shipment',
                'quantity_change': -quantity,
                'reason': f'FBO Shipment to {marketplace} - {warehouse}',
                'user_id': current_user['_id'],
                'created_at': datetime.utcnow()
            })
            
            shipment['products'].append({
                'product_id': product_id,
                'sku': prod.get('sku'),
                'name': prod.get('name'),
                'quantity': quantity
            })
            
            total_items += quantity
    
    result = await db.fbo_shipments.insert_one(shipment)
    
    return {
        'message': f'FBO Shipment created. {total_items} items will be shipped.',
        'id': str(result.inserted_id),
        'total_items': total_items
    }

# Import and include product routes
try:
    from product_routes import router as product_router
    app.include_router(product_router)
    logger.info("Product routes included")
except Exception as e:
    logger.error(f"Failed to include product_routes: {e}")

# Skip warehouse_links_routes for now (requires proper dependency setup)
# try:
#     from warehouse_links_routes import router as warehouse_links_router
#     app.include_router(warehouse_links_router)
#     logger.info("Warehouse links routes included")
# except Exception as e:
#     logger.error(f"Failed to include warehouse_links_routes: {e}")

try:
    from order_routes import router as order_router
    app.include_router(order_router)
    logger.info("Order routes included")
except Exception as e:
    logger.error(f"Failed to include order_routes: {e}")

try:
    from finance_routes import router as finance_router
    app.include_router(finance_router)
    logger.info("Finance routes included")
except Exception as e:
    logger.error(f"Failed to include finance_routes: {e}")

# Skip analytics_routes for now (requires openai)
# try:
#     from analytics_routes import router as analytics_router
#     app.include_router(analytics_router)
#     logger.info("Analytics routes included")
# except Exception as e:
#     logger.error(f"Failed to include analytics_routes: {e}")

try:
    from admin_routes import router as admin_router
    app.include_router(admin_router)
    logger.info("Admin routes included")
except Exception as e:
    logger.error(f"Failed to include admin_routes: {e}")

# Skip marketplace_warehouse_routes for now (requires proper get_current_user setup)
# try:
#     from marketplace_warehouse_routes import router as marketplace_warehouse_router
#     app.include_router(marketplace_warehouse_router)
#     logger.info("Marketplace warehouse routes included")
# except Exception as e:
#     logger.error(f"Failed to include marketplace_warehouse_routes: {e}")

# Skip inventory_routes for now due to model issues
# try:
#     from inventory_routes import router as inventory_router
#     app.include_router(inventory_router)
#     logger.info("Inventory routes included")
# except Exception as e:
#     logger.error(f"Failed to include inventory_routes: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
@app.post("/api/products/import-from-marketplace")
async def import_product_from_marketplace(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Import product from marketplace with full data and auto-mapping"""
    import uuid
    
    marketplace_product = data.get('product')
    if not marketplace_product:
        raise HTTPException(status_code=400, detail="Product data required")
    
    sku = marketplace_product.get('sku', '')
    marketplace = marketplace_product.get('marketplace', 'unknown')
    
    if not sku:
        raise HTTPException(status_code=400, detail="SKU (артикул продавца) required")
    
    logger.info(f"📦 Importing product from {marketplace}: SKU={sku}, Name={marketplace_product.get('name', 'N/A')}")
    
    # Check if product with this SKU already exists
    existing_product = await db.products.find_one({"sku": sku, "seller_id": current_user["_id"]})
    
    if existing_product:
        logger.info(f"✅ Product already exists: {existing_product.get('name')}")
        
        # Update marketplace_data for existing product
        marketplace_data = existing_product.get("marketplace_data", {})
        marketplace_data[marketplace] = {
            "id": marketplace_product.get('id'),
            "barcode": marketplace_product.get('barcode', ''),
            "characteristics": marketplace_product.get('characteristics', []),
            "category": marketplace_product.get('category', ''),
            "brand": marketplace_product.get('brand', ''),
            "mapped_at": datetime.utcnow().isoformat()
        }
        
        await db.products.update_one(
            {"_id": existing_product["_id"]},
            {"$set": {"marketplace_data": marketplace_data, "updated_at": datetime.utcnow().isoformat()}}
        )
        
        return {
            "message": "Product already exists, mapping updated",
            "product_id": str(existing_product.get("_id")),
            "action": "mapped"
        }
    
    # Create new product from marketplace data
    product_id = str(uuid.uuid4())
    
    # Prepare attributes from characteristics
    attributes = {}
    for char in marketplace_product.get('characteristics', []):
        char_name = char.get('name', '')
        char_value = char.get('value', '')
        if char_name and char_value:
            attributes[char_name] = char_value
    
    # Prepare tags
    tags = []
    tag_from_request = data.get('tag', '').strip()
    if tag_from_request:
        tags.append(tag_from_request)
    
    new_product = {
        "_id": product_id,
        "sku": sku,
        "name": marketplace_product.get('name', 'Imported product'),
        "description": marketplace_product.get('description', ''),
        "price": marketplace_product.get('price', 0),
        "images": marketplace_product.get('photos', [])[:5],  # Max 5 photos
        "category_id": None,  # User can set later
        "tags": tags,  # Tags from import
        "status": "draft",
        "seller_id": current_user["_id"],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        
        # Attributes from characteristics
        "attributes": attributes,
        
        # Marketplace specific data with auto-mapping
        "marketplace_data": {
            marketplace: {
                "id": marketplace_product.get('id'),
                "barcode": marketplace_product.get('barcode', ''),
                "characteristics": marketplace_product.get('characteristics', []),
                "category": marketplace_product.get('category', ''),
                "brand": marketplace_product.get('brand', ''),
                "size": marketplace_product.get('size', ''),
                "mapped_at": datetime.utcnow().isoformat()
            }
        }
    }
    
    # Insert product
    await db.products.insert_one(new_product)
    
    logger.info(f"✅ Product imported and auto-mapped: {new_product['name']} (SKU: {sku})")
    logger.info(f"   Photos: {len(new_product['images'])}, Characteristics: {len(new_product.get('characteristics', []))}")
    
    return {
        "message": "Product imported successfully",
        "product_id": product_id,
        "action": "created",
        "product": {
            "id": product_id,
            "sku": sku,
            "name": new_product['name'],
            "photos_count": len(new_product['images']),
            "characteristics_count": len(attributes)
        }
    }

@app.put("/api/products/{product_id}/marketplace-mapping")
async def update_marketplace_mapping(
    product_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update marketplace mapping for existing product"""
    marketplace = data.get('marketplace')
    marketplace_id = data.get('marketplace_id')
    barcode = data.get('barcode', '')
    
    logger.info(f"🔗 Updating marketplace mapping: Product={product_id}, Marketplace={marketplace}, MP_ID={marketplace_id}")
    
    # Find product
    product = await db.products.find_one({"_id": product_id, "seller_id": current_user["_id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update marketplace_data
    marketplace_data = product.get("marketplace_data", {})
    marketplace_data[marketplace] = {
        "id": marketplace_id,
        "barcode": barcode,
        "mapped_at": datetime.utcnow().isoformat()
    }
    
    await db.products.update_one(
        {"_id": product_id},
        {"$set": {
            "marketplace_data": marketplace_data,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    logger.info(f"✅ Marketplace mapping saved for product {product_id}")
    
    return {"message": "Mapping saved successfully"}

# ========== WAREHOUSE MANAGEMENT ==========

class WarehouseCreate(BaseModel):
    name: str
    type: str  # main, marketplace, transit
    # Basic settings
    is_fbo: Optional[bool] = False
    send_stock: Optional[bool] = True
    load_orders: Optional[bool] = True
    use_for_orders: Optional[bool] = True
    priority: Optional[int] = 0
    default_cell: Optional[str] = ""
    # Marketplace connection
    marketplace_name: Optional[str] = None
    marketplace_warehouse_id: Optional[str] = None
    # Additional settings
    description: Optional[str] = ""
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    address: Optional[str] = ""
    brand: Optional[str] = ""
    working_hours: Optional[str] = ""
    assembly_hours: Optional[int] = 0
    storage_days: Optional[int] = 0
    online_payment: Optional[bool] = False
    cash_payment: Optional[bool] = False
    card_payment: Optional[bool] = False
    show_on_goods: Optional[bool] = False

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    # Basic settings
    is_fbo: Optional[bool] = None
    send_stock: Optional[bool] = None
    load_orders: Optional[bool] = None
    use_for_orders: Optional[bool] = None
    priority: Optional[int] = None
    default_cell: Optional[str] = None
    # Marketplace connection
    marketplace_name: Optional[str] = None
    marketplace_warehouse_id: Optional[str] = None
    # Additional settings
    description: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    address: Optional[str] = None
    brand: Optional[str] = None
    working_hours: Optional[str] = None
    assembly_hours: Optional[int] = None
    storage_days: Optional[int] = None
    online_payment: Optional[bool] = None
    cash_payment: Optional[bool] = None
    card_payment: Optional[bool] = None
    show_on_goods: Optional[bool] = None

class Warehouse(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    # Basic settings
    is_fbo: bool = False
    send_stock: bool = True
    load_orders: bool = True
    use_for_orders: bool = True
    priority: int = 0
    default_cell: str = ""
    # Marketplace connection
    marketplace_name: Optional[str] = None
    marketplace_warehouse_id: Optional[str] = None
    sync_with_main_warehouse_id: Optional[str] = None
    # Additional settings
    description: str = ""
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    address: str = ""
    brand: str = ""
    working_hours: str = ""
    assembly_hours: int = 0
    storage_days: int = 0
    online_payment: bool = False
    cash_payment: bool = False
    card_payment: bool = False
    show_on_goods: bool = False
    created_at: datetime
    updated_at: datetime

# ============ PRODUCTS MODELS ============

class ProductCreate(BaseModel):
    name: str
    sku: str  # Артикул
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[str] = None

class Product(BaseModel):
    id: str
    user_id: str
    name: str
    sku: str
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    created_at: datetime
    updated_at: datetime

# ============ STOCK MODELS ============

class StockCreate(BaseModel):
    product_id: str
    warehouse_id: str
    quantity: int

class StockUpdate(BaseModel):
    quantity: int

class Stock(BaseModel):
    id: str
    user_id: str
    product_id: str
    warehouse_id: str
    quantity: int
    updated_at: datetime

@app.post("/api/warehouses", status_code=201)
async def create_warehouse(
    warehouse_data: WarehouseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create new warehouse with business logic validation"""
    import uuid
    
    logger.info(f"🏪 Creating warehouse: {warehouse_data.name}, type: {warehouse_data.type}")
    
    # Check if main warehouse already exists
    main_warehouse = await db.warehouses.find_one({
        "user_id": current_user["_id"],
        "type": "main"
    })
    
    # Business logic: Only one main warehouse allowed
    if main_warehouse and warehouse_data.type == "main":
        raise HTTPException(
            status_code=400,
            detail="Основной склад может быть только один."
        )
    
    # Business logic: Main warehouse must be created first
    if not main_warehouse and warehouse_data.type != "main":
        raise HTTPException(
            status_code=400,
            detail="Сначала необходимо создать Основной склад."
        )
    
    # Validate type
    if warehouse_data.type not in ["main", "marketplace", "transit"]:
        raise HTTPException(
            status_code=400,
            detail="Неверный тип склада. Допустимые: main, marketplace, transit"
        )
    
    # Create warehouse
    warehouse_id = str(uuid.uuid4())
    new_warehouse = {
        "_id": warehouse_id,
        "user_id": current_user["_id"],
        "name": warehouse_data.name,
        "type": warehouse_data.type,
        "address": warehouse_data.address or "",
        "description": warehouse_data.description or "",
        "marketplace_name": warehouse_data.marketplace_name,
        "marketplace_warehouse_id": warehouse_data.marketplace_warehouse_id,
        "sync_with_main_warehouse_id": None,
        "is_fbo": warehouse_data.is_fbo,
        "send_stock": warehouse_data.send_stock,
        "load_orders": warehouse_data.load_orders,
        "use_for_orders": warehouse_data.use_for_orders,
        "priority": warehouse_data.priority,
        "default_cell": warehouse_data.default_cell,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.warehouses.insert_one(new_warehouse)
    
    logger.info(f"✅ Warehouse created: {new_warehouse['name']} (ID: {warehouse_id})")
    
    return {
        "id": warehouse_id,
        "user_id": str(current_user["_id"]),
        "name": new_warehouse["name"],
        "type": new_warehouse["type"],
        "address": new_warehouse["address"],
        "description": new_warehouse.get("description", ""),
        "is_fbo": new_warehouse.get("is_fbo", False),
        "send_stock": new_warehouse.get("send_stock", True),
        "load_orders": new_warehouse.get("load_orders", True),
        "use_for_orders": new_warehouse.get("use_for_orders", True),
        "priority": new_warehouse.get("priority", 0),
        "created_at": new_warehouse["created_at"],
        "updated_at": new_warehouse["updated_at"]
    }

@app.get("/api/warehouses", response_model=List[Warehouse])
async def get_warehouses(current_user: dict = Depends(get_current_user)):
    """Get all warehouses for current user"""
    warehouses = await db.warehouses.find({"user_id": current_user["_id"]}).to_list(length=100)
    
    result = []
    for wh in warehouses:
        result.append(Warehouse(
            id=str(wh["_id"]),
            user_id=str(wh["user_id"]),
            name=wh["name"],
            type=wh["type"],
            address=wh.get("address", ""),
            comment=wh.get("comment", ""),
            created_at=datetime.fromisoformat(wh["created_at"]) if isinstance(wh["created_at"], str) else wh["created_at"],
            updated_at=datetime.fromisoformat(wh["updated_at"]) if isinstance(wh["updated_at"], str) else wh["updated_at"]
        ))
    
    return result


@app.get("/api/warehouses/{warehouse_id}")
async def get_warehouse(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific warehouse by ID"""
    logger.info(f"📦 Getting warehouse: {warehouse_id}")
    
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    return {
        "id": str(warehouse["_id"]),
        "user_id": str(warehouse["user_id"]),
        "name": warehouse["name"],
        "type": warehouse.get("type", "main"),
        "address": warehouse.get("address", ""),
        "comment": warehouse.get("comment", ""),
        "description": warehouse.get("description", ""),
        "is_fbo": warehouse.get("is_fbo", False),
        "send_stock": warehouse.get("send_stock", True),
        "load_orders": warehouse.get("load_orders", True),
        "use_for_orders": warehouse.get("use_for_orders", True),
        "priority": warehouse.get("priority", 0),
        "default_cell": warehouse.get("default_cell", ""),
        "longitude": warehouse.get("longitude"),
        "latitude": warehouse.get("latitude"),
        "brand": warehouse.get("brand", ""),
        "working_hours": warehouse.get("working_hours", ""),
        "assembly_hours": warehouse.get("assembly_hours", 0),
        "storage_days": warehouse.get("storage_days", 0),
        "online_payment": warehouse.get("online_payment", False),
        "cash_payment": warehouse.get("cash_payment", False),
        "card_payment": warehouse.get("card_payment", False),
        "show_on_goods": warehouse.get("show_on_goods", False),
        "marketplace_name": warehouse.get("marketplace_name"),
        "marketplace_warehouse_id": warehouse.get("marketplace_warehouse_id"),
        "sync_with_main_warehouse_id": warehouse.get("sync_with_main_warehouse_id"),
        "created_at": warehouse.get("created_at"),
        "updated_at": warehouse.get("updated_at")
    }

@app.put("/api/warehouses/{warehouse_id}")
async def update_warehouse(
    warehouse_id: str,
    warehouse_data: WarehouseUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update warehouse (cannot change type)"""
    logger.info(f"✏️ Updating warehouse: {warehouse_id}")
    
    # Find warehouse
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Склад не найден")
    
    # Prepare update data (only allowed fields)
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    if warehouse_data.name is not None:
        update_data["name"] = warehouse_data.name
    if warehouse_data.address is not None:
        update_data["address"] = warehouse_data.address
    if warehouse_data.comment is not None:
        update_data["comment"] = warehouse_data.comment
    
    # Update warehouse
    await db.warehouses.update_one(
        {"_id": warehouse_id},
        {"$set": update_data}
    )
    
    logger.info(f"✅ Warehouse updated: {warehouse_id}")
    
    return {"message": "Склад успешно обновлён", "warehouse_id": warehouse_id}

@app.delete("/api/warehouses/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete warehouse (cannot delete main warehouse)"""
    logger.info(f"🗑️ Attempting to delete warehouse: {warehouse_id}")
    
    # Find warehouse
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Склад не найден")
    
    # Business logic: Cannot delete main warehouse
    if warehouse["type"] == "main":
        raise HTTPException(
            status_code=400,
            detail="Основной склад не может быть удален."
        )
    
    # Delete warehouse
    await db.warehouses.delete_one({"_id": warehouse_id})
    
    logger.info(f"✅ Warehouse deleted: {warehouse_id}")
    
    return {"success": True, "message": "Склад успешно удален."}

@app.get("/api/integrations/{integration_id}/warehouses")
async def get_integration_warehouses(
    integration_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get warehouses from marketplace API"""
    from connectors import get_connector, MarketplaceError
    
    logger.info(f"📦 Loading warehouses from integration: {integration_id}")
    
    # Get API key
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_keys = profile.get('api_keys', [])
    api_key = next((k for k in api_keys if k.get('id') == integration_id), None)
    
    if not api_key:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Validate API key
    if not api_key.get('api_key'):
        raise HTTPException(status_code=400, detail=f"API key not configured for {api_key.get('marketplace', 'this integration')}")
    
    logger.info(f"📍 Marketplace: {api_key['marketplace']}, Client ID: {api_key.get('client_id', 'N/A')[:10]}...")
    
    try:
        connector = get_connector(
            api_key['marketplace'],
            api_key.get('client_id', ''),
            api_key['api_key']
        )
        
        warehouses = await connector.get_warehouses()
        
        logger.info(f"✅ Loaded {len(warehouses)} warehouses from {api_key['marketplace']}")
        
        return {
            "marketplace": api_key['marketplace'],
            "warehouses": warehouses
        }
        
    except MarketplaceError as e:
        logger.error(f"❌ Failed to load warehouses: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)

@app.get("/api/marketplaces/{marketplace}/all-warehouses")
async def get_all_marketplace_warehouses(
    marketplace: str,
    current_user: dict = Depends(get_current_user)
):
    """Get warehouses from ALL integrations of specific marketplace - like SelSup"""
    from connectors import get_connector, MarketplaceError
    
    logger.info(f"📦 Loading ALL warehouses from marketplace: {marketplace}")
    
    # Get all API keys for this marketplace
    profile = await db.seller_profiles.find_one({'user_id': current_user['_id']})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    api_keys = profile.get('api_keys', [])
    marketplace_keys = [k for k in api_keys if k.get('marketplace') == marketplace]
    
    if not marketplace_keys:
        return {
            "marketplace": marketplace,
            "warehouses": [],
            "message": f"No API keys configured for {marketplace}. Please add integration first."
        }
    
    logger.info(f"📍 Found {len(marketplace_keys)} integration(s) for {marketplace}")
    
    # Collect warehouses from ALL integrations
    all_warehouses = []
    seen_warehouse_ids = set()
    
    for api_key in marketplace_keys:
        if not api_key.get('api_key'):
            continue
        
        try:
            connector = get_connector(
                marketplace,
                api_key.get('client_id', ''),
                api_key['api_key']
            )
            
            warehouses = await connector.get_warehouses()
            
            # Add integration_id to each warehouse and deduplicate
            for wh in warehouses:
                wh_id = wh.get('id')
                if wh_id not in seen_warehouse_ids:
                    wh['integration_id'] = api_key.get('id')
                    wh['integration_name'] = api_key.get('name', api_key.get('client_id', 'Integration'))
                    all_warehouses.append(wh)
                    seen_warehouse_ids.add(wh_id)
            
            logger.info(f"✅ Loaded {len(warehouses)} warehouses from integration {api_key.get('id')[:8]}...")
            
        except MarketplaceError as e:
            logger.warning(f"⚠️ Failed to load from one integration: {e.message}")
            continue
        except Exception as e:
            logger.warning(f"⚠️ Unexpected error: {str(e)}")
            continue
    
    logger.info(f"✅ Total loaded {len(all_warehouses)} unique warehouses from {marketplace}")
    
    return {
        "marketplace": marketplace,
        "warehouses": all_warehouses
    }

@app.put("/api/warehouses/{warehouse_id}/link")
async def link_warehouse(
    warehouse_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Link marketplace warehouse to main warehouse"""
    main_warehouse_id = data.get('main_warehouse_id')
    
    logger.info(f"🔗 Linking warehouse {warehouse_id} to main warehouse {main_warehouse_id}")
    
    # Find warehouse
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Update link
    update_data = {
        "sync_with_main_warehouse_id": main_warehouse_id,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.warehouses.update_one(
        {"_id": warehouse_id},
        {"$set": update_data}
    )
    
    logger.info(f"✅ Warehouse link updated")
    


# ============================================================================
# WAREHOUSE LINKS ENDPOINTS
# ============================================================================

@app.get("/api/warehouses/{warehouse_id}/links")
async def get_warehouse_links(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all links for a warehouse"""
    logger.info(f"📋 Getting links for warehouse: {warehouse_id}")
    
    # Verify warehouse belongs to user
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Get links
    links = await db.warehouse_links.find({
        "warehouse_id": warehouse_id
    }).to_list(length=100)
    
    logger.info(f"✅ Found {len(links)} links")
    return links


@app.post("/api/warehouses/{warehouse_id}/links")
async def create_warehouse_link(
    warehouse_id: str,
    link_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a new warehouse link"""
    import uuid
    
    logger.info(f"🔗 Creating link for warehouse: {warehouse_id}")
    
    # Verify warehouse belongs to user
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Check if link already exists
    existing = await db.warehouse_links.find_one({
        "warehouse_id": warehouse_id,
        "marketplace_warehouse_id": link_data.get("marketplace_warehouse_id")
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Link already exists")
    
    # Create link
    link = {
        "id": str(uuid.uuid4()),
        "warehouse_id": warehouse_id,
        "integration_id": link_data.get("integration_id"),
        "marketplace_name": link_data.get("marketplace_name"),
        "marketplace_warehouse_id": link_data.get("marketplace_warehouse_id"),
        "marketplace_warehouse_name": link_data.get("marketplace_warehouse_name"),
        "send_stock": link_data.get("send_stock", True),  # Default to True
        "created_at": datetime.utcnow().isoformat(),
        "user_id": current_user["_id"]
    }
    
    await db.warehouse_links.insert_one(link)
    
    logger.info(f"✅ Link created: {link['id']}")
    return {"message": "Link created successfully", "link": link}


@app.delete("/api/warehouses/{warehouse_id}/links/{link_id}")
async def delete_warehouse_link(
    warehouse_id: str,
    link_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a warehouse link"""
    logger.info(f"🗑️ Deleting link: {link_id}")
    
    # Verify warehouse belongs to user
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Delete link
    result = await db.warehouse_links.delete_one({
        "id": link_id,
        "warehouse_id": warehouse_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    
    logger.info(f"✅ Link deleted: {link_id}")
    return {"message": "Link deleted successfully"}


@app.put("/api/warehouses/{warehouse_id}/links/{link_id}")
async def update_warehouse_link(
    warehouse_id: str,
    link_id: str,
    link_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update warehouse link (e.g., send_stock flag)"""
    logger.info(f"📝 Updating link: {link_id}")
    
    # Verify warehouse belongs to user
    warehouse = await db.warehouses.find_one({
        "_id": warehouse_id,
        "user_id": current_user["_id"]
    })
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Update link
    update_fields = {}
    if "send_stock" in link_data:
        update_fields["send_stock"] = link_data["send_stock"]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.warehouse_links.update_one(
        {"id": link_id, "warehouse_id": warehouse_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    
    logger.info(f"✅ Link updated: {link_id}")
    return {"message": "Link updated successfully"}


    return {"message": "Связь установлена", "warehouse_id": warehouse_id}


# ============================================
# PRODUCTS ENDPOINTS
# ============================================

@app.post("/api/products", status_code=201)
async def create_product(
    product_data: ProductCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create new product"""
    import uuid
    
    logger.info(f"📦 Creating product: {product_data.name} (SKU: {product_data.sku})")
    
    # Check if SKU already exists
    existing = await db.products.find_one({
        "user_id": current_user["_id"],
        "sku": product_data.sku
    })
    
    if existing:
        logger.warning(f"❌ Product with SKU {product_data.sku} already exists")
        raise HTTPException(
            status_code=400,
            detail=f"Товар с артикулом {product_data.sku} уже существует"
        )
    
    product_id = str(uuid.uuid4())
    new_product = {
        "_id": product_id,
        "user_id": current_user["_id"],
        "name": product_data.name,
        "sku": product_data.sku,
        "category": product_data.category or "",
        "description": product_data.description or "",
        "image_url": product_data.image_url or "",
        "price": product_data.price or 0.0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.products.insert_one(new_product)
    
    logger.info(f"✅ Product created: {new_product['name']} (SKU: {new_product['sku']})")
    
    return {
        "id": product_id,
        "user_id": str(current_user["_id"]),
        "name": new_product["name"],
        "sku": new_product["sku"],
        "category": new_product["category"],
        "description": new_product["description"],
        "image_url": new_product["image_url"],
        "price": new_product["price"],
        "created_at": new_product["created_at"],
        "updated_at": new_product["updated_at"]
    }

@app.get("/api/products", response_model=List[Product])
async def get_products(current_user: dict = Depends(get_current_user)):
    """Get all products for current user"""
    logger.info(f"📦 Fetching products for user {current_user['_id']}")
    
    products = await db.products.find({"user_id": current_user["_id"]}).to_list(length=1000)
    
    result = []
    for p in products:
        result.append(Product(
            id=str(p["_id"]),
            user_id=str(p["user_id"]),
            name=p["name"],
            sku=p["sku"],
            category=p.get("category"),
            description=p.get("description"),
            image_url=p.get("image_url"),
            price=p.get("price"),
            created_at=datetime.fromisoformat(p["created_at"]),
            updated_at=datetime.fromisoformat(p["updated_at"])
        ))
    
    logger.info(f"✅ Found {len(result)} products")
    return result

@app.put("/api/products/{product_id}")
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update product"""
    logger.info(f"📦 Updating product: {product_id}")
    
    product = await db.products.find_one({
        "_id": product_id,
        "user_id": current_user["_id"]
    })
    
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    if product_data.name is not None:
        update_data["name"] = product_data.name
    if product_data.category is not None:
        update_data["category"] = product_data.category
    if product_data.description is not None:
        update_data["description"] = product_data.description
    if product_data.image_url is not None:
        update_data["image_url"] = product_data.image_url
    if product_data.price is not None:
        update_data["price"] = product_data.price
    
    await db.products.update_one(
        {"_id": product_id},
        {"$set": update_data}
    )
    
    logger.info(f"✅ Product updated: {product_id}")
    
    return {"message": "Товар успешно обновлён", "product_id": product_id}

@app.delete("/api/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete product"""
    logger.info(f"📦 Deleting product: {product_id}")
    
    product = await db.products.find_one({
        "_id": product_id,
        "user_id": current_user["_id"]
    })
    
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Check if product has stock
    stock_count = await db.stock.count_documents({"product_id": product_id})
    
    if stock_count > 0:
        logger.warning(f"❌ Cannot delete product {product_id}: has stock records")
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить товар, у которого есть остатки на складах. Сначала обнулите остатки."
        )
    
    await db.products.delete_one({"_id": product_id})
    
    logger.info(f"✅ Product deleted: {product_id}")
    
    return {"success": True, "message": "Товар успешно удален"}

# ============================================
# STOCK ENDPOINTS
# ============================================

@app.post("/api/stock", status_code=201)
async def create_or_update_stock(
    stock_data: StockCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create or update stock for product in warehouse"""
    logger.info(f"📊 Setting stock: product {stock_data.product_id}, warehouse {stock_data.warehouse_id}, qty {stock_data.quantity}")
    
    # Check if product exists
    product = await db.products.find_one({
        "_id": stock_data.product_id,
        "user_id": current_user["_id"]
    })
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Check if warehouse exists
    warehouse = await db.warehouses.find_one({
        "_id": stock_data.warehouse_id,
        "user_id": current_user["_id"]
    })
    if not warehouse:
        raise HTTPException(status_code=404, detail="Склад не найден")
    
    # Check if stock record already exists
    existing_stock = await db.stock.find_one({
        "user_id": current_user["_id"],
        "product_id": stock_data.product_id,
        "warehouse_id": stock_data.warehouse_id
    })
    
    if existing_stock:
        # Update existing record
        await db.stock.update_one(
            {"_id": existing_stock["_id"]},
            {"$set": {
                "quantity": stock_data.quantity,
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        logger.info(f"✅ Stock updated: {existing_stock['_id']}")
        return {"message": "Остатки обновлены", "stock_id": str(existing_stock["_id"])}
    else:
        # Create new record
        import uuid
        stock_id = str(uuid.uuid4())
        new_stock = {
            "_id": stock_id,
            "user_id": current_user["_id"],
            "product_id": stock_data.product_id,
            "warehouse_id": stock_data.warehouse_id,
            "quantity": stock_data.quantity,
            "updated_at": datetime.utcnow().isoformat()
        }
        await db.stock.insert_one(new_stock)
        logger.info(f"✅ Stock created: {stock_id}")
        return {"message": "Остатки созданы", "stock_id": stock_id}

@app.get("/api/stock")
async def get_stock(current_user: dict = Depends(get_current_user)):
    """Get all stock records with product and warehouse details"""
    logger.info(f"📊 Fetching stock for user {current_user['_id']}")
    
    stock_records = await db.stock.find({"user_id": current_user["_id"]}).to_list(length=10000)
    
    result = []
    for record in stock_records:
        # Get product info
        product = await db.products.find_one({"_id": record["product_id"]})
        # Get warehouse info
        warehouse = await db.warehouses.find_one({"_id": record["warehouse_id"]})
        
        result.append({
            "id": str(record["_id"]),
            "product": {
                "id": str(product["_id"]),
                "name": product["name"],
                "sku": product["sku"],
                "image_url": product.get("image_url")
            } if product else None,
            "warehouse": {
                "id": str(warehouse["_id"]),
                "name": warehouse["name"],
                "type": warehouse["type"]
            } if warehouse else None,
            "quantity": record["quantity"],
            "updated_at": record["updated_at"]
        })
    
    logger.info(f"✅ Found {len(result)} stock records")
    return result
