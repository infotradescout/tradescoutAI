import {
  listHomeScoutListingPhotoUrls,
  normalizeHomeScoutListingId,
} from "../shared/homeScoutListingShare";
import { sanitizePublicListingText } from "../shared/publicListingSafety";

const HOME_SCOUT_METRIC_KEYS = new Set([
  "homescout_active_listings",
  "homescout_median_price",
  "homescout_median_dom_days",
  "homescout_price_drops_7d",
]);

const HOME_SCOUT_PUBLIC_EVENT_TYPES = new Set(["created", "price_changed", "status_changed"]);
const MAX_REPORT_BYTES = 25 * 1024 * 1024;

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const candidate = cleanString(value, 80);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanNumericString(value: unknown): string | null {
  const parsed = cleanNumber(value);
  return parsed === null ? null : String(value);
}

function cleanPublicText(value: unknown, maxLength: number): string | null {
  const clean = sanitizePublicListingText(value, maxLength);
  return clean || null;
}

function cleanPublicStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizePublicListingText(item, maxLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function safePublicPath(value: unknown, prefix: string): string | null {
  const candidate = cleanString(value, 500);
  return candidate.startsWith(prefix) && !/[\\\r\n]/.test(candidate) ? candidate : null;
}

export function getHomeScoutAuthorityUserId(listing: unknown): string | null {
  if (!listing || typeof listing !== "object") return null;
  const source = listing as Record<string, unknown>;
  const value = cleanString(source.contactUserId || source.agentUserId || source.sellerUserId, 128);
  return value || null;
}

export function toPublicHomeScoutListing(
  listing: unknown,
  additions?: { canonicalProfileUrl?: unknown }
): Record<string, unknown> | null {
  if (!listing || typeof listing !== "object") return null;
  const source = listing as Record<string, unknown>;
  const id = normalizeHomeScoutListingId(source.id);
  const title = sanitizePublicListingText(source.title, 200);
  const countyFips = cleanString(source.countyFips, 5);
  const stateCode = cleanString(source.stateCode, 2).toUpperCase();
  if (!id || !title || !/^\d{5}$/.test(countyFips) || !/^[A-Z]{2}$/.test(stateCode)) {
    return null;
  }

  const canonicalProfileUrl = safePublicPath(additions?.canonicalProfileUrl, "/u/");
  const status = cleanString(source.status, 32) || "active";
  const listingAuthorType = cleanString(source.listingAuthorType, 16);

  return {
    id,
    status,
    title,
    description: cleanPublicText(source.description, 4000),
    price: cleanNumericString(source.price) || "0",
    propertyType: cleanString(source.propertyType, 32) || "house",
    beds: cleanNumber(source.beds),
    baths: cleanNumericString(source.baths),
    sqft: cleanNumber(source.sqft),
    lotSqft: cleanNumber(source.lotSqft),
    yearBuilt: cleanNumber(source.yearBuilt),
    features: cleanPublicStringList(source.features, 40, 200),
    photos: listHomeScoutListingPhotoUrls(source.photos),
    countyFips,
    stateCode,
    city: cleanPublicText(source.city, 100),
    listedAt: cleanDate(source.listedAt),
    createdAt: cleanDate(source.createdAt),
    listingAuthorType: listingAuthorType === "agent" ? "agent" : "owner",
    canonicalProfileUrl,
  };
}

export function toPublicHomeScoutListingEvent(event: unknown): Record<string, unknown> | null {
  if (!event || typeof event !== "object") return null;
  const source = event as Record<string, unknown>;
  const id = cleanString(source.id, 128);
  const eventType = cleanString(source.eventType, 32);
  const observedAt = cleanDate(source.observedAt);
  if (!id || !observedAt || !HOME_SCOUT_PUBLIC_EVENT_TYPES.has(eventType)) return null;

  const rawPayload =
    source.payload && typeof source.payload === "object" && !Array.isArray(source.payload)
      ? (source.payload as Record<string, unknown>)
      : {};
  const payload: Record<string, unknown> = {};
  if (eventType === "price_changed") {
    payload.from = cleanNumericString(rawPayload.from);
    payload.to = cleanNumericString(rawPayload.to);
  } else {
    const from = cleanString(rawPayload.from, 32);
    const to = cleanString(rawPayload.to, 32);
    const status = cleanString(rawPayload.status, 32);
    if (from) payload.from = from;
    if (to) payload.to = to;
    if (status) payload.status = status;
  }

  return { id, eventType, observedAt, payload };
}

export function toPublicHomeScoutMarketBucket(bucket: unknown): Record<string, unknown> | null {
  if (!bucket || typeof bucket !== "object") return null;
  const source = bucket as Record<string, unknown>;
  const countyFips = cleanString(source.countyFips, 5);
  const stateCode = cleanString(source.stateCode, 2).toUpperCase();
  if (!/^\d{5}$/.test(countyFips) || !/^[A-Z]{2}$/.test(stateCode)) return null;

  return {
    countyFips,
    stateCode,
    propertyType: cleanString(source.propertyType, 32) || "house",
    bedsBucket: cleanNumber(source.bedsBucket),
    activeCount: Math.max(0, cleanNumber(source.activeCount) || 0),
    medianPrice: cleanNumericString(source.medianPrice),
    medianPricePerSqft: cleanNumericString(source.medianPricePerSqft),
    medianDomDays: cleanNumber(source.medianDomDays),
    priceDropCount7d: Math.max(0, cleanNumber(source.priceDropCount7d) || 0),
  };
}

export function toPublicHomeScoutCountyMetric(metric: unknown): Record<string, unknown> | null {
  if (!metric || typeof metric !== "object") return null;
  const source = metric as Record<string, unknown>;
  const countyFips = cleanString(source.countyFips, 5);
  const metricKey = cleanString(source.metricKey, 100);
  if (!/^\d{5}$/.test(countyFips) || !HOME_SCOUT_METRIC_KEYS.has(metricKey)) return null;
  if (source.metricValue === null || source.metricValue === undefined) return null;

  return {
    countyFips,
    metricKey,
    metricValue:
      typeof source.metricValue === "number"
        ? source.metricValue
        : cleanString(source.metricValue, 80),
  };
}

export function toPublicHomeScoutPartnerRecommendation(
  recommendation: unknown
): Record<string, unknown> | null {
  if (!recommendation || typeof recommendation !== "object") return null;
  const source = recommendation as Record<string, unknown>;
  const category = cleanString(source.category, 32);
  const displayName = sanitizePublicListingText(source.displayName, 140);
  if (category !== "inspector" || !displayName) return null;

  return {
    category,
    displayName,
    company: cleanPublicText(source.company, 140),
  };
}

export function toPublicHomeScoutInspectionReport(report: unknown): Record<string, unknown> | null {
  if (!report || typeof report !== "object") return null;
  const source = report as Record<string, unknown>;
  const id = cleanString(source.id, 128);
  const reportType = cleanString(source.reportType, 32);
  const createdAt = cleanDate(source.createdAt);
  if (!id || !reportType || !createdAt) return null;

  return {
    id,
    reportType,
    inspectionDate: cleanDate(source.inspectionDate),
    inspectorName: cleanPublicText(source.inspectorName, 140),
    inspectorCompany: cleanPublicText(source.inspectorCompany, 140),
    summary: cleanPublicText(source.summary, 4000),
    highlights: cleanPublicStringList(source.highlights, 20, 500),
    visibility: cleanString(source.visibility, 16) || "private",
    status: cleanString(source.status, 16) || "pending_review",
    createdAt,
    downloadPath: `/api/homescout/inspection-reports/${encodeURIComponent(id)}/download`,
  };
}

export function toVisibleHomeScoutInspectionRequest(
  request: unknown
): Record<string, unknown> | null {
  if (!request || typeof request !== "object") return null;
  const source = request as Record<string, unknown>;
  const id = cleanString(source.id, 128);
  const createdAt = cleanDate(source.createdAt);
  const requestMessage = sanitizePublicListingText(source.requestMessage, 2000);
  if (!id || !createdAt || !requestMessage) return null;

  return {
    id,
    status: cleanString(source.status, 16) || "open",
    requestMessage,
    preferredWindow: cleanPublicText(source.preferredWindow, 120),
    createdAt,
  };
}

function decodePath(pathname: string): string | null {
  let current = pathname;
  for (let index = 0; index < 2; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      return null;
    }
  }
  return current;
}

function isSafeDecodedPath(pathname: string): boolean {
  const decoded = decodePath(pathname);
  if (!decoded || !decoded.startsWith("/") || /[\\\0\r\n]/.test(decoded)) return false;
  return !decoded.split("/").some((segment) => segment === "." || segment === "..");
}

function isSafeUploadPath(pathname: string): boolean {
  const decoded = decodePath(pathname);
  return Boolean(decoded?.startsWith("/uploads/")) && isSafeDecodedPath(pathname);
}

function configuredUploadBases(env: NodeJS.ProcessEnv): URL[] {
  const values = [
    "https://www.thetradescout.com",
    "https://thetradescout.com",
    env.R2_PUBLIC_URL,
    env.PUBLIC_URL_BASE,
    env.PUBLIC_BASE_URL,
    env.CLIENT_ORIGIN,
  ];
  const bases: URL[] = [];
  for (const value of values) {
    if (!value || typeof value !== "string" || !/^https:\/\//i.test(value.trim())) continue;
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) bases.push(parsed);
    } catch {
      // Ignore malformed optional configuration.
    }
  }
  return bases;
}

export function normalizeHomeScoutReportSourceUrl(
  value: unknown,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const candidate = cleanString(value, 500);
  if (!candidate || /[\\\r\n]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return isSafeUploadPath(candidate) ? candidate : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !isSafeDecodedPath(parsed.pathname)
  ) {
    return null;
  }

  const allowed = configuredUploadBases(env).some((base) => {
    if (base.origin !== parsed.origin) return false;
    const basePath = base.pathname.replace(/\/+$/, "");
    const uploadPrefix =
      !basePath || basePath === "/"
        ? "/uploads/"
        : basePath.endsWith("/uploads")
          ? `${basePath}/`
          : `${basePath}/uploads/`;
    return parsed.pathname.startsWith(uploadPrefix);
  });
  return allowed ? parsed.toString() : null;
}

export const HOME_SCOUT_REPORT_DOWNLOAD_MAX_BYTES = MAX_REPORT_BYTES;
