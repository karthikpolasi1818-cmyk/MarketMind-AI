# MarketMind AI Architecture

## System components

| Component | Responsibility |
|---|---|
| Next.js and React frontend | User interface, chart, period selection, feature panels |
| FastAPI backend | Market history, analytics, watchlist, validation, comparison, exports, AI endpoint |
| PostgreSQL | Saved historical price records and watchlist entries |
| yfinance | Historical market-data retrieval |
| Analytics functions | Returns, moving averages, RSI approximation, volatility, drawdown |
| Data-quality functions | Missing values, invalid price fields, duplicate dates, unusual moves, freshness |
| Ollama | Local language model used for explanations of supplied metrics |
| CSV / Excel exporter | Downloads saved price history and report sheets |

## Request flow

1. The user selects a symbol and period in the Next.js dashboard.
2. The frontend sends a request to FastAPI.
3. The backend fetches historical prices as needed and saves them in PostgreSQL.
4. Analytics and data-quality endpoints read the relevant stored records.
5. The frontend renders the returned metrics and comparison results.
6. The export endpoint produces CSV or Excel output from saved records.
7. The AI endpoint passes the user's question and available historical metrics to Ollama.

## Endpoint reference

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/markets/search` | Search the built-in ticker list |
| `GET /api/v1/markets/{symbol}/history?period=1y` | Get and store historical price data |
| `GET /api/v1/features/analytics/{symbol}?period=1y` | Calculate historical metrics |
| `GET /api/v1/features/watchlist` | List saved symbols |
| `POST /api/v1/features/watchlist` | Add a symbol |
| `DELETE /api/v1/features/watchlist/{symbol}` | Remove a symbol |
| `POST /api/v1/features/analyst` | Request a local AI explanation |
| `GET /api/v1/pro/quality/{symbol}?period=1y` | Validate stored price data |
| `GET /api/v1/pro/compare?symbols=TCS.NS,RELIANCE.NS&period=1y` | Compare historical metrics |
| `GET /api/v1/pro/export/{symbol}?period=1y&format=csv` | Download CSV |
| `GET /api/v1/pro/export/{symbol}?period=1y&format=xlsx` | Download Excel workbook |

## Operational limitations

- Historical data is provided through an unofficial yfinance integration.
- The watchlist displays stored prices; saving a symbol does not itself retrieve new market history.
- The quality score is heuristic. It can identify review candidates but cannot prove that the source data is correct.
- Return comparisons across markets do not automatically normalize currencies.
- Ollama runs locally unless configured to use a separately reachable inference service.
- Generated explanations are not a substitute for checking the source prices and calculation logic.