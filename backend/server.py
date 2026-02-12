
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
from pathlib import Path

# Core imports
from core.config import settings, validate_settings
from core.logging import setup_logging
from core.database import client, db
from services.auth_service import AuthService
from schemas.user import UserRole
import os

# Routers
from routers import (
    auth, users, keys, products, products_old,
    admin, ai, analytics, categories, categories_v2, categories_internal,
    export, orders_fbs, orders_fbo, orders_retail, orders, orders_income,
    inventory, inventory_stock, stock_operations, stock_sync,
    warehouses, warehouses_marketplace, warehouse_links,
    suppliers, finance, reports_parser, ozon_bonuses, ozon_reports,
    analytics_profit
)

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Config validation
if not validate_settings():
    logger.warning("⚠️ Configuration issues detected but starting anyway.")

# Initialize App
app = FastAPI(title="MinimalMod API")

# Rate Limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - исправленная конфигурация безопасности
cors_origins = settings.cors_origins_list
logger.info(f"[CORS] Origins: {cors_origins}")

# В режиме разработки разрешаем все локальные origins
if settings.DEBUG:
    cors_origins.extend([
        "http://localhost:3000",
        "http://localhost:3002",  # Добавляем порт 3002
        "http://localhost:5173", 
        "http://localhost:8001",
        "http://localhost:8002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",  # Добавляем порт 3002
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8001",
        "http://127.0.0.1:8002",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:3002",  # Добавляем порт 3002
        "http://0.0.0.0:5173",
        "http://0.0.0.0:8001",
        "http://0.0.0.0:8002"
    ])
    # Remove duplicates
    cors_origins = list(set(cors_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # logger.info(f"Request: {request.method} {request.url.path}")
    response = await call_next(request)
    # logger.info(f"Response: {response.status_code}")
    return response

# Security Headers
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Startup/Shutdown
@app.on_event("startup")
async def startup_db_client():
    from core.database import client # Ensure client is init
    logger.info(f"Connected to MongoDB at {settings.get_mongo_url()}")
    
    # Create default admin
    await create_default_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    from core.database import client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")

from services.auth_service import AuthService
from schemas.user import UserRole, UserCreate
from core.database import db
from datetime import datetime

async def create_default_admin():
    # Use direct DB access to avoid validation overrides or just check existence
    admin = await db.users.find_one({"role": UserRole.ADMIN})
    if not admin:
        logger.info("Creating default admin...")
        try:
             # Manually insert to avoid duplicate email check in register_user if implemented differently
             # But here we use AuthService helper if possible? 
             # AuthService.register_user expects UserCreate.
             # But we want to set role=ADMIN.
             password_hash = AuthService.get_password_hash("admin123")
             await db.users.insert_one({
                 "email": "admin@minimalmod.com",
                 "password_hash": password_hash,
                 "full_name": "Administrator",
                 "role": UserRole.ADMIN,
                 "is_active": True,
                 "created_at": datetime.utcnow()
             })
             logger.info("Default admin created: admin@minimalmod.com / admin123")
        except Exception as e:
            logger.error(f"Failed to create admin: {e}")

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(keys.router)
app.include_router(products.router)
app.include_router(products_old.router)
app.include_router(inventory.router)
# app.include_router(inventory_stock.router)  # Временно отключен из-за ошибок импорта

# Legacy Routers moved to Routers
app.include_router(admin.router)
app.include_router(ai.router)
# app.include_router(analytics.router)
app.include_router(categories.router)
app.include_router(categories_v2.router)
app.include_router(categories_internal.router)
# app.include_router(export.router)
app.include_router(orders_fbs.router)
app.include_router(orders_fbo.router)
app.include_router(orders_retail.router)
app.include_router(orders.router)
app.include_router(orders_income.router)
app.include_router(inventory.router)
app.include_router(inventory_stock.router)
app.include_router(stock_operations.router)
app.include_router(stock_sync.router)
app.include_router(warehouses.router)
app.include_router(warehouses_marketplace.router)
app.include_router(warehouse_links.router)
app.include_router(suppliers.router)
app.include_router(finance.router)
app.include_router(reports_parser.router)
app.include_router(ozon_bonuses.router)
app.include_router(ozon_reports.router)
app.include_router(analytics_profit.router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "MinimalMod API V2"}

from datetime import datetime
