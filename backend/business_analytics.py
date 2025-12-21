# Business Analytics Module - Complete financial analytics with proper categorization
# Handles all Ozon operation types including loyalty points, penalties, returns

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
from io import BytesIO
import aiohttp
import os
import xlsxwriter

from database import get_database
from auth_utils import get_current_user

router = APIRouter(prefix="/api/business-analytics", tags=["business-analytics"])


# Mapping of Ozon operation types to our categories
OPERATION_TYPE_MAPPING = {
    # INCOME - Доходы
    "OperationAgentDeliveredToCustomer": {"category": "income", "subcategory": "sales", "name": "Продажа (доставлено)"},
    "MarketplaceSellerReexposureDeliveryReturnOperation": {"category": "income", "subcategory": "compensations", "name": "Компенсация за возврат"},
    
    # RETURNS - Возвраты
    "ClientReturnAgentOperation": {"category": "expense", "subcategory": "returns", "name": "Возврат средств клиенту"},
    "OperationItemReturn": {"category": "expense", "subcategory": "returns", "name": "Возврат товара"},
    "OperationReturnGoodsFBSofRMS": {"category": "expense", "subcategory": "returns", "name": "Возврат FBS товаров"},
    
    # PENALTIES - Штрафы
    "DefectRateCancellation": {"category": "expense", "subcategory": "penalties", "name": "Штраф за отмену (дефект-рейт)"},
    "DefectRateShipmentDelay": {"category": "expense", "subcategory": "penalties", "name": "Штраф за задержку отгрузки"},
    "DefectRateDetailed": {"category": "expense", "subcategory": "penalties", "name": "Штраф (детализация)"},
    
    # LOYALTY & POINTS - Баллы и кэшбэк
    "OperationPointsForReviews": {"category": "expense", "subcategory": "loyalty_points", "name": "Баллы за отзывы"},
    "OperationMarketplaceServicePremiumCashbackIndividualPoints": {"category": "expense", "subcategory": "loyalty_points", "name": "Кэшбэк баллами Premium"},
    
    # SERVICES - Услуги маркетплейса
    "OperationSubscriptionPremium": {"category": "expense", "subcategory": "subscription", "name": "Подписка Premium"},
    "OperationMarketplaceServiceStorage": {"category": "expense", "subcategory": "storage", "name": "Хранение на складе"},
    "MarketplaceRedistributionOfAcquiringOperation": {"category": "expense", "subcategory": "acquiring", "name": "Эквайринг"},
    "OperationMarketplaceServiceEarlyPaymentAccrual": {"category": "expense", "subcategory": "early_payment", "name": "Комиссия за раннюю выплату"},
    "OperationMarketplaceFlexiblePaymentSchedule": {"category": "expense", "subcategory": "early_payment", "name": "Гибкий график выплат"},
    "MarketplaceServiceRedistributionOfDeliveryServicesRFBS": {"category": "expense", "subcategory": "logistics", "name": "Логистика rFBS"},
    "MarketplaceAgencyFeeAggregator3plRFBS": {"category": "expense", "subcategory": "logistics", "name": "Агентская комиссия 3PL"},
    "OperationMarketplaceItemTemporaryStorageRedistribution": {"category": "expense", "subcategory": "storage", "name": "Временное хранение"},
    
    # COMPENSATIONS - Компенсации
    "OperationMarketplaceServicePartialCompensationToClient": {"category": "expense", "subcategory": "client_compensation", "name": "Частичная компенсация клиенту"},
}

# Mapping of service types to categories
SERVICE_TYPE_MAPPING = {
    # Logistics
    "MarketplaceServiceItemDirectFlowLogistic": {"category": "logistics", "name": "Логистика (прямой поток)"},
    "MarketplaceServiceItemReturnFlowLogistic": {"category": "logistics", "name": "Логистика возвратов"},
    "MarketplaceServiceItemRedistributionLastMileCourier": {"category": "logistics", "name": "Последняя миля (курьер)"},
    "MarketplaceServiceItemRedistributionDropOffApvz": {"category": "logistics", "name": "Доставка до ПВЗ"},
    "MarketplaceServiceItemDropoffPVZ": {"category": "logistics", "name": "Услуги ПВЗ"},
    "MarketplaceServiceItemRedistributionReturnsPVZ": {"category": "logistics", "name": "Возврат через ПВЗ"},
    "MarketplaceServiceItemReturnNotDelivToCustomer": {"category": "logistics", "name": "Недоставка клиенту"},
    "MarketplaceServiceItemReturnAfterDelivToCustomer": {"category": "logistics", "name": "Возврат после доставки"},
    
    # Acquiring
    "MarketplaceRedistributionOfAcquiringOperation": {"category": "acquiring", "name": "Эквайринг"},
    
    # Storage
    "MarketplaceServiceItemTemporaryStorageRedistribution": {"category": "storage", "name": "Временное хранение"},
    
    # Loyalty Points
    "MarketplaceServiceItemElectronicServicesPremiumCashbackIndividualPoints": {"category": "loyalty_points", "name": "Кэшбэк баллами"},
}


async def calculate_cogs(operations: List[Dict], seller_id: str) -> Dict[str, Any]:
    """
    Рассчитывает себестоимость проданных товаров (COGS).
    
    ВАЖНО: COGS считается только для ЧИСТЫХ продаж (delivered - returned)!
    Возвращённый товар возвращается на склад, его себестоимость не теряется.
    
    Стратегия поиска закупочной цены:
    1. По SKU из таблицы маппинга ozon_sku_mapping
    2. По артикулу/offer_id
    3. По названию товара (частичное совпадение)
    """
    db = await get_database()
    
    # Загружаем маппинг SKU -> article (если есть)
    sku_mappings = await db.ozon_sku_mapping.find({"seller_id": seller_id}).to_list(10000)
    sku_to_article = {str(m.get("sku")): m.get("article") for m in sku_mappings}
    
    # Загружаем все товары продавца с закупочными ценами
    products = await db.product_catalog.find(
        {"seller_id": seller_id, "purchase_price": {"$gt": 0}},
        {"article": 1, "purchase_price": 1, "name": 1, "sku": 1, "offer_id": 1, "marketplace_data": 1}
    ).to_list(10000)
    
    # Создаём различные словари для поиска
    price_by_article = {}  # артикул -> цена
    price_by_name = {}     # слова из названия -> цена
    
    for p in products:
        price = p.get("purchase_price", 0)
        article = p.get("article", "")
        name = p.get("name", "")
        
        if article:
            price_by_article[article.lower().strip()] = price
        
        # Добавляем по ozon product_id если есть
        ozon_data = p.get("marketplace_data", {}).get("ozon", {})
        if ozon_data.get("id"):
            price_by_article[str(ozon_data["id"]).lower()] = price
        
        # Индексируем по ключевым словам из названия (для fuzzy matching)
        if name and price > 0:
            # Берём первые 3 значимых слова из названия
            words = [w.lower() for w in name.split() if len(w) > 3][:3]
            key = " ".join(sorted(words))
            if key:
                price_by_name[key] = {"price": price, "article": article}
    
    # Считаем доставки и возвраты по каждому SKU
    sku_stats = {}  # sku -> {delivered: int, returned: int, price: float}
    
    for op in operations:
        op_type = op.get("operation_type", "")
        items = op.get("items", [])
        
        for item in items:
            sku = str(item.get("sku", ""))
            name = item.get("name", "")
            
            if not sku:
                continue
            
            # Находим цену для SKU
            if sku not in sku_stats:
                purchase_price = 0
                
                # 1. Ищем по маппингу SKU -> article
                if sku in sku_to_article:
                    article = sku_to_article[sku]
                    if article.lower() in price_by_article:
                        purchase_price = price_by_article[article.lower()]
                
                # 2. Ищем напрямую по SKU как артикулу
                if not purchase_price:
                    if sku.lower() in price_by_article:
                        purchase_price = price_by_article[sku.lower()]
                
                # 3. Ищем по названию товара (fuzzy)
                if not purchase_price and name:
                    words = [w.lower() for w in name.split() if len(w) > 3][:3]
                    key = " ".join(sorted(words))
                    if key in price_by_name:
                        purchase_price = price_by_name[key]["price"]
                
                sku_stats[sku] = {"delivered": 0, "returned": 0, "price": purchase_price, "name": name}
            
            # Считаем доставки
            if op_type == "OperationAgentDeliveredToCustomer":
                if op.get("amount", 0) > 0:
                    sku_stats[sku]["delivered"] += 1
            
            # Считаем возвраты
            elif op_type in ("ClientReturnAgentOperation", "OperationItemReturn"):
                if op.get("amount", 0) < 0:
                    sku_stats[sku]["returned"] += 1
    
    # Считаем итоговый COGS только для чистых продаж
    total_cogs = 0
    items_with_cogs = 0
    items_without_cogs = 0
    unmatched_items = []
    
    for sku, stats in sku_stats.items():
        delivered = stats["delivered"]
        returned = stats["returned"]
        price = stats["price"]
        
        # Чистые продажи = доставлено - возвращено
        net_sold = max(0, delivered - returned)
        
        if net_sold > 0:
            if price > 0:
                total_cogs += price * net_sold
                items_with_cogs += net_sold
            else:
                items_without_cogs += net_sold
                if len(unmatched_items) < 20:
                    unmatched_items.append({
                        "sku": sku,
                        "name": stats["name"][:60] if stats["name"] else ""
                    })
    
    return {
        "total_cogs": round(total_cogs, 2),
        "items_with_cogs": items_with_cogs,
        "items_without_cogs": items_without_cogs,
        "coverage_pct": round(items_with_cogs / (items_with_cogs + items_without_cogs) * 100, 1) if (items_with_cogs + items_without_cogs) > 0 else 0,
        "unmatched_items": unmatched_items,
        "note": "COGS рассчитан для ЧИСТЫХ продаж (delivered - returned). Для улучшения точности добавьте маппинг SKU."
    }


async def get_ozon_credentials(seller_id: str) -> Dict[str, str]:
    """Get Ozon API credentials for seller"""
    db = await get_database()
    
    # Try both string and ObjectId formats
    from bson import ObjectId
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    if not profile:
        try:
            profile = await db.seller_profiles.find_one({"user_id": ObjectId(seller_id)})
        except:
            pass
    
    if not profile or not profile.get("api_keys"):
        raise HTTPException(status_code=404, detail="API ключи не найдены")
    
    for key in profile.get("api_keys", []):
        if key.get("marketplace") == "ozon":
            return {
                "client_id": key.get("client_id"),
                "api_key": key.get("api_key")
            }
    
    raise HTTPException(status_code=404, detail="Ozon API ключ не найден")


async def fetch_realization_report(client_id: str, api_key: str, year: int, month: int) -> List[Dict]:
    """
    Загружает отчёт о реализации товаров из Ozon API.
    
    Это самый точный источник данных для Unit Economics!
    Содержит: цену реализации, вознаграждение Ozon, комиссии, возвраты.
    
    API: POST /v2/finance/realization
    """
    url = "https://api-seller.ozon.ru/v2/finance/realization"
    headers = {
        "Client-Id": client_id,
        "Api-Key": api_key,
        "Content-Type": "application/json"
    }
    
    body = {
        "year": year,
        "month": month
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=body) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("result", {}).get("rows", [])
            else:
                error_text = await resp.text()
                print(f"[REALIZATION API ERROR] Status: {resp.status}, Error: {error_text[:200]}")
                return []


async def sync_realization_report(seller_id: str, year: int, month: int) -> Dict[str, Any]:
    """
    Синхронизирует отчёт о реализации из Ozon API в базу данных.
    
    Returns:
        Dict с информацией о синхронизации
    """
    db = await get_database()
    
    # Получаем API ключи
    credentials = await get_ozon_credentials(seller_id)
    
    # Загружаем данные из API
    rows = await fetch_realization_report(
        credentials["client_id"],
        credentials["api_key"],
        year,
        month
    )
    
    if not rows:
        return {"success": False, "message": "Нет данных за выбранный период", "count": 0}
    
    report_period = f"{year}-{month:02d}"
    
    # Удаляем старые данные за этот период
    await db.sales_report.delete_many({
        "seller_id": seller_id,
        "report_period": report_period
    })
    
    # Преобразуем данные в формат для базы
    items = []
    for row in rows:
        item = row.get("item", {})
        delivery = row.get("delivery_commission", {}) or {}
        return_data = row.get("return_commission", {}) or {}
        
        items.append({
            "seller_id": seller_id,
            "report_type": "sales_report",
            "report_period": report_period,
            "article": item.get("offer_id", ""),
            "sku": str(item.get("sku", "")),
            "name": item.get("name", ""),
            "barcode": item.get("barcode", ""),
            
            # Реализация
            "sale_amount": delivery.get("amount", 0),
            "loyalty_payments": delivery.get("bank_coinvestment", 0),
            "points_discounts": delivery.get("bonus", 0),
            "qty_sold": delivery.get("quantity", 0),
            "sale_price": delivery.get("price_per_instance", 0),
            "commission_rate": row.get("commission_ratio", 0),
            "price_before_discount": row.get("seller_price_per_instance", 0),
            "ozon_commission": delivery.get("standard_fee", 0),
            "total_accrued": delivery.get("total", 0),
            "stars": delivery.get("stars", 0),
            "compensation": delivery.get("compensation", 0),
            
            # Возврат
            "return_amount": return_data.get("amount", 0) if return_data else 0,
            "return_loyalty": return_data.get("bank_coinvestment", 0) if return_data else 0,
            "return_points": return_data.get("bonus", 0) if return_data else 0,
            "qty_returned": return_data.get("quantity", 0) if return_data else 0,
            "return_price": return_data.get("price_per_instance", 0) if return_data else 0,
            "return_commission": return_data.get("standard_fee", 0) if return_data else 0,
            "total_returned": return_data.get("total", 0) if return_data else 0,
            
            "imported_at": datetime.utcnow(),
            "source": "api"
        })
    
    # Сохраняем в базу
    if items:
        await db.sales_report.insert_many(items)
    
    return {
        "success": True,
        "message": f"Синхронизировано {len(items)} товаров за {report_period}",
        "count": len(items),
        "period": report_period
    }


@router.post("/sync-realization")
async def sync_realization(
    year: int = Query(..., description="Год (например, 2025)"),
    month: int = Query(..., ge=1, le=12, description="Месяц (1-12)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Синхронизирует отчёт о реализации из Ozon API.
    
    Это позволяет получить ТОЧНЫЕ данные для Unit Economics:
    - Реальную цену реализации
    - Точное вознаграждение Ozon (комиссия + логистика)
    - Количество продаж и возвратов
    
    Рекомендуется вызывать после 5-го числа каждого месяца
    (когда Ozon формирует отчёт за предыдущий месяц).
    """
    seller_id = str(current_user["_id"])
    
    try:
        result = await sync_realization_report(seller_id, year, month)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка синхронизации: {str(e)}")


async def fetch_ozon_operations(
    client_id: str,
    api_key: str,
    date_from: datetime,
    date_to: datetime
) -> List[Dict]:
    """
    Fetch all operations from Ozon Finance API.
    ВАЖНО: Ozon API ограничивает запрос периодом в 1 месяц (31 день).
    При необходимости разбиваем период на части.
    """
    url = "https://api-seller.ozon.ru/v3/finance/transaction/list"
    headers = {
        "Client-Id": client_id,
        "Api-Key": api_key,
        "Content-Type": "application/json"
    }
    
    all_operations = []
    
    # Разбиваем период на части по 30 дней (Ozon ограничивает 1 месяцем)
    MAX_DAYS = 30
    current_start = date_from
    
    async with aiohttp.ClientSession() as session:
        while current_start < date_to:
            # Определяем конец текущего периода (максимум 30 дней)
            current_end = min(current_start + timedelta(days=MAX_DAYS - 1), date_to)
            
            page = 1
            while True:
                body = {
                    "filter": {
                        "date": {
                            "from": current_start.strftime("%Y-%m-%dT00:00:00.000Z"),
                            "to": current_end.strftime("%Y-%m-%dT23:59:59.999Z")
                        },
                        "operation_type": [],
                        "transaction_type": "all"
                    },
                    "page": page,
                    "page_size": 1000
                }
                
                async with session.post(url, headers=headers, json=body) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        raise HTTPException(status_code=resp.status, detail=f"Ozon API error: {error_text}")
                    
                    data = await resp.json()
                    operations = data.get("result", {}).get("operations", [])
                    
                    if not operations:
                        break
                    
                    all_operations.extend(operations)
                    page += 1
                    
                    if page > 100:
                        break
            
            # Переходим к следующему периоду
            current_start = current_end + timedelta(days=1)
    
    return all_operations


def categorize_operations(operations: List[Dict]) -> Dict[str, Any]:
    """
    Categorize operations into income/expense categories.
    
    ВАЖНО: Используем СЫРЫЕ суммы из Ozon API:
    - amount > 0 = деньги НА счёт (доход)
    - amount < 0 = деньги СО счёта (расход)
    
    Формула: Чистая прибыль = Сумма всех amount
    """
    
    # Initialize categories
    result = {
        "income": {
            "sales": 0,           # Продажи (OperationAgentDeliveredToCustomer)
            "compensations": 0,   # Компенсации от маркетплейса
            "other": 0,
            "total": 0
        },
        "expense": {
            "returns": 0,         # Возвраты средств клиентам
            "penalties": 0,       # Штрафы (дефект-рейт)
            "loyalty_points": 0,  # Баллы и кэшбэк
            "subscription": 0,    # Подписка Premium
            "storage": 0,         # Хранение
            "acquiring": 0,       # Эквайринг
            "early_payment": 0,   # Комиссия за раннюю выплату
            "logistics": 0,       # Логистика
            "client_compensation": 0,  # Компенсации клиентам
            "other": 0,
            "total": 0
        },
        "raw_totals": {
            "positive_sum": 0,    # Все положительные операции
            "negative_sum": 0,    # Все отрицательные операции
            "net_total": 0        # Чистый итог (прибыль/убыток)
        },
        "details": {
            "by_operation_type": defaultdict(lambda: {"count": 0, "amount": 0}),
            "by_service_type": defaultdict(lambda: {"count": 0, "amount": 0})
        }
    }
    
    for op in operations:
        op_type = op.get("operation_type", "unknown")
        amount = op.get("amount", 0)
        
        # Track raw totals (это ТОЧНЫЕ цифры из API)
        if amount > 0:
            result["raw_totals"]["positive_sum"] += amount
        else:
            result["raw_totals"]["negative_sum"] += amount
        result["raw_totals"]["net_total"] += amount
        
        # Track by operation type
        result["details"]["by_operation_type"][op_type]["count"] += 1
        result["details"]["by_operation_type"][op_type]["amount"] += amount
        
        # Categorize for display (используем abs для расходов)
        mapping = OPERATION_TYPE_MAPPING.get(op_type, {})
        
        # Определяем категорию по знаку суммы, а не по маппингу
        if amount > 0:
            # Положительная сумма = доход
            subcategory = mapping.get("subcategory", "other")
            if subcategory == "sales" or op_type == "OperationAgentDeliveredToCustomer":
                result["income"]["sales"] += amount
            elif subcategory == "compensations" or "Compensation" in op_type or "Reexposure" in op_type:
                result["income"]["compensations"] += amount
            else:
                result["income"]["other"] += amount
            result["income"]["total"] += amount
        else:
            # Отрицательная сумма = расход
            abs_amount = abs(amount)
            subcategory = mapping.get("subcategory", "other")
            
            if "Return" in op_type or "ClientReturn" in op_type:
                result["expense"]["returns"] += abs_amount
            elif "DefectRate" in op_type or "penalty" in op_type.lower():
                result["expense"]["penalties"] += abs_amount
            elif "Points" in op_type or "Cashback" in op_type or "Premium" in op_type and "Subscription" not in op_type:
                result["expense"]["loyalty_points"] += abs_amount
            elif "Subscription" in op_type:
                result["expense"]["subscription"] += abs_amount
            elif "Storage" in op_type:
                result["expense"]["storage"] += abs_amount
            elif "Acquiring" in op_type:
                result["expense"]["acquiring"] += abs_amount
            elif "EarlyPayment" in op_type or "FlexiblePayment" in op_type:
                result["expense"]["early_payment"] += abs_amount
            elif "Delivery" in op_type or "Logistic" in op_type or "3pl" in op_type.lower():
                result["expense"]["logistics"] += abs_amount
            elif "PartialCompensation" in op_type:
                result["expense"]["client_compensation"] += abs_amount
            elif subcategory in result["expense"]:
                result["expense"][subcategory] += abs_amount
            else:
                result["expense"]["other"] += abs_amount
            
            result["expense"]["total"] += abs_amount
        
        # Track services
        for service in op.get("services", []):
            service_name = service.get("name", "unknown")
            service_price = service.get("price", 0)
            result["details"]["by_service_type"][service_name]["count"] += 1
            result["details"]["by_service_type"][service_name]["amount"] += service_price
    
    return result


@router.get("/economics")
async def get_business_economics(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    compare_previous: bool = Query(False, description="Compare with previous period"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete business economics report with proper categorization.
    Shows income, expenses breakdown, and optionally comparison with previous period.
    
    Использует кэшированные данные из базы для стабильной работы.
    """
    seller_id = str(current_user["_id"])
    
    try:
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    db = await get_database()
    
    # Получаем данные из КЭША (база данных)
    operations = await db.ozon_operations.find({
        "seller_id": seller_id,
        "operation_date": {
            "$gte": period_start,
            "$lte": period_end
        }
    }).to_list(50000)
    
    # Если в кэше нет данных, пробуем загрузить из API
    if not operations:
        try:
            credentials = await get_ozon_credentials(seller_id)
            operations = await fetch_ozon_operations(
                credentials["client_id"],
                credentials["api_key"],
                period_start,
                period_end
            )
        except Exception:
            # Если API недоступен, используем все данные из кэша
            operations = await db.ozon_operations.find({
                "seller_id": seller_id
            }).to_list(50000)
    
    # Categorize
    current_data = categorize_operations(operations)
    
    # Рассчитываем себестоимость проданных товаров (COGS)
    cogs_data = await calculate_cogs(operations, seller_id)
    total_cogs = cogs_data["total_cogs"]
    
    # Calculate key metrics using RAW totals (точные данные из API)
    raw = current_data["raw_totals"]
    gross_income = raw["positive_sum"]       # Все поступления
    total_mp_expenses = abs(raw["negative_sum"]) # Расходы маркетплейса (в abs)
    total_expenses = total_mp_expenses + total_cogs  # Общие расходы = МП + COGS
    net_profit_before_tax = raw["net_total"] - total_cogs  # Прибыль ДО налогов (минус COGS!)
    margin_pct = (net_profit_before_tax / gross_income * 100) if gross_income > 0 else 0
    
    # Получаем настройки налогообложения из профиля продавца
    db = await get_database()
    from bson import ObjectId
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    if not profile:
        try:
            profile = await db.seller_profiles.find_one({"user_id": ObjectId(seller_id)})
        except:
            pass
    
    tax_system = profile.get("tax_system", "usn_6") if profile else "usn_6"
    
    # Расчёт налогов по системе налогообложения
    tax_rates = {
        "usn_6": {"name": "УСН 6% (доходы)", "rate": 0.06, "base": "income"},
        "usn_15": {"name": "УСН 15% (доходы-расходы)", "rate": 0.15, "base": "profit"},
        "osn": {"name": "ОСН (20% НДС + 13% прибыль)", "rate": 0.20, "base": "profit"},
        "patent": {"name": "Патент", "rate": 0, "base": "fixed"},
        "self_employed": {"name": "Самозанятый 6%", "rate": 0.06, "base": "income"}
    }
    
    tax_info = tax_rates.get(tax_system, tax_rates["usn_6"])
    
    if tax_info["base"] == "income":
        tax_amount = gross_income * tax_info["rate"]
    elif tax_info["base"] == "profit":
        tax_amount = max(0, net_profit_before_tax) * tax_info["rate"]
    else:
        tax_amount = 0  # Патент - фиксированный платёж
    
    net_profit = net_profit_before_tax - tax_amount  # Чистая прибыль ПОСЛЕ налогов
    
    result = {
        "period": {
            "from": date_from,
            "to": date_to,
            "days": (period_end - period_start).days + 1
        },
        "summary": {
            "gross_income": round(gross_income, 2),
            "total_expenses": round(total_expenses, 2),
            "cogs": round(total_cogs, 2),  # Себестоимость проданных товаров
            "mp_expenses": round(total_mp_expenses, 2),  # Расходы маркетплейса
            "profit_before_tax": round(net_profit_before_tax, 2),
            "tax_amount": round(tax_amount, 2),
            "net_profit": round(net_profit, 2),
            "margin_pct": round(margin_pct, 2)
        },
        "cogs_info": {
            "total": round(total_cogs, 2),
            "items_with_cogs": cogs_data["items_with_cogs"],
            "items_without_cogs": cogs_data["items_without_cogs"],
            "coverage_pct": cogs_data["coverage_pct"],
            "note": "Себестоимость рассчитана по закупочным ценам из каталога"
        },
        "tax_info": {
            "system": tax_system,
            "name": tax_info["name"],
            "rate": tax_info["rate"],
            "tax_amount": round(tax_amount, 2)
        },
        # Также добавим сырые данные для проверки
        "raw_data_check": {
            "positive_operations": round(raw["positive_sum"], 2),
            "negative_operations": round(raw["negative_sum"], 2),
            "mp_profit_before_cogs": round(raw["net_total"], 2),
            "cogs_total": round(total_cogs, 2),
            "calculated_profit": round(raw["net_total"] - total_cogs, 2),
            "note": "Прибыль = Доходы - Расходы МП - Себестоимость"
        },
        "income_breakdown": {
            "sales": round(current_data["income"]["sales"], 2),
            "compensations": round(current_data["income"]["compensations"], 2),
            "other": round(current_data["income"]["other"], 2)
        },
        "expense_breakdown": {
            "returns": {
                "amount": round(current_data["expense"]["returns"], 2),
                "name": "Возвраты средств"
            },
            "penalties": {
                "amount": round(current_data["expense"]["penalties"], 2),
                "name": "Штрафы (дефект-рейт)"
            },
            "loyalty_points": {
                "amount": round(current_data["expense"]["loyalty_points"], 2),
                "name": "Баллы и кэшбэк"
            },
            "subscription": {
                "amount": round(current_data["expense"]["subscription"], 2),
                "name": "Подписка Premium"
            },
            "storage": {
                "amount": round(current_data["expense"]["storage"], 2),
                "name": "Хранение"
            },
            "acquiring": {
                "amount": round(current_data["expense"]["acquiring"], 2),
                "name": "Эквайринг"
            },
            "early_payment": {
                "amount": round(current_data["expense"]["early_payment"], 2),
                "name": "Комиссия за раннюю выплату"
            },
            "logistics": {
                "amount": round(current_data["expense"]["logistics"], 2),
                "name": "Логистика"
            },
            "client_compensation": {
                "amount": round(current_data["expense"]["client_compensation"], 2),
                "name": "Компенсации клиентам"
            },
            "other": {
                "amount": round(current_data["expense"]["other"], 2),
                "name": "Прочие расходы"
            }
        },
        "operations_count": len(operations)
    }
    
    # Add comparison with previous period if requested
    if compare_previous:
        period_days = (period_end - period_start).days + 1
        prev_start = period_start - timedelta(days=period_days)
        prev_end = period_start - timedelta(days=1)
        
        try:
            prev_operations = await fetch_ozon_operations(
                credentials["client_id"],
                credentials["api_key"],
                prev_start,
                prev_end
            )
            prev_data = categorize_operations(prev_operations)
            
            prev_income = prev_data["income"]["total"]
            prev_expenses = prev_data["expense"]["total"]
            prev_profit = prev_income - prev_expenses
            
            # Calculate changes
            def calc_change(current, previous):
                if previous == 0:
                    return 100 if current > 0 else 0
                return round((current - previous) / abs(previous) * 100, 1)
            
            result["comparison"] = {
                "previous_period": {
                    "from": prev_start.strftime("%Y-%m-%d"),
                    "to": prev_end.strftime("%Y-%m-%d")
                },
                "changes": {
                    "income_change_pct": calc_change(gross_income, prev_income),
                    "expenses_change_pct": calc_change(total_expenses, prev_expenses),
                    "profit_change_pct": calc_change(net_profit, prev_profit),
                    "prev_income": round(prev_income, 2),
                    "prev_expenses": round(prev_expenses, 2),
                    "prev_profit": round(prev_profit, 2)
                }
            }
        except Exception as e:
            result["comparison"] = {"error": str(e)}
    
    return result


@router.get("/detailed-operations")
async def get_detailed_operations(
    date_from: str = Query(...),
    date_to: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed list of all operation types with amounts"""
    seller_id = str(current_user["_id"])
    
    try:
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    credentials = await get_ozon_credentials(seller_id)
    
    operations = await fetch_ozon_operations(
        credentials["client_id"],
        credentials["api_key"],
        period_start,
        period_end
    )
    
    # Group by operation type
    by_type = defaultdict(lambda: {"count": 0, "amount": 0, "name": ""})
    
    for op in operations:
        op_type = op.get("operation_type", "unknown")
        amount = op.get("amount", 0)
        op_name = op.get("operation_type_name", op_type)
        
        by_type[op_type]["count"] += 1
        by_type[op_type]["amount"] += amount
        by_type[op_type]["name"] = op_name
    
    # Sort by amount (expenses first, then income)
    sorted_types = sorted(
        by_type.items(),
        key=lambda x: x[1]["amount"]
    )
    
    return {
        "period": {"from": date_from, "to": date_to},
        "total_operations": len(operations),
        "operation_types": [
            {
                "type": op_type,
                "name": data["name"],
                "count": data["count"],
                "amount": round(data["amount"], 2),
                "category": OPERATION_TYPE_MAPPING.get(op_type, {}).get("category", "other"),
                "subcategory": OPERATION_TYPE_MAPPING.get(op_type, {}).get("subcategory", "other")
            }
            for op_type, data in sorted_types
        ]
    }


@router.post("/sync-operations")
async def sync_ozon_operations(
    date_from: str = Query(...),
    date_to: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Sync operations from Ozon API and save to database"""
    seller_id = str(current_user["_id"])
    
    try:
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    credentials = await get_ozon_credentials(seller_id)
    
    operations = await fetch_ozon_operations(
        credentials["client_id"],
        credentials["api_key"],
        period_start,
        period_end
    )
    
    db = await get_database()
    saved = 0
    updated = 0
    
    for op in operations:
        # Parse services into breakdown
        services = op.get("services", [])
        breakdown = {
            "logistics": 0,
            "acquiring": 0,
            "storage": 0,
            "loyalty_points": 0,
            "other": 0
        }
        
        for service in services:
            service_name = service.get("name", "")
            price = abs(service.get("price", 0))
            
            service_mapping = SERVICE_TYPE_MAPPING.get(service_name, {})
            category = service_mapping.get("category", "other")
            
            if category in breakdown:
                breakdown[category] += price
            else:
                breakdown["other"] += price
        
        # Create transaction document
        transaction = {
            "seller_id": seller_id,
            "marketplace": "ozon",
            "operation_id": str(op.get("operation_id", "")),
            "operation_type": op.get("operation_type", ""),
            "operation_type_name": op.get("operation_type_name", ""),
            "operation_date": datetime.fromisoformat(op.get("operation_date", "").replace(" ", "T")),
            "amount": op.get("amount", 0),
            "posting_number": op.get("posting", {}).get("posting_number", ""),
            "items": op.get("items", []),
            "services": services,
            "breakdown": breakdown,
            "raw_data": op,
            "updated_at": datetime.utcnow()
        }
        
        result = await db.ozon_operations.update_one(
            {
                "seller_id": seller_id,
                "operation_id": transaction["operation_id"]
            },
            {
                "$set": transaction,
                "$setOnInsert": {"created_at": datetime.utcnow()}
            },
            upsert=True
        )
        
        if result.upserted_id:
            saved += 1
        else:
            updated += 1
    
    return {
        "status": "success",
        "period": {"from": date_from, "to": date_to},
        "statistics": {
            "total_fetched": len(operations),
            "saved": saved,
            "updated": updated
        }
    }


# Tax system settings endpoints
TAX_SYSTEMS = {
    "usn_6": {"name": "УСН 6% (доходы)", "rate": 0.06, "description": "Упрощённая система, 6% от всех доходов"},
    "usn_15": {"name": "УСН 15% (доходы-расходы)", "rate": 0.15, "description": "Упрощённая система, 15% от прибыли"},
    "osn": {"name": "ОСН", "rate": 0.20, "description": "Общая система, 20% НДС + налог на прибыль"},
    "patent": {"name": "Патент", "rate": 0, "description": "Фиксированная сумма налога"},
    "self_employed": {"name": "Самозанятый 6%", "rate": 0.06, "description": "Налог на профессиональный доход 6%"}
}


@router.get("/tax-systems")
async def get_tax_systems():
    """Get list of available tax systems"""
    return {
        "systems": [
            {"code": code, **info}
            for code, info in TAX_SYSTEMS.items()
        ]
    }


@router.get("/tax-settings")
async def get_tax_settings(current_user: dict = Depends(get_current_user)):
    """Get current tax settings for seller"""
    seller_id = str(current_user["_id"])
    
    db = await get_database()
    from bson import ObjectId
    
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    if not profile:
        try:
            profile = await db.seller_profiles.find_one({"user_id": ObjectId(seller_id)})
        except:
            pass
    
    current_system = profile.get("tax_system", "usn_6") if profile else "usn_6"
    
    return {
        "current_system": current_system,
        "system_info": TAX_SYSTEMS.get(current_system, TAX_SYSTEMS["usn_6"]),
        "available_systems": list(TAX_SYSTEMS.keys())
    }


@router.post("/tax-settings")
async def update_tax_settings(
    tax_system: str = Query(..., description="Tax system code: usn_6, usn_15, osn, patent, self_employed"),
    current_user: dict = Depends(get_current_user)
):
    """Update tax settings for seller"""
    seller_id = str(current_user["_id"])
    
    if tax_system not in TAX_SYSTEMS:
        raise HTTPException(status_code=400, detail=f"Invalid tax system. Available: {list(TAX_SYSTEMS.keys())}")
    
    db = await get_database()
    from bson import ObjectId
    
    # Try to update with string ID first
    result = await db.seller_profiles.update_one(
        {"user_id": seller_id},
        {"$set": {"tax_system": tax_system, "tax_updated_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        # Try with ObjectId
        try:
            result = await db.seller_profiles.update_one(
                {"user_id": ObjectId(seller_id)},
                {"$set": {"tax_system": tax_system, "tax_updated_at": datetime.utcnow()}}
            )
        except:
            pass
    
    return {
        "status": "success",
        "tax_system": tax_system,
        "system_info": TAX_SYSTEMS[tax_system]
    }


# ============================================================================
# ЗАКАЗЫ OZON
# ============================================================================

@router.get("/orders")
async def get_ozon_orders(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список заказов Ozon за период с полным расчётом прибыли.
    Включает: выручку, расходы МП, себестоимость, налог.
    """
    seller_id = str(current_user["_id"])
    
    try:
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Get credentials
    credentials = await get_ozon_credentials(seller_id)
    
    # Fetch operations
    operations = await fetch_ozon_operations(
        credentials["client_id"],
        credentials["api_key"],
        period_start,
        period_end
    )
    
    # Загружаем закупочные цены для расчёта себестоимости
    db = await get_database()
    products = await db.product_catalog.find(
        {"seller_id": seller_id, "purchase_price": {"$gt": 0}},
        {"article": 1, "purchase_price": 1, "name": 1}
    ).to_list(10000)
    
    # Индекс цен по ключевым словам названия
    price_by_name = {}
    for p in products:
        name = p.get("name", "")
        price = p.get("purchase_price", 0)
        if name and price > 0:
            words = [w.lower() for w in name.split() if len(w) > 3][:3]
            key = " ".join(sorted(words))
            if key:
                price_by_name[key] = price
    
    # Получаем настройки налога
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    tax_system = "usn_6"
    if profile and profile.get("tax_settings"):
        tax_system = profile["tax_settings"].get("system", "usn_6")
    tax_rate = TAX_SYSTEMS.get(tax_system, {}).get("rate", 0.06)
    
    # Извлекаем заказы из операций
    orders = []
    order_map = {}  # posting_number -> order data
    
    for op in operations:
        posting = op.get("posting", {})
        posting_number = posting.get("posting_number", "")
        
        if not posting_number:
            continue
        
        op_type = op.get("operation_type", "")
        amount = op.get("amount", 0)
        items = op.get("items", [])
        
        if posting_number not in order_map:
            # Определяем тип доставки (FBS/FBO)
            delivery_schema = posting.get("delivery_schema", "").upper()
            if delivery_schema not in ["FBS", "FBO"]:
                delivery_schema = "FBS"  # По умолчанию FBS
            
            order_map[posting_number] = {
                "id": posting_number,
                "posting_number": posting_number,
                "delivery_type": delivery_schema,
                "items": [],
                "item_names": [],
                "item_skus": [],
                "revenue": 0,          # Выручка (что получили от покупателя)
                "mp_expenses": 0,      # Расходы маркетплейса (комиссии, логистика)
                "cogs": 0,             # Себестоимость
                "status": "DELIVERED" if op_type == "OperationAgentDeliveredToCustomer" else "PROCESSING",
                "operations": []
            }
        
        order = order_map[posting_number]
        
        # Добавляем товары и считаем себестоимость
        for item in items:
            item_name = item.get("name", "")
            item_sku = item.get("sku", "")
            
            if item_name and item_name not in order["item_names"]:
                order["item_names"].append(item_name)
                order["items"].append({
                    "sku": item_sku,
                    "name": item_name
                })
                
                # Ищем себестоимость по названию
                words = [w.lower() for w in item_name.split() if len(w) > 3][:3]
                key = " ".join(sorted(words))
                if key in price_by_name:
                    order["cogs"] += price_by_name[key]
        
        # Считаем финансы
        if amount > 0:
            order["revenue"] += amount
        else:
            order["mp_expenses"] += abs(amount)
        
        # Статус заказа
        if op_type == "OperationAgentDeliveredToCustomer":
            order["status"] = "DELIVERED"
        elif "Return" in op_type:
            order["status"] = "RETURNED"
        elif "Cancel" in op_type:
            order["status"] = "CANCELLED"
        
        order["operations"].append({
            "type": op_type,
            "amount": amount
        })
    
    # Финализируем заказы
    for posting_number, order in order_map.items():
        revenue = order["revenue"]
        mp_expenses = order["mp_expenses"]
        
        # COGS применяем ТОЛЬКО к доставленным заказам!
        if order["status"] == "DELIVERED":
            cogs = order["cogs"]
        else:
            cogs = 0  # Для возвратов, отмен и в обработке - COGS = 0
        
        # Налог считаем от выручки (УСН 6%) или от прибыли (УСН 15%)
        if tax_system == "usn_6":
            tax = revenue * tax_rate
        else:
            # УСН 15% - от прибыли до налога
            profit_before_tax = revenue - mp_expenses - cogs
            tax = max(0, profit_before_tax * tax_rate)
        
        # Чистая прибыль
        net_profit = revenue - mp_expenses - cogs - tax
        
        order["tax"] = round(tax, 2)
        order["profit"] = round(net_profit, 2)
        order["revenue"] = round(revenue, 2)
        order["mp_expenses"] = round(mp_expenses, 2)
        order["cogs"] = round(cogs, 2)
        order["items_count"] = len(order["items"])
        
        # Текст для отображения
        order["items_text"] = ", ".join(order["item_names"][:2])
        if len(order["item_names"]) > 2:
            extra_count = len(order["item_names"]) - 2
            order["items_text"] += f" (+{extra_count})"
        
        orders.append(order)
    
    # Сортируем по выручке
    orders.sort(key=lambda x: x["revenue"], reverse=True)
    
    # Статистика
    total_revenue = sum(o["revenue"] for o in orders)
    total_mp_expenses = sum(o["mp_expenses"] for o in orders)
    total_cogs = sum(o["cogs"] for o in orders)
    total_tax = sum(o["tax"] for o in orders)
    total_profit = sum(o["profit"] for o in orders)
    delivered_count = sum(1 for o in orders if o["status"] == "DELIVERED")
    fbs_count = sum(1 for o in orders if o.get("delivery_type") == "FBS")
    fbo_count = sum(1 for o in orders if o.get("delivery_type") == "FBO")
    
    # Заказы без себестоимости
    orders_without_cogs = sum(1 for o in orders if o["cogs"] == 0 and o["status"] == "DELIVERED")
    
    return {
        "orders": orders,
        "summary": {
            "total_orders": len(orders),
            "delivered": delivered_count,
            "fbs_count": fbs_count,
            "fbo_count": fbo_count,
            "total_revenue": round(total_revenue, 2),
            "total_mp_expenses": round(total_mp_expenses, 2),
            "total_cogs": round(total_cogs, 2),
            "total_tax": round(total_tax, 2),
            "total_profit": round(total_profit, 2),
            "orders_without_cogs": orders_without_cogs
        },
        "tax_info": {
            "system": tax_system,
            "rate": tax_rate,
            "name": TAX_SYSTEMS.get(tax_system, {}).get("name", "УСН 6%")
        },
        "period": {
            "from": date_from,
            "to": date_to
        },
        "note": "Прибыль = Выручка - Расходы МП - Себестоимость - Налог"
    }



# ============================================================================
# UNIT ECONOMICS ПО ТОВАРАМ
# ============================================================================

async def _calculate_from_sales_report(db, seller_id: str, sales_data: List[Dict], tag: str, period_start, period_end, date_from: str, date_to: str):
    """
    Рассчитывает Unit Economics из отчёта о реализации Ozon.
    
    Это САМЫЙ ТОЧНЫЙ источник данных, т.к. отчёт содержит:
    - Реальную цену реализации (после всех скидок)
    - Полное вознаграждение Ozon (комиссия + логистика)
    - Точное количество продаж и возвратов
    
    Агрегирует данные по товарам если период охватывает несколько месяцев.
    """
    
    # Загружаем закупочные цены и теги
    products = await db.product_catalog.find(
        {"seller_id": seller_id},
        {"article": 1, "purchase_price": 1, "tags": 1}
    ).to_list(10000)
    
    price_by_article = {}
    tags_by_article = {}
    for p in products:
        article = p.get("article", "")
        if article:
            price_by_article[article.lower().strip()] = p.get("purchase_price", 0) or 0
            tags_by_article[article.lower().strip()] = p.get("tags", [])
    
    # Получаем настройки налога
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    if not profile:
        from bson import ObjectId
        profile = await db.seller_profiles.find_one({"user_id": ObjectId(seller_id)})
    
    tax_system = profile.get("tax_system", "usn_6") if profile else "usn_6"
    tax_rate = TAX_SYSTEMS.get(tax_system, {}).get("rate", 0.06)
    
    # Агрегируем данные по артикулу (один товар может быть в нескольких месяцах)
    aggregated = {}
    
    for item in sales_data:
        article = item.get("article", "")
        sku = item.get("sku", "")
        name = item.get("name", "")
        
        # Используем артикул как ключ (или SKU если артикула нет)
        key = article.lower().strip() if article else sku
        
        if not key:
            continue
        
        if key not in aggregated:
            aggregated[key] = {
                "article": article,
                "sku": sku,
                "name": name,
                "qty_sold": 0,
                "qty_returned": 0,
                "sale_amount": 0,
                "total_accrued": 0,
                "ozon_commission": 0,
                "total_returned": 0,
                "sale_price": item.get("sale_price", 0),  # Берём цену из первой записи
            }
        
        agg = aggregated[key]
        agg["qty_sold"] += item.get("qty_sold", 0)
        agg["qty_returned"] += item.get("qty_returned", 0)
        agg["sale_amount"] += item.get("sale_amount", 0)
        agg["total_accrued"] += item.get("total_accrued", 0)
        agg["ozon_commission"] += item.get("ozon_commission", 0)
        agg["total_returned"] += abs(item.get("total_returned", 0))
    
    products_result = []
    all_tags = set()
    
    for key, item in aggregated.items():
        article = item.get("article", "")
        sku = item.get("sku", "")
        name = item.get("name", "")
        
        item_tags = tags_by_article.get(article.lower().strip(), [])
        all_tags.update(item_tags)
        
        # Фильтр по тегу
        if tag and tag not in item_tags:
            continue
        
        qty_sold = item.get("qty_sold", 0)
        qty_returned = item.get("qty_returned", 0)
        net_sold = max(0, qty_sold - qty_returned)
        
        # Финансы из отчёта
        sale_price = item.get("sale_price", 0)  # Цена реализации
        total_accrued = item.get("total_accrued", 0)  # К начислению (уже за вычетом комиссии Ozon!)
        ozon_commission = item.get("ozon_commission", 0)  # Вознаграждение Ozon (комиссия+логистика)
        total_returned = abs(item.get("total_returned", 0))  # Возвращено
        
        # Чистая выручка = К начислению - Возвращено
        net_revenue = total_accrued - total_returned
        
        # Расходы МП уже ВКЛЮЧЕНЫ в ozon_commission и вычтены из total_accrued
        # Поэтому mp_expenses = 0 для расчёта прибыли (они уже учтены)
        mp_expenses = ozon_commission  # Показываем для информации
        
        # Закупочная цена
        purchase_price = price_by_article.get(article.lower().strip(), 0)
        
        # COGS = закупочная × чистые продажи
        cogs = purchase_price * net_sold if net_sold > 0 and purchase_price > 0 else 0
        
        # Налог
        if tax_system == "usn_6":
            tax = max(0, total_accrued) * tax_rate
        else:
            profit_before_tax = net_revenue - cogs
            tax = max(0, profit_before_tax) * tax_rate
        
        # Чистая прибыль = Чистая выручка - COGS - Налог
        # (mp_expenses уже вычтены из выручки!)
        profit = net_revenue - cogs - tax
        
        # Маржинальность
        if sale_price > 0:
            margin_pct = (profit / (sale_price * qty_sold) * 100) if qty_sold > 0 else 0
        else:
            margin_pct = 0
        
        margin_pct = max(-100, min(100, margin_pct))
        
        products_result.append({
            "name": name,
            "sku": sku,
            "article": article,
            "tags": item_tags,
            "delivered": qty_sold,
            "returned": qty_returned,
            "sales_count": net_sold,
            "purchase_price": round(purchase_price, 2),
            "revenue": round(net_revenue, 2),
            "sales_revenue": round(total_accrued, 2),  # К начислению
            "return_costs": round(total_returned, 2),
            "mp_expenses": round(ozon_commission, 2),  # Показываем вознаграждение Ozon
            "logistics": 0,  # Включено в ozon_commission
            "other_expenses": 0,  # Включено в ozon_commission
            "compensations": 0,
            "cogs": round(cogs, 2),
            "tax": round(tax, 2),
            "profit": round(profit, 2),
            "margin_pct": round(margin_pct, 1),
            "profit_per_unit": round(profit / net_sold, 2) if net_sold > 0 else 0,
            "has_purchase_price": purchase_price > 0,
            "is_returned": qty_returned > 0 and qty_sold == 0
        })
    
    # Сортируем по прибыли
    products_result.sort(key=lambda x: x["profit"])
    
    # Итоги
    total_products = len(products_result)
    profitable = sum(1 for p in products_result if p["profit"] > 0)
    unprofitable = sum(1 for p in products_result if p["profit"] < 0)
    returned_items = sum(1 for p in products_result if p["is_returned"])
    without_cogs = sum(1 for p in products_result if not p["has_purchase_price"])
    
    total_sales = sum(p["delivered"] for p in products_result)
    total_returns = sum(p["returned"] for p in products_result)
    total_revenue = sum(p["revenue"] for p in products_result)
    total_profit = sum(p["profit"] for p in products_result)
    
    return {
        "products": products_result,
        "summary": {
            "total_products": total_products,
            "profitable": profitable,
            "unprofitable": unprofitable,
            "returned_items": returned_items,
            "without_cogs": without_cogs,
            "total_sales": total_sales,
            "total_returns": total_returns,
            "total_revenue": round(total_revenue, 2),
            "total_profit": round(total_profit, 2),
            "general_expenses_total": 0,  # Уже включены в ozon_commission
            "net_profit": round(total_profit, 2)
        },
        "general_expenses": {
            "subscription": 0,
            "penalties": 0,
            "advertising": 0,
            "storage": 0,
            "early_payment": 0,
            "points": 0,
            "other": 0,
            "total": 0
        },
        "available_tags": sorted(list(all_tags)),
        "tax_info": {
            "system": tax_system,
            "rate": tax_rate,
            "name": TAX_SYSTEMS.get(tax_system, {}).get("name", "УСН 6%")
        },
        "period": {
            "from": date_from,
            "to": date_to
        },
        "data_source": "sales_report",
        "note": "Данные из отчёта о реализации Ozon. Расходы МП уже вычтены из выручки."
    }



@router.get("/products-economics")
async def get_products_economics(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    tag: str = Query(None, description="Filter by tag"),
    current_user: dict = Depends(get_current_user)
):
    """
    Unit Economics по каждому товару.
    
    ПРАВИЛЬНАЯ ЛОГИКА РАСЧЁТА:
    1. amount в OperationAgentDeliveredToCustomer УЖЕ содержит выручку за вычетом комиссии Ozon
    2. Расходы МП = логистика + эквайринг + прочие услуги (комиссия уже вычтена!)
    3. COGS = закупочная × чистые продажи (delivered - returned)
    4. Прибыль = Чистая выручка - Расходы МП - COGS - Налог
    
    Также показывает:
    - Общие расходы (не привязанные к товарам): подписка, штрафы, хранение и т.д.
    """
    seller_id = str(current_user["_id"])
    
    try:
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    db = await get_database()
    
    # Определяем все месяцы в периоде
    report_periods = []
    current = period_start.replace(day=1)
    while current <= period_end:
        report_periods.append(f"{current.year}-{current.month:02d}")
        # Переходим к следующему месяцу
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    
    # ПРИОРИТЕТ 1: Данные из отчёта о реализации (самые точные!)
    # Загружаем данные за ВСЕ месяцы периода
    sales_report_data = await db.sales_report.find({
        "seller_id": seller_id,
        "report_period": {"$in": report_periods}
    }).to_list(50000)
    
    if sales_report_data:
        # Используем данные из отчёта о реализации
        return await _calculate_from_sales_report(db, seller_id, sales_report_data, tag, period_start, period_end, date_from, date_to)
    
    # ПРИОРИТЕТ 2: Данные из Finance API (менее точные)
    # Получаем операции из КЭША (база данных), а не напрямую из API
    operations = await db.ozon_operations.find({
        "seller_id": seller_id,
        "operation_date": {
            "$gte": period_start,
            "$lte": period_end
        }
    }).to_list(50000)
    
    # Если в кэше нет данных за период, пробуем загрузить из API
    if not operations:
        try:
            credentials = await get_ozon_credentials(seller_id)
            operations = await fetch_ozon_operations(
                credentials["client_id"],
                credentials["api_key"],
                period_start,
                period_end
            )
        except Exception as e:
            # Если API недоступен, используем все данные из кэша
            operations = await db.ozon_operations.find({
                "seller_id": seller_id
            }).to_list(50000)
    
    # Загружаем товары с закупочными ценами и тегами
    products_cursor = db.product_catalog.find(
        {"seller_id": seller_id},
        {"article": 1, "name": 1, "purchase_price": 1, "tags": 1, "price": 1}
    )
    products_list = await products_cursor.to_list(10000)
    
    # Загружаем SKU маппинг
    sku_mappings = await db.ozon_sku_mapping.find({"seller_id": seller_id}).to_list(10000)
    sku_to_article = {str(m.get("sku")): m.get("article") for m in sku_mappings}
    
    # Индекс цен по артикулу (PRIMARY - самый надёжный)
    price_by_article = {}
    tags_by_article = {}
    
    # Индекс цен и тегов по ключевым словам названия (FALLBACK)
    price_by_name = {}
    tags_by_name = {}
    article_by_name = {}
    
    for p in products_list:
        name = p.get("name", "")
        price = p.get("purchase_price", 0) or 0
        tags = p.get("tags", [])
        article = p.get("article", "")
        
        # PRIMARY: Индекс по артикулу
        if article:
            price_by_article[article.lower().strip()] = price
            tags_by_article[article.lower().strip()] = tags
        
        # FALLBACK: Индекс по названию
        if name:
            words = [w.lower() for w in name.split() if len(w) > 3][:3]
            key = " ".join(sorted(words))
            if key:
                price_by_name[key] = price
                tags_by_name[key] = tags
                article_by_name[key] = article
    
    # Получаем настройки налога
    profile = await db.seller_profiles.find_one({"user_id": seller_id})
    tax_system = "usn_6"
    if profile and profile.get("tax_settings"):
        tax_system = profile["tax_settings"].get("system", "usn_6")
    tax_rate = TAX_SYSTEMS.get(tax_system, {}).get("rate", 0.06)
    
    # Собираем статистику по товарам - ГРУППИРОВКА ПО SKU (точная)
    product_stats = {}  # sku -> stats
    
    for op in operations:
        op_type = op.get("operation_type", "")
        amount = op.get("amount", 0)
        items = op.get("items", [])
        posting_number = op.get("posting", {}).get("posting_number", "")
        
        # Обрабатываем только операции с товарами
        if not items:
            continue
        
        for item in items:
            item_name = item.get("name", "")
            item_sku = str(item.get("sku", ""))
            
            if not item_name or not item_sku:
                continue
            
            # Используем SKU как ключ (точная группировка!)
            key = item_sku
            
            # === ПОИСК ЗАКУПОЧНОЙ ЦЕНЫ (приоритетный порядок) ===
            purchase_price = 0
            found_article = ""
            found_tags = []
            
            # 1. ПРИОРИТЕТ: SKU маппинг -> артикул -> цена
            if item_sku in sku_to_article:
                article = sku_to_article[item_sku]
                if article.lower().strip() in price_by_article:
                    purchase_price = price_by_article[article.lower().strip()]
                    found_article = article
                    found_tags = tags_by_article.get(article.lower().strip(), [])
            
            # 2. FALLBACK: Поиск по названию
            if not purchase_price and item_name:
                words = [w.lower() for w in item_name.split() if len(w) > 3][:3]  # 3 слова для совпадения
                name_key = " ".join(sorted(words))
                if name_key in price_by_name:
                    purchase_price = price_by_name.get(name_key, 0)
                    found_article = article_by_name.get(name_key, "")
                    found_tags = tags_by_name.get(name_key, [])
            
            if key not in product_stats:
                product_stats[key] = {
                    "name": item_name,
                    "sku": item_sku,
                    "article": found_article,
                    "tags": found_tags,
                    "purchase_price": purchase_price,
                    "delivered_count": 0,      # Доставлено (реальные продажи)
                    "returned_count": 0,       # Возвращено
                    "sales_revenue": 0,        # Выручка (уже за вычетом комиссии Ozon!)
                    "return_costs": 0,         # Возвраты клиентам
                    "logistics": 0,            # Логистика и доставка
                    "other_expenses": 0,       # Прочие расходы (кэшбэк, баллы и т.д.)
                    "compensations": 0,        # Компенсации от МП
                    "postings": set()          # Уникальные заказы
                }
            
            stats = product_stats[key]
            stats["postings"].add(posting_number)
            
            # === КАТЕГОРИЗАЦИЯ ОПЕРАЦИЙ ===
            # ВАЖНО: amount в OperationAgentDeliveredToCustomer УЖЕ содержит выручку
            # за вычетом комиссии Ozon! Не нужно считать комиссию отдельно.
            
            # 1. ПРОДАЖИ — amount УЖЕ за вычетом комиссии!
            if op_type == "OperationAgentDeliveredToCustomer":
                if amount > 0:
                    stats["delivered_count"] += 1
                    stats["sales_revenue"] += amount  # Это выручка ПОСЛЕ комиссии
            
            # 2. ВОЗВРАТЫ ТОВАРА (реальный возврат денег клиенту)
            elif op_type in ("ClientReturnAgentOperation", "OperationItemReturn"):
                if amount < 0:
                    stats["returned_count"] += 1
                    stats["return_costs"] += abs(amount)
                elif amount > 0:
                    stats["compensations"] += amount
            
            # 3. ЛОГИСТИКА (все виды доставки, возвраты, хранение)
            elif any(x in op_type for x in [
                "Delivery", "Redistribution", "Logistic", "ReturnGoods", 
                "Crossdocking", "Storage", "AgencyFee", "3pl"
            ]):
                if amount < 0:
                    stats["logistics"] += abs(amount)
                elif amount > 0:
                    stats["compensations"] += amount
            
            # 4. КОМПЕНСАЦИИ ОТ МП (за возвраты и т.д.)
            elif "Reexposure" in op_type or "Compensation" in op_type:
                if amount > 0:
                    stats["compensations"] += amount
                elif amount < 0:
                    stats["other_expenses"] += abs(amount)
            
            # 5. ПРОЧИЕ РАСХОДЫ (кэшбэк, баллы, эквайринг и т.д.)
            # Эквайринг — это дополнительная комиссия за способ оплаты
            elif any(x in op_type for x in [
                "Acquiring", "Cashback", "Points", "Premium", "Installment"
            ]):
                if amount < 0:
                    stats["other_expenses"] += abs(amount)
                elif amount > 0:
                    stats["compensations"] += amount
            
            # 6. ВСЕ ОСТАЛЬНОЕ
            else:
                if amount < 0:
                    stats["other_expenses"] += abs(amount)
                elif amount > 0 and op_type != "OperationAgentDeliveredToCustomer":
                    stats["compensations"] += amount
    
    # Рассчитываем финальные метрики для каждого товара
    products_result = []
    
    # Также считаем общие расходы (не привязанные к товарам)
    general_expenses = {
        "subscription": 0,      # Подписка Premium
        "penalties": 0,         # Штрафы (DefectRate)
        "advertising": 0,       # Реклама
        "storage": 0,           # Хранение
        "early_payment": 0,     # Ранняя выплата
        "points": 0,            # Баллы за отзывы
        "other": 0,             # Прочее
    }
    
    # Считаем операции БЕЗ привязки к товарам
    for op in operations:
        items = op.get("items", [])
        if items:  # Пропускаем операции с товарами
            continue
        
        op_type = op.get("operation_type", "")
        amount = op.get("amount", 0)
        
        if amount >= 0:  # Считаем только расходы
            continue
        
        abs_amount = abs(amount)
        
        if "Subscription" in op_type or "Premium" in op_type:
            general_expenses["subscription"] += abs_amount
        elif "DefectRate" in op_type or "Cancellation" in op_type or "ShipmentDelay" in op_type:
            general_expenses["penalties"] += abs_amount
        elif "CostPerClick" in op_type or "Promotion" in op_type:
            general_expenses["advertising"] += abs_amount
        elif "Storage" in op_type:
            general_expenses["storage"] += abs_amount
        elif "EarlyPayment" in op_type or "FlexiblePayment" in op_type:
            general_expenses["early_payment"] += abs_amount
        elif "Points" in op_type or "Reviews" in op_type:
            general_expenses["points"] += abs_amount
        else:
            general_expenses["other"] += abs_amount
    
    general_expenses_total = sum(general_expenses.values())
    
    for sku_key, stats in product_stats.items():
        # Фильтр по тегу
        if tag and tag not in stats["tags"]:
            continue
        
        delivered = stats["delivered_count"]
        returned = stats["returned_count"]
        
        # Чистые продажи
        net_sales = max(0, delivered - returned)
        
        # Финансовые показатели
        # ВАЖНО: sales_revenue УЖЕ за вычетом комиссии Ozon!
        sales_revenue = stats["sales_revenue"]
        return_costs = stats["return_costs"]
        logistics = stats["logistics"]
        other_expenses = stats["other_expenses"]
        compensations = stats["compensations"]
        
        # Чистая выручка = выручка (уже за вычетом комиссии) - возвраты + компенсации
        net_revenue = sales_revenue - return_costs + compensations
        
        # Расходы МП = логистика + прочее (комиссия уже вычтена из sales_revenue!)
        mp_expenses = logistics + other_expenses
        
        purchase_price = stats["purchase_price"]
        
        # COGS = закупочная × чистые продажи
        actual_sold = max(0, delivered - returned)
        cogs = purchase_price * actual_sold if actual_sold > 0 and purchase_price > 0 else 0
        
        # Налог
        if tax_system == "usn_6":
            # УСН 6% — от выручки (но от какой? от sales_revenue или от net_revenue?)
            # Правильно: от суммы поступлений, т.е. sales_revenue + compensations
            tax_base = sales_revenue + compensations
            tax = max(0, tax_base) * tax_rate
        else:
            profit_before_tax = net_revenue - mp_expenses - cogs
            tax = max(0, profit_before_tax) * tax_rate
        
        # Чистая прибыль
        profit = net_revenue - mp_expenses - cogs - tax
        
        # Маржинальность
        if sales_revenue > 0:
            margin_pct = (profit / sales_revenue * 100)
        elif net_revenue != 0:
            margin_pct = (profit / abs(net_revenue) * 100)
        else:
            margin_pct = -100 if profit < 0 else 0
        
        margin_pct = max(-100, min(100, margin_pct))
        
        profit_per_unit = profit / net_sales if net_sales > 0 else 0
        
        has_activity = delivered > 0 or returned > 0 or mp_expenses > 0 or return_costs > 0
        
        if not has_activity:
            continue
        
        products_result.append({
            "name": stats["name"],
            "sku": stats["sku"],
            "article": stats["article"],
            "tags": stats["tags"],
            "delivered": delivered,
            "returned": returned,
            "sales_count": net_sales,
            "purchase_price": round(purchase_price, 2),
            "revenue": round(net_revenue, 2),
            "sales_revenue": round(sales_revenue, 2),
            "return_costs": round(return_costs, 2),
            "mp_expenses": round(mp_expenses, 2),
            "logistics": round(logistics, 2),
            "other_expenses": round(other_expenses, 2),
            "compensations": round(compensations, 2),
            "cogs": round(cogs, 2),
            "tax": round(tax, 2),
            "profit": round(profit, 2),
            "margin_pct": round(margin_pct, 1),
            "profit_per_unit": round(profit_per_unit, 2),
            "has_purchase_price": purchase_price > 0,
            "is_returned": returned > 0 and delivered == 0
        })
    
    # Сортируем по прибыли (убыточные сверху)
    products_result.sort(key=lambda x: x["profit"])
    
    # Статистика
    total_products = len(products_result)
    profitable = sum(1 for p in products_result if p["profit"] > 0)
    unprofitable = sum(1 for p in products_result if p["profit"] < 0)
    returned_items = sum(1 for p in products_result if p.get("is_returned"))
    without_cogs = sum(1 for p in products_result if not p["has_purchase_price"] and p["sales_count"] > 0)
    
    total_revenue = sum(p["revenue"] for p in products_result)
    total_profit = sum(p["profit"] for p in products_result)
    total_sales = sum(p["sales_count"] for p in products_result)
    total_returns = sum(p["returned"] for p in products_result)
    
    # Собираем все теги для фильтра
    all_tags = set()
    for p in products_result:
        all_tags.update(p["tags"])
    
    return {
        "products": products_result,
        "summary": {
            "total_products": total_products,
            "profitable": profitable,
            "unprofitable": unprofitable,
            "returned_items": returned_items,
            "without_cogs": without_cogs,
            "total_sales": total_sales,
            "total_returns": total_returns,
            "total_revenue": round(total_revenue, 2),
            "total_profit": round(total_profit, 2),
            "general_expenses_total": round(general_expenses_total, 2),
            "net_profit": round(total_profit - general_expenses_total, 2)
        },
        "general_expenses": {
            "subscription": round(general_expenses["subscription"], 2),
            "penalties": round(general_expenses["penalties"], 2),
            "advertising": round(general_expenses["advertising"], 2),
            "storage": round(general_expenses["storage"], 2),
            "early_payment": round(general_expenses["early_payment"], 2),
            "points": round(general_expenses["points"], 2),
            "other": round(general_expenses["other"], 2),
            "total": round(general_expenses_total, 2)
        },
        "available_tags": sorted(list(all_tags)),
        "tax_info": {
            "system": tax_system,
            "rate": tax_rate,
            "name": TAX_SYSTEMS.get(tax_system, {}).get("name", "УСН 6%")
        },
        "period": {
            "from": date_from,
            "to": date_to
        },
        "note": "sales_revenue уже за вычетом комиссии Ozon. mp_expenses = логистика + прочие услуги."
    }


@router.get("/products-economics/export")
async def export_products_economics(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    tag: str = Query(None, description="Filter by tag"),
    current_user: dict = Depends(get_current_user)
):
    """
    Выгрузка Unit Economics в Excel
    """
    # Получаем данные
    data = await get_products_economics(date_from, date_to, tag, current_user)
    products = data["products"]
    
    # Создаём Excel файл
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # Форматы
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#1a1a2e', 'font_color': '#00d4ff',
        'border': 1, 'align': 'center'
    })
    money_format = workbook.add_format({'num_format': '#,##0.00 ₽', 'align': 'right'})
    percent_format = workbook.add_format({'num_format': '0.0%', 'align': 'right'})
    profit_format = workbook.add_format({'num_format': '#,##0.00 ₽', 'align': 'right', 'font_color': 'green'})
    loss_format = workbook.add_format({'num_format': '#,##0.00 ₽', 'align': 'right', 'font_color': 'red'})
    
    # Лист с товарами
    ws = workbook.add_worksheet('Unit Economics')
    
    # Заголовки
    headers = [
        'Товар', 'Артикул', 'SKU', 'Теги', 'Продаж', 'Возвратов',
        'Закупочная цена', 'Выручка', 'Расходы МП', 'Себестоимость',
        'Налог', 'Прибыль', 'Маржа %', 'Прибыль/шт'
    ]
    for col, header in enumerate(headers):
        ws.write(0, col, header, header_format)
    
    # Данные
    for row, p in enumerate(products, start=1):
        ws.write(row, 0, p["name"])
        ws.write(row, 1, p["article"])
        ws.write(row, 2, p["sku"])
        ws.write(row, 3, ", ".join(p["tags"]) if p["tags"] else "")
        ws.write(row, 4, p["sales_count"])
        ws.write(row, 5, p["returned"])
        ws.write(row, 6, p["purchase_price"], money_format)
        ws.write(row, 7, p["revenue"], money_format)
        ws.write(row, 8, p["mp_expenses"], money_format)
        ws.write(row, 9, p["cogs"], money_format)
        ws.write(row, 10, p["tax"], money_format)
        ws.write(row, 11, p["profit"], profit_format if p["profit"] >= 0 else loss_format)
        ws.write(row, 12, p["margin_pct"] / 100, percent_format)
        ws.write(row, 13, p["profit_per_unit"], money_format)
    
    # Автоширина колонок
    ws.set_column(0, 0, 50)  # Название
    ws.set_column(1, 3, 15)  # Артикул, SKU, Теги
    ws.set_column(4, 5, 10)  # Продаж, Возвратов
    ws.set_column(6, 13, 15)  # Финансы
    
    # Лист со сводкой
    ws_summary = workbook.add_worksheet('Сводка')
    ws_summary.write(0, 0, 'Период', header_format)
    ws_summary.write(0, 1, f'{date_from} - {date_to}')
    ws_summary.write(1, 0, 'Всего товаров', header_format)
    ws_summary.write(1, 1, data["summary"]["total_products"])
    ws_summary.write(2, 0, 'Прибыльных', header_format)
    ws_summary.write(2, 1, data["summary"]["profitable"])
    ws_summary.write(3, 0, 'Убыточных', header_format)
    ws_summary.write(3, 1, data["summary"]["unprofitable"])
    ws_summary.write(4, 0, 'Без себестоимости', header_format)
    ws_summary.write(4, 1, data["summary"]["without_cogs"])
    ws_summary.write(5, 0, 'Общая выручка', header_format)
    ws_summary.write(5, 1, data["summary"]["total_revenue"], money_format)
    ws_summary.write(6, 0, 'Общая прибыль', header_format)
    ws_summary.write(6, 1, data["summary"]["total_profit"], profit_format if data["summary"]["total_profit"] >= 0 else loss_format)
    
    ws_summary.set_column(0, 0, 20)
    ws_summary.set_column(1, 1, 25)
    
    workbook.close()
    output.seek(0)
    
    filename = f"unit_economics_{date_from}_{date_to}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

