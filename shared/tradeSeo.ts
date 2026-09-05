import { COMPREHENSIVE_TRADES, type Trade } from "./trades-data";

export type TradeSeoMatch = {
  trade: Trade;
  canonicalSlug: string;
  keywords: string[];
};

const ALIAS_TO_CANONICAL: Record<string, string> = {
  plumbers: "plumbing",
  plumber: "plumbing",
  electricians: "electrical",
  electrician: "electrical",
  "concrete-contractors": "concrete-contractor",
  "concrete-contractor": "concrete-contractor",
  concrete: "concrete-contractor",
  hvac: "hvac",
  "hvac-contractors": "hvac",
  "air conditioning contractor": "hvac",
  "air conditioning repair service": "air-conditioning",
  "heating contractor": "hvac",
  roofers: "roofing",
  roofer: "roofing",
};

// Imported business categories use human-readable trade names. Resolve exact
// names through the same vocabulary as routes, detail pages, and sitemaps.
const TRADE_NAME_TO_CANONICAL = new Map(
  COMPREHENSIVE_TRADES.map((trade) => [trade.name.trim().toLowerCase(), trade.slug])
);

/** Exact normalized values accepted by getTradeSeoMatch. */
export const PUBLIC_TRADE_INPUT_SLUGS: readonly string[] = Object.freeze(
  Array.from(
    new Set([
      ...COMPREHENSIVE_TRADES.map((trade) => trade.slug),
      ...TRADE_NAME_TO_CANONICAL.keys(),
      ...Object.keys(ALIAS_TO_CANONICAL),
    ])
  )
);

export const PRIMARY_TRADE_SLUGS: string[] = Array.from(
  new Set(COMPREHENSIVE_TRADES.filter((t) => !t.parentId).map((t) => t.slug))
);

export function normalizeTradeSlug(raw: unknown): string {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (!value) return "";
  if (ALIAS_TO_CANONICAL[value]) return ALIAS_TO_CANONICAL[value];
  if (TRADE_NAME_TO_CANONICAL.has(value)) return TRADE_NAME_TO_CANONICAL.get(value)!;
  return value;
}

export function getTradeBySlug(raw: unknown): Trade | null {
  const slug = normalizeTradeSlug(raw);
  if (!slug) return null;
  return COMPREHENSIVE_TRADES.find((t) => t.slug === slug) || null;
}

export function getTradeSeoMatch(raw: unknown): TradeSeoMatch | null {
  const trade = getTradeBySlug(raw);
  if (!trade) return null;

  // Keywords are used for broad matching against business profileData.
  // Keep them short + stable (SEO safety) and avoid "intelligence" inference.
  const keywords = Array.from(
    new Set(
      [
        trade.slug,
        trade.name,
        trade.name.toLowerCase(),
        trade.name.toLowerCase().replace(/\s+/g, "-"),
        trade.name.toLowerCase().replace(/\s+/g, " "),
      ]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );

  return { trade, canonicalSlug: trade.slug, keywords };
}

export function slugifyCountyName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}
