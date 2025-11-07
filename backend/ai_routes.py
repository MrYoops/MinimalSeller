from fastapi import APIRouter, HTTPException, Depends
import os
import httpx

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Эти зависимости будут импортированы из server.py
get_current_user = None

def init_ai_routes(current_user_dep):
    global get_current_user
    get_current_user = current_user_dep

# Для AI будем использовать Emergent LLM key
EMERGENT_API_KEY = os.getenv("EMERGENT_LLM_KEY", "")

@router.post("/adapt-name")
async def adapt_name(
    text: str,
    marketplace: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """
    AI-адаптация названия товара для конкретного маркетплейса.
    """
    if not EMERGENT_LLM_KEY:
        # Fallback без AI
        return {
            "original": text,
            "adapted": text,
            "suggestions": [text]
        }
    
    marketplace_rules = {
        "ozon": "Оптимизируй название для Ozon: до 255 символов, включи ключевые характеристики, бренд в начале.",
        "wildberries": "Оптимизируй название для Wildberries: до 255 символов, включи тип товара, цвет, размер.",
        "yandex": "Оптимизируй название для Яндекс.Маркет: до 255 символов, понятно и кратко."
    }
    
    prompt = f"""{marketplace_rules.get(marketplace, 'Оптимизируй название товара')}

Исходное название: {text}

Дай 3 варианта оптимизированного названия."""
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {EMERGENT_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": "Ты помощник для оптимизации карточек товаров на маркетплейсах."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                adapted_text = data["choices"][0]["message"]["content"]
                
                # Парсим варианты
                suggestions = [s.strip() for s in adapted_text.split('\n') if s.strip() and not s.startswith('#')]
                
                return {
                    "original": text,
                    "adapted": suggestions[0] if suggestions else text,
                    "suggestions": suggestions[:3]
                }
    except Exception as e:
        print(f"AI adaptation error: {e}")
    
    # Fallback
    return {
        "original": text,
        "adapted": text,
        "suggestions": [text]
    }

@router.post("/optimize-description")
async def optimize_description(
    text: str,
    marketplace: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """
    AI-оптимизация описания товара для конкретного маркетплейса.
    """
    if not EMERGENT_LLM_KEY:
        return {
            "original": text,
            "optimized": text
        }
    
    marketplace_rules = {
        "ozon": "Оптимизируй описание для Ozon: структурированно, с ключевыми словами, до 4000 символов.",
        "wildberries": "Оптимизируй описание для Wildberries: списки преимуществ, характеристики, эмоциональный стиль.",
        "yandex": "Оптимизируй описание для Яндекс.Маркет: информативно, без воды, выдели главное."
    }
    
    prompt = f"""{marketplace_rules.get(marketplace, 'Оптимизируй описание товара')}

Исходное описание: {text}

Дай оптимизированное описание."""
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {EMERGENT_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": "Ты помощник для оптимизации карточек товаров на маркетплейсах."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1000
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                optimized_text = data["choices"][0]["message"]["content"]
                
                return {
                    "original": text,
                    "optimized": optimized_text.strip()
                }
    except Exception as e:
        print(f"AI optimization error: {e}")
    
    return {
        "original": text,
        "optimized": text
    }
