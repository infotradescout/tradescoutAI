import { COMPREHENSIVE_TRADES } from "./trades-data";

export const STABLE_PUBLIC_LANDING_BASE_VARIANTS = [
  "contractor",
  "homeowner",
  "realtor",
  "hoa",
  "property-manager",
  "lender",
  "insurance-agent",
  "supplier",
  "affiliate",
  "local-operating-system",
] as const;

export type StablePublicLandingBaseVariant =
  (typeof STABLE_PUBLIC_LANDING_BASE_VARIANTS)[number];

const STABLE_PUBLIC_LANDING_VARIANTS = new Set<string>([
  ...STABLE_PUBLIC_LANDING_BASE_VARIANTS,
  ...COMPREHENSIVE_TRADES.map((trade) => trade.slug),
]);

export type PublicLandingIndexability = {
  canonicalPath: string;
  indexable: boolean;
  stableVariant: string | null;
};

function normalizePath(requestPath: string): string {
  const pathOnly = requestPath.split("?")[0].split("#")[0] || "/";
  return pathOnly.replace(/\/+$/, "") || "/";
}

function normalizeVariant(value: string | null | undefined): string {
  let decoded = String(value || "").trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return "";
  }
  return decoded.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
}

/**
 * One shared indexability contract for the server fallback and the hydrated
 * landing page. Campaign/query variants may render, but only reviewed base and
 * exact trade variants are canonical index targets.
 */
export function resolvePublicLandingIndexability(input: {
  requestPath?: string | null;
  variant?: string | null;
}): PublicLandingIndexability {
  const requestPath = String(input.requestPath || "/");
  const pathOnly = normalizePath(requestPath);
  const hasQueryParams = requestPath.includes("?");
  const isAliasPath = pathOnly === "/lp" || pathOnly.startsWith("/lp/");

  if (pathOnly === "/") {
    return {
      canonicalPath: "/",
      indexable: !hasQueryParams,
      stableVariant: null,
    };
  }

  const pathVariant = pathOnly.startsWith("/landing/")
    ? pathOnly.slice("/landing/".length)
    : pathOnly.startsWith("/lp/")
      ? pathOnly.slice("/lp/".length)
      : input.variant;
  const normalizedVariant = normalizeVariant(pathVariant);
  const isStableVariant = STABLE_PUBLIC_LANDING_VARIANTS.has(normalizedVariant);
  const canonicalPath = isStableVariant ? `/landing/${normalizedVariant}` : "/";
  const isCanonicalStablePath = pathOnly === canonicalPath;

  return {
    canonicalPath,
    indexable: isCanonicalStablePath && !isAliasPath && !hasQueryParams,
    stableVariant: isStableVariant ? normalizedVariant : null,
  };
}
