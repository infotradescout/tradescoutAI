import {
  parseDirectConnectEntryContext,
  type DirectConnectEntryContext,
  type DirectConnectEntryContextType,
  type DirectConnectHomeContextIntent,
} from "./directConnectEntryContext";

const STAGED_CONTEXT_VERSION = 1;
const STAGED_CONTEXT_TTL_MS = 10 * 60 * 1000;
const STAGED_CONTEXT_STORAGE_PREFIX = "tradescout:direct-connect:staged:v1:";
const STAGED_CONTEXT_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const MAX_STORED_RECORD_LENGTH = 32_000;
const DIRECT_CONNECT_PATH = "/direct-connect";

const CONTEXT_TYPES: ReadonlySet<DirectConnectEntryContextType> = new Set([
  "provider",
  "business",
  "profile",
  "community_post",
  "trade_deal",
  "client",
  "shared_request",
  "employment_post",
]);

const SUBJECT_TYPES: ReadonlySet<string> = new Set(["business", "product", "service", "evidence"]);
const HOME_CONTEXT_INTENTS: ReadonlySet<DirectConnectHomeContextIntent> = new Set([
  "link_existing",
  "create_from_request",
  "update_from_request",
  "skip_for_now",
]);

type StagedContextEnvelope = {
  version: typeof STAGED_CONTEXT_VERSION;
  token: string;
  createdAt: number;
  expiresAt: number;
  context: DirectConnectEntryContext;
};

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function cleanString(value: unknown, maxLength: number, multiline = false): string | undefined {
  if (typeof value !== "string") return undefined;

  const withoutUnsafeControls = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g,
      ""
    );
  const normalizedWhitespace = multiline
    ? withoutUnsafeControls.replace(/[ \t]+\n/g, "\n")
    : withoutUnsafeControls.replace(/\s+/g, " ");
  const trimmed = normalizedWhitespace.trim();
  if (!trimmed) return undefined;

  return Array.from(trimmed).slice(0, maxLength).join("");
}

function cleanCountyFips(value: unknown): string | undefined {
  const candidate = cleanString(value, 16);
  return candidate && /^\d{5}$/.test(candidate) ? candidate : undefined;
}

function cleanStateCode(value: unknown): string | undefined {
  const candidate = cleanString(value, 16)?.toUpperCase();
  return candidate && /^[A-Z]{2}$/.test(candidate) ? candidate : undefined;
}

function cleanBudget(value: unknown): string | undefined {
  const candidate = cleanString(value, 32);
  return candidate && /^\d{1,12}(?:\.\d{1,2})?$/.test(candidate) ? candidate : undefined;
}

function cleanIdentity(value: unknown, maxLength: number): string | undefined {
  const candidate = cleanString(value, maxLength + 1);
  return candidate && Array.from(candidate).length <= maxLength ? candidate : undefined;
}

function cleanContextType(value: unknown): DirectConnectEntryContextType | undefined {
  return typeof value === "string" && CONTEXT_TYPES.has(value as DirectConnectEntryContextType)
    ? (value as DirectConnectEntryContextType)
    : undefined;
}

function cleanSubjectType(value: unknown): DirectConnectEntryContext["subjectType"] | undefined {
  return typeof value === "string" && SUBJECT_TYPES.has(value)
    ? (value as DirectConnectEntryContext["subjectType"])
    : undefined;
}

function cleanHomeContextIntent(value: unknown): DirectConnectHomeContextIntent | undefined {
  return typeof value === "string" &&
    HOME_CONTEXT_INTENTS.has(value as DirectConnectHomeContextIntent)
    ? (value as DirectConnectHomeContextIntent)
    : undefined;
}

function cleanIdentityList(value: unknown, maxItems: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const cleaned = Array.from(
    new Set(
      value.map((item) => cleanIdentity(item, 120)).filter((item): item is string => Boolean(item))
    )
  ).slice(0, maxItems);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Keeps only the Direct Connect entry fields the composer understands, removes
 * unsafe control characters, validates enums/geography/budgets, and enforces
 * field-size limits before anything is written to browser storage.
 */
export function sanitizeDirectConnectEntryContext(
  input: unknown
): DirectConnectEntryContext | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const source = input as Record<string, unknown>;
  const context: DirectConnectEntryContext = {
    countyFips: cleanCountyFips(source.countyFips),
    stateCode: cleanStateCode(source.stateCode),
    targetProviderId: cleanIdentity(source.targetProviderId, 120),
    targetUserId: cleanIdentity(source.targetUserId, 120),
    targetName: cleanString(source.targetName, 160),
    targetSelector: cleanIdentity(source.targetSelector, 120),
    source: cleanString(source.source, 80),
    title: cleanString(source.title, 160),
    description: cleanString(source.description, 5_000, true),
    budgetMin: cleanBudget(source.budgetMin),
    budgetMax: cleanBudget(source.budgetMax),
    location: cleanString(source.location, 240),
    timing: cleanString(source.timing, 160),
    tradeId: cleanIdentity(source.tradeId, 120),
    contextType: cleanContextType(source.contextType),
    contextId: cleanIdentity(source.contextId, 120),
    subjectType: cleanSubjectType(source.subjectType),
    homeId: cleanIdentity(source.homeId, 120),
    homeContextIntent: cleanHomeContextIntent(source.homeContextIntent),
    homePacketId: cleanIdentity(source.homePacketId, 120),
    homePacketSelectedDetailIds: cleanIdentityList(source.homePacketSelectedDetailIds, 50),
    homePacketReadinessState:
      source.homePacketReadinessState === "ready_for_handoff" ? "ready_for_handoff" : undefined,
  };

  for (const key of Object.keys(context) as Array<keyof DirectConnectEntryContext>) {
    if (context[key] === undefined) delete context[key];
  }

  return Object.keys(context).length > 0 ? context : null;
}

function createOpaqueToken(): string | null {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return null;

  try {
    const bytes = new Uint8Array(32);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function stagedTokenFromPath(path: string): string | null {
  const query = path.includes("?") ? path.split("?", 2)[1].split("#", 1)[0] : "";
  const token = new URLSearchParams(query).get("staged")?.trim() || "";
  return STAGED_CONTEXT_TOKEN_PATTERN.test(token) ? token : null;
}

function removeStoredContext(storage: Storage, token: string): void {
  try {
    storage.removeItem(`${STAGED_CONTEXT_STORAGE_PREFIX}${token}`);
  } catch {
    // A blocked browser storage cleanup must not break the ordinary URL fallback.
  }
}

type DirectConnectDestination = {
  fallbackHref: string;
  canUseCurrentSessionStorage: boolean;
};

function safeFallbackPath(destination: URL): string {
  const params = new URLSearchParams();
  const profile = cleanIdentity(destination.searchParams.get("profile"), 120);
  const profileName = cleanString(destination.searchParams.get("profileName"), 160);
  const source = cleanString(destination.searchParams.get("source"), 80);
  const subject = cleanSubjectType(destination.searchParams.get("subject"));

  if (profile) params.set("profile", profile);
  if (profileName) params.set("profileName", profileName);
  if (source) params.set("source", source);
  if (subject) params.set("subject", subject);

  const query = params.toString();
  return `${DIRECT_CONNECT_PATH}${query ? `?${query}` : ""}`;
}

function resolveDirectConnectDestination(destinationHref: string): DirectConnectDestination {
  const candidate = destinationHref.trim() || DIRECT_CONNECT_PATH;
  const currentHref = typeof window === "undefined" ? null : window.location.href;

  try {
    const destination = new URL(candidate, currentHref || "https://www.thetradescout.com/");
    if (destination.protocol !== "https:" && destination.protocol !== "http:") {
      return { fallbackHref: DIRECT_CONNECT_PATH, canUseCurrentSessionStorage: false };
    }
    const fallbackPath = safeFallbackPath(destination);

    if (!currentHref) {
      return {
        fallbackHref: /^(?:https?:)?\/\//i.test(candidate)
          ? `${destination.origin}${fallbackPath}`
          : fallbackPath,
        canUseCurrentSessionStorage: false,
      };
    }

    const isSameOrigin = destination.origin === window.location.origin;
    return {
      fallbackHref: isSameOrigin ? fallbackPath : `${destination.origin}${fallbackPath}`,
      canUseCurrentSessionStorage: isSameOrigin,
    };
  } catch {
    return { fallbackHref: DIRECT_CONNECT_PATH, canUseCurrentSessionStorage: false };
  }
}

/**
 * Returns a progressive-enhancement link with only non-sensitive request
 * routing fields. Project descriptions, addresses, timing, and county data are
 * never copied into this fallback URL.
 */
export function getDirectConnectEntryFallbackHref(destinationHref = DIRECT_CONNECT_PATH): string {
  return resolveDirectConnectDestination(destinationHref).fallbackHref;
}

/**
 * For a same-origin destination, stores sanitized entry context in this tab
 * only and returns a relative URL containing safe routing fields and a random
 * lookup token. For a different origin, it does not touch inaccessible session
 * storage and returns an absolute Direct Connect link containing only safe
 * routing fields. Private project details are never copied into either URL.
 */
export function stageDirectConnectEntryContext(
  input: DirectConnectEntryContext,
  destinationHref = DIRECT_CONNECT_PATH
): string {
  const destination = resolveDirectConnectDestination(destinationHref);
  if (!destination.canUseCurrentSessionStorage) return destination.fallbackHref;

  const context = sanitizeDirectConnectEntryContext(input);
  const storage = getSessionStorage();
  const token = createOpaqueToken();
  if (!context || !storage || !token) return destination.fallbackHref;

  const createdAt = Date.now();
  const envelope: StagedContextEnvelope = {
    version: STAGED_CONTEXT_VERSION,
    token,
    createdAt,
    expiresAt: createdAt + STAGED_CONTEXT_TTL_MS,
    context,
  };

  try {
    storage.setItem(`${STAGED_CONTEXT_STORAGE_PREFIX}${token}`, JSON.stringify(envelope));
  } catch {
    return destination.fallbackHref;
  }

  const separator = destination.fallbackHref.includes("?") ? "&" : "?";
  return `${destination.fallbackHref}${separator}staged=${token}`;
}

/** Reads a valid staged context without copying any context fields into the URL. */
export function readStagedDirectConnectEntryContext(
  path: string
): DirectConnectEntryContext | null {
  const token = stagedTokenFromPath(path);
  const storage = getSessionStorage();
  if (!token || !storage) return null;

  const storageKey = `${STAGED_CONTEXT_STORAGE_PREFIX}${token}`;
  let raw: string | null = null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) return null;
  if (raw.length > MAX_STORED_RECORD_LENGTH) {
    removeStoredContext(storage, token);
    return null;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    removeStoredContext(storage, token);
    return null;
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    removeStoredContext(storage, token);
    return null;
  }

  const envelope = candidate as Partial<StagedContextEnvelope>;
  const now = Date.now();
  const hasValidEnvelope =
    envelope.version === STAGED_CONTEXT_VERSION &&
    envelope.token === token &&
    Number.isFinite(envelope.createdAt) &&
    Number.isFinite(envelope.expiresAt) &&
    envelope.expiresAt === Number(envelope.createdAt) + STAGED_CONTEXT_TTL_MS &&
    Number(envelope.createdAt) <= now &&
    Number(envelope.expiresAt) > now;
  if (!hasValidEnvelope) {
    removeStoredContext(storage, token);
    return null;
  }

  const context = sanitizeDirectConnectEntryContext(envelope.context);
  if (!context || JSON.stringify(context) !== JSON.stringify(envelope.context)) {
    removeStoredContext(storage, token);
    return null;
  }

  return context;
}

/**
 * Prefers a valid tab-scoped staged handoff, then preserves the existing public
 * query-string parser as the fallback for every current Direct Connect route.
 */
export function resolveDirectConnectEntryContext(path: string): DirectConnectEntryContext {
  return readStagedDirectConnectEntryContext(path) || parseDirectConnectEntryContext(path);
}
