"use client";

import { useCallback, useEffect, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_MARKETMIND_API_URL ?? "http://127.0.0.1:8000";

type Analytics = {
  symbol: string;
  period: string;
  observations: number;
  start_date: string;
  end_date: string;
  first_close: number;
  latest_close: number;
  period_change: number;
  period_return_pct: number | null;
  daily_return_pct: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14_approx: number;
  annualized_volatility_pct: number;
  period_high: number;
  period_low: number;
  max_drawdown_pct: number;
  note: string;
};

type WatchItem = {
  symbol: string;
  latest_close: number | null;
  price_date: string | null;
  added_at: string;
};

type AnalystResult = {
  model: string;
  analysis: string;
  note: string;
};

const card: React.CSSProperties = {
  background: "#101a28",
  border: "1px solid #263346",
  borderRadius: 14,
  padding: 20,
  minWidth: 0,
};

const muted: React.CSSProperties = {
  color: "#8290a5",
  fontSize: 12,
};

const heading: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 650,
  margin: "5px 0 16px",
};

const field: React.CSSProperties = {
  background: "#0b1220",
  color: "#f1f5f9",
  border: "1px solid #304057",
  borderRadius: 8,
  padding: "10px 12px",
  minWidth: 0,
};

const button: React.CSSProperties = {
  background: "#55d6a0",
  color: "#07150f",
  border: 0,
  borderRadius: 8,
  padding: "10px 13px",
  fontWeight: 700,
  cursor: "pointer",
};

function number(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div style={{ ...card, padding: 15 }}>
      <div style={muted}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 23, fontWeight: 700, margin: "9px 0 4px", overflowWrap: "anywhere" }}>
        {value}
      </div>
      {hint && <div style={muted}>{hint}</div>}
    </div>
  );
}

export default function MarketMindFeatures({
  symbol,
  period,
}: {
  symbol: string;
  period: string;
}) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");

  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [watchSymbol, setWatchSymbol] = useState("");
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchError, setWatchError] = useState("");
  const [watchMessage, setWatchMessage] = useState("");

  const [analystQuestion, setAnalystQuestion] = useState("");
  const [analyst, setAnalyst] = useState<AnalystResult | null>(null);
  const [analystLoading, setAnalystLoading] = useState(false);
  const [analystError, setAnalystError] = useState(""); 
  // MARKETMIND_RESET_ANALYST_ON_SELECTION
  useEffect(() => {
    setAnalyst(null);
    setAnalystError("");
  }, [symbol, period]);

  const loadWatchlist = useCallback(async () => {
    setWatchError("");
    try {
      const response = await fetch(`${API}/api/v1/features/watchlist`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail ?? "Unable to load watchlist.");
      setWatchlist(body.items ?? []);
    } catch (err) {
      setWatchError(err instanceof Error ? err.message : "Watchlist request failed.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    setAnalytics(null);

    fetch(
      `${API}/api/v1/features/analytics/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.detail ?? "Analytics request failed.");
        return body as Analytics;
      })
      .then((body) => {
        if (!cancelled) setAnalytics(body);
      })
      .catch((err: Error) => {
        if (!cancelled) setAnalyticsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol, period]);

  useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  async function addSymbol(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = watchSymbol.trim().toUpperCase();
    if (!value) return;

    setWatchLoading(true);
    setWatchError("");
    setWatchMessage("");

    try {
      const response = await fetch(`${API}/api/v1/features/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: value }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail ?? "Could not add symbol.");
      setWatchSymbol("");
      setWatchMessage(`${value} saved to your watchlist.`);
      await loadWatchlist();
    } catch (err) {
      setWatchError(err instanceof Error ? err.message : "Could not add symbol.");
    } finally {
      setWatchLoading(false);
    }
  }

  async function removeSymbol(value: string) {
    setWatchError("");
    setWatchMessage("");
    try {
      const response = await fetch(
        `${API}/api/v1/features/watchlist/${encodeURIComponent(value)}`,
        { method: "DELETE" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail ?? "Could not remove symbol.");
      setWatchMessage(`${value} removed from your watchlist.`);
      await loadWatchlist();
    } catch (err) {
      setWatchError(err instanceof Error ? err.message : "Could not remove symbol.");
    }
  }

  async function runAnalyst() {
    setAnalystLoading(true);
    setAnalystError("");
    setAnalyst(null);
    try {
      const response = await fetch(`${API}/api/v1/features/analyst`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, period, question: analystQuestion.trim() || "Give me a concise analysis of this stock." }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail ?? "AI analysis failed.");
      setAnalyst(body as AnalystResult);
    } catch (err) {
      setAnalystError(
        err instanceof Error ? err.message : "Could not reach the AI analyst.",
      );
    } finally {
      setAnalystLoading(false);
    }
  }

  const positive = (analytics?.period_return_pct ?? 0) >= 0;

  return (
    <section style={{ display: "grid", gap: 18, marginTop: 24 }}>
      <section id="stock-analytics" style={card}>
        <div style={muted}>MARKETMIND / QUANTITATIVE INSIGHTS</div>
        <h2 style={heading}>Stock Analytics</h2>
        <p style={{ ...muted, marginTop: -8, marginBottom: 16 }}>
          {symbol} Ã‚Â· {period} Ã‚Â· Historical data only
        </p>

        {analyticsLoading && <p role="status">Calculating analyticsÃ¢â‚¬Â¦</p>}
        {analyticsError && (
          <p role="alert" style={{ color: "#ff9c9c" }}>
            {analyticsError}
            <br />
            <span style={muted}>
              Ensure the backend is running and this symbol has historical prices saved.
            </span>
          </p>
        )}

        {analytics && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <Metric
                label="Period return"
                value={`${positive ? "+" : ""}${number(analytics.period_return_pct)}%`}
                hint={`${analytics.start_date} Ã¢â€ â€™ ${analytics.end_date}`}
              />
              <Metric label="SMA 20" value={number(analytics.sma20)} />
              <Metric label="SMA 50" value={number(analytics.sma50)} />
              <Metric label="SMA 200" value={number(analytics.sma200)} />
              <Metric label="RSI (approx.)" value={number(analytics.rsi14_approx)} />
              <Metric label="Annualized volatility" value={`${number(analytics.annualized_volatility_pct)}%`} />
              <Metric label="Period high / low" value={`${number(analytics.period_high)} / ${number(analytics.period_low)}`} />
              <Metric label="Maximum drawdown" value={`${number(analytics.max_drawdown_pct)}%`} />
              <Metric label="Observations" value={number(analytics.observations)} />
              <Metric label="Latest close" value={number(analytics.latest_close)} />
            </div>
            <p style={{ ...muted, marginTop: 14 }}>{analytics.note}</p>
          </>
        )}
      </section>

      <section id="watchlist" style={card}>
        <div style={muted}>YOUR SAVED SYMBOLS</div>
        <h2 style={heading}>Watchlist</h2>
        <form onSubmit={addSymbol} style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <input
            aria-label="Symbol to add"
            placeholder="e.g. RELIANCE.NS, AAPL, ^NSEI"
            value={watchSymbol}
            onChange={(event) => setWatchSymbol(event.target.value)}
            maxLength={30}
            style={{ ...field, flex: "1 1 240px" }}
          />
          <button type="submit" disabled={watchLoading} style={button}>
            {watchLoading ? "N/A" : "Add symbol"}
          </button>
          <button type="button" onClick={() => void loadWatchlist()} style={{ ...button, background: "#263346", color: "#f1f5f9" }}>
            Refresh
          </button>
        </form>

        {watchError && <p role="alert" style={{ color: "#ff9c9c" }}>{watchError}</p>}
        {watchMessage && <p role="status" style={{ color: "#55d6a0" }}>{watchMessage}</p>}

        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {watchlist.map((item) => (
            <div key={item.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid #263346", paddingTop: 12 }}>
              <div>
                <strong>{item.symbol}</strong>
                <div style={muted}>
                  {item.price_date ? `Latest saved close date: ${item.price_date}` : "No saved price yet"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <strong>{number(item.latest_close)}</strong>
                <button
                  type="button"
                  onClick={() => void removeSymbol(item.symbol)}
                  aria-label={`Remove ${item.symbol}`}
                  style={{ ...button, background: "#3b2630", color: "#ffb4bd" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {watchlist.length === 0 && (
            <p style={muted}>Your watchlist is empty. Add a symbol above to get started.</p>
          )}
        </div>
        <p style={{ ...muted, marginTop: 14 }}>
          Prices are the latest values already stored in PostgreSQL; adding a symbol does not fetch new market data.
        </p>
      </section>

      <section id="ai-analyst" style={card}>
        <div style={muted}>LOCAL AI ANALYST / OLLAMA</div>
        <h2 style={heading}>AI Analyst</h2>
        <p style={{ ...muted, marginTop: -8 }}>
          Explain the historical metrics for {symbol} over {period}.
        </p>
        <label htmlFor="analyst-question" style={{ display: "block", ...muted, marginBottom: 7 }}>
          YOUR QUESTION
        </label>
        <textarea
          id="analyst-question"
          value={analystQuestion}
          onChange={(event) => setAnalystQuestion(event.target.value.slice(0, 500))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !analystLoading) {
              event.preventDefault();
              void runAnalyst();
            }
          }}
          placeholder="Ask about RSI, volatility, returns, risk, diversification, or this stock's performance..."
          maxLength={500}
          rows={3}
          style={{ ...field, width: "100%", resize: "vertical", marginBottom: 10 }}
        />
        <div style={{ ...muted, marginBottom: 12 }}>
          Press Enter to ask; Shift+Enter for a new line. Maximum 500 characters.
        </div>        <button type="button" onClick={() => void runAnalyst()} disabled={analystLoading} style={button}>
          {analystLoading ? "Analyzing..." : `Analyze ${symbol}`}
        </button>
        {analystError && <p role="alert" style={{ color: "#ff9c9c" }}>{analystError}</p>}
        {analyst && (
          <div style={{ marginTop: 18, borderTop: "1px solid #263346", paddingTop: 16 }}>
            <p style={muted}>Model: {analyst.model}</p>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, overflowWrap: "anywhere" }}>
              {analyst.analysis}
            </div>
            <p style={{ ...muted, marginTop: 16 }}>{analyst.note}</p>
          </div>
        )}
        <p style={{ ...muted, marginTop: 14 }}>
          AI output can be inaccurate. This feature explains historical metrics; it does not provide investment advice.
        </p>
      </section>
    </section>
  );
}