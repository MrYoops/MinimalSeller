
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from bson import ObjectId

from backend.core.config import settings
from backend.core.database import get_database
from backend.schemas.user import UserCreate, UserRole, User
from backend.schemas.auth import Token

# Security tools
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = settings.get_secret_key()
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.get_token_expire_minutes()

class AuthService:
    @staticmethod
    def verify_password(plain_password, hashed_password):
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password):
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    @classmethod
    async def get_current_user(cls, credentials: HTTPAuthorizationCredentials = Depends(security)):
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
        
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise credentials_exception
        return user

    @classmethod
    def require_role(cls, required_role: str):
        async def role_checker(current_user: dict = Depends(cls.get_current_user)):
            if current_user["role"] != required_role and required_role != "any":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            return current_user
        return role_checker

    @classmethod
    async def register_user(cls, user_data: UserCreate):
        db = await get_database()
        
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
            "password_hash": cls.get_password_hash(user_data.password),
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
        
        return user

    @classmethod
    async def authenticate_user(cls, email: str, password: str):
        db = await get_database()
        user = await db.users.find_one({"email": email})
        
        if not user:
            return None
            
        password_hash = user.get("password_hash") or user.get("hashed_password")
        if not password_hash:
            return None
            
        if not cls.verify_password(password, password_hash):
            return None
            
        # Update last login
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login_at": datetime.utcnow()}}
        )
            
        return user
