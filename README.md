# MarketMind AI â€” Phase 1
Standalone foundation for India and global stock-market analytics.

## Stack
- Next.js + React + TypeScript
- FastAPI + Python
- PostgreSQL via Docker Compose
- Local Ollama status integration

## Start
1. Copy root `.env.example` to `.env`.
2. Start database: `docker compose up -d db`
3. In terminal 1:
   `cd backend`
   `py -3.11 -m venv .venv`
   `.\.venv\Scripts\Activate.ps1`
   `pip install -r requirements.txt`
   `Copy-Item .env.example .env`
   `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
4. In terminal 2:
   `cd frontend`
   `Copy-Item .env.example .env.local`
   `npm install`
   `npm run dev`
5. Open `http://localhost:3000`; API docs at `http://127.0.0.1:8000/docs`.

## Verify
`Invoke-RestMethod http://127.0.0.1:8000/health`
`Invoke-RestMethod http://127.0.0.1:8000/api/v1/system/status`
`Invoke-RestMethod http://127.0.0.1:8000/api/v1/ai/status`

PostgreSQL is bound to localhost port 5433 to avoid colliding with an existing port 5432 service. The local default password is for development only. Do not expose the database port publicly or commit `.env` files.

Phase 1 intentionally does not fetch live market data, generate forecasts, or give investment advice. Phase 2 will add market-data ingestion and verified charts.

## Data quality, comparison and exports

MarketMind AI includes data-quality checks, historical stock comparison, and downloadable reports.

- Data Quality checks required-field completeness, invalid values, duplicate dates, large daily moves, and stale saved data.
- Stock Comparison compares historical return, annualized volatility, and maximum drawdown for up to eight tickers.
- CSV export downloads saved prices.
- Excel export includes price history, a data-quality sheet, and an analytics summary.
- Automated calculation tests can be run from the backend directory using `python -m unittest discover -s tests -v`.

### Local run

Start the FastAPI backend from `backend` with your configured virtual environment, and start the Next.js frontend from `frontend` using `npm run dev`.

See [the architecture guide](docs/ARCHITECTURE.md) for data flow, endpoints, and limitations.