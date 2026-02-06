from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import logging
import asyncio

from backend.core.database import get_database
from stock_sync_routes import sync_product_to_marketplace

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def sync_all_stocks_job():
    """
    Автоматическая синхронизация всех остатков каждые 15 минут
    
    Логика:
    - Берём все товары из inventory
    - Для каждого товара находим склады с sends_stock=True
    - Синхронизируем на все связанные МП склады
    """
    logger.info("[SCHEDULER] Starting automatic stock synchronization...")
    
    try:
        db = await get_database()
        
        # Получить все уникальные seller_id
        pipeline = [
            {"$group": {"_id": "$seller_id"}}
        ]
        sellers = await db.inventory.aggregate(pipeline).to_list(length=1000)
        
        total_synced = 0
        total_products = 0
        
        for seller_doc in sellers:
            seller_id = seller_doc["_id"]
            
            # Получить все склады продавца с sends_stock=True
            warehouses = await db.warehouses.find({
                "seller_id": str(seller_id),
                "sends_stock": True
            }).to_list(length=100)
            
            if not warehouses:
                logger.info(f"[SCHEDULER] No active warehouses for seller {seller_id}")
                continue
            
            # Получить все inventory записи продавца
            inventories = await db.inventory.find({
                "seller_id": str(seller_id)
            }).to_list(length=10000)
            
            total_products += len(inventories)
            
            # Синхронизировать каждый товар на все активные склады
            for inv in inventories:
                product = await db.product_catalog.find_one({"_id": inv["product_id"]})
                
                if not product:
                    continue
                
                article = product.get("article")
                quantity = inv.get("available", 0)
                
                # Синхронизировать на каждый активный склад
                for warehouse in warehouses:
                    try:
                        await sync_product_to_marketplace(
                            db,
                            seller_id,
                            warehouse["id"],
                            article,
                            quantity
                        )
                        total_synced += 1
                    except Exception as e:
                        logger.error(f"[SCHEDULER] Failed to sync {article} to warehouse {warehouse.get('name')}: {e}")
        
        logger.info(f"[SCHEDULER] ✅ Automatic sync completed: {total_synced} products synced across all sellers")
        
    except Exception as e:
        logger.error(f"[SCHEDULER] ❌ Automatic sync failed: {e}")


def start_scheduler():
    """
    Запустить планировщик автоматической синхронизации
    
    Синхронизация запускается каждые 15 минут
    """
    # Добавить задачу синхронизации каждые 15 минут
    scheduler.add_job(
        sync_all_stocks_job,
        trigger=IntervalTrigger(minutes=15),
        id='stock_sync_job',
        name='Automatic stock synchronization',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("[SCHEDULER] ✅ Stock synchronization scheduler started (every 15 minutes)")


def stop_scheduler():
    """
    Остановить планировщик
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[SCHEDULER] Stock synchronization scheduler stopped")
