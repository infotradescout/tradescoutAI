import type { ScoutMessage, ScoutAction } from "./state";

const apiBaseEnv = (import.meta as any).env?.VITE_SCOUT_API_BASE as
  | string
  | undefined;

function isLocalHost() {
  if (typeof window === "undefined") return false;
  const hn = window.location.hostname;
  return hn === "localhost" || hn === "127.0.0.1" || hn === "0.0.0.0";
}

export const apiBase =
  apiBaseEnv ||
  (isLocalHost()
    ? "/api"
    : "https://www.thetradescout.com/api");

export interface ScoutLocality {
  county?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
}

export type ScoutMode =
  | "default"
  | "mealscout"
  | "marketplace"
  | "contractors"
  | "admin";

export type KnowledgeMode = "local-first" | "kb-only" | "web-fallback";

export interface SendToScoutOptions {
  history: Pick<ScoutMessage, "role" | "content">[];
  message: string;
  locality?: ScoutLocality;
  mode?: ScoutMode;
  knowledgeMode?: KnowledgeMode;
  filters?: Record<string, unknown>;
}

export interface ScoutBackendResponse {
  message: string;
  suggestedActions?: string[];
  actions?: ScoutAction[];
  knowledge?: {
    layer?: number;
    sources?: Array<{ title: string; url?: string; type?: string }>;
  };
  timestamp?: string;
}

export async function sendToScout(
  options: SendToScoutOptions
): Promise<ScoutBackendResponse> {
  const payload = {
    message: options.message,
    history: options.history,
    locality: options.locality ?? {},
    mode: options.mode ?? "default",
    knowledgeMode: options.knowledgeMode ?? "local-first",
    filters: options.filters ?? {},
    hyperlocalPricing: true,
  };

  const res = await fetch(`${apiBase}/scout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scout HTTP ${res.status}: ${text || "unknown error"}`);
  }

  return res.json();
}

/* ------------------------------ Trending API ----------------------------- */

export interface TrendingItem {
  id: string;
  title: string;
  category?: string;
  stat?: string;
  delta?: string;
}

export async function fetchTrending(locality?: ScoutLocality) {
  const params = new URLSearchParams();
  if (locality?.county) params.set("county", locality.county);
  if (locality?.state) params.set("state", locality.state);
  if (locality?.zip) params.set("zip", locality.zip);

  const res = await fetch(`${apiBase}/trending?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Trending HTTP ${res.status}`);
  }

  const json = await res.json();
  const rawItems: any[] = Array.isArray(json.items) ? json.items : [];

  const items: TrendingItem[] = rawItems
    .map((item, idx) => ({
      id: String(item.id ?? idx),
      title: String(item.title ?? item.name ?? "").trim(),
      category: item.category ?? item.type ?? "Community",
      stat: item.stat ?? item.metric,
      delta: item.delta ?? item.change,
    }))
    .filter((i) => i.title.length > 0);

  return items;
}

/* ---------------------- Contractors / Marketplace helpers ---------------- */

export interface ContractorSearchParams {
  trade?: string;
  county?: string;
  state?: string;
  zip?: string;
}

export async function searchContractors(params: ContractorSearchParams) {
  const u = new URL(`${apiBase}/contractors/search`, window.location.origin);
  if (params.trade) u.searchParams.set("trade", params.trade);
  if (params.county) u.searchParams.set("county", params.county);
  if (params.state) u.searchParams.set("state", params.state);
  if (params.zip) u.searchParams.set("zip", params.zip);

  const res = await fetch(u.toString(), {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Contractors HTTP ${res.status}`);
  return res.json();
}

export interface MarketplaceSearchParams {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  county?: string;
  state?: string;
}

export async function searchMarketplace(params: MarketplaceSearchParams) {
  const u = new URL(`${apiBase}/marketplace/search`, window.location.origin);
  if (params.category) u.searchParams.set("category", params.category);
  if (params.priceMin != null) u.searchParams.set("priceMin", String(params.priceMin));
  if (params.priceMax != null) u.searchParams.set("priceMax", String(params.priceMax));
  if (params.county) u.searchParams.set("county", params.county);
  if (params.state) u.searchParams.set("state", params.state);

  const res = await fetch(u.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`Marketplace HTTP ${res.status}`);
  return res.json();
}

/* ---------------------------- Admin insights ----------------------------- */

export interface ScoutInsightPayload {
  message: string;
  mode: ScoutMode;
  locality?: ScoutLocality;
  success: boolean;
  latencyMs: number;
  error?: string;
}

export async function logScoutInsight(payload: ScoutInsightPayload) {
  try {
    await fetch(`${apiBase}/admin/scout-insights`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Logging failures should never break the UI
  }
}

