const HOME_PACKET_HANDOFF_VERSION = 1;
const HOME_PACKET_HANDOFF_TTL_MS = 10 * 60 * 1000;
const HOME_PACKET_HANDOFF_STORAGE_PREFIX =
  "tradescout:direct-connect-home-packet-handoff:v1:";
const DIRECT_CONNECT_DRAFT_STORAGE_KEY = "ts_direct_connect_draft_v1";
const STAGED_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const DIRECT_CONNECT_REQUEST_PATH = "/api/direct-connect/requests";

export type DirectConnectHomePacketIntent = "link_existing" | "update_from_request";

export type DirectConnectHomePacketEntryContext = {
  targetUserId?: string;
  targetProviderId?: string;
  targetSelector?: string;
  contextType?: string;
  contextId?: string;
  subjectType?: string;
  source?: string;
  title?: string;
  description?: string;
  budgetMin?: string;
  budgetMax?: string;
  location?: string;
  timing?: string;
  tradeId?: string;
  homeId?: string;
  homeContextIntent?: string;
  homePacketId?: string;
  homePacketSelectedDetailIds?: string[];
  homePacketReadinessState?: string;
};

type StoredHomePacketHandoff = {
  version: typeof HOME_PACKET_HANDOFF_VERSION;
  token: string;
  createdAt: number;
  expiresAt: number;
  homeId: string;
  homeContextIntent: DirectConnectHomePacketIntent;
  homePacketId: string;
  homePacketSelectedDetailIds: string[];
  homePacketReadinessState: "ready_for_handoff";
};

type PreparedDirectConnectPayload = {
  payload: unknown;
  handoffToken: string | null;
};

function getSessionStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return Array.from(
    value
      .normalize("NFC")
      .replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  )
    .slice(0, maxLength)
    .join("");
}

function cleanHomePacketIntent(value: unknown): DirectConnectHomePacketIntent | null {
  return value === "link_existing" || value === "update_from_request" ? value : null;
}

function cleanSelectedDetailIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => cleanString(item, 120)).filter(Boolean))
  ).slice(0, 50);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stagedTokenFromLocation(pathOrHref: string): string | null {
  try {
    const parsed = new URL(pathOrHref, "https://www.thetradescout.com");
    const token = parsed.searchParams.get("staged")?.trim() || "";
    return STAGED_TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

function isDirectConnectRequestCreate(method: string, url: string): boolean {
  if (String(method || "").trim().toUpperCase() !== "POST") return false;
  try {
    return new URL(url, "https://www.thetradescout.com").pathname === DIRECT_CONNECT_REQUEST_PATH;
  } catch {
    return false;
  }
}

function storageKey(token: string): string {
  return `${HOME_PACKET_HANDOFF_STORAGE_PREFIX}${token}`;
}

function removeStoredHandoff(storage: Storage, token: string): void {
  try {
    storage.removeItem(storageKey(token));
  } catch {
    // The request can still continue without optional HomeID packet enrichment.
  }
}

function readStoredHandoff(
  token: string,
  storage: Storage,
  now = Date.now()
): StoredHomePacketHandoff | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(storageKey(token));
  } catch {
    return null;
  }
  if (!raw || raw.length > 16_000) return null;

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    removeStoredHandoff(storage, token);
    return null;
  }
  if (!isPlainRecord(candidate)) {
    removeStoredHandoff(storage, token);
    return null;
  }

  const homeId = cleanString(candidate.homeId, 120);
  const homeContextIntent = cleanHomePacketIntent(candidate.homeContextIntent);
  const homePacketId = cleanString(candidate.homePacketId, 120);
  const selectedDetailIds = cleanSelectedDetailIds(candidate.homePacketSelectedDetailIds);
  const createdAt = Number(candidate.createdAt);
  const expiresAt = Number(candidate.expiresAt);
  const valid =
    candidate.version === HOME_PACKET_HANDOFF_VERSION &&
    candidate.token === token &&
    Number.isFinite(createdAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt === createdAt + HOME_PACKET_HANDOFF_TTL_MS &&
    createdAt <= now &&
    expiresAt > now &&
    Boolean(homeId && homeContextIntent && homePacketId) &&
    candidate.homePacketReadinessState === "ready_for_handoff";
  if (!valid) {
    removeStoredHandoff(storage, token);
    return null;
  }

  return {
    version: HOME_PACKET_HANDOFF_VERSION,
    token,
    createdAt,
    expiresAt,
    homeId,
    homeContextIntent,
    homePacketId,
    homePacketSelectedDetailIds: selectedDetailIds,
    homePacketReadinessState: "ready_for_handoff",
  };
}

/** Matches the entry signature owned by the current Direct Connect composer. */
export function buildDirectConnectEntrySignature(
  context: DirectConnectHomePacketEntryContext
): string {
  const identity = {
    intent: "",
    targetUserId: cleanString(context.targetUserId, 120),
    targetProviderId: cleanString(context.targetProviderId, 120),
    targetSelector: cleanString(context.targetSelector, 120),
    contextType: cleanString(context.contextType, 80),
    contextId: cleanString(context.contextId, 120),
    subjectType: cleanString(context.subjectType, 40),
    source: cleanString(context.source, 80),
    title: cleanString(context.title, 160),
    description: cleanString(context.description, 5_000),
    budgetMin: cleanString(context.budgetMin, 32),
    budgetMax: cleanString(context.budgetMax, 32),
    location: cleanString(context.location, 240),
    timing: cleanString(context.timing, 160),
    tradeId: cleanString(context.tradeId, 120),
  };
  return Object.values(identity).some(Boolean) ? JSON.stringify(identity) : "";
}

/**
 * Seeds the composer through its existing private draft gate. A complete packet
 * also receives its own short-lived submit record, keyed by the opaque URL token.
 */
export function stageDirectConnectHomePacketHandoff({
  token,
  returnPath,
  context,
  storage,
  now = Date.now(),
}: {
  token: string;
  returnPath: string;
  context: DirectConnectHomePacketEntryContext;
  storage?: Storage | null;
  now?: number;
}): { composerDraftStaged: boolean; packetStaged: boolean } {
  const targetStorage = getSessionStorage(storage);
  const homeId = cleanString(context.homeId, 120);
  const homeContextIntent = cleanHomePacketIntent(context.homeContextIntent);
  if (!targetStorage || !STAGED_TOKEN_PATTERN.test(token) || !homeId || !homeContextIntent) {
    return { composerDraftStaged: false, packetStaged: false };
  }

  const title = cleanString(context.title, 160);
  const description = cleanString(context.description, 5_000);
  const budgetMin = cleanString(context.budgetMin, 32);
  const budgetMax = cleanString(context.budgetMax, 32);
  const location = cleanString(context.location, 240);
  const timing = cleanString(context.timing, 160);
  const providerId = cleanString(context.targetProviderId, 120);
  const draft = {
    savedAt: now,
    returnPath,
    authHandoff: true,
    entrySignature: buildDirectConnectEntrySignature(context) || undefined,
    requestType: context.subjectType === "product" ? "buy_sell" : "service_request",
    title,
    description,
    budgetMin,
    budgetMax,
    showOptional: Boolean(budgetMin || budgetMax),
    selectedProviderIds: providerId ? [providerId] : [],
    selectedHomeId: homeId,
    homeContextIntent,
    attachmentKeys: [],
    detailAnswers: {
      what: title,
      where: location,
      when: timing,
      details: description,
    },
  };

  try {
    targetStorage.setItem(DIRECT_CONNECT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    return { composerDraftStaged: false, packetStaged: false };
  }

  const homePacketId = cleanString(context.homePacketId, 120);
  const packetMetadataPresent = Boolean(
    homePacketId ||
      context.homePacketReadinessState ||
      (Array.isArray(context.homePacketSelectedDetailIds) &&
        context.homePacketSelectedDetailIds.length > 0)
  );
  if (!packetMetadataPresent) {
    return { composerDraftStaged: true, packetStaged: false };
  }
  if (!homePacketId || context.homePacketReadinessState !== "ready_for_handoff") {
    return { composerDraftStaged: true, packetStaged: false };
  }

  const record: StoredHomePacketHandoff = {
    version: HOME_PACKET_HANDOFF_VERSION,
    token,
    createdAt: now,
    expiresAt: now + HOME_PACKET_HANDOFF_TTL_MS,
    homeId,
    homeContextIntent,
    homePacketId,
    homePacketSelectedDetailIds: cleanSelectedDetailIds(
      context.homePacketSelectedDetailIds
    ),
    homePacketReadinessState: "ready_for_handoff",
  };
  try {
    targetStorage.setItem(storageKey(token), JSON.stringify(record));
    return { composerDraftStaged: true, packetStaged: true };
  } catch {
    return { composerDraftStaged: true, packetStaged: false };
  }
}

/**
 * Adds HomeID packet linkage only at the deliberate request-submit boundary and
 * only when the composer still carries the same selected home and intent.
 */
export function prepareDirectConnectHomePacketSubmission({
  method,
  url,
  payload,
  locationHref,
  storage,
  now = Date.now(),
}: {
  method: string;
  url: string;
  payload: unknown;
  locationHref?: string;
  storage?: Storage | null;
  now?: number;
}): PreparedDirectConnectPayload {
  if (!isDirectConnectRequestCreate(method, url) || !isPlainRecord(payload)) {
    return { payload, handoffToken: null };
  }
  const currentLocation =
    locationHref !== undefined
      ? locationHref
      : typeof window === "undefined"
        ? ""
        : window.location.href;
  const token = stagedTokenFromLocation(currentLocation);
  const targetStorage = getSessionStorage(storage);
  if (!token || !targetStorage) return { payload, handoffToken: null };

  const handoff = readStoredHandoff(token, targetStorage, now);
  if (!handoff) return { payload, handoffToken: null };

  const submittedHomeId = cleanString(payload.homeId, 120);
  const submittedIntent = cleanHomePacketIntent(payload.homeContextIntent);
  if (
    submittedHomeId !== handoff.homeId ||
    submittedIntent !== handoff.homeContextIntent
  ) {
    return { payload, handoffToken: null };
  }

  return {
    payload: {
      ...payload,
      homePacketId: handoff.homePacketId,
      homePacketSelectedDetailIds: handoff.homePacketSelectedDetailIds,
      homePacketReadinessState: handoff.homePacketReadinessState,
    },
    handoffToken: token,
  };
}

/** Removes packet replay state only after the server accepts the request. */
export function completeDirectConnectHomePacketSubmission(
  token: string | null | undefined,
  storage?: Storage | null
): void {
  const targetStorage = getSessionStorage(storage);
  const normalizedToken = cleanString(token, 64);
  if (!targetStorage || !STAGED_TOKEN_PATTERN.test(normalizedToken)) return;
  removeStoredHandoff(targetStorage, normalizedToken);
}
