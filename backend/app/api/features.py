import json
import math
import os
from datetime import date, datetime, timedelta, timezone

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text

from app.core.config import get_settings

router = APIRouter(prefix="/features", tags=["Analytics, Watchlist and AI"])
settings = get_settings()

def get_engine():
    return create_engine(settings.database_url, pool_pre_ping=True)

def ensure_tables(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS marketmind_watchlist (
            symbol VARCHAR(30) PRIMARY KEY,
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))

@router.get("/analytics/{symbol}")
def analytics(symbol: str, period: str = "1y"):
    symbol = symbol.strip().upper()
    allowed = {"1mo": 31, "3mo": 93, "6mo": 186, "1y": 366, "2y": 732}
    if period not in allowed:
        raise HTTPException(400, "Choose 1mo, 3mo, 6mo, 1y or 2y.")
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(text("""
                SELECT price_date, close, volume
                FROM market_prices
                WHERE symbol = :symbol
                  AND price_date >= CURRENT_DATE - (:days * INTERVAL '1 day')
                  AND close IS NOT NULL
                ORDER BY price_date
            """), {"symbol": symbol, "days": allowed[period]}).mappings().all()
    except Exception as exc:
        raise HTTPException(503, "Could not read saved market history.") from exc

    if len(rows) < 2:
        raise HTTPException(404, "Not enough saved prices. Open the symbol history first to fetch data.")

    closes = np.array([float(r["close"]) for r in rows], dtype=float)
    returns = np.diff(closes) / closes[:-1]
    latest = float(closes[-1])
    first = float(closes[0])
    change = latest - first
    daily_returns = returns.tolist()

    def sma(window):
        return round(float(np.mean(closes[-window:])), 2) if len(closes) >= window else None

    gains = np.maximum(returns, 0)
    losses = np.maximum(-returns, 0)
    recent_gains = float(np.mean(gains[-14:])) if len(gains) else 0
    recent_losses = float(np.mean(losses[-14:])) if len(losses) else 0
    rsi = (100 - 100 / (1 + recent_gains / recent_losses)) if recent_losses else (100 if recent_gains else 50)

    peaks = np.maximum.accumulate(closes)
    drawdowns = (closes - peaks) / peaks
    vol = float(np.std(returns, ddof=1) * math.sqrt(252) * 100) if len(returns) > 1 else 0

    return {
        "symbol": symbol,
        "period": period,
        "observations": len(closes),
        "start_date": rows[0]["price_date"].isoformat(),
        "end_date": rows[-1]["price_date"].isoformat(),
        "first_close": round(first, 2),
        "latest_close": round(latest, 2),
        "period_change": round(change, 2),
        "period_return_pct": round(change / first * 100, 2) if first else None,
        "daily_return_pct": round(float(returns[-1] * 100), 2),
        "sma20": sma(20), "sma50": sma(50), "sma200": sma(200),
        "rsi14_approx": round(float(rsi), 2),
        "annualized_volatility_pct": round(vol, 2),
        "period_high": round(float(np.max(closes)), 2),
        "period_low": round(float(np.min(closes)), 2),
        "max_drawdown_pct": round(float(np.min(drawdowns) * 100), 2),
        "note": "Historical analytics, not investment advice. SMA/RSI require sufficient history."
    }

@router.get("/watchlist")
def get_watchlist():
    try:
        with get_engine().begin() as conn:
            ensure_tables(conn)
            symbols = conn.execute(text("""
                SELECT symbol, added_at FROM marketmind_watchlist
                ORDER BY added_at DESC
            """)).mappings().all()
            result = []
            for item in symbols:
                price = conn.execute(text("""
                    SELECT price_date, close FROM market_prices
                    WHERE symbol = :symbol ORDER BY price_date DESC LIMIT 1
                """), {"symbol": item["symbol"]}).mappings().first()
                result.append({
                    "symbol": item["symbol"],
                    "added_at": item["added_at"].isoformat(),
                    "latest_close": float(price["close"]) if price and price["close"] is not None else None,
                    "price_date": price["price_date"].isoformat() if price else None
                })
        return {"count": len(result), "items": result}
    except Exception as exc:
        raise HTTPException(503, "Could not read the watchlist.") from exc

class WatchlistInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)

@router.post("/watchlist")
def add_watchlist(item: WatchlistInput):
    symbol = item.symbol.strip().upper()
    if not all(c.isalnum() or c in ".^=_-" for c in symbol):
        raise HTTPException(400, "Invalid symbol.")
    try:
        with get_engine().begin() as conn:
            ensure_tables(conn)
            conn.execute(text("""
                INSERT INTO marketmind_watchlist(symbol) VALUES (:symbol)
                ON CONFLICT(symbol) DO NOTHING
            """), {"symbol": symbol})
        return {"ok": True, "symbol": symbol}
    except Exception as exc:
        raise HTTPException(503, "Could not save the watchlist item.") from exc

@router.delete("/watchlist/{symbol}")
def remove_watchlist(symbol: str):
    symbol = symbol.strip().upper()
    with get_engine().begin() as conn:
        ensure_tables(conn)
        result = conn.execute(text("""
            DELETE FROM marketmind_watchlist WHERE symbol = :symbol
        """), {"symbol": symbol})
    return {"ok": True, "removed": result.rowcount > 0, "symbol": symbol}

class AnalystInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    period: str = "1y"
    question: str = Field(
        default="Give me a concise analysis of the selected stock.",
        max_length=500
    )

@router.post("/analyst")
async def ai_analyst(item: AnalystInput):
    symbol = item.symbol.strip().upper()
    # Use the same analytics calculations rather than asking the LLM to invent figures.
    data = analytics(symbol, item.period)
    question = item.question.strip() or "Explain the selected stock's historical performance."
    prompt = (
        "You are MarketMind AI, a concise stock-market and financial education assistant. "
        "Answer the user's specific question directly. You can explain stocks, indices, "
        "historical returns, SMA, RSI, MACD, volatility, drawdown, diversification, "
        "portfolio risk, market terminology, and the supplied metrics. "
        "Use the supplied metrics when relevant. Never invent current prices, news, company facts, "
        "or unavailable data. If a question requires live data or information not supplied, say so. "
        "Keep the answer clear and concise, using short bullets when useful. "
        "Explain uncertainty. Do not promise returns or give personalized buy/sell instructions. "
        "\nUSER QUESTION:\n" + question +
        "\nSELECTED STOCK METRICS (historical):\n" +
        json.dumps(data, default=str)
    )
    base = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                f"{base}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": "10m",
                    "options": {"num_predict": 150, "temperature": 0.2}
                }
            )
            response.raise_for_status()
            body = response.json()
        return {
            "symbol": symbol, "period": item.period,
            "model": model, "analytics": data,
            "analysis": body.get("response", "").strip(),
            "note": "AI-generated historical explanation, not investment advice."
        }
    except Exception as exc:
        raise HTTPException(
            503,
            "Could not reach Ollama. Start Ollama and verify OLLAMA_MODEL and OLLAMA_BASE_URL."
        ) from exc