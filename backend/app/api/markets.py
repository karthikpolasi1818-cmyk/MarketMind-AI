import re
from datetime import datetime, timezone

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

SYMBOLS = [
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "market": "India"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "market": "India"},
    {"symbol": "INFY.NS", "name": "Infosys", "market": "India"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "market": "India"},
    {"symbol": "^NSEI", "name": "Nifty 50", "market": "India"},
    {"symbol": "^BSESN", "name": "BSE Sensex", "market": "India"},
    {"symbol": "AAPL", "name": "Apple", "market": "Global"},
    {"symbol": "MSFT", "name": "Microsoft", "market": "Global"},
    {"symbol": "GOOGL", "name": "Alphabet", "market": "Global"},
    {"symbol": "^GSPC", "name": "S&P 500", "market": "Global"},
    {"symbol": "^IXIC", "name": "Nasdaq Composite", "market": "Global"},
]

PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}
SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9.^=_-]{1,30}$")


def ensure_price_table(connection) -> None:
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS market_prices (
            symbol VARCHAR(30) NOT NULL,
            price_date DATE NOT NULL,
            open NUMERIC(20, 6),
            high NUMERIC(20, 6),
            low NUMERIC(20, 6),
            close NUMERIC(20, 6),
            adj_close NUMERIC(20, 6),
            volume BIGINT,
            source VARCHAR(40) NOT NULL DEFAULT 'Yahoo Finance via yfinance',
            retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (symbol, price_date)
        )
    """))


@router.get("/search")
def search_symbols(
    q: str = Query(default="", max_length=50),
    market: str = Query(default="all", pattern="^(all|india|global)$"),
) -> dict:
    query = q.strip().lower()
    results = [
        item for item in SYMBOLS
        if (not query
            or query in item["symbol"].lower()
            or query in item["name"].lower())
        and (market == "all" or item["market"].lower() == market)
    ]
    return {
        "count": len(results),
        "results": results,
        "note": "Searches the built-in starter symbol list.",
    }


@router.get("/{symbol}/history")
def get_history(
    symbol: str,
    period: str = Query(default="1y"),
) -> dict:
    symbol = symbol.strip().upper()

    if not SYMBOL_PATTERN.fullmatch(symbol):
        raise HTTPException(status_code=400, detail="Invalid symbol format.")

    if period not in PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported period. Choose one of: {sorted(PERIODS)}",
        )

    try:
        frame = yf.download(
            symbol,
            period=period,
            interval="1d",
            auto_adjust=False,
            progress=False,
            threads=False,
            multi_level_index=False,
            timeout=20,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Market-data provider request failed: {type(exc).__name__}",
        ) from exc

    if frame is None or frame.empty:
        raise HTTPException(
            status_code=404,
            detail="No historical prices returned for this symbol and period.",
        )

    frame.columns = [
        str(column[0] if isinstance(column, tuple) else column).lower()
        for column in frame.columns
    ]

    required = {"open", "high", "low", "close", "volume"}
    if not required.issubset(set(frame.columns)):
        raise HTTPException(
            status_code=502,
            detail="Provider response did not contain the expected price fields.",
        )

    records = []
    for index, row in frame.iterrows():
        date_value = index.date() if hasattr(index, "date") else index
        item = {
            "symbol": symbol,
            "price_date": date_value,
            "open": None if row["open"] != row["open"] else float(row["open"]),
            "high": None if row["high"] != row["high"] else float(row["high"]),
            "low": None if row["low"] != row["low"] else float(row["low"]),
            "close": None if row["close"] != row["close"] else float(row["close"]),
            "adj_close": (
                None if "adj close" not in frame.columns
                or row["adj close"] != row["adj close"]
                else float(row["adj close"])
            ),
            "volume": (
                None if row["volume"] != row["volume"]
                else int(row["volume"])
            ),
        }
        records.append(item)

    insert_statement = text("""
        INSERT INTO market_prices
            (symbol, price_date, open, high, low, close, adj_close, volume,
             source, retrieved_at)
        VALUES
            (:symbol, :price_date, :open, :high, :low, :close, :adj_close,
             :volume, 'Yahoo Finance via yfinance', NOW())
        ON CONFLICT (symbol, price_date) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            adj_close = EXCLUDED.adj_close,
            volume = EXCLUDED.volume,
            source = EXCLUDED.source,
            retrieved_at = NOW()
    """)

    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        try:
            with engine.begin() as connection:
                ensure_price_table(connection)
                connection.execute(insert_statement, records)

                saved = connection.execute(
                    text("""
                        SELECT price_date, open, high, low, close,
                               adj_close, volume, source, retrieved_at
                        FROM market_prices
                        WHERE symbol = :symbol
                          AND price_date >= CASE :period
                              WHEN '1d' THEN CURRENT_DATE - 1
                              WHEN '5d' THEN CURRENT_DATE - 5
                              WHEN '1mo' THEN CURRENT_DATE - INTERVAL '1 month'
                              WHEN '3mo' THEN CURRENT_DATE - INTERVAL '3 months'
                              WHEN '6mo' THEN CURRENT_DATE - INTERVAL '6 months'
                              WHEN '1y' THEN CURRENT_DATE - INTERVAL '1 year'
                              WHEN '2y' THEN CURRENT_DATE - INTERVAL '2 years'
                              WHEN '5y' THEN CURRENT_DATE - INTERVAL '5 years'
                              WHEN '10y' THEN CURRENT_DATE - INTERVAL '10 years'
                              WHEN 'ytd' THEN DATE_TRUNC('year', CURRENT_DATE)::date
                              WHEN 'max' THEN DATE '1900-01-01'
                              ELSE CURRENT_DATE - INTERVAL '1 year'
                          END
                        ORDER BY price_date DESC
                        LIMIT 500
                    """),
                    {"symbol": symbol, "period": period},
                ).mappings().all()
        finally:
            engine.dispose()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Could not save or retrieve market prices from PostgreSQL.",
        ) from exc

    prices = []
    for row in reversed(saved):
        prices.append({
            "date": row["price_date"].isoformat(),
            "open": float(row["open"]) if row["open"] is not None else None,
            "high": float(row["high"]) if row["high"] is not None else None,
            "low": float(row["low"]) if row["low"] is not None else None,
            "close": float(row["close"]) if row["close"] is not None else None,
            "adj_close": (
                float(row["adj_close"])
                if row["adj_close"] is not None else None
            ),
            "volume": row["volume"],
        })

    return {
        "symbol": symbol,
        "period_requested": period,
        "interval": "1d",
        "count": len(prices),
        "prices": prices,
        "source": "Yahoo Finance via yfinance (unofficial)",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "data_note": (
            "Historical daily data; may be delayed, incomplete, or revised. "
            "This is not a real-time quote or investment recommendation."
        ),
    }

