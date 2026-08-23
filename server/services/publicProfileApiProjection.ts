import { sanitizePublicProfileText } from "../../shared/publicListingSafety";

const DIRECT_CONTACT_REPLACEMENT = "Continue through TradeScout";

export type PublicProfileApiFieldConsent = Readonly<{
  addressLabel?: boolean;
  contactLinks?: boolean;
  directionsUrl?: boolean;
  email?: boolean;
  outboundLinks?: boolean;
  phone?: boolean;
  socialLinks?: boolean;
  websiteUrl?: boolean;
}>;

export type PublicProfileApiProjectionOptions = Readonly<{
  /**
   * Every direct-action field is opt-in. Publication preferences such as
   * `publicProfileIds` are intentionally not inspected here and never count as
   * contact or exact-location consent.
   */
  fieldConsent?: PublicProfileApiFieldConsent;
}>;

type DirectField = keyof PublicProfileApiFieldConsent;

const EMAIL_VALUE_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_VALUE_PATTERN =
  /^(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d+)?$/i;
const DIRECT_SCHEME_PATTERN = /^(?:mailto|tel|sms|callto|facetime|whatsapp):/i;
const WEB_URL_PATTERN = /^(?:(?:https?:)?\/\/|www\.)\S+$/i;
const BARE_DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+[a-z]{2,63}(?:\/[^\s]*)?$/i;
const RELATIVE_ASSET_OR_ROUTE_PATTERN = /^(?:\.{1,2}\/|\/(?!\/)|#|\?)/;

const MEDIA_KEY_PATTERN =
  /(?:image|photo|media|video|audio|logo|avatar|thumbnail|poster|favicon|asset|icon)(?:url|uri|src|href|path)?s?$/;
const SOURCE_KEY_PATTERN =
  /(?:source|attribution|citation|credit|provenance|verification|evidence)(?:url|uri|href|link|links|urls)?s?$/;
const SOCIAL_KEY_PATTERN =
  /(?:social|instagram|facebook|linkedin|youtube|twitter|tiktok|pinterest|snapchat|threads|yelp)/;
const CONTACT_KEY_PATTERN =
  /(?:contact|email|phone|telephone|mobile|fax|mailto|message|whatsapp|facetime|calllink|smslink|phonelink|emaillink)/;
const OUTBOUND_KEY_PATTERN = /(?:outbound|external|homepage|learnmore|visitlink)/;
const WEBSITE_CONTEXT_PATTERN = /(?:companywebsite|homepage|website)/;
const DIRECTIONS_CONTEXT_PATTERN = /^(?:directions?|navigation|maps?)(?:url|href|link|links)?$/;
const LINK_CONTEXT_PATTERN = /(?:links?|urls?|hrefs?)$/;
const LINK_KEY_PATTERN = /(?:url|uri|href|link)$/;

const STRUCTURAL_URL_KEYS = new Set([
  "canonical",
  "canonicalurl",
  "customdomain",
  "profilepath",
  "publicprofilepath",
  "publicprofileurl",
  "routepath",
  "sharepath",
]);

const WEBSITE_KEYS = new Set([
  "companywebsite",
  "homepageurl",
  "officialwebsite",
  "siteurl",
  "website",
  "websitehref",
  "websitelink",
  "websiteurl",
]);

const DIRECTIONS_KEYS = new Set([
  "directionshref",
  "directionslink",
  "directionsurl",
  "maphref",
  "maplink",
  "mapsurl",
  "mapurl",
  "navigationurl",
]);

const GENERIC_LINK_KEYS = new Set([
  "externalurl",
  "href",
  "link",
  "linkhref",
  "linkurl",
  "outboundurl",
  "url",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isUrlLike(value: string): boolean {
  const candidate = value.trim();
  return (
    DIRECT_SCHEME_PATTERN.test(candidate) ||
    WEB_URL_PATTERN.test(candidate) ||
    BARE_DOMAIN_PATTERN.test(candidate) ||
    RELATIVE_ASSET_OR_ROUTE_PATTERN.test(candidate) ||
    /^(?:data|blob):/i.test(candidate)
  );
}

function isExternalUrl(value: string): boolean {
  const candidate = value.trim();
  return (
    DIRECT_SCHEME_PATTERN.test(candidate) ||
    WEB_URL_PATTERN.test(candidate) ||
    BARE_DOMAIN_PATTERN.test(candidate)
  );
}

function isTradeScoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return hostname === "thetradescout.com" || hostname.endsWith(".thetradescout.com");
  } catch {
    return false;
  }
}

function pathHasPattern(path: readonly string[], pattern: RegExp): boolean {
  return path.some((segment) => pattern.test(normalizedKey(segment)));
}

function isMediaUrl(path: readonly string[], value: string): boolean {
  return isUrlLike(value) && pathHasPattern(path, MEDIA_KEY_PATTERN);
}

function isSourceAttributionUrl(path: readonly string[], value: string): boolean {
  return isUrlLike(value) && pathHasPattern(path, SOURCE_KEY_PATTERN);
}

function isExplicitlyConsented(
  field: DirectField,
  options: PublicProfileApiProjectionOptions
): boolean {
  return options.fieldConsent?.[field] === true;
}

function explicitDirectStringField(key: string, value: string): DirectField | null {
  const normalized = normalizedKey(key);

  if (normalized === "addresslabel") return "addressLabel";
  if (WEBSITE_KEYS.has(normalized)) return "websiteUrl";
  if (DIRECTIONS_KEYS.has(normalized)) return "directionsUrl";

  if (
    normalized === "email" ||
    normalized === "emails" ||
    normalized.endsWith("emailaddress") ||
    normalized.endsWith("contactemail")
  ) {
    return "email";
  }

  if (
    normalized === "phone" ||
    normalized === "phones" ||
    normalized === "tel" ||
    normalized === "telephone" ||
    normalized.endsWith("phonenumber") ||
    normalized.endsWith("contactphone")
  ) {
    return "phone";
  }

  return null;
}

function contextualDirectStringField(
  key: string,
  path: readonly string[],
  value: string
): DirectField | null {
  const normalized = normalizedKey(key);
  const normalizedPath = path.map(normalizedKey);
  const candidate = value.trim();
  const isContactValue =
    isUrlLike(candidate) ||
    EMAIL_VALUE_PATTERN.test(candidate) ||
    PHONE_VALUE_PATTERN.test(candidate);

  if (!isContactValue) return null;
  if (normalizedPath.some((segment) => WEBSITE_CONTEXT_PATTERN.test(segment))) return "websiteUrl";
  if (normalizedPath.some((segment) => DIRECTIONS_CONTEXT_PATTERN.test(segment)))
    return "directionsUrl";
  if (normalizedPath.some((segment) => SOCIAL_KEY_PATTERN.test(segment))) return "socialLinks";
  if (normalizedPath.some((segment) => CONTACT_KEY_PATTERN.test(segment))) return "contactLinks";
  if (normalizedPath.some((segment) => OUTBOUND_KEY_PATTERN.test(segment))) return "outboundLinks";
  if (DIRECT_SCHEME_PATTERN.test(candidate)) return "contactLinks";
  if (EMAIL_VALUE_PATTERN.test(candidate) || PHONE_VALUE_PATTERN.test(candidate)) {
    return GENERIC_LINK_KEYS.has(normalized) || LINK_KEY_PATTERN.test(normalized)
      ? "contactLinks"
      : null;
  }
  if (!isExternalUrl(candidate) || isTradeScoutUrl(candidate)) return null;
  if (
    GENERIC_LINK_KEYS.has(normalized) ||
    LINK_KEY_PATTERN.test(normalized) ||
    normalizedPath.some((segment) => LINK_CONTEXT_PATTERN.test(segment))
  ) {
    return "outboundLinks";
  }

  // A URL stored in an ordinary text field is sanitized as text below. Only
  // actionable link fields and link collections are removed from the shape.
  return null;
}

function sanitizeOwnerAuthoredText(value: string): string {
  const withoutDirectSchemes = value
    .replace(/\b(?:mailto|tel|sms|callto|facetime|whatsapp):\S+/gi, DIRECT_CONTACT_REPLACEMENT)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, DIRECT_CONTACT_REPLACEMENT)
    .replace(
      /(^|[^\d])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d+)?(?!\d)/gi,
      `$1${DIRECT_CONTACT_REPLACEMENT}`
    );
  return sanitizePublicProfileText(withoutDirectSchemes, 20_000);
}

const SUPPRESSED_ARRAY_VALUE = Symbol("suppressed-public-profile-array-value");

function projectValue(
  value: unknown,
  path: readonly string[],
  options: PublicProfileApiProjectionOptions,
  seen: WeakMap<object, unknown>
): unknown | typeof SUPPRESSED_ARRAY_VALUE {
  if (typeof value === "string") {
    const key = path[path.length - 1] || "";
    const explicitDirectField = explicitDirectStringField(key, value);

    if (explicitDirectField && !isExplicitlyConsented(explicitDirectField, options)) {
      return SUPPRESSED_ARRAY_VALUE;
    }

    if (explicitDirectField && isExplicitlyConsented(explicitDirectField, options)) return value;

    // Media and provenance URLs are rendering evidence, not direct-action
    // fields. A mail/tel/sms value can never use this exception.
    if (!DIRECT_SCHEME_PATTERN.test(value.trim())) {
      if (isMediaUrl(path, value) || isSourceAttributionUrl(path, value)) return value;
      if (STRUCTURAL_URL_KEYS.has(normalizedKey(key))) return value;
    }

    const contextualDirectField = contextualDirectStringField(key, path, value);
    if (contextualDirectField && !isExplicitlyConsented(contextualDirectField, options)) {
      return SUPPRESSED_ARRAY_VALUE;
    }
    if (contextualDirectField && isExplicitlyConsented(contextualDirectField, options))
      return value;
    if (RELATIVE_ASSET_OR_ROUTE_PATTERN.test(value.trim())) return value;
    if (
      isTradeScoutUrl(value) &&
      (GENERIC_LINK_KEYS.has(normalizedKey(key)) || LINK_KEY_PATTERN.test(normalizedKey(key)))
    ) {
      return value;
    }
    return sanitizeOwnerAuthoredText(value);
  }

  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (value instanceof Date) return new Date(value.getTime());
  if (seen.has(value)) return seen.get(value)!;

  if (Array.isArray(value)) {
    const projected: unknown[] = [];
    seen.set(value, projected);
    for (let index = 0; index < value.length; index += 1) {
      const item = projectValue(value[index], [...path, String(index)], options, seen);
      if (item !== SUPPRESSED_ARRAY_VALUE) projected.push(item);
    }
    return projected;
  }

  const projected: Record<string, unknown> = {};
  seen.set(value, projected);
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    const normalized = normalizedKey(key);

    if (normalized === "addresslabel" && !isExplicitlyConsented("addressLabel", options)) {
      projected[key] = null;
      continue;
    }

    const projectedChild = projectValue(child, nextPath, options, seen);
    projected[key] = projectedChild === SUPPRESSED_ARRAY_VALUE ? null : projectedChild;
  }
  return projected;
}

/**
 * Clones and projects a public-profile API payload through the contact and
 * exact-location boundary. This function is intentionally JSON-shape agnostic
 * so new content-block fields cannot silently skip the boundary.
 */
export function projectPublicProfileApiPayload<T>(
  payload: T,
  options: PublicProfileApiProjectionOptions = {}
): T {
  return projectValue(payload, [], options, new WeakMap()) as T;
}

/** Field-aware projection for the compact public-search adapter. */
export function projectPublicProfileSearchResult<T>(row: T): T {
  return projectPublicProfileApiPayload(row);
}
