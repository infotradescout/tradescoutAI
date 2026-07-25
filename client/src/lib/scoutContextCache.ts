/**
 * Short-lived Scout / signup context seeded from public profiles (ISSA lux, etc.)
 * and extended by Scout explorer Q&A. Sibling profile work seeds material; Scout
 * asks for missing fields and prefills signup from the same cache.
 */

export const SCOUT_CONTEXT_CACHE_KEY = "tradescout:scout-context-cache:v1";
export const SCOUT_CONTEXT_CACHE_TTL_MS = 30 * 60 * 1000;
/** Synthetic slug when Scout gathers context without a profile handoff. */
export const SCOUT_EXPLORE_PROFILE_SLUG = "explore";

export type ScoutContextCacheSource =
  | "public_profile"
  | "business_profile_call"
  | "lux_material_toggle"
  | "direct_connect"
  | "scout_explorer"
  | string;

export type ScoutContextPendingAskKey = "area" | "project_goal" | "material";

export type ScoutContextCacheEntry = {
  source: ScoutContextCacheSource;
  profileSlug: string;
  profileName?: string;
  /** Stable material slug (e.g. honey-onyx). */
  itemId?: string;
  /** Human-readable material label. */
  itemName?: string;
  /** Mirror of itemId for ?stone= deep links. */
  stone?: string;
  prompt?: string;
  /** Explorer-gathered locality / signup fields */
  city?: string;
  stateCode?: string;
  countyName?: string;
  countyFips?: string;
  projectSummary?: string;
  intent?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  presenceType?: string;
  /** Original Scout question deferred while asking for missing context. */
  deferredMessage?: string;
  pendingAskKey?: ScoutContextPendingAskKey;
  pendingAskPrompt?: string;
  askedKeys?: ScoutContextPendingAskKey[];
  savedAt: number;
  expiresAt: number;
};

type SeedFromProfileMaterialInput = {
  profileSlug: string;
  profileName?: string;
  itemId?: string | null;
  itemName?: string | null;
  source?: ScoutContextCacheSource;
  prompt?: string;
};

type ScoutContextPatch = Partial<
  Omit<ScoutContextCacheEntry, "savedAt" | "expiresAt" | "askedKeys">
> & {
  askedKeys?: ScoutContextPendingAskKey[];
  /** When true, clear pending ask fields. */
  clearPendingAsk?: boolean;
  /** Field names to remove from the cached entry. */
  unsetFields?: Array<keyof ScoutContextCacheEntry>;
  savedAt?: number;
  expiresAt?: number;
};

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanSlug(value: unknown): string {
  const slug = cleanText(value, 128).toLowerCase();
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) ? slug : "";
}

function cleanState(value: unknown): string {
  const cleaned = cleanText(value, 32);
  return cleaned && /^[a-zA-Z]{2}$/.test(cleaned) ? cleaned.toUpperCase() : "";
}

function cleanCountyFips(value: unknown): string {
  const cleaned = cleanText(value, 5);
  return cleaned && /^\d{5}$/.test(cleaned) ? cleaned : "";
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isFresh(entry: ScoutContextCacheEntry, now = Date.now()): boolean {
  return Number.isFinite(entry.expiresAt) && entry.expiresAt > now && entry.savedAt <= now;
}

function normalizeAskedKeys(value: unknown): ScoutContextPendingAskKey[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<ScoutContextPendingAskKey>(["area", "project_goal", "material"]);
  return Array.from(
    new Set(
      value.filter(
        (key): key is ScoutContextPendingAskKey =>
          typeof key === "string" && allowed.has(key as ScoutContextPendingAskKey)
      )
    )
  );
}

function normalizeEntry(parsed: ScoutContextCacheEntry): ScoutContextCacheEntry | null {
  const profileSlug = cleanSlug(parsed.profileSlug);
  if (!profileSlug) return null;
  const itemId = cleanSlug(parsed.itemId);
  const itemName = cleanText(parsed.itemName, 120);
  const stone = cleanSlug(parsed.stone) || itemId;
  const pendingAskKey =
    parsed.pendingAskKey === "area" ||
    parsed.pendingAskKey === "project_goal" ||
    parsed.pendingAskKey === "material"
      ? parsed.pendingAskKey
      : undefined;

  return {
    source: cleanText(parsed.source, 64) || "public_profile",
    profileSlug,
    ...(cleanText(parsed.profileName, 120)
      ? { profileName: cleanText(parsed.profileName, 120) }
      : {}),
    ...(itemId ? { itemId } : {}),
    ...(itemName ? { itemName } : {}),
    ...(stone ? { stone } : {}),
    ...(cleanText(parsed.prompt, 2000) ? { prompt: cleanText(parsed.prompt, 2000) } : {}),
    ...(cleanText(parsed.city, 120) ? { city: cleanText(parsed.city, 120) } : {}),
    ...(cleanState(parsed.stateCode) ? { stateCode: cleanState(parsed.stateCode) } : {}),
    ...(cleanText(parsed.countyName, 120) ? { countyName: cleanText(parsed.countyName, 120) } : {}),
    ...(cleanCountyFips(parsed.countyFips)
      ? { countyFips: cleanCountyFips(parsed.countyFips) }
      : {}),
    ...(cleanText(parsed.projectSummary, 500)
      ? { projectSummary: cleanText(parsed.projectSummary, 500) }
      : {}),
    ...(cleanText(parsed.intent, 64) ? { intent: cleanText(parsed.intent, 64) } : {}),
    ...(cleanText(parsed.firstName, 80) ? { firstName: cleanText(parsed.firstName, 80) } : {}),
    ...(cleanText(parsed.lastName, 80) ? { lastName: cleanText(parsed.lastName, 80) } : {}),
    ...(cleanText(parsed.email, 160) ? { email: cleanText(parsed.email, 160) } : {}),
    ...(cleanText(parsed.phone, 40) ? { phone: cleanText(parsed.phone, 40) } : {}),
    ...(cleanText(parsed.businessName, 120)
      ? { businessName: cleanText(parsed.businessName, 120) }
      : {}),
    ...(cleanText(parsed.presenceType, 40)
      ? { presenceType: cleanText(parsed.presenceType, 40) }
      : {}),
    ...(cleanText(parsed.deferredMessage, 500)
      ? { deferredMessage: cleanText(parsed.deferredMessage, 500) }
      : {}),
    ...(pendingAskKey ? { pendingAskKey } : {}),
    ...(cleanText(parsed.pendingAskPrompt, 400)
      ? { pendingAskPrompt: cleanText(parsed.pendingAskPrompt, 400) }
      : {}),
    askedKeys: normalizeAskedKeys(parsed.askedKeys),
    savedAt: Number(parsed.savedAt) || 0,
    expiresAt: Number(parsed.expiresAt) || 0,
  };
}

export function clearScoutContextCache(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SCOUT_CONTEXT_CACHE_KEY);
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function getScoutContextCache(): ScoutContextCacheEntry | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SCOUT_CONTEXT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScoutContextCacheEntry;
    if (!parsed || typeof parsed !== "object") {
      clearScoutContextCache();
      return null;
    }
    const normalized = normalizeEntry(parsed);
    if (!normalized || !isFresh(normalized)) {
      clearScoutContextCache();
      return null;
    }
    return normalized;
  } catch {
    clearScoutContextCache();
    return null;
  }
}

export function setScoutContextCache(
  input: Omit<ScoutContextCacheEntry, "savedAt" | "expiresAt" | "askedKeys"> & {
    askedKeys?: ScoutContextPendingAskKey[];
    savedAt?: number;
    expiresAt?: number;
  }
): ScoutContextCacheEntry | null {
  const profileSlug = cleanSlug(input.profileSlug);
  if (!profileSlug) return null;
  const now = Date.now();
  const normalized = normalizeEntry({
    ...input,
    profileSlug,
    askedKeys: normalizeAskedKeys(input.askedKeys),
    savedAt: typeof input.savedAt === "number" ? input.savedAt : now,
    expiresAt:
      typeof input.expiresAt === "number" ? input.expiresAt : now + SCOUT_CONTEXT_CACHE_TTL_MS,
  } as ScoutContextCacheEntry);
  if (!normalized) return null;

  const store = storage();
  if (!store) return normalized;
  try {
    store.setItem(SCOUT_CONTEXT_CACHE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore quota / private-mode failures — still return in-memory shape */
  }
  return normalized;
}

/**
 * Merge explorer / signup answers into the shared cache without resetting TTL
 * when an entry already exists.
 */
export function patchScoutContextCache(patch: ScoutContextPatch): ScoutContextCacheEntry | null {
  const existing = getScoutContextCache();
  const profileSlug =
    cleanSlug(patch.profileSlug) || existing?.profileSlug || SCOUT_EXPLORE_PROFILE_SLUG;
  const askedKeys = Array.from(
    new Set([...(existing?.askedKeys || []), ...(patch.askedKeys || [])])
  ) as ScoutContextPendingAskKey[];

  const merged: ScoutContextCacheEntry = {
    source:
      cleanText(patch.source, 64) ||
      existing?.source ||
      (profileSlug === SCOUT_EXPLORE_PROFILE_SLUG ? "scout_explorer" : "public_profile"),
    profileSlug,
    profileName: patch.profileName ?? existing?.profileName,
    itemId: patch.itemId ?? existing?.itemId,
    itemName: patch.itemName ?? existing?.itemName,
    stone: patch.stone ?? existing?.stone,
    prompt: patch.prompt ?? existing?.prompt,
    city: patch.city ?? existing?.city,
    stateCode: patch.stateCode ?? existing?.stateCode,
    countyName: patch.countyName ?? existing?.countyName,
    countyFips: patch.countyFips ?? existing?.countyFips,
    projectSummary: patch.projectSummary ?? existing?.projectSummary,
    intent: patch.intent ?? existing?.intent,
    firstName: patch.firstName ?? existing?.firstName,
    lastName: patch.lastName ?? existing?.lastName,
    email: patch.email ?? existing?.email,
    phone: patch.phone ?? existing?.phone,
    businessName: patch.businessName ?? existing?.businessName,
    presenceType: patch.presenceType ?? existing?.presenceType,
    deferredMessage: patch.deferredMessage ?? existing?.deferredMessage,
    pendingAskKey: patch.clearPendingAsk
      ? undefined
      : (patch.pendingAskKey ?? existing?.pendingAskKey),
    pendingAskPrompt: patch.clearPendingAsk
      ? undefined
      : (patch.pendingAskPrompt ?? existing?.pendingAskPrompt),
    askedKeys,
    savedAt: existing?.savedAt ?? Date.now(),
    expiresAt: existing?.expiresAt ?? Date.now() + SCOUT_CONTEXT_CACHE_TTL_MS,
  };

  for (const key of patch.unsetFields || []) {
    if (key === "savedAt" || key === "expiresAt" || key === "profileSlug" || key === "source") {
      continue;
    }
    delete (merged as Record<string, unknown>)[key];
  }

  if (typeof patch.savedAt === "number") merged.savedAt = patch.savedAt;
  if (typeof patch.expiresAt === "number") merged.expiresAt = patch.expiresAt;

  return setScoutContextCache(merged);
}

/**
 * Seed Scout/signup context from a public-profile material selection.
 * Safe to call on every lux toggle and Scout handoff navigation.
 * Preserves explorer-gathered fields already in the cache.
 */
export function seedFromProfileMaterial(
  input: SeedFromProfileMaterialInput
): ScoutContextCacheEntry | null {
  const profileSlug = cleanSlug(input.profileSlug);
  if (!profileSlug) return null;
  const existing = getScoutContextCache();
  const itemId = cleanSlug(input.itemId);
  const itemName = cleanText(input.itemName, 120);
  const profileName = cleanText(input.profileName, 120) || existing?.profileName || "";
  const prompt =
    cleanText(input.prompt, 2000) ||
    (itemName
      ? `I am looking at ${itemName} on ${profileName || profileSlug}'s TradeScout profile.`
      : existing?.prompt);

  return setScoutContextCache({
    source: input.source || "public_profile",
    profileSlug,
    ...(profileName ? { profileName } : {}),
    ...(itemId ? { itemId, stone: itemId } : {}),
    ...(itemName ? { itemName } : {}),
    ...(prompt ? { prompt } : {}),
    city: existing?.city,
    stateCode: existing?.stateCode,
    countyName: existing?.countyName,
    countyFips: existing?.countyFips,
    projectSummary: existing?.projectSummary,
    intent: existing?.intent,
    firstName: existing?.firstName,
    lastName: existing?.lastName,
    email: existing?.email,
    phone: existing?.phone,
    businessName: existing?.businessName,
    presenceType: existing?.presenceType,
    deferredMessage: existing?.deferredMessage,
    pendingAskKey: existing?.pendingAskKey,
    pendingAskPrompt: existing?.pendingAskPrompt,
    askedKeys: existing?.askedKeys,
    // Fresh TTL on material seed (user actively engaged with a product).
  });
}

/** Signup / Scout helpers: return only fields useful for prefilling. */
export function readScoutContextPrefill(): {
  profileSlug: string;
  profileName?: string;
  itemId?: string;
  itemName?: string;
  stone?: string;
  prompt?: string;
  source: string;
  city?: string;
  stateCode?: string;
  countyName?: string;
  countyFips?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  presenceType?: string;
  intent?: string;
  projectSummary?: string;
} | null {
  const cached = getScoutContextCache();
  if (!cached) return null;
  return {
    profileSlug: cached.profileSlug,
    ...(cached.profileName ? { profileName: cached.profileName } : {}),
    ...(cached.itemId ? { itemId: cached.itemId } : {}),
    ...(cached.itemName ? { itemName: cached.itemName } : {}),
    ...(cached.stone ? { stone: cached.stone } : {}),
    ...(cached.prompt ? { prompt: cached.prompt } : {}),
    source: cached.source,
    ...(cached.city ? { city: cached.city } : {}),
    ...(cached.stateCode ? { stateCode: cached.stateCode } : {}),
    ...(cached.countyName ? { countyName: cached.countyName } : {}),
    ...(cached.countyFips ? { countyFips: cached.countyFips } : {}),
    ...(cached.firstName ? { firstName: cached.firstName } : {}),
    ...(cached.lastName ? { lastName: cached.lastName } : {}),
    ...(cached.email ? { email: cached.email } : {}),
    ...(cached.phone ? { phone: cached.phone } : {}),
    ...(cached.businessName ? { businessName: cached.businessName } : {}),
    ...(cached.presenceType ? { presenceType: cached.presenceType } : {}),
    ...(cached.intent ? { intent: cached.intent } : {}),
    ...(cached.projectSummary ? { projectSummary: cached.projectSummary } : {}),
  };
}

export function hasAreaInScoutContext(
  cache: ScoutContextCacheEntry | null,
  locality?: {
    county?: string;
    countyName?: string;
    countyFips?: string;
    state?: string;
    stateCode?: string;
    city?: string;
  } | null
): boolean {
  if (locality?.countyFips || locality?.county || locality?.countyName) return true;
  if ((locality?.stateCode || locality?.state) && locality?.city) return true;
  if (cache?.countyFips || cache?.countyName) return true;
  if (cache?.stateCode && cache?.city) return true;
  return false;
}

export function hasMaterialInScoutContext(cache: ScoutContextCacheEntry | null): boolean {
  return Boolean(cache?.itemId || cache?.itemName || cache?.stone);
}

/** Merge cache into Scout launchContext after URL cleanup. */
export function buildExplorerLaunchContextOverlay(
  cache: ScoutContextCacheEntry | null = getScoutContextCache()
): Record<string, string> | null {
  if (!cache) return null;
  const overlay: Record<string, string> = {};
  if (cache.itemId) overlay.itemId = cache.itemId;
  if (cache.itemName) overlay.itemName = cache.itemName;
  if (cache.stone) overlay.stone = cache.stone;
  if (cache.profileSlug && cache.profileSlug !== SCOUT_EXPLORE_PROFILE_SLUG) {
    overlay.businessSlug = cache.profileSlug;
  }
  if (cache.profileName) overlay.businessName = cache.profileName;
  if (cache.countyName) overlay.county = cache.countyName;
  if (cache.countyFips) overlay.countyFips = cache.countyFips;
  if (cache.stateCode) overlay.state = cache.stateCode;
  if (cache.city) overlay.city = cache.city;
  if (cache.intent) overlay.intent = cache.intent;
  if (cache.source) overlay.source = String(cache.source);
  return Object.keys(overlay).length > 0 ? overlay : null;
}
