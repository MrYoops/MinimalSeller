"""
Общие утилиты для аутентификации
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from jose import JWTError, jwt
from bson import ObjectId
from pathlib import Path

from core.database import get_database
from core.config import settings

# Определяем путь к корню проекта динамически
PROJECT_ROOT = Path(__file__).parent.parent
DEBUG_LOG_PATH = PROJECT_ROOT / ".cursor" / "debug.log"
DEBUG_LOG_PATH.parent.mkdir(exist_ok=True)

# HTTPBearer с auto_error=False для OPTIONS запросов
security = HTTPBearer(auto_error=False)

# Используем SECRET_KEY из config для единообразия
SECRET_KEY = settings.get_secret_key()
ALGORITHM = settings.JWT_ALGORITHM


async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """
    Получить текущего пользователя из JWT токена
    ВАЖНО: auto_error=False позволяет OPTIONS запросам проходить без токена
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # #region agent log
    import json
    import time
    try:
        with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
            f.write(json.dumps({"id":"log_get_current_user_called","timestamp":int(time.time()*1000),"location":"auth_utils.py:25","message":"get_current_user called","data":{"method":request.method,"has_credentials":credentials is not None},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + '\n')
    except Exception as e:
        logger.error(f"Failed to write debug log: {e}")
    # #endregion
    
    # КРИТИЧНО: Для OPTIONS запросов НЕ требуем авторизацию - CORS middleware обработает их
    # Но если запрос все равно дошел сюда, значит явный OPTIONS endpoint не сработал
    if request.method == "OPTIONS":
        # #region agent log
        try:
            with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
                f.write(json.dumps({"id":"log_options_in_auth","timestamp":int(time.time()*1000),"location":"auth_utils.py:45","message":"OPTIONS request reached auth - should not happen","data":{},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + '\n')
        except Exception as e:
            pass
        # #endregion
        # Это не должно происходить, но на всякий случай возвращаем None
        return None
    
    # Для всех остальных запросов требуем авторизацию
    if not credentials:
        # #region agent log
        try:
            with open(str(DEBUG_LOG_PATH), 'a', encoding='utf-8') as f:
                f.write(json.dumps({"id":"log_no_credentials","timestamp":int(time.time()*1000),"location":"auth_utils.py:45","message":"No credentials provided for non-OPTIONS request","data":{"method":request.method},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + '\n')
        except Exception as e:
            pass
        # #endregion
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    db = await get_database()
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.warning("Token payload missing 'sub' field")
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError as e:
        logger.warning(f"JWT validation error: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error validating token: {str(e)}")
        raise credentials_exception
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            logger.warning(f"User not found: {user_id}")
            raise credentials_exception
    except Exception as e:
        logger.error(f"Error finding user: {str(e)}")
        raise credentials_exception
    
    return user
