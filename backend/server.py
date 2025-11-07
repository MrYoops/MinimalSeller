from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
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

# Import and include product routes
from products_routes import router as products_router, init_routes
from ai_routes import router as ai_router, init_ai_routes

# Initialize routes with dependencies after app startup
@app.on_event("startup")
async def setup_routes():
    init_routes(db, get_current_user, require_role)
    init_ai_routes(get_current_user)
    app.include_router(products_router)
    app.include_router(ai_router)
    logger.info("Product and AI routes initialized")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)