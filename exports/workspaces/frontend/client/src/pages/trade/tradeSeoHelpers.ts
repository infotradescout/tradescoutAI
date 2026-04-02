import { getTradeSeoMatch } from "@shared/tradeSeo";

export function nameToSlug(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

export function getTradeDisplay(tradeSlug: string): { canonicalSlug: string; name: string } | null {
  const match = getTradeSeoMatch(tradeSlug);
  if (!match) return null;
  return { canonicalSlug: match.canonicalSlug, name: match.trade.name };
}
