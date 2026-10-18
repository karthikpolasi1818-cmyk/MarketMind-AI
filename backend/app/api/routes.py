import httpx
from fastapi import APIRouter
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "app": "MarketMind AI",
        "phase": 1,
        "markets": ["India (NSE/BSE)", "Global"],
        "market_data_live": False,
        "investment_advice": False,
        "available": [
            "api_health",
            "postgresql_connectivity_check",
            "ollama_connectivity_check",
        ],
        "planned": [
            "historical_market_data",
            "technical_indicators",
            "sector_analytics",
            "portfolio_risk",
            "anomaly_detection",
            "forecast_evaluation",
            "ai_market_explanations",
            "strategy_backtesting",
        ],
    }


@router.get("/ai/status")
async def ai_status() -> dict:
    url = settings.ollama_base_url.rstrip("/") + "/api/tags"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
        models = [
            item.get("name", "")
            for item in payload.get("models", [])
            if item.get("name")
        ]
        available = any(
            name == settings.ollama_model
            or name.startswith(settings.ollama_model + ":")
            for name in models
        )
        return {
            "service": "ollama",
            "reachable": True,
            "configured_model": settings.ollama_model,
            "configured_model_available": available,
            "installed_models": models,
            "note": "Connectivity check only; no inference is performed.",
        }
    except (httpx.HTTPError, ValueError):
        return {
            "service": "ollama",
            "reachable": False,
            "configured_model": settings.ollama_model,
            "configured_model_available": False,
            "installed_models": [],
            "note": "Start Ollama and check its local endpoint.",
        }


@router.get("/system/status")
def system_status() -> dict:
    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        engine.dispose()
        database = {
            "reachable": True,
            "detail": "PostgreSQL connection successful",
        }
    except (SQLAlchemyError, ValueError):
        database = {
            "reachable": False,
            "detail": "Database unavailable; check Docker and DATABASE_URL",
        }
    return {"api": {"reachable": True}, "database": database}
