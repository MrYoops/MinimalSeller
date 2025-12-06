"""
Маршруты для аналитики чистой прибыли
Получение данных из Ozon API и расчет прибыли с детализацией всех расходов
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import aiohttp
import os
from io import BytesIO
import pandas as pd
from fastapi.responses import StreamingResponse

from database import get_database
import dependencies

router = APIRouter(prefix="/api/profit-analytics", tags=["profit-analytics"])

# Helper function to get current user
async def get_current_user_dep():
    """Dependency to get current user"""
    if dependencies.get_current_user is None:
        raise HTTPException(status_code=500, detail="Authentication not configured")
    return dependencies.get_current_user


# ============================================================================
# МОДЕЛИ ДАННЫХ
# ============================================================================

class OzonFinancialTransaction:
    """Финансовая транзакция из Ozon с полной детализацией"""
    
    @staticmethod
    def from_ozon_api(seller_id: str, ozon_data: dict) -> dict:
        """
        Преобразовать данные из Ozon API в нашу модель
        
        ozon_data structure:
        {
          "operation_id": 12345678,
          "operation_type": "OperationAgentDeliveredToCustomer",
          "operation_date": "2024-11-15T10:30:00Z",
          "posting_number": "12345678-0001-1",
          "amount": 5000.00,
          "type": "orders",
          "items": [...],
          "services": [
            {"name": "MarketplaceServiceItemFulfillment", "price": 150.00},
            {"name": "MarketplaceServiceItemDeliveryToCustomer", "price": 100.00},
            ...
          ]
        }
        """
        
        # Парсим услуги и расходы
        services = ozon_data.get("services", [])
        
        commission_base = 0.0
        logistics_delivery = 0.0
        logistics_last_mile = 0.0
        service_storage = 0.0
        service_acquiring = 0.0
        service_pvz = 0.0
        service_packaging = 0.0
        penalties = 0.0
        other_charges = 0.0
        
        # Маппинг типов услуг Ozon на наши категории
        for service in services:
            service_name = service.get("name", "")
            price = abs(service.get("price", 0.0))  # abs потому что Ozon может отдавать отрицательные суммы
            
            # Комиссия маркетплейса
            if "Commission" in service_name or "MarketplaceServiceItemFulfillment" in service_name:
                commission_base += price
            
            # Логистика - доставка до покупателя
            elif "DeliveryToCustomer" in service_name or "Delivery" in service_name:
                logistics_delivery += price
            
            # Логистика - последняя миля
            elif "LastMile" in service_name or "DropoffPVZ" in service_name:
                logistics_last_mile += price
            
            # Хранение
            elif "Storage" in service_name or "Storing" in service_name:
                service_storage += price
            
            # Эквайринг
            elif "Acquiring" in service_name or "Payment" in service_name:
                service_acquiring += price
            
            # Выдача на ПВЗ
            elif "PVZ" in service_name or "PickupPoint" in service_name:
                service_pvz += price
            
            # Упаковка
            elif "Package" in service_name or "Packaging" in service_name:
                service_packaging += price
            
            # Штрафы
            elif "Penalty" in service_name or "Fine" in service_name:
                penalties += price
            
            # Прочие расходы
            else:
                other_charges += price
        
        # Обрабатываем товары
        items = []
        for item in ozon_data.get("items", []):
            items.append({
                "sku": item.get("sku", ""),
                "name": item.get("name", ""),
                "quantity": item.get("quantity", 1),
                "price": item.get("price", 0.0),  # Цена продажи за единицу
            })
        
        # Формируем нашу структуру
        transaction = {
            "seller_id": seller_id,
            "marketplace": "ozon",
            
            # Идентификаторы
            "transaction_id": str(ozon_data.get("operation_id", "")),
            "order_id": ozon_data.get("posting_number", ""),
            "posting_number": ozon_data.get("posting_number", ""),
            
            # Основные данные
            "operation_date": datetime.fromisoformat(ozon_data.get("operation_date", "").replace("Z", "+00:00")),
            "operation_type": ozon_data.get("operation_type", ""),
            
            # Финансы
            "amount": ozon_data.get("amount", 0.0),
            
            # Детализация расходов
            "breakdown": {
                "commission": {
                    "base_commission": commission_base,
                    "bonus_commission": 0.0,  # Пока 0, добавим позже когда будет система бонусов
                    "total": commission_base
                },
                "logistics": {
                    "delivery_to_customer": logistics_delivery,
                    "last_mile": logistics_last_mile,
                    "returns": 0.0,  # Для возвратов отдельная обработка
                    "total": logistics_delivery + logistics_last_mile
                },
                "services": {
                    "storage": service_storage,
                    "acquiring": service_acquiring,
                    "pvz_fee": service_pvz,
                    "packaging": service_packaging,
                    "total": service_storage + service_acquiring + service_pvz + service_packaging
                },
                "penalties": {
                    "total": penalties
                },
                "other_charges": {
                    "total": other_charges
                }
            },
            
            # Товары
            "items": items,
            
            # Метаданные
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "data_source": "api",
            "raw_data": ozon_data  # Сохраняем сырые данные для отладки
        }
        
        return transaction


# ============================================================================
# ИНТЕГРАЦИЯ С OZON API
# ============================================================================

async def get_ozon_api_credentials(seller_id: str):
    """Получить API ключи Ozon для продавца"""
    db = await get_database()
    
    # Ищем API ключи в коллекции api_keys или settings
    api_keys = await db.api_keys.find_one({
        "seller_id": seller_id,
        "marketplace": "ozon"
    })
    
    if not api_keys:
        raise HTTPException(
            status_code=404,
            detail="Ozon API ключи не найдены. Добавьте их в настройках."
        )
    
    return {
        "client_id": api_keys.get("client_id"),
        "api_key": api_keys.get("api_key")
    }


async def fetch_ozon_transactions(
    client_id: str,
    api_key: str,
    date_from: datetime,
    date_to: datetime,
    operation_types: List[str] = None
) -> List[dict]:
    """
    Получить транзакции из Ozon API
    
    Args:
        client_id: Ozon Client ID
        api_key: Ozon API Key
        date_from: Начало периода
        date_to: Конец периода
        operation_types: Типы операций (["orders"], ["returns"], и т.д.)
    
    Returns:
        Список транзакций
    """
    url = "https://api-seller.ozon.ru/v3/finance/transaction/list"
    headers = {
        "Client-Id": client_id,
        "Api-Key": api_key,
        "Content-Type": "application/json"
    }
    
    all_transactions = []
    page = 1
    
    if operation_types is None:
        operation_types = ["orders"]  # По умолчанию только продажи
    
    async with aiohttp.ClientSession() as session:
        while True:
            body = {
                "filter": {
                    "date": {
                        "from": date_from.isoformat(),
                        "to": date_to.isoformat()
                    },
                    "operation_type": operation_types,
                    "transaction_type": "all"
                },
                "page": page,
                "page_size": 1000
            }
            
            async with session.post(url, headers=headers, json=body) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise HTTPException(
                        status_code=resp.status,
                        detail=f"Ошибка Ozon API: {error_text}"
                    )
                
                data = await resp.json()
                operations = data.get("result", {}).get("operations", [])
                
                if not operations:
                    break
                
                all_transactions.extend(operations)
                page += 1
                
                # Защита от бесконечного цикла
                if page > 100:
                    break
    
    return all_transactions


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/sync-ozon-data")
async def sync_ozon_data(
    date_from: str = Query(..., description="Дата начала периода (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Дата конца периода (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Синхронизировать данные из Ozon API
    
    Получает заказы и финансовые транзакции за указанный период
    и сохраняет их в БД с детализацией всех расходов
    """
    seller_id = current_user["_id"]
    
    # Парсим даты
    try:
        period_start = datetime.fromisoformat(date_from)
        period_end = datetime.fromisoformat(date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
    
    # Получаем API ключи
    credentials = await get_ozon_api_credentials(seller_id)
    
    # Получаем транзакции из Ozon
    try:
        ozon_transactions = await fetch_ozon_transactions(
            credentials["client_id"],
            credentials["api_key"],
            period_start,
            period_end,
            operation_types=["orders"]  # Пока только продажи
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при получении данных из Ozon: {str(e)}"
        )
    
    # Сохраняем в БД
    db = await get_database()
    saved_count = 0
    updated_count = 0
    
    for ozon_txn in ozon_transactions:
        # Преобразуем в нашу модель
        transaction = OzonFinancialTransaction.from_ozon_api(seller_id, ozon_txn)
        
        # Upsert (обновить если уже есть)
        result = await db.marketplace_transactions.update_one(
            {
                "seller_id": seller_id,
                "marketplace": "ozon",
                "transaction_id": transaction["transaction_id"]
            },
            {"$set": transaction},
            upsert=True
        )
        
        if result.upserted_id:
            saved_count += 1
        else:
            updated_count += 1
    
    return {
        "status": "success",
        "message": f"Синхронизация завершена",
        "period": {
            "from": date_from,
            "to": date_to
        },
        "statistics": {
            "total_transactions": len(ozon_transactions),
            "saved": saved_count,
            "updated": updated_count
        }
    }


@router.get("/profit-report")
async def get_profit_report(
    date_from: str = Query(..., description="Дата начала периода (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Дата конца периода (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по маркетплейсу (ozon, wb, yandex)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить отчет о чистой прибыли за период
    
    Возвращает детальный отчет с разбивкой:
    - Выручка
    - Расходы (комиссии, логистика, услуги, штрафы)
    - Чистая прибыль
    - Маржа
    """
    seller_id = current_user["_id"]
    
    # Парсим даты
    try:
        period_start = datetime.fromisoformat(date_from)
        period_end = datetime.fromisoformat(date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
    
    db = await get_database()
    
    # Построить фильтр
    match_filter = {
        "seller_id": seller_id,
        "operation_date": {
            "$gte": period_start,
            "$lte": period_end
        }
    }
    if marketplace:
        match_filter["marketplace"] = marketplace
    
    # Агрегация для расчета всех метрик
    pipeline = [
        {"$match": match_filter},
        
        # Группировка и суммирование
        {"$group": {
            "_id": None,
            "total_amount": {"$sum": "$amount"},
            "transaction_count": {"$sum": 1},
            
            # Расходы
            "commission_base": {"$sum": "$breakdown.commission.base_commission"},
            "commission_bonus": {"$sum": "$breakdown.commission.bonus_commission"},
            "logistics_delivery": {"$sum": "$breakdown.logistics.delivery_to_customer"},
            "logistics_last_mile": {"$sum": "$breakdown.logistics.last_mile"},
            "logistics_returns": {"$sum": "$breakdown.logistics.returns"},
            "service_storage": {"$sum": "$breakdown.services.storage"},
            "service_acquiring": {"$sum": "$breakdown.services.acquiring"},
            "service_pvz": {"$sum": "$breakdown.services.pvz_fee"},
            "service_packaging": {"$sum": "$breakdown.services.packaging"},
            "penalties": {"$sum": "$breakdown.penalties.total"},
            "other_charges": {"$sum": "$breakdown.other_charges.total"},
            
            # Все товары для расчета себестоимости
            "all_items": {"$push": "$items"}
        }}
    ]
    
    result = await db.marketplace_transactions.aggregate(pipeline).to_list(1)
    
    if not result or not result[0]:
        # Нет данных за период
        return {
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
            "revenue": {"gross_sales": 0, "net_sales": 0},
            "expenses": {"total": 0},
            "profit": {"net_profit": 0, "net_margin_pct": 0},
            "message": "Нет данных за указанный период. Выполните синхронизацию."
        }
    
    data = result[0]
    
    # Рассчитываем метрики
    gross_sales = data.get("total_amount", 0.0)
    
    # Расходы
    commission_total = data.get("commission_base", 0.0) + data.get("commission_bonus", 0.0)
    logistics_total = (
        data.get("logistics_delivery", 0.0) + 
        data.get("logistics_last_mile", 0.0) + 
        data.get("logistics_returns", 0.0)
    )
    services_total = (
        data.get("service_storage", 0.0) +
        data.get("service_acquiring", 0.0) +
        data.get("service_pvz", 0.0) +
        data.get("service_packaging", 0.0)
    )
    penalties_total = data.get("penalties", 0.0)
    other_total = data.get("other_charges", 0.0)
    
    total_expenses = (
        commission_total +
        logistics_total +
        services_total +
        penalties_total +
        other_total
    )
    
    # Чистая прибыль (без учета себестоимости пока)
    net_profit = gross_sales - total_expenses
    
    # Маржа
    net_margin_pct = (net_profit / gross_sales * 100) if gross_sales > 0 else 0.0
    
    # Формируем отчет
    report = {
        "period": {
            "from": date_from,
            "to": date_to
        },
        "marketplace": marketplace or "all",
        "statistics": {
            "total_transactions": data.get("transaction_count", 0)
        },
        "revenue": {
            "gross_sales": round(gross_sales, 2),
            "returns": 0.0,  # TODO: добавить возвраты
            "net_sales": round(gross_sales, 2)
        },
        "expenses": {
            "commissions": {
                "marketplace_base": round(data.get("commission_base", 0.0), 2),
                "bonus_commission": round(data.get("commission_bonus", 0.0), 2),
                "total": round(commission_total, 2)
            },
            "logistics": {
                "delivery_to_customer": round(data.get("logistics_delivery", 0.0), 2),
                "last_mile": round(data.get("logistics_last_mile", 0.0), 2),
                "returns": round(data.get("logistics_returns", 0.0), 2),
                "total": round(logistics_total, 2)
            },
            "services": {
                "storage": round(data.get("service_storage", 0.0), 2),
                "acquiring": round(data.get("service_acquiring", 0.0), 2),
                "pvz_fees": round(data.get("service_pvz", 0.0), 2),
                "packaging": round(data.get("service_packaging", 0.0), 2),
                "total": round(services_total, 2)
            },
            "penalties": {
                "total": round(penalties_total, 2)
            },
            "other_expenses": {
                "total": round(other_total, 2)
            },
            "total_expenses": round(total_expenses, 2)
        },
        "profit": {
            "net_profit": round(net_profit, 2),
            "net_margin_pct": round(net_margin_pct, 2)
        }
    }
    
    return report


@router.get("/export-profit-report")
async def export_profit_report_to_excel(
    date_from: str = Query(..., description="Дата начала периода (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Дата конца периода (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по маркетплейсу"),
    current_user: dict = Depends(get_current_user)
):
    """
    Экспортировать отчет о чистой прибыли в Excel
    """
    # Получаем данные отчета
    report = await get_profit_report(date_from, date_to, marketplace, current_user)
    
    # Создаем Excel файл
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Лист 1: Сводка
        summary_data = {
            "Показатель": [
                "Период",
                "Маркетплейс",
                "",
                "ВЫРУЧКА",
                "Валовая выручка",
                "Возвраты",
                "Чистая выручка",
                "",
                "РАСХОДЫ",
                "Комиссии маркетплейса",
                "  - Базовая комиссия",
                "  - Комиссия от бонусов",
                "Логистика",
                "  - Доставка до покупателя",
                "  - Последняя миля",
                "  - Возвратная логистика",
                "Услуги",
                "  - Хранение",
                "  - Эквайринг",
                "  - Выдача на ПВЗ",
                "  - Упаковка",
                "Штрафы",
                "Прочие расходы",
                "",
                "ИТОГО РАСХОДОВ",
                "",
                "ЧИСТАЯ ПРИБЫЛЬ",
                "Чистая маржа (%)"
            ],
            "Значение": [
                f"{report['period']['from']} - {report['period']['to']}",
                report['marketplace'],
                "",
                "",
                report['revenue']['gross_sales'],
                report['revenue']['returns'],
                report['revenue']['net_sales'],
                "",
                "",
                "",
                report['expenses']['commissions']['marketplace_base'],
                report['expenses']['commissions']['bonus_commission'],
                "",
                report['expenses']['logistics']['delivery_to_customer'],
                report['expenses']['logistics']['last_mile'],
                report['expenses']['logistics']['returns'],
                "",
                report['expenses']['services']['storage'],
                report['expenses']['services']['acquiring'],
                report['expenses']['services']['pvz_fees'],
                report['expenses']['services']['packaging'],
                report['expenses']['penalties']['total'],
                report['expenses']['other_expenses']['total'],
                "",
                report['expenses']['total_expenses'],
                "",
                report['profit']['net_profit'],
                report['profit']['net_margin_pct']
            ]
        }
        
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Сводка', index=False)
    
    output.seek(0)
    
    # Формируем имя файла
    filename = f"profit_report_{date_from}_{date_to}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/transactions")
async def get_transactions(
    date_from: str = Query(..., description="Дата начала периода (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Дата конца периода (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список транзакций с детализацией
    """
    seller_id = current_user["_id"]
    
    try:
        period_start = datetime.fromisoformat(date_from)
        period_end = datetime.fromisoformat(date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    db = await get_database()
    
    match_filter = {
        "seller_id": seller_id,
        "operation_date": {"$gte": period_start, "$lte": period_end}
    }
    if marketplace:
        match_filter["marketplace"] = marketplace
    
    # Получаем транзакции
    transactions = await db.marketplace_transactions.find(
        match_filter
    ).sort("operation_date", -1).skip(offset).limit(limit).to_list(limit)
    
    # Считаем общее количество
    total_count = await db.marketplace_transactions.count_documents(match_filter)
    
    # Преобразуем ObjectId в строки
    for txn in transactions:
        txn["_id"] = str(txn["_id"])
        txn["operation_date"] = txn["operation_date"].isoformat()
        txn["created_at"] = txn["created_at"].isoformat()
        txn["updated_at"] = txn["updated_at"].isoformat()
    
    return {
        "transactions": transactions,
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }
