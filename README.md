# MarketMind AI

**An end-to-end financial data analytics platform for exploring historical markets, validating price data, comparing stocks, and generating AI-assisted explanations.**

MarketMind AI combines a Next.js dashboard, FastAPI services, PostgreSQL storage, quantitative analysis, downloadable reports, and a locally hosted Ollama model.

> Historical market analysis and educational explanations only. This project does not provide investment advice or guarantee live quotes.

## Highlights

- **Market explorer:** search the built-in Indian and global market symbol list and inspect historical price charts.
- **Stock analytics:** examine period returns, moving averages, RSI, annualized volatility, price ranges, and drawdown.
- **Watchlist:** save symbols in PostgreSQL and review the latest prices already stored for them.
- **AI analyst:** ask finance and data-analysis questions using a local Ollama model, with available historical metrics supplied as context.
- **Data quality:** inspect missing fields, invalid price rows, duplicate dates, large daily price moves, and data freshness.
- **Stock comparison:** compare historical returns, volatility, and drawdown across supported symbols.
- **Data export:** download CSV price history or an Excel workbook containing price history, a quality report, and an analytics summary.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript, Recharts, Lucide React |
| API | Python, FastAPI |
| Data store | PostgreSQL, SQLAlchemy |
| Market history | yfinance |
| AI | Ollama, `llama3.2:3b` |
| Reporting | CSV, openpyxl / Excel |
| Testing | Python `unittest`, TypeScript checks, Next.js production build |

## Architecture

```mermaid
flowchart TD
    UI[Next.js Dashboard] --> API[FastAPI]
    API --> DB[(PostgreSQL)]
    API --> MD[Historical Market Data]
    API --> QA[Data Quality Checks]
    API --> AN[Analytics and Comparison]
    API --> EX[CSV and Excel Export]
    API --> AI[Local Ollama Analyst]
    QA --> DB
    AN --> DB
    EX --> DB
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for more details about the data flow, endpoints, and limitations.

## Local development

### Prerequisites

- Python 3.12 or a compatible version supported by the backend dependencies
- Node.js and npm
- Docker with Docker Compose
- Ollama for the local AI analyst

### 1. Configure local environment files

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

Review each copied template and adjust local database settings if needed. Keep real `.env` files private; only example templates with placeholder values belong in Git.

### 2. Start PostgreSQL

```powershell
docker compose up -d db
```

Verify that the backend database URL in `backend\.env` matches the database host, port, name, and credentials configured for your local environment.

### 3. Start the API

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If the virtual environment already exists, activate and reuse it instead of recreating it.

The API documentation is available at `http://127.0.0.1:8000/docs`.

### 4. Start the local AI model

Install Ollama, then fetch the configured model if needed:

```powershell
ollama pull llama3.2:3b
```

Ollama must be running and reachable at the base URL configured by the backend. The first request may take longer while the model loads.

### 5. Start the frontend

Open a second terminal:

```powershell
Set-Location .\frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The local API URL can be configured with `NEXT_PUBLIC_MARKETMIND_API_URL` in the frontend environment template.

## Quality checks

Backend syntax and calculation tests:

```powershell
Set-Location .\backend
.\.venv\Scripts\python.exe -m py_compile .\app\main.py .\app\api\features.py .\app\api\pro_features.py
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Frontend checks:

```powershell
Set-Location .\frontend
.\node_modules\.bin\tsc.cmd --noEmit
npm run build
```

Stop an active Next.js development server before running a production build if the `.next` directory is locked by another process.

## Data and interpretation notes

- Historical prices can be delayed, incomplete, revised, or unavailable for some symbols.
- The market-history integration uses yfinance, an unofficial interface; it is not a guaranteed real-time data feed.
- A large daily move is a review flag, not proof that the observation is wrong.
- The data-quality score is heuristic, not a guarantee of correctness.
- Comparisons do not automatically normalize different currencies or foreign-exchange effects.
- Technical indicators and historical returns describe past data and are not reliable promises about future outcomes.
- The AI analyst may produce incorrect explanations. Verify calculations against the underlying records and do not use generated text as personalized investment advice.
- Local Ollama access is not automatically available after deploying the frontend publicly. Online deployments require a separately reachable, secured backend and data store.

## Repository structure

```text
MarketMind_AI/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â””â”€â”€ core/
â”‚   â””â”€â”€ tests/
â”œâ”€â”€ frontend/
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ app/
â”‚       â”œâ”€â”€ components/
â”‚       â””â”€â”€ lib/
â”œâ”€â”€ docs/
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ .env.example
â””â”€â”€ README.md
```

## Screenshots

Explore the main features of MarketMind AI.

### Market overview

![Market overview](docs/screenshots/01-market-overview.png)

### Price history and stock analytics

![Price history and stock analytics](docs/screenshots/02-price-history-and-analytics.png)

### Watchlist and AI Analyst

![Watchlist and AI Analyst](docs/screenshots/03-watchlist-and-ai-analyst.png)

### AI-generated analysis

![AI Analyst response](docs/screenshots/04-ai-analyst-response.png)

### Data quality report

![Data quality report](docs/screenshots/05-data-quality-report.png)

### Stock comparison and reporting

![Stock comparison and export](docs/screenshots/06-stock-comparison-and-export.png)
## Disclaimer

MarketMind AI is an educational and portfolio project for historical financial data analysis. It is not a broker, trading system, certified financial product, or substitute for independent research.