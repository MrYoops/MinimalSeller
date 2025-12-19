# Business Analytics Module - Complete financial analytics with proper categorization
# Handles all Ozon operation types including loyalty points, penalties, returns

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
import aiohttp
import os

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
    
    total_cogs = 0
    items_with_cogs = 0
    items_without_cogs = 0
    unmatched_items = []
    
    for op in operations:
        op_type = op.get("operation_type", "")
        
        # Считаем COGS только для продаж (доставленных клиенту)
        if op_type != "OperationAgentDeliveredToCustomer":
            continue
        
        items = op.get("items", [])
        for item in items:
            sku = str(item.get("sku", ""))
            name = item.get("name", "")
            
            purchase_price = 0
            match_method = None
            
            # 1. Ищем по маппингу SKU -> article
            if sku and sku in sku_to_article:
                article = sku_to_article[sku]
                if article.lower() in price_by_article:
                    purchase_price = price_by_article[article.lower()]
                    match_method = "sku_mapping"
            
            # 2. Ищем напрямую по SKU как артикулу
            if not purchase_price and sku:
                if sku.lower() in price_by_article:
                    purchase_price = price_by_article[sku.lower()]
                    match_method = "sku_as_article"
            
            # 3. Ищем по названию товара (fuzzy)
            if not purchase_price and name:
                words = [w.lower() for w in name.split() if len(w) > 3][:3]
                key = " ".join(sorted(words))
                if key in price_by_name:
                    purchase_price = price_by_name[key]["price"]
                    match_method = "name_match"
            
            if purchase_price > 0:
                total_cogs += purchase_price
                items_with_cogs += 1
            else:
                items_without_cogs += 1
                if len(unmatched_items) < 20:
                    unmatched_items.append({
                        "sku": sku,
                        "name": name[:60] if name else ""
                    })
    
    return {
        "total_cogs": round(total_cogs, 2),
        "items_with_cogs": items_with_cogs,
        "items_without_cogs": items_without_cogs,
        "coverage_pct": round(items_with_cogs / (items_with_cogs + items_without_cogs) * 100, 1) if (items_with_cogs + items_without_cogs) > 0 else 0,
        "unmatched_items": unmatched_items,
        "note": "Для улучшения точности добавьте маппинг SKU -> артикул через синхронизацию товаров"
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
    """
    seller_id = str(current_user["_id"])
    
    try:
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Get credentials
    credentials = await get_ozon_credentials(seller_id)
    
    # Fetch current period data
    operations = await fetch_ozon_operations(
        credentials["client_id"],
        credentials["api_key"],
        period_start,
        period_end
    )
    
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
        cogs = order["cogs"]
        
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

