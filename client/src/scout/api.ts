// client/src/scout/api.ts

import type { ScoutMessage, ScoutAction } from "./state";
import type { RecentActivityEvent } from "../agent/activity";
import { sanitizeAreaLabel } from "@/lib/copyHelpers";

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
  intent?: string;
  knowledgeMode?: KnowledgeMode;
  filters?: Record<string, unknown>;
  roles?: string[];
  recentActivity?: RecentActivityEvent[];
  shownAdIds?: string[];
}

export interface SponsoredResult {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  isAffiliate?: boolean | null;
  targetLocation?: string | null;
}

export interface ScoutActionChip {
  id: string;
  label: string;
  kind: "NAVIGATE" | "CALL_TOOL";
  target: string;
  args?: unknown;
  priority?: "primary" | "secondary";
}

export interface ScoutResponseFrame {
  templateId?: string;
  truthLines: string[];
  meaningLine?: string;
  directionLine?: string;
  actionChips?: ScoutActionChip[];
  suggestedPrompts?: string[];
  workingContextDelta?: {
    topic?: "finances" | "projects" | "community" | "docs";
    jobId?: string;
    communityId?: string;
  };
}

export interface ScoutWorkingContext {
  lastTopic?: "finances" | "projects" | "community" | "docs";
  lastJobId?: string;
  lastCommunityId?: string;
  lastTemplateId?: string;
}

export interface ScoutBackendResponse {
  message: string;
  suggestedActions?: string[];
  actions?: ScoutAction[];
  overrideOption?: {
    label: string;
    message: string;
    scope?: string;
    logAction: "ignored_advice";
    contextType?: string;
    contextId?: string | null;
  };
   frame?: ScoutResponseFrame;
   workingContext?: ScoutWorkingContext;
  sponsored?: SponsoredResult | null;
  publicEntities?: Array<{
    type: "trade_deal" | "community_post";
    id: string;
    href?: string;
    ownerUserId?: string | null;
    authorId?: string | null;
    canDirectConnect?: boolean;
    canMessage?: boolean;
  }>;
  ctaHints?: Array<{
    type: "trade_deal" | "community_post";
    id: string;
    ownerUserId?: string | null;
    authorId?: string | null;
    canDirectConnect?: boolean;
    canMessage?: boolean;
    label?: string;
  }>;
  knowledge?: {
    layer?: number;
    sources?: Array<{ title: string; url?: string; type?: string }>;
  };
  timestamp?: string;
  metadata?: {
    intent?: string;
    thought_flow?: string[];
    decision?: string;
    redirect?: string;
    resolvedContext?: {
      stage?: string;
      blockingReason?: string | null;
      allowedActions?: string[];
      confidence?: string;
      requiresLLM?: boolean;
      [key: string]: unknown;
    } | null;
    currentJobId?: string;
  };
}

function inferModeFromMessageAndRoles(message: string, roles?: string[]): ScoutMode {
  const lower = message.toLowerCase();
  const roleSet = new Set((roles ?? []).map((r) => r.toLowerCase()));

  // Message-driven
  if (lower.includes("meal") || lower.includes("restaurant") || lower.includes("food")) {
    return "mealscout";
  }
  if (lower.includes("marketplace") || lower.includes("for sale") || lower.includes("listing")) {
    return "marketplace";
  }
  if (lower.includes("contractor") || lower.includes("pro") || lower.includes("trade")) {
    return "contractors";
  }

  const rolesArray = Array.from(roleSet);

  // Role-driven
  if (
    rolesArray.some(
      (r) =>
        r.startsWith("contractor") ||
        r === "service_provider" ||
        r === "specialty_tradesperson"
    )
  ) {
    return "contractors";
  }
  if (rolesArray.some((r) => r.includes("car_dealer") || r.includes("auto_service"))) {
    return "marketplace";
  }
  if (rolesArray.some((r) => r.includes("restaurant") || r.includes("restaurant-owner"))) {
    return "mealscout";
  }

  return "default";
}

// Aligns with server/routes/scout.ts -> interface ScoutRequest
export async function sendToScout(
  options: SendToScoutOptions
): Promise<ScoutBackendResponse> {
  const mode: ScoutMode =
    options.mode ?? inferModeFromMessageAndRoles(options.message, options.roles);

  const countyCode =
    options.locality?.county && options.locality?.state
      ? `${sanitizeAreaLabel(options.locality.county)}, ${options.locality.state}`
      : options.locality?.county
      ? sanitizeAreaLabel(options.locality.county)
      : undefined;

  const stateCode = options.locality?.state;

  const payload = {
    message: options.message,
    history: options.history,
    countyCode, // server uses countyCode
    stateCode, // server uses stateCode
    // extra fields are allowed but ignored by current server
    mode,
    intent: options.intent,
    knowledgeMode: options.knowledgeMode ?? "local-first",
    filters: options.filters ?? {},
    hyperlocalPricing: true,
    roles: options.roles ?? [],
    recentActivity: options.recentActivity ?? [],
    shownAdIds: options.shownAdIds ?? [],
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

// Use community-backed trending topics derived from real posts
export async function fetchTrending(locality?: ScoutLocality) {
  const params = new URLSearchParams();
  if (locality?.state) params.set("stateCode", locality.state);
  // We don't have county FIPS here; state-level trending is still
  // grounded in real community posts.
  params.set("limit", "12");

  const res = await fetch(`${apiBase}/community/trending?${params.toString()}` , {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Trending HTTP ${res.status}`);
  }

  const json = await res.json();
  const rawItems: any[] = Array.isArray(json) ? json : [];

  const items: TrendingItem[] = rawItems
    .map((item, idx) => {
      const tag = String(item.tag ?? item.hashtag ?? item.title ?? "").trim();
      const posts = typeof item.posts === "number" ? item.posts : Number(item.posts ?? 0);
      return {
        id: tag || String(idx),
        title: tag ? `#${tag}` : "Community topic",
        category: "Community",
        stat: posts > 0 ? `${posts} post${posts === 1 ? "" : "s"}` : undefined,
        delta: undefined,
      } as TrendingItem;
    })
    .filter((i) => i.title.trim().length > 0);

  return items;
}

/* ---------------------- Contractors / Marketplace helpers ---------------- */

export interface ContractorSearchParams {
  trade?: string;
  county?: string;
  state?: string;
  zip?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export async function searchContractors(params: ContractorSearchParams) {
  const u = new URL(`${apiBase}/contractors/search`, window.location.origin);
  if (params.trade) u.searchParams.set("trade", params.trade);
  if (params.county) u.searchParams.set("county", params.county);
  if (params.state) u.searchParams.set("state", params.state);
  if (params.zip) u.searchParams.set("zip", params.zip);
  if (params.sort) u.searchParams.set("sort", params.sort);
  if (params.limit != null) u.searchParams.set("limit", String(params.limit));
  if (params.offset != null) u.searchParams.set("offset", String(params.offset));

  const res = await fetch(u.toString(), {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Contractors HTTP ${res.status}`);
  return res.json();
}

export interface MarketplaceSearchParams {
  query?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  condition?: string;
  verifiedOnly?: boolean;
  freeShipping?: boolean;
  buyerProtection?: boolean;
  sortBy?: string;
}

export async function searchMarketplace(params: MarketplaceSearchParams) {
  const u = new URL(`${apiBase}/marketplace/search`, window.location.origin);
  if (params.query) u.searchParams.set("query", params.query);
  if (params.category) u.searchParams.set("category", params.category);
  if (params.priceMin != null) u.searchParams.set("minPrice", String(params.priceMin));
  if (params.priceMax != null) u.searchParams.set("maxPrice", String(params.priceMax));
  if (params.location) u.searchParams.set("location", params.location);
  if (params.condition) u.searchParams.set("condition", params.condition);
  if (params.verifiedOnly != null) u.searchParams.set("verifiedOnly", String(params.verifiedOnly));
  if (params.freeShipping != null) u.searchParams.set("freeShipping", String(params.freeShipping));
  if (params.buyerProtection != null) u.searchParams.set("buyerProtection", String(params.buyerProtection));
  if (params.sortBy) u.searchParams.set("sortBy", params.sortBy);

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

// Soft logging only – route can be added later; failures never break UI
export async function logScoutInsight(payload: ScoutInsightPayload) {
  try {
    await fetch(`${apiBase}/analytics/shell`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "scout_query",
        payload,
      }),
    });
  } catch {
    // Logging failures should never break the UI
  }
}

