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
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
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
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
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
    return [
        APIKey(
            id=str(key.get("_id", "")),
            marketplace=key["marketplace"],
            client_id=key["client_id"],
            api_key_masked="***" + key["api_key"][-4:] if len(key["api_key"]) > 4 else "***",
            created_at=key.get("created_at", datetime.utcnow())
        )
        for key in api_keys
    ]

@app.post("/api/seller/api-keys")
async def add_api_key(
    key_data: APIKeyCreate,
    current_user: dict = Depends(require_role(UserRole.SELLER))
):
    # Validate marketplace
    if key_data.marketplace not in ["ozon", "wb", "yandex"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid marketplace. Use: ozon, wb, or yandex"
        )
    
    new_key = {
        "_id": ObjectId(),
        "marketplace": key_data.marketplace,
        "client_id": key_data.client_id,
        "api_key": key_data.api_key,  # In production, encrypt this
        "created_at": datetime.utcnow()
    }
    
    await db.seller_profiles.update_one(
        {"user_id": current_user["_id"]},
        {"$push": {"api_keys": new_key}}
    )
    
    return {"message": "API key added successfully", "key_id": str(new_key["_id"])}

@app.delete("/api/seller/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(require_role(UserRole.SELLER))
):
    result = await db.seller_profiles.update_one(
        {"user_id": current_user["_id"]},
        {"$pull": {"api_keys": {"_id": ObjectId(key_id)}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"message": "API key deleted successfully"}

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

# Import and include product routes
try:
    from products_routes import router as products_router
    from ai_routes import router as ai_router
    app.include_router(products_router)
    app.include_router(ai_router)
    logger.info("Product and AI routes included")
except Exception as e:
    logger.error(f"Failed to include routes: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)