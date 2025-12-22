import asyncio
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from bson import ObjectId

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
            
            # Для Yandex используем отдельный метод get_orders
            if marketplace == "yandex":
                mp_orders = await connector.get_orders(date_from, date_to, client_id)
            else:
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
                        old_status = existing["status"]
                        logger.info(f"[OrderSync FBS] Обновление статуса {external_id}: {old_status} → {internal_status}")
                        
                        # Получить данные заказа для обработки inventory
                        items = existing.get("items", [])
                        warehouse_id = existing.get("warehouse_id")
                        order_number = existing.get("order_number")
                        
                        # ЛОГИКА СПИСАНИЯ при отправке
                        if internal_status == "delivering" and old_status in ["new", "awaiting_packaging", "awaiting_deliver", "awaiting_shipment"]:
                            logger.info(f"[OrderSync FBS] 📤 Списание товаров для {order_number} (статус: delivering)")
                            
                            for item in items:
                                if item.get("product_id"):
                                    try:
                                        prod_id = ObjectId(item["product_id"]) if isinstance(item["product_id"], str) else item["product_id"]
                                        quantity = item.get("quantity", 1)
                                        
                                        # Списание: quantity ↓, reserved ↓
                                        result = await db.inventory.update_one(
                                            {"product_id": prod_id},
                                            {
                                                "$inc": {
                                                    "quantity": -quantity,
                                                    "reserved": -quantity
                                                }
                                            }
                                        )
                                        
                                        if result.modified_count > 0:
                                            logger.info(f"[OrderSync FBS] ✅ Списан товар {item.get('article')}: {quantity} шт")
                                            
                                            # Записать в историю
                                            await db.inventory_history.insert_one({
                                                "product_id": prod_id,
                                                "seller_id": seller_id,
                                                "operation_type": "sale",
                                                "quantity_change": -quantity,
                                                "reason": f"Списание для заказа {order_number} (delivering)",
                                                "user_id": seller_id,
                                                "created_at": datetime.utcnow()
                                            })
                                        else:
                                            logger.warning(f"[OrderSync FBS] ⚠️ Не удалось списать {item.get('article')}")
                                    except Exception as e:
                                        logger.error(f"[OrderSync FBS] ❌ Ошибка списания {item.get('article')}: {e}")
                        
                        # ЛОГИКА ВОЗВРАТА при отмене
                        elif internal_status == "cancelled" and old_status in ["new", "awaiting_packaging", "awaiting_deliver", "awaiting_shipment"]:
                            logger.info(f"[OrderSync FBS] 🔙 Возврат товаров для {order_number} (статус: cancelled)")
                            
                            # Проверить настройки склада
                            warehouse = await db.warehouses.find_one({"id": warehouse_id}) if warehouse_id else None
                            
                            if warehouse and warehouse.get("return_on_cancel", True):
                                for item in items:
                                    if item.get("product_id"):
                                        try:
                                            prod_id = ObjectId(item["product_id"]) if isinstance(item["product_id"], str) else item["product_id"]
                                            quantity = item.get("quantity", 1)
                                            
                                            # Возврат: reserved ↓, available ↑
                                            result = await db.inventory.update_one(
                                                {"product_id": prod_id},
                                                {
                                                    "$inc": {
                                                        "reserved": -quantity,
                                                        "available": quantity
                                                    }
                                                }
                                            )
                                            
                                            if result.modified_count > 0:
                                                logger.info(f"[OrderSync FBS] ✅ Возвращен товар {item.get('article')}: {quantity} шт")
                                                
                                                # Записать в историю
                                                await db.inventory_history.insert_one({
                                                    "product_id": prod_id,
                                                    "seller_id": seller_id,
                                                    "operation_type": "return",
                                                    "quantity_change": 0,  # quantity не меняется
                                                    "reason": f"Возврат из заказа {order_number} (cancelled)",
                                                    "user_id": seller_id,
                                                    "created_at": datetime.utcnow()
                                                })
                                            else:
                                                logger.warning(f"[OrderSync FBS] ⚠️ Не удалось вернуть {item.get('article')}")
                                        except Exception as e:
                                            logger.error(f"[OrderSync FBS] ❌ Ошибка возврата {item.get('article')}: {e}")
                            else:
                                logger.info(f"[OrderSync FBS] ⚠️ Возврат отключен для склада или склад не найден")
                        
                        # Обновить статус в БД
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
    
    async def _create_ozon_order(self, db, seller_id: str, mp_order_data: dict):
        """Создать заказ Ozon в БД"""
        try:
            posting_number = mp_order_data.get("posting_number")
            mp_status = mp_order_data.get("status")
            products = mp_order_data.get("products", [])
            
            # Парсинг товаров
            items = []
            total_sum = 0
            
            for prod in products:
                offer_id = prod.get("offer_id")
                quantity = prod.get("quantity", 1)
                price = float(prod.get("price", 0))
                
                # Найти товар в каталоге
                product = await db.product_catalog.find_one({
                    "article": offer_id,
                    "seller_id": seller_id
                })
                
                items.append({
                    "product_id": str(product["_id"]) if product else "",
                    "article": offer_id,
                    "name": prod.get("name", product.get("name", "") if product else ""),
                    "price": price,
                    "quantity": quantity,
                    "total": price * quantity
                })
                total_sum += price * quantity
            
            # Парсинг покупателя
            customer_data = {
                "full_name": (mp_order_data.get("customer") or {}).get("name", ""),
                "phone": (mp_order_data.get("customer") or {}).get("phone", ""),
                "address": ""
            }
            
            # Получить склад из delivery_method
            delivery = mp_order_data.get("delivery_method", {})
            warehouse_id_mp = delivery.get("warehouse_id")
            
            # Найти локальный склад по warehouse_id
            local_warehouse = None
            if warehouse_id_mp:
                link = await db.warehouse_links.find_one({
                    "marketplace_name": "ozon",
                    "marketplace_warehouse_id": str(warehouse_id_mp)
                })
                if link:
                    local_warehouse = await db.warehouses.find_one({"id": link.get("warehouse_id")})
            
            # Если не нашли, используем склад с use_for_orders=True
            if not local_warehouse:
                local_warehouse = await db.warehouses.find_one({
                    "seller_id": seller_id,
                    "use_for_orders": True
                })
            
            warehouse_id = local_warehouse.get("id") if local_warehouse else None
            
            # Маппинг статуса
            from connectors import OzonConnector
            temp_connector = OzonConnector("", "")
            internal_status = temp_connector.map_ozon_status_to_internal(mp_status)
            
            # Извлечь реальную дату создания заказа от Ozon
            order_created_at_str = mp_order_data.get("created_at") or mp_order_data.get("in_process_at")
            if order_created_at_str:
                try:
                    from dateutil import parser as date_parser
                    order_created_at = date_parser.parse(order_created_at_str)
                except:
                    order_created_at = datetime.utcnow()
            else:
                order_created_at = datetime.utcnow()
            
            # Создать заказ
            new_order = {
                "order_number": posting_number,  # Используем настоящий номер заказа с маркетплейса
                "external_order_id": posting_number,
                "marketplace": "ozon",
                "seller_id": seller_id,
                "warehouse_id": warehouse_id,
                "status": internal_status,
                "items": items,
                "customer": customer_data,
                "totals": {
                    "subtotal": total_sum,
                    "shipping": 0,
                    "commission": 0,
                    "total": total_sum
                },
                "created_at": order_created_at,  # Реальная дата от МП
                "updated_at": datetime.utcnow(),
                "imported_at": datetime.utcnow()
            }
            
            await db.orders_fbs.insert_one(new_order)
            logger.info(f"[OrderSync FBS] ✅ Заказ {posting_number} создан в БД")
            
            # Резервировать товары если нужно
            # Резервируем для статусов: new, awaiting_packaging, awaiting_deliver, awaiting_shipment
            if internal_status in ["new", "awaiting_packaging", "awaiting_deliver", "awaiting_shipment"]:
                reserved_count = 0
                for item in items:
                    if item["product_id"]:
                        try:
                            # Конвертируем в ObjectId если это строка
                            prod_id = ObjectId(item["product_id"]) if isinstance(item["product_id"], str) else item["product_id"]
                            
                            result = await db.inventory.update_one(
                                {"product_id": prod_id},
                                {
                                    "$inc": {"reserved": item["quantity"], "available": -item["quantity"]}
                                }
                            )
                            
                            if result.modified_count > 0:
                                reserved_count += 1
                                logger.info(f"[OrderSync FBS] ✅ Зарезервирован товар {item['article']}: {item['quantity']} шт")
                            else:
                                logger.warning(f"[OrderSync FBS] ⚠️ Не удалось зарезервировать {item['article']} - inventory не найден")
                        except Exception as e:
                            logger.error(f"[OrderSync FBS] ❌ Ошибка резерва товара {item['article']}: {e}")
                
                if reserved_count > 0:
                    logger.info(f"[OrderSync FBS] ✅ Зарезервировано {reserved_count}/{len(items)} товаров для {posting_number}")
                else:
                    logger.warning(f"[OrderSync FBS] ⚠️ НЕ удалось зарезервировать товары для {posting_number}")
        
        except Exception as e:
            logger.error(f"[OrderSync FBS] Ошибка создания Ozon заказа: {e}")
    
    async def _create_wb_order(self, db, seller_id: str, mp_order_data: dict):
        """Создать заказ WB в БД"""
        logger.warning("[OrderSync FBS] Создание WB заказов пока не реализовано")
    
    async def _create_yandex_order(self, db, seller_id: str, mp_order_data: dict):
        """Создать заказ Yandex в БД"""
        try:
            order_id = str(mp_order_data.get("id"))
            yandex_status = mp_order_data.get("status")
            
            # Извлечь реальную дату создания заказа
            created_date_str = mp_order_data.get("creationDate")
            if created_date_str:
                try:
                    order_created_at = datetime.strptime(created_date_str, "%d-%m-%Y")
                except:
                    order_created_at = datetime.utcnow()
            else:
                order_created_at = datetime.utcnow()
            
            # Парсинг товаров
            items = []
            total_sum = 0
            
            for item in mp_order_data.get("items", []):
                offer_id = item.get("offerId")
                quantity = int(item.get("count", 1))
                price = float(item.get("price", 0))
                
                # Найти товар в каталоге
                product = await db.product_catalog.find_one({
                    "article": offer_id,
                    "seller_id": seller_id
                })
                
                items.append({
                    "product_id": str(product["_id"]) if product else "",
                    "article": offer_id,
                    "name": item.get("offerName", product.get("name", "") if product else ""),
                    "price": price,
                    "quantity": quantity,
                    "total": price * quantity
                })
                total_sum += price * quantity
            
            # Парсинг покупателя
            buyer = mp_order_data.get("buyer", {})
            delivery = mp_order_data.get("delivery", {})
            address_obj = delivery.get("address", {})
            
            address_parts = []
            if address_obj.get("city"):
                address_parts.append(address_obj["city"])
            if address_obj.get("street"):
                address_parts.append(f"ул. {address_obj['street']}")
            if address_obj.get("house"):
                address_parts.append(f"д. {address_obj['house']}")
            if address_obj.get("apartment"):
                address_parts.append(f"кв. {address_obj['apartment']}")
            
            customer_data = {
                "full_name": f"{buyer.get('lastName', '')} {buyer.get('firstName', '')} {buyer.get('middleName', '')}".strip(),
                "phone": buyer.get("phone", ""),
                "address": ", ".join(address_parts) if address_parts else ""
            }
            
            # Найти склад
            warehouse = await db.warehouses.find_one({
                "seller_id": seller_id,
                "use_for_orders": True
            })
            
            warehouse_id = warehouse.get("id") if warehouse else None
            
            # Маппинг статуса
            from connectors import YandexMarketConnector
            temp_connector = YandexMarketConnector("", "")
            internal_status = temp_connector.map_yandex_status_to_internal(yandex_status)
            
            # Создать заказ
            new_order = {
                "order_number": order_id,
                "external_order_id": order_id,
                "marketplace": "yandex",
                "seller_id": seller_id,
                "warehouse_id": warehouse_id,
                "status": internal_status,
                "items": items,
                "customer": customer_data,
                "totals": {
                    "subtotal": total_sum,
                    "shipping": 0,
                    "commission": 0,
                    "total": total_sum
                },
                "created_at": order_created_at,
                "updated_at": datetime.utcnow(),
                "imported_at": datetime.utcnow()
            }
            
            await db.orders_fbs.insert_one(new_order)
            logger.info(f"[OrderSync FBS] ✅ Заказ Yandex {order_id} создан в БД")
            
            # Резервировать товары если нужно
            if internal_status in ["new", "awaiting_packaging", "awaiting_deliver", "awaiting_shipment"]:
                reserved_count = 0
                for item in items:
                    if item["product_id"]:
                        try:
                            prod_id = ObjectId(item["product_id"]) if isinstance(item["product_id"], str) else item["product_id"]
                            
                            result = await db.inventory.update_one(
                                {"product_id": prod_id},
                                {
                                    "$inc": {"reserved": item["quantity"], "available": -item["quantity"]}
                                }
                            )
                            
                            if result.modified_count > 0:
                                reserved_count += 1
                                logger.info(f"[OrderSync FBS] ✅ Зарезервирован товар {item['article']}: {item['quantity']} шт")
                            else:
                                logger.warning(f"[OrderSync FBS] ⚠️ Не удалось зарезервировать {item['article']}")
                        except Exception as e:
                            logger.error(f"[OrderSync FBS] ❌ Ошибка резерва товара {item['article']}: {e}")
                
                if reserved_count > 0:
                    logger.info(f"[OrderSync FBS] ✅ Зарезервировано {reserved_count}/{len(items)} товаров для Yandex {order_id}")
        
        except Exception as e:
            logger.error(f"[OrderSync FBS] Ошибка создания Yandex заказа: {e}")



# Глобальный экземпляр
order_sync_scheduler = OrderSyncScheduler()
