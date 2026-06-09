export function stripCountySuffix(value?: string | null): string {
  return String(value || "")
    .replace(/\s+(County|Parish)$/i, "")
    .trim();
}

export function toLocalMarketLabel(value?: string | null, stateCode?: string | null): string {
  const base = stripCountySuffix(value) || String(value || "").trim();
  if (!base) return stateCode ? `your local market, ${stateCode}` : "your local market";
  return stateCode ? `${base}, ${stateCode}` : base;
}

export function localBrowseCopy(): string {
  return "Browse local listings, see CVS and business details, and reach out through TradeScout when you're ready.";
}

export function protectedContactCopy(): string {
  return "Reach out through TradeScout when you're ready. It keeps things organized and cuts down on spam.";
}

export function trustScoreLabel(): string {
  return "CVS";
}

export function trustScoreDescription(): string {
  return "CVS shows verified identity, active license and insurance, work history, and community recommendations in one place.";
}

export function matchFlowCopy(): string {
  return "Describe what you need, wait for a pro to accept, then keep the conversation moving in one place.";
}
