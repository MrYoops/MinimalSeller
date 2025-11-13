from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from collections import defaultdict
import os
from openai import OpenAI

from database import get_database

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Initialize OpenAI client for AI recommendations
client = OpenAI()  # API key from environment

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_seller_id() -> str:
    """Get current seller ID from JWT token"""
    # TODO: Implement JWT authentication
    return "demo_seller_id"

def calculate_listing_quality_score(product: dict) -> int:
    """
    Рассчитывает качество листинга (0-100)
    Критерии:
    - Наличие изображений (20 баллов)
    - Длина названия (15 баллов)
    - Длина описания (15 баллов)
    - Заполненность характеристик (20 баллов)
    - Наличие ключевых слов (15 баллов)
    - Качество SEO (15 баллов)
    """
    score = 0
    
    # Images (20 points)
    images = product.get("images", [])
    if len(images) >= 5:
        score += 20
    elif len(images) >= 3:
        score += 15
    elif len(images) >= 1:
        score += 10
    
    # Title length (15 points)
    title = product.get("name", "")
    if 50 <= len(title) <= 100:
        score += 15
    elif 30 <= len(title) < 50 or 100 < len(title) <= 150:
        score += 10
    elif len(title) > 0:
        score += 5
    
    # Description length (15 points)
    description = product.get("description", "")
    if len(description) >= 500:
        score += 15
    elif len(description) >= 200:
        score += 10
    elif len(description) > 0:
        score += 5
    
    # Characteristics (20 points)
    characteristics = product.get("characteristics", {})
    filled_chars = sum(1 for v in characteristics.values() if v)
    if filled_chars >= 10:
        score += 20
    elif filled_chars >= 5:
        score += 15
    elif filled_chars >= 3:
        score += 10
    elif filled_chars > 0:
        score += 5
    
    # Keywords in title (15 points)
    # Check if title contains common keywords
    keywords = ["качественный", "новый", "оригинал", "премиум", "лучший"]
    keyword_count = sum(1 for kw in keywords if kw.lower() in title.lower())
    score += min(keyword_count * 5, 15)
    
    # SEO (15 points)
    # Check if description contains keywords
    if len(description) > 0 and any(kw in description.lower() for kw in keywords):
        score += 15
    
    return min(score, 100)

# ============================================================================
# PRODUCT ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/product-performance")
async def get_product_performance(
    period: str = Query("month", regex="^(week|month|year)$"),
    sort_by: str = Query("revenue", regex="^(revenue|profit|quantity|conversion)$"),
    limit: int = Query(20, ge=1, le=100),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить аналитику по товарам
    """
    db = await get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get orders
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Get products
    products = await db.products.find({"seller_id": seller_id}).to_list(10000)
    product_map = {str(p["_id"]): p for p in products}
    
    # Calculate metrics per product
    product_metrics = defaultdict(lambda: {
        "revenue": 0.0,
        "profit": 0.0,
        "quantity_sold": 0,
        "orders": 0,
        "views": 0,
        "conversion_rate": 0.0
    })
    
    for order in orders:
        for item in order["items"]:
            product_id = item["product_id"]
            product_metrics[product_id]["revenue"] += item["price"] * item["quantity"]
            product_metrics[product_id]["quantity_sold"] += item["quantity"]
            product_metrics[product_id]["orders"] += 1
            
            # Calculate profit
            purchase_price = item.get("purchase_price", 0)
            product_metrics[product_id]["profit"] += (item["price"] - purchase_price) * item["quantity"]
    
    # Add product details and calculate conversion
    results = []
    for product_id, metrics in product_metrics.items():
        if product_id in product_map:
            product = product_map[product_id]
            
            # Get views from product stats (if exists)
            views = product.get("stats", {}).get("views", 0)
            metrics["views"] = views
            
            # Calculate conversion rate
            if views > 0:
                metrics["conversion_rate"] = (metrics["orders"] / views) * 100
            
            results.append({
                "product_id": product_id,
                "sku": product.get("sku", ""),
                "name": product.get("name", ""),
                "image": product.get("images", [None])[0],
                **metrics
            })
    
    # Sort by requested metric
    results.sort(key=lambda x: x[sort_by], reverse=True)
    
    return {
        "period": period,
        "products": results[:limit]
    }

@router.get("/listing-quality")
async def get_listing_quality(
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить анализ качества листингов
    """
    db = await get_database()
    
    # Get all products
    products = await db.products.find({"seller_id": seller_id}).to_list(10000)
    
    # Calculate quality scores
    quality_data = []
    total_score = 0
    
    for product in products:
        score = calculate_listing_quality_score(product)
        total_score += score
        
        quality_data.append({
            "product_id": str(product["_id"]),
            "sku": product.get("sku", ""),
            "name": product.get("name", ""),
            "score": score,
            "issues": get_listing_issues(product, score)
        })
    
    # Sort by score (lowest first - need improvement)
    quality_data.sort(key=lambda x: x["score"])
    
    # Calculate average
    avg_score = total_score / len(products) if products else 0
    
    # Count by quality level
    excellent = sum(1 for p in quality_data if p["score"] >= 80)
    good = sum(1 for p in quality_data if 60 <= p["score"] < 80)
    needs_improvement = sum(1 for p in quality_data if p["score"] < 60)
    
    return {
        "summary": {
            "total_products": len(products),
            "average_score": round(avg_score, 1),
            "excellent": excellent,
            "good": good,
            "needs_improvement": needs_improvement
        },
        "products": quality_data
    }

def get_listing_issues(product: dict, score: int) -> List[str]:
    """Определяет проблемы листинга"""
    issues = []
    
    if len(product.get("images", [])) < 3:
        issues.append("Недостаточно изображений (минимум 3)")
    
    title = product.get("name", "")
    if len(title) < 30:
        issues.append("Слишком короткое название")
    elif len(title) > 150:
        issues.append("Слишком длинное название")
    
    description = product.get("description", "")
    if len(description) < 200:
        issues.append("Слишком короткое описание")
    
    characteristics = product.get("characteristics", {})
    if len(characteristics) < 5:
        issues.append("Мало заполненных характеристик")
    
    if score < 60:
        issues.append("Общее качество листинга требует улучшения")
    
    return issues

@router.get("/recommendations")
async def get_recommendations(
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить AI-рекомендации по улучшению продаж
    """
    db = await get_database()
    
    # Get seller data
    products = await db.products.find({"seller_id": seller_id}).to_list(100)
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": datetime.utcnow() - timedelta(days=30)}
    }).to_list(1000)
    
    # Prepare data for AI
    total_revenue = sum(order["totals"]["subtotal"] for order in orders)
    total_orders = len(orders)
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
    
    # Calculate product performance
    product_sales = defaultdict(int)
    for order in orders:
        for item in order["items"]:
            product_sales[item["product_id"]] += item["quantity"]
    
    top_products = sorted(product_sales.items(), key=lambda x: x[1], reverse=True)[:5]
    low_products = [p for p in products if str(p["_id"]) not in dict(top_products)][:5]
    
    # Generate AI recommendations
    prompt = f"""
Ты - эксперт по e-commerce и маркетплейсам. Проанализируй данные продавца и дай 5 конкретных рекомендаций.

Данные за последние 30 дней:
- Выручка: {total_revenue:.2f} руб
- Заказов: {total_orders}
- Средний чек: {avg_order_value:.2f} руб
- Товаров в каталоге: {len(products)}
- Топ-5 продаваемых товаров: {len(top_products)}
- Товаров без продаж: {len(low_products)}

Дай рекомендации в формате JSON:
[
  {{
    "title": "Заголовок рекомендации",
    "description": "Подробное описание",
    "priority": "high/medium/low",
    "expected_impact": "Ожидаемый эффект"
  }}
]
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "Ты - эксперт по e-commerce."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        import json
        recommendations = json.loads(response.choices[0].message.content)
        
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "recommendations": recommendations
        }
    
    except Exception as e:
        # Fallback to static recommendations
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "recommendations": [
                {
                    "title": "Улучшите качество фотографий",
                    "description": "Товары с качественными фото продаются на 40% лучше",
                    "priority": "high",
                    "expected_impact": "+40% конверсии"
                },
                {
                    "title": "Оптимизируйте цены",
                    "description": "Проанализируйте цены конкурентов и скорректируйте свои",
                    "priority": "medium",
                    "expected_impact": "+15% продаж"
                },
                {
                    "title": "Добавьте больше товаров",
                    "description": "Расширение ассортимента увеличивает охват аудитории",
                    "priority": "medium",
                    "expected_impact": "+25% выручки"
                }
            ]
        }

@router.get("/competitor-analysis")
async def get_competitor_analysis(
    product_id: str,
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Анализ конкурентов для товара
    TODO: Implement marketplace API integration
    """
    db = await get_database()
    
    # Get product
    product = await db.products.find_one({
        "_id": ObjectId(product_id),
        "seller_id": seller_id
    })
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Mock competitor data (in production, fetch from marketplace APIs)
    return {
        "product_id": product_id,
        "competitors": [
            {
                "name": "Конкурент 1",
                "price": product["price"] * 0.9,
                "rating": 4.5,
                "reviews": 150,
                "sales_per_month": 200
            },
            {
                "name": "Конкурент 2",
                "price": product["price"] * 1.1,
                "rating": 4.2,
                "reviews": 80,
                "sales_per_month": 120
            }
        ],
        "your_position": {
            "price_rank": "средний",
            "rating_rank": "выше среднего",
            "recommendation": "Снизьте цену на 5-10% для увеличения конкурентоспособности"
        }
    }

@router.get("/sales-forecast")
async def get_sales_forecast(
    period: str = Query("month", regex="^(week|month|quarter)$"),
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Прогноз продаж на основе исторических данных
    """
    db = await get_database()
    
    # Get historical data (last 3 months)
    start_date = datetime.utcnow() - timedelta(days=90)
    orders = await db.orders.find({
        "seller_id": seller_id,
        "dates.created_at": {"$gte": start_date},
        "status": {"$nin": ["cancelled"]}
    }).to_list(10000)
    
    # Group by week
    weekly_sales = defaultdict(float)
    for order in orders:
        week = order["dates"]["created_at"].strftime("%Y-W%W")
        weekly_sales[week] += order["totals"]["subtotal"]
    
    # Calculate average weekly sales
    avg_weekly_sales = sum(weekly_sales.values()) / len(weekly_sales) if weekly_sales else 0
    
    # Simple forecast (can be improved with ML)
    if period == "week":
        forecast = avg_weekly_sales
        forecast_period = "следующая неделя"
    elif period == "month":
        forecast = avg_weekly_sales * 4
        forecast_period = "следующий месяц"
    else:  # quarter
        forecast = avg_weekly_sales * 12
        forecast_period = "следующий квартал"
    
    # Calculate confidence (based on data consistency)
    if len(weekly_sales) >= 8:
        confidence = "высокая"
    elif len(weekly_sales) >= 4:
        confidence = "средняя"
    else:
        confidence = "низкая"
    
    return {
        "forecast_period": forecast_period,
        "predicted_revenue": round(forecast, 2),
        "confidence": confidence,
        "based_on_weeks": len(weekly_sales),
        "historical_avg_weekly": round(avg_weekly_sales, 2)
    }

@router.get("/inventory-alerts")
async def get_inventory_alerts(
    seller_id: str = Depends(get_current_seller_id)
):
    """
    Получить алерты по складу (заканчивающиеся товары, избыток)
    """
    db = await get_database()
    
    # Get inventory
    inventory = await db.inventory.find({"seller_id": seller_id}).to_list(1000)
    
    alerts = []
    
    for item in inventory:
        # Get product details
        product = await db.products.find_one({"_id": ObjectId(item["product_id"])})
        if not product:
            continue
        
        # Low stock alert
        if item["available"] < 10:
            alerts.append({
                "type": "low_stock",
                "severity": "high" if item["available"] < 5 else "medium",
                "product_id": item["product_id"],
                "sku": product.get("sku", ""),
                "name": product.get("name", ""),
                "available": item["available"],
                "message": f"Осталось всего {item['available']} шт. Рекомендуется пополнить запас"
            })
        
        # Overstock alert (more than 100 units)
        if item["quantity"] > 100:
            alerts.append({
                "type": "overstock",
                "severity": "low",
                "product_id": item["product_id"],
                "sku": product.get("sku", ""),
                "name": product.get("name", ""),
                "quantity": item["quantity"],
                "message": f"Избыток товара ({item['quantity']} шт). Рассмотрите акцию"
            })
    
    # Sort by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda x: severity_order[x["severity"]])
    
    return {
        "total_alerts": len(alerts),
        "alerts": alerts
    }
