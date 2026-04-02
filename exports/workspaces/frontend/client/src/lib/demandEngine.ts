type DemandAttribution = {
  ref: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  variant: string | null;
  campaignKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

type SegmentCategory = "homeowner" | "contractor" | "mixed" | "unknown";
type SegmentIntentLevel = "passive" | "problem_aware" | "actively_looking" | "unknown";

const STORAGE_KEY = "ts_demand_attribution_v1";

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  return v.length ? v.slice(0, 120) : null;
}

function extractVariant(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "");
  const match = normalized.match(/^\/(?:landing|lp)\/([^/?#]+)/i);
  return normalize(match?.[1] || null);
}

function computeCampaignKey(input: {
  variant: string | null;
  utmCampaign: string | null;
  utmSource: string | null;
  ref: string | null;
}): string {
  if (input.utmCampaign) return input.utmCampaign;
  const parts = [
    input.variant || "default",
    input.utmSource || "organic",
    input.ref ? `ref_${input.ref}` : "noref",
  ];
  return parts.join("__");
}

function readStored(): DemandAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemandAttribution;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.campaignKey || !parsed.lastSeenAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: DemandAttribution) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // fail-soft: tracking must never break UX
  }
}

function normalizeCountyFips(value: string | null | undefined): string | undefined {
  const raw = String(value || "").trim();
  return /^\d{5}$/.test(raw) ? raw : undefined;
}

function readUserLocationCountyFips(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem("userLocation");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { countyFips?: unknown; county_fips?: unknown };
    return normalizeCountyFips(
      typeof parsed?.countyFips === "string"
        ? parsed.countyFips
        : typeof parsed?.county_fips === "string"
          ? parsed.county_fips
          : undefined
    );
  } catch {
    return undefined;
  }
}

function readStringField(
  payload: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  if (!payload) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function deriveCountyFips(payload: Record<string, unknown> | undefined): string | undefined {
  const fromPayload = normalizeCountyFips(
    readStringField(payload, ["county_fips", "countyFips", "county"])
  );
  if (fromPayload) return fromPayload;

  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const fromQuery = normalizeCountyFips(params.get("countyFips") || params.get("county"));
      if (fromQuery) return fromQuery;
    } catch {
      // fall through
    }
  }

  return readUserLocationCountyFips();
}

function normalizeSegmentCategory(value: string | undefined): SegmentCategory | undefined {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "homeowner") return "homeowner";
  if (normalized === "contractor") return "contractor";
  if (normalized === "mixed") return "mixed";
  if (normalized === "unknown") return "unknown";
  return undefined;
}

function deriveSegmentCategory(payload: Record<string, unknown> | undefined): SegmentCategory {
  const explicit = normalizeSegmentCategory(
    readStringField(payload, ["segment_category", "segmentCategory", "userRole", "audience"])
  );
  if (explicit) return explicit;

  const presenceType = String(readStringField(payload, ["presenceType", "presence_type"]) || "")
    .trim()
    .toLowerCase();
  if (presenceType === "personal") return "homeowner";
  if (presenceType === "represent_business") return "contractor";

  return "mixed";
}

function normalizeIntentLevel(value: string | undefined): SegmentIntentLevel | undefined {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "passive") return "passive";
  if (normalized === "problem_aware") return "problem_aware";
  if (normalized === "actively_looking") return "actively_looking";
  if (normalized === "unknown") return "unknown";
  return undefined;
}

function deriveSegmentIntentLevel(
  event:
    | "landing_view"
    | "cta_click"
    | "auth_view"
    | "signin_success"
    | "create_success"
    | "setup_complete"
    | "intent_submitted",
  payload: Record<string, unknown> | undefined
): SegmentIntentLevel {
  const explicit = normalizeIntentLevel(
    readStringField(payload, ["segment_intent_level", "segmentIntentLevel", "intentLevel"])
  );
  if (explicit) return explicit;

  if (event === "landing_view") return "passive";
  if (event === "cta_click" || event === "auth_view") return "problem_aware";
  return "actively_looking";
}

export function bootstrapDemandAttribution(rawUrl?: string): DemandAttribution | null {
  if (typeof window === "undefined") return null;

  const url = new URL(rawUrl || window.location.href, window.location.origin);
  const now = new Date().toISOString();

  const next: DemandAttribution = {
    ref: normalize(url.searchParams.get("ref")),
    utmSource: normalize(url.searchParams.get("utm_source")),
    utmMedium: normalize(url.searchParams.get("utm_medium")),
    utmCampaign: normalize(url.searchParams.get("utm_campaign")),
    utmContent: normalize(url.searchParams.get("utm_content")),
    utmTerm: normalize(url.searchParams.get("utm_term")),
    variant: extractVariant(url.pathname),
    campaignKey: "",
    firstSeenAt: now,
    lastSeenAt: now,
  };
  next.campaignKey = computeCampaignKey(next);

  const existing = readStored();
  if (!existing) {
    writeStored(next);
    return next;
  }

  const merged: DemandAttribution = {
    ...existing,
    ref: next.ref || existing.ref,
    utmSource: next.utmSource || existing.utmSource,
    utmMedium: next.utmMedium || existing.utmMedium,
    utmCampaign: next.utmCampaign || existing.utmCampaign,
    utmContent: next.utmContent || existing.utmContent,
    utmTerm: next.utmTerm || existing.utmTerm,
    variant: next.variant || existing.variant,
    firstSeenAt: existing.firstSeenAt || now,
    lastSeenAt: now,
    campaignKey: "",
  };
  merged.campaignKey = computeCampaignKey(merged);
  writeStored(merged);
  return merged;
}

export function getDemandAttribution(): DemandAttribution | null {
  return readStored();
}

export function withDemandQueryParams(targetHref: string): string {
  if (typeof window === "undefined") return targetHref;
  if (!targetHref || !targetHref.startsWith("/")) return targetHref;

  const attr = getDemandAttribution();
  if (!attr) return targetHref;

  try {
    const url = new URL(targetHref, window.location.origin);
    if (attr.ref && !url.searchParams.has("ref")) url.searchParams.set("ref", attr.ref);
    if (attr.utmSource && !url.searchParams.has("utm_source")) {
      url.searchParams.set("utm_source", attr.utmSource);
    }
    if (attr.utmMedium && !url.searchParams.has("utm_medium")) {
      url.searchParams.set("utm_medium", attr.utmMedium);
    }
    if (attr.utmCampaign && !url.searchParams.has("utm_campaign")) {
      url.searchParams.set("utm_campaign", attr.utmCampaign);
    }
    if (attr.utmContent && !url.searchParams.has("utm_content")) {
      url.searchParams.set("utm_content", attr.utmContent);
    }
    if (attr.utmTerm && !url.searchParams.has("utm_term")) {
      url.searchParams.set("utm_term", attr.utmTerm);
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return targetHref;
  }
}

export async function trackDemandEvent(
  event:
    | "landing_view"
    | "cta_click"
    | "auth_view"
    | "signin_success"
    | "create_success"
    | "setup_complete"
    | "intent_submitted",
  payload?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  const normalizedPayload = payload || {};
  const countyFips = deriveCountyFips(normalizedPayload);
  const segmentCategory = deriveSegmentCategory(normalizedPayload);
  const segmentIntentLevel = deriveSegmentIntentLevel(event, normalizedPayload);
  const attribution = bootstrapDemandAttribution();
  const body = {
    eventType: `demand.${event}`,
    data: {
      ...normalizedPayload,
      countyFips: countyFips || null,
      county_fips: countyFips || null,
      segmentCategory,
      segment_category: segmentCategory,
      segmentIntentLevel,
      segment_intent_level: segmentIntentLevel,
      attribution,
      path: window.location.pathname,
      search: window.location.search,
      timestamp: new Date().toISOString(),
    },
  };

  try {
    fetch("/api/events", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    // fail-soft
  }
}
