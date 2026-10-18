"use client";

import { useEffect,  useState, type CSSProperties  } from "react";

const API =
  process.env.NEXT_PUBLIC_MARKETMIND_API_URL ?? "http://127.0.0.1:8000";

type Quality = {
  symbol: string;
  period: string;
  observations: number;
  start_date: string | null;
  end_date: string | null;
  missing_counts: Record<string, number>;
  missing_cells: number;
  duplicate_dates: number;
  invalid_price_rows: number;
  outlier_days_over_15pct: number;
  data_stale: boolean;
  quality_score: number;
  score_note: string;
};

type ComparisonItem = {
  symbol: string;
  observations: number;
  start_date?: string;
  end_date?: string;
  latest_close?: number;
  period_return_pct?: number;
  annualized_volatility_pct?: number;
  max_drawdown_pct?: number;
  unavailable?: string;
};

type Comparison = {
  period: string;
  results: ComparisonItem[];
  equal_weight_average_return_pct: number;
  note: string;
};

const panel: CSSProperties = {
  background: "#101a28",
  border: "1px solid #263346",
  borderRadius: 14,
  padding: 22,
  minWidth: 0,
};

const muted: CSSProperties = { color: "#8290a5", fontSize: 12, lineHeight: 1.6 };

const inputStyle: CSSProperties = {
  background: "#0b1220",
  color: "#f1f5f9",
  border: "1px solid #304057",
  borderRadius: 8,
  padding: "10px 12px",
  minWidth: 0,
  width: "100%",
};

const primaryButton: CSSProperties = {
  background: "#55d6a0",
  color: "#07150f",
  border: 0,
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "#263346",
  color: "#f1f5f9",
};

function fmt(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div style={{ ...panel, padding: 15 }}>
      <div style={muted}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 23, fontWeight: 700, margin: "9px 0 3px", overflowWrap: "anywhere" }}>
        {value}
      </div>
      {note && <div style={muted}>{note}</div>}
    </div>
  );
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  return body;
}

export default function MarketMindProFeatures({
  symbol,
  period,
}: {
  symbol: string;
  period: string;
}) {
  const [quality, setQuality] = useState<Quality | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState("");

  const [symbolsText, setSymbolsText] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");

  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  // MARKETMIND_AUTO_QUALITY_REFRESH
  useEffect(() => {
    let active = true;
    setQuality(null);
    setQualityError("");
    setQualityLoading(true);
    setComparison(null);
    setComparisonError("");
    setExportMessage("");
    setExportError("");

    fetch(
      `${API}/api/v1/pro/quality/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}`,
      { cache: "no-store" },
    )
      .then(responseJson)
      .then((body) => {
        if (active) setQuality(body as Quality);
      })
      .catch((error: unknown) => {
        if (active) {
          setQualityError(error instanceof Error ? error.message : "Data quality check failed.");
        }
      })
      .finally(() => {
        if (active) setQualityLoading(false);
      });

    return () => { active = false; };
  }, [symbol, period]);


  async function runQuality() {
    setQualityLoading(true);
    setQualityError("");
    setQuality(null);
    try {
      const response = await fetch(
        `${API}/api/v1/pro/quality/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}`,
        { cache: "no-store" },
      );
      setQuality(await responseJson(response) as Quality);
    } catch (error) {
      setQualityError(error instanceof Error ? error.message : "Data quality check failed.");
    } finally {
      setQualityLoading(false);
    }
  }

  async function runComparison() {
    const requested = symbolsText.trim() || `${symbol},RELIANCE.NS,TCS.NS`;
    setComparisonLoading(true);
    setComparisonError("");
    setComparison(null);
    try {
      const response = await fetch(
        `${API}/api/v1/pro/compare?symbols=${encodeURIComponent(requested)}&period=${encodeURIComponent(period)}`,
        { cache: "no-store" },
      );
      setComparison(await responseJson(response) as Comparison);
    } catch (error) {
      setComparisonError(error instanceof Error ? error.message : "Comparison failed.");
    } finally {
      setComparisonLoading(false);
    }
  }

  async function downloadReport(format: "csv" | "xlsx") {
    setExportLoading(true);
    setExportError("");
    setExportMessage("");
    try {
      const response = await fetch(
        `${API}/api/v1/pro/export/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}&format=${format}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `MarketMind_${symbol.replace(/[^A-Za-z0-9._-]/g, "_")}_${period}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage(`${format.toUpperCase()} report downloaded for ${symbol}.`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 18, marginTop: 22 }}>
      <section id="data-quality" style={panel}>
        <div style={muted}>DATA TRUST / VALIDATION</div>
        <h2 style={{ fontSize: 19, margin: "7px 0 8px" }}>Data Quality Report</h2>
        <p style={{ ...muted, margin: "0 0 15px" }}>
          Inspect missing fields, invalid prices, large day-to-day changes, duplicates, and freshness for {symbol} ({period}).
        </p>
        <button type="button" disabled={qualityLoading} onClick={() => void runQuality()} style={primaryButton}>
          {qualityLoading ? "Checking data..." : "Run data quality check"}
        </button>
        {qualityLoading && <p role="status" style={muted}>Checking current selection...</p>}
        {qualityError && <p role="alert" style={{ color: "#ff9c9c" }}>{qualityError}</p>}
        {quality && (
          <div style={{ marginTop: 17 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
              <Stat label="Quality score" value={`${fmt(quality.quality_score)} / 100`} note="Heuristic score" />
              <Stat label="Observations" value={fmt(quality.observations)} />
              <Stat label="Missing cells" value={fmt(quality.missing_cells)} />
              <Stat label="Invalid rows" value={fmt(quality.invalid_price_rows)} />
              <Stat label="Duplicate dates" value={fmt(quality.duplicate_dates)} />
              <Stat label="Large daily moves" value={fmt(quality.outlier_days_over_15pct)} note="Absolute move over 15%" />
            </div>
            <div style={{ marginTop: 14, borderTop: "1px solid #263346", paddingTop: 13 }}>
              <strong style={{ fontSize: 13 }}>Missing values by field</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
                {Object.entries(quality.missing_counts).map(([field, count]) => (
                  <span key={field} style={{ ...muted, border: "1px solid #263346", borderRadius: 7, padding: "6px 9px" }}>
                    {field}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
              <p style={{ ...muted, marginTop: 11 }}>
                Date range: {quality.start_date ?? "N/A"} to {quality.end_date ?? "N/A"}.
                {quality.data_stale ? " Warning: latest saved date may be stale." : " Latest saved date is within the seven-day freshness window."}
              </p>
              <p style={muted}>{quality.score_note}</p>
            </div>
          </div>
        )}
      </section>

      <section id="stock-comparison" style={panel}>
        <div style={muted}>RELATIVE PERFORMANCE / RISK</div>
        <h2 style={{ fontSize: 19, margin: "7px 0 8px" }}>Stock Comparison</h2>
        <p style={{ ...muted, margin: "0 0 12px" }}>
          Compare historical returns, volatility, and drawdown. Enter up to eight comma-separated symbols.
        </p>
        <input
          aria-label="Symbols to compare"
          value={symbolsText}
          onChange={(event) => setSymbolsText(event.target.value)}
          placeholder={`${symbol}, RELIANCE.NS, TCS.NS`}
          style={inputStyle}
        />
        <button type="button" disabled={comparisonLoading} onClick={() => void runComparison()} style={{ ...primaryButton, marginTop: 10 }}>
          {comparisonLoading ? "Comparing..." : "Compare stocks"}
        </button>
        {comparisonError && <p role="alert" style={{ color: "#ff9c9c" }}>{comparisonError}</p>}
        {comparison && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...panel, padding: 15, marginBottom: 12 }}>
              <div style={muted}>EQUAL-WEIGHT AVERAGE HISTORICAL RETURN</div>
              <strong style={{ fontSize: 23 }}>
                {fmt(comparison.equal_weight_average_return_pct, "%")}
              </strong>
              <p style={muted}>{comparison.note}</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Symbol", "Observations", "Period return", "Annualized volatility", "Max drawdown"].map((label) => (
                      <th key={label} style={{ textAlign: "left", padding: 10, color: "#8290a5", borderBottom: "1px solid #263346", whiteSpace: "nowrap" }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.results.map((item) => (
                    <tr key={item.symbol}>
                      <td style={{ padding: 10, borderBottom: "1px solid #263346", fontWeight: 700 }}>{item.symbol}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #263346" }}>{fmt(item.observations)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #263346" }}>{item.period_return_pct == null ? (item.unavailable ?? "N/A") : fmt(item.period_return_pct, "%")}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #263346" }}>{fmt(item.annualized_volatility_pct, "%")}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #263346" }}>{fmt(item.max_drawdown_pct, "%")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section id="data-export" style={panel}>
        <div style={muted}>DOWNLOADABLE REPORTS</div>
        <h2 style={{ fontSize: 19, margin: "7px 0 8px" }}>Export & Reporting</h2>
        <p style={{ ...muted, margin: "0 0 15px" }}>
          Export {symbol} historical prices for {period}. Excel includes price history, analytics summary, and the data-quality report.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" disabled={exportLoading} onClick={() => void downloadReport("csv")} style={primaryButton}>
            Download CSV
          </button>
          <button type="button" disabled={exportLoading} onClick={() => void downloadReport("xlsx")} style={secondaryButton}>
            Download Excel report
          </button>
        </div>
        {exportMessage && <p role="status" style={{ color: "#55d6a0" }}>{exportMessage}</p>}
        {exportError && <p role="alert" style={{ color: "#ff9c9c" }}>{exportError}</p>}
        <p style={{ ...muted, marginTop: 12 }}>
          Reports use prices already saved in PostgreSQL. Load the stock history first if no records are available.
        </p>
      </section>
    </section>
  );
}