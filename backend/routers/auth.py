
from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.services.auth_service import AuthService
from backend.schemas.user import UserCreate, User, UserLogin
from backend.schemas.auth import Token

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/register", response_model=dict)
async def register(user_data: UserCreate):
    user = await AuthService.register_user(user_data)
    return {
        "message": "Registration successful. Waiting for admin approval.",
        "email": user["email"]
    }

@router.post("/login", response_model=Token)
async def login(request: Request, credentials: UserLogin):
    user = await AuthService.authenticate_user(credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not activated. Waiting for admin approval."
        )
            
    access_token = AuthService.create_access_token(
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

@router.get("/me", response_model=User)
async def get_me(current_user: dict = Depends(AuthService.get_current_user)):
    return User(
        id=str(current_user["_id"]),
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        is_active=current_user["is_active"],
        created_at=current_user["created_at"],
        last_login_at=current_user.get("last_login_at")
    )
