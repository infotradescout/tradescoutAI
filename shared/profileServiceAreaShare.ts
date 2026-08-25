import { sanitizePublicDiscoveryText } from "./publicListingSafety";

const PROFILE_SERVICE_AREAS_SEGMENT = "service-areas";
const CUSTOM_DOMAIN_SERVICE_AREAS_PATH = "/landing/service-areas";
const MAX_SERVICE_AREAS = 30;
const MAX_SERVICE_AREA_LABEL_LENGTH = 80;
const MAX_SERVICE_AREA_WORDS = 8;
const SERVICE_AREA_LABEL_PATTERN = /^[A-Za-z0-9 .,'’&()/-]+$/;
const NON_LOCATION_AREA_PATTERN =
  /\b(?:after (?:property|site|jurisdiction|supplier)|availability|available after|confirmed|contact us|coverage|miles? (?:from|of)|other (?:project |service )?areas?|project areas?|service areas?|serving|subject to|upon review|where available|within \d+)\b/i;

type RawContentBlock = {
  type?: unknown;
  data?: unknown;
};

export type ResolvedProfileServiceAreaHub = {
  areas: string[];
  description: string;
};

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safePublicArea(value: unknown): string | null {
  const raw = cleanText(value, MAX_SERVICE_AREA_LABEL_LENGTH + 1);
  const wordCount = raw.split(/\s+/).filter(Boolean).length;
  const commaCount = (raw.match(/,/g) || []).length;
  if (
    !raw ||
    raw.length < 2 ||
    raw.length > MAX_SERVICE_AREA_LABEL_LENGTH ||
    wordCount > MAX_SERVICE_AREA_WORDS ||
    commaCount > 1 ||
    !/[A-Za-z]/.test(raw) ||
    !SERVICE_AREA_LABEL_PATTERN.test(raw) ||
    NON_LOCATION_AREA_PATTERN.test(raw)
  ) {
    return null;
  }

  const sanitized = sanitizePublicDiscoveryText(raw, MAX_SERVICE_AREA_LABEL_LENGTH);
  if (!sanitized || sanitized !== raw || /Continue through TradeScout/i.test(sanitized)) return null;
  return sanitized;
}

function areaLabel(value: unknown): string | null {
  if (typeof value === "string") return safePublicArea(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return safePublicArea(record.label || record.name || record.title || record.area);
}

function blockData(block: RawContentBlock): Record<string, unknown> {
  return block?.data && typeof block.data === "object" && !Array.isArray(block.data)
    ? (block.data as Record<string, unknown>)
    : {};
}

function serviceAreaDiscoveryDisabled(contentBlocks: RawContentBlock[]): boolean {
  const discovery = contentBlocks.find(
    (block) => cleanText(block?.type, 64).toLowerCase() === "publicdiscovery"
  );
  const data = blockData(discovery || {});
  const sitemap =
    data.sitemap && typeof data.sitemap === "object" && !Array.isArray(data.sitemap)
      ? (data.sitemap as Record<string, unknown>)
      : {};
  return sitemap.serviceAreas === false;
}

export function resolveProfileServiceAreaHub(
  contentBlocks: unknown
): ResolvedProfileServiceAreaHub | null {
  if (!Array.isArray(contentBlocks)) return null;
  const blocks = contentBlocks as RawContentBlock[];
  if (serviceAreaDiscoveryDisabled(blocks)) return null;

  const areas: string[] = [];
  const seen = new Set<string>();
  let description = "";

  for (const rawBlock of blocks) {
    const type = cleanText(rawBlock?.type, 64).toLowerCase();
    if (type !== "localserviceprofile" && type !== "serviceareas" && type !== "servicearea") {
      continue;
    }

    const data = blockData(rawBlock);
    const candidates =
      type === "localserviceprofile"
        ? data.serviceAreas
        : data.areas || data.items || data.serviceAreas;
    const values = Array.isArray(candidates) ? candidates : [];

    for (const value of values) {
      const label = areaLabel(value);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      areas.push(label);
      if (areas.length >= MAX_SERVICE_AREAS) break;
    }

    if (!description) {
      const candidate = cleanText(
        data.serviceAreaDescription || data.description || data.text || data.body,
        500
      );
      const sanitized = sanitizePublicDiscoveryText(candidate, 500);
      if (sanitized && sanitized === candidate && sanitized.length >= 40) {
        description = sanitized;
      }
    }

    if (areas.length >= MAX_SERVICE_AREAS) break;
  }

  return areas.length > 0 ? { areas, description } : null;
}

function normalizedBasePath(value: string): string {
  const raw = String(value || "").trim() || "/";
  const leading = raw.startsWith("/") ? raw : `/${raw}`;
  return leading.replace(/\/+$/, "") || "/";
}

export function buildProfileServiceAreaPath(profileBasePath: string): string {
  const base = normalizedBasePath(profileBasePath);
  return base === "/"
    ? CUSTOM_DOMAIN_SERVICE_AREAS_PATH
    : `${base}/${PROFILE_SERVICE_AREAS_SEGMENT}`;
}

export function buildProfileServiceAreaUrl(profileUrlValue: string): string | null {
  try {
    const profileUrl = new URL(profileUrlValue);
    const path = buildProfileServiceAreaPath(profileUrl.pathname);
    return new URL(path, profileUrl.origin).toString();
  } catch {
    return null;
  }
}

export function isProfileServiceAreaPath(pathnameValue: unknown): boolean {
  const pathname = String(pathnameValue || "")
    .trim()
    .replace(/\/+$/, "") || "/";
  return (
    /^\/(?:u|p)\/[^/]+\/service-areas$/i.test(pathname) ||
    pathname.toLowerCase() === CUSTOM_DOMAIN_SERVICE_AREAS_PATH
  );
}

export function resolveProfileServiceAreaRoute(pathnameValue: unknown): {
  source: "platform" | "custom_domain";
  requestedProfileSlug: string | null;
} | null {
  const pathname = String(pathnameValue || "")
    .trim()
    .replace(/\/+$/, "") || "/";
  const platform = pathname.match(/^\/(?:u|p)\/([^/]+)\/service-areas$/i);
  if (platform?.[1]) {
    try {
      return {
        source: "platform",
        requestedProfileSlug: decodeURIComponent(platform[1]).trim().toLowerCase(),
      };
    } catch {
      return null;
    }
  }
  return pathname.toLowerCase() === CUSTOM_DOMAIN_SERVICE_AREAS_PATH
    ? { source: "custom_domain", requestedProfileSlug: null }
    : null;
}
