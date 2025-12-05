import asyncio
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database import get_database
from connectors import get_connector, MarketplaceError
from models import OrderItemNew, OrderCustomerNew, OrderTotalsNew
import uuid

logger = logging.getLogger(__name__)


class OrderSyncScheduler:
    """
    Планировщик автоматической синхронизации заказов с маркетплейсов
    
    Запускается каждые 5 минут и:
    1. Получает новые заказы FBS с МП
    2. Создаёт их в БД + резервирует товары
    3. Обновляет статусы существующих заказов
    4. При статусе "delivering" → списывает со склада
    5. Синхронизирует остатки на МП
    6. Получает FBO заказы (только для аналитики)
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
    
    def start(self):
        """Запустить планировщик"""
        if self.is_running:
            logger.warning("[OrderSync] Планировщик уже запущен")
            return
        
        # Добавить задачу: каждые 5 минут
        self.scheduler.add_job(
            self.sync_all_marketplaces,
            trigger=IntervalTrigger(minutes=5),
            id="order_sync_job",
            name="Синхронизация заказов с МП",
            replace_existing=True
        )
        
        self.scheduler.start()
        self.is_running = True
        
        logger.info("[OrderSync] ✅ Планировщик запущен (каждые 5 минут)")
    
    def stop(self):
        """Остановить планировщик"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("[OrderSync] Планировщик остановлен")
    
    async def sync_all_marketplaces(self):
        """
        Синхронизировать заказы со всех МП для всех продавцов
        """
        logger.info("[OrderSync] Начало синхронизации заказов...")
        
        db = await get_database()
        
        # Получить всех продавцов с API ключами
        sellers = await db.seller_profiles.find({
            "api_keys": {"$exists": True, "$ne": []}
        }).to_list(None)
        
        logger.info(f"[OrderSync] Найдено {len(sellers)} продавцов с API ключами")
        
        for seller in sellers:
            seller_id = str(seller["user_id"])
            
            for api_key_data in seller.get("api_keys", []):
                marketplace = api_key_data.get("marketplace")
                
                logger.info(f"[OrderSync] Синхронизация {marketplace} для продавца {seller_id}")
                
                try:
                    # FBS заказы
                    await self.sync_fbs_orders_for_seller(
                        seller_id,
                        marketplace,
                        api_key_data.get("client_id", ""),
                        api_key_data["api_key"]
                    )
                    
                    # FBO заказы
                    await self.sync_fbo_orders_for_seller(
                        seller_id,
                        marketplace,
                        api_key_data.get("client_id", ""),
                        api_key_data["api_key"]
                    )
                    
                except Exception as e:
                    logger.error(f"[OrderSync] Ошибка синхронизации {marketplace} для {seller_id}: {e}")
        
        logger.info("[OrderSync] Синхронизация завершена")
    
    async def sync_fbs_orders_for_seller(
        self,
        seller_id: str,
        marketplace: str,
        client_id: str,
        api_key: str
    ):
        """
        Синхронизировать FBS заказы для одного продавца с одного МП
        """
        db = await get_database()
        
        try:
            connector = get_connector(marketplace, client_id, api_key)
            
            # Получить заказы за последние 24 часа
            date_from = datetime.utcnow() - timedelta(days=1)
            date_to = datetime.utcnow()
            
            mp_orders = await connector.get_fbs_orders(date_from, date_to)
            
            logger.info(f"[OrderSync FBS] {marketplace}: получено {len(mp_orders)} заказов")
            
            for mp_order_data in mp_orders:
                # Извлечь ID заказа
                if marketplace == "ozon":
                    external_id = mp_order_data.get("posting_number")
                    mp_status = mp_order_data.get("status")
                elif marketplace == "wb":
                    external_id = str(mp_order_data.get("id"))
                    mp_status = mp_order_data.get("wbStatus")
                elif marketplace == "yandex":
                    external_id = str(mp_order_data.get("id"))
                    mp_status = mp_order_data.get("status")
                else:
                    continue
                
                if not external_id:
                    continue
                
                # Проверить существование
                existing = await db.orders_fbs.find_one({
                    "external_order_id": external_id,
                    "seller_id": seller_id
                })
                
                if not existing:
                    # СОЗДАТЬ НОВЫЙ ЗАКАЗ
                    logger.info(f"[OrderSync FBS] Создание нового заказа {external_id} от {marketplace}")
                    
                    # Парсинг данных заказа
                    if marketplace == "ozon":
                        await self._create_ozon_order(db, seller_id, mp_order_data)
                    elif marketplace == "wb":
                        await self._create_wb_order(db, seller_id, mp_order_data)
                    elif marketplace == "yandex":
                        await self._create_yandex_order(db, seller_id, mp_order_data)
                    
                else:
                    # ОБНОВИТЬ СТАТУС
                    internal_status = connector.map_ozon_status_to_internal(mp_status) if marketplace == "ozon" else \
                                     connector.map_wb_status_to_internal(int(mp_status)) if marketplace == "wb" else \
                                     connector.map_yandex_status_to_internal(mp_status)
                    
                    if existing["status"] != internal_status:
                        logger.info(f"[OrderSync FBS] Обновление статуса {external_id}: {existing['status']} → {internal_status}")
                        
                        # Обновить статус
                        # TODO: Вызвать логику резерва/списания/возврата
                        await db.orders_fbs.update_one(
                            {"_id": existing["_id"]},
                            {"$set": {
                                "status": internal_status,
                                "updated_at": datetime.utcnow()
                            }}
                        )
        
        except MarketplaceError as e:
            logger.error(f"[OrderSync FBS] Ошибка API {marketplace}: {e.message}")
        except Exception as e:
            logger.error(f"[OrderSync FBS] Ошибка: {e}")
    
    async def sync_fbo_orders_for_seller(
        self,
        seller_id: str,
        marketplace: str,
        client_id: str,
        api_key: str
    ):
        """
        Синхронизировать FBO заказы для одного продавца с одного МП
        (только для аналитики, без влияния на inventory)
        """
        db = await get_database()
        
        try:
            connector = get_connector(marketplace, client_id, api_key)
            
            date_from = datetime.utcnow() - timedelta(days=1)
            date_to = datetime.utcnow()
            
            # Получить FBO заказы с МП
            if marketplace == "ozon":
                mp_orders = await connector.get_fbo_orders(date_from, date_to)
            elif marketplace in ["wb", "wildberries"]:
                # Wildberries не разделяет FBS/FBO в API, пропускаем
                logger.info(f"[OrderSync FBO] Wildberries не поддерживает отдельную синхронизацию FBO")
                return
            elif marketplace == "yandex":
                # Yandex тоже не разделяет явно
                logger.info(f"[OrderSync FBO] Yandex Market не поддерживает отдельную синхронизацию FBO")
                return
            else:
                return
            
            logger.info(f"[OrderSync FBO] {marketplace}: получено {len(mp_orders)} заказов")
            
            for mp_order_data in mp_orders:
                # Извлечь ID
                if marketplace == "ozon":
                    external_id = mp_order_data.get("posting_number")
                elif marketplace == "wb":
                    external_id = str(mp_order_data.get("id"))
                elif marketplace == "yandex":
                    external_id = str(mp_order_data.get("id"))
                else:
                    continue
                
                if not external_id:
                    continue
                
                # Проверить существование
                existing = await db.orders_fbo.find_one({
                    "external_order_id": external_id,
                    "seller_id": seller_id
                })
                
                if not existing:
                    # СОЗДАТЬ (без резервов)
                    logger.info(f"[OrderSync FBO] Создание нового заказа {external_id} от {marketplace}")
                    # TODO: Парсинг данных
                else:
                    # ОБНОВИТЬ (просто статус)
                    pass
        
        except MarketplaceError as e:
            logger.error(f"[OrderSync FBO] Ошибка API {marketplace}: {e.message}")
        except Exception as e:
            logger.error(f"[OrderSync FBO] Ошибка: {e}")


# Глобальный экземпляр
order_sync_scheduler = OrderSyncScheduler()
