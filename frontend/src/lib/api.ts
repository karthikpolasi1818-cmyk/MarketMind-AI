const API_BASE =
  process.env.NEXT_PUBLIC_MARKETMIND_API_URL ?? "http://127.0.0.1:8000";

export type MarketSymbol = {
  symbol: string;
  name: string;
  market: string;
};

export type PricePoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adj_close: number | null;
  volume: number | null;
};

export type HistoryResponse = {
  symbol: string;
  period_requested: string;
  interval: string;
  count: number;
  prices: PricePoint[];
  source: string;
  retrieved_at: string;
  data_note: string;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function searchSymbols(q: string, market = "all") {
  return request<{ count: number; results: MarketSymbol[] }>(
    `/api/v1/markets/search?q=${encodeURIComponent(q)}&market=${market}`,
  );
}

export function getHistory(symbol: string, period: string) {
  return request<HistoryResponse>(
    `/api/v1/markets/${encodeURIComponent(symbol)}/history?period=${period}`,
  );
}
