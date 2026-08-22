const BUSINESSES_WORKSPACE_STORAGE_PREFIX = "tradescout:businesses-workspace:v1:";
const MAX_STORED_WORKSPACE_LENGTH = 4_096;

export type BusinessesWorkspaceState = {
  stateCode: string;
  countyFips: string;
  tradeSlug: string;
  searchQuery: string;
  selectedProviderId: string;
};

type WorkspaceField = keyof BusinessesWorkspaceState;

type ParsedRouteState = {
  values: BusinessesWorkspaceState;
  explicit: Record<WorkspaceField, boolean>;
};

const EMPTY_WORKSPACE_STATE: BusinessesWorkspaceState = {
  stateCode: "",
  countyFips: "",
  tradeSlug: "",
  searchQuery: "",
  selectedProviderId: "",
};

const WORKSPACE_QUERY_ALIASES = {
  stateCode: ["state"],
  countyFips: ["county", "countyFips"],
  tradeSlug: ["trade"],
  searchQuery: ["q", "query", "city"],
  selectedProviderId: ["selected"],
} as const satisfies Record<WorkspaceField, readonly string[]>;

function cleanSingleLine(value: unknown, maxLength: number): string {
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

function cleanStateCode(value: unknown): string {
  const candidate = cleanSingleLine(value, 8).toUpperCase();
  return /^[A-Z]{2}$/.test(candidate) ? candidate : "";
}

function cleanCounty(value: unknown): string {
  return cleanSingleLine(value, 80);
}

function cleanTradeSlug(value: unknown): string {
  const candidate = cleanSingleLine(value, 80).toLowerCase();
  return /^[a-z0-9][a-z0-9_-]*$/.test(candidate) ? candidate : "";
}

function cleanSearchQuery(value: unknown): string {
  return cleanSingleLine(value, 160);
}

function cleanProviderId(value: unknown): string {
  return cleanSingleLine(value, 120);
}

export function sanitizeBusinessesWorkspaceState(input: unknown): BusinessesWorkspaceState {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    stateCode: cleanStateCode(source.stateCode),
    countyFips: cleanCounty(source.countyFips),
    tradeSlug: cleanTradeSlug(source.tradeSlug),
    searchQuery: cleanSearchQuery(source.searchQuery),
    selectedProviderId: cleanProviderId(source.selectedProviderId),
  };
}

function readFirstQueryValue(
  params: URLSearchParams,
  aliases: readonly string[]
): { explicit: boolean; value: string } {
  for (const alias of aliases) {
    if (params.has(alias)) {
      return { explicit: true, value: params.get(alias) || "" };
    }
  }
  return { explicit: false, value: "" };
}

export function parseBusinessesWorkspaceRoute(search: string): ParsedRouteState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const stateCode = readFirstQueryValue(params, WORKSPACE_QUERY_ALIASES.stateCode);
  const countyFips = readFirstQueryValue(params, WORKSPACE_QUERY_ALIASES.countyFips);
  const tradeSlug = readFirstQueryValue(params, WORKSPACE_QUERY_ALIASES.tradeSlug);
  const searchQuery = readFirstQueryValue(params, WORKSPACE_QUERY_ALIASES.searchQuery);
  const selectedProviderId = readFirstQueryValue(
    params,
    WORKSPACE_QUERY_ALIASES.selectedProviderId
  );

  return {
    values: sanitizeBusinessesWorkspaceState({
      stateCode: stateCode.value,
      countyFips: countyFips.value,
      tradeSlug: tradeSlug.value,
      searchQuery: searchQuery.value,
      selectedProviderId: selectedProviderId.value,
    }),
    explicit: {
      stateCode: stateCode.explicit,
      countyFips: countyFips.explicit,
      tradeSlug: tradeSlug.explicit,
      searchQuery: searchQuery.explicit,
      selectedProviderId: selectedProviderId.explicit,
    },
  };
}

export function getBusinessesWorkspaceStorageKey(
  authenticatedUserId: string | null | undefined,
  pathname: string
): string | null {
  const userId = cleanSingleLine(authenticatedUserId, 160);
  const routePath = cleanSingleLine(pathname, 240);
  if (!userId || !routePath.startsWith("/")) return null;
  return `${BUSINESSES_WORKSPACE_STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(routePath)}`;
}

function readStoredBusinessesWorkspaceState(
  storage: Storage | null,
  storageKey: string | null
): BusinessesWorkspaceState {
  if (!storage || !storageKey) return { ...EMPTY_WORKSPACE_STATE };

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { ...EMPTY_WORKSPACE_STATE };
    if (raw.length > MAX_STORED_WORKSPACE_LENGTH) {
      storage.removeItem(storageKey);
      return { ...EMPTY_WORKSPACE_STATE };
    }
    return sanitizeBusinessesWorkspaceState(JSON.parse(raw));
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      // A blocked cleanup must not prevent the directory from loading.
    }
    return { ...EMPTY_WORKSPACE_STATE };
  }
}

export function resolveBusinessesWorkspaceState({
  search,
  storage,
  authenticatedUserId,
  pathname,
}: {
  search: string;
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
}): BusinessesWorkspaceState {
  const route = parseBusinessesWorkspaceRoute(search);
  const stored = readStoredBusinessesWorkspaceState(
    storage,
    getBusinessesWorkspaceStorageKey(authenticatedUserId, pathname)
  );

  return {
    stateCode: route.explicit.stateCode ? route.values.stateCode : stored.stateCode,
    countyFips: route.explicit.countyFips ? route.values.countyFips : stored.countyFips,
    tradeSlug: route.explicit.tradeSlug ? route.values.tradeSlug : stored.tradeSlug,
    searchQuery: route.explicit.searchQuery ? route.values.searchQuery : stored.searchQuery,
    selectedProviderId: route.explicit.selectedProviderId
      ? route.values.selectedProviderId
      : stored.selectedProviderId,
  };
}

export function writeBusinessesWorkspaceState({
  storage,
  authenticatedUserId,
  pathname,
  state,
}: {
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
  state: BusinessesWorkspaceState;
}): void {
  const storageKey = getBusinessesWorkspaceStorageKey(authenticatedUserId, pathname);
  if (!storage || !storageKey) return;
  const sanitized = sanitizeBusinessesWorkspaceState(state);
  const isEmpty = Object.values(sanitized).every((value) => value.length === 0);

  try {
    if (isEmpty) storage.removeItem(storageKey);
    else storage.setItem(storageKey, JSON.stringify(sanitized));
  } catch {
    // Continuity is progressive enhancement; storage denial must not break search.
  }
}

export function clearBusinessesWorkspaceState({
  storage,
  authenticatedUserId,
  pathname,
}: {
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
}): void {
  const storageKey = getBusinessesWorkspaceStorageKey(authenticatedUserId, pathname);
  if (!storage || !storageKey) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // The in-memory state and URL still clear if browser storage is unavailable.
  }
}

export function buildCanonicalBusinessesWorkspaceHref({
  pathname,
  currentSearch,
  hash = "",
  state,
}: {
  pathname: string;
  currentSearch: string;
  hash?: string;
  state: BusinessesWorkspaceState;
}): string {
  const params = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch
  );
  for (const aliases of Object.values(WORKSPACE_QUERY_ALIASES)) {
    for (const alias of aliases) params.delete(alias);
  }

  const sanitized = sanitizeBusinessesWorkspaceState(state);
  if (sanitized.stateCode) params.set("state", sanitized.stateCode);
  if (sanitized.countyFips) params.set("county", sanitized.countyFips);
  if (sanitized.tradeSlug) params.set("trade", sanitized.tradeSlug);
  if (sanitized.searchQuery) params.set("q", sanitized.searchQuery);
  if (sanitized.selectedProviderId) params.set("selected", sanitized.selectedProviderId);

  const query = params.toString();
  const safeHash = hash.startsWith("#") ? hash : hash ? `#${hash}` : "";
  return `${pathname}${query ? `?${query}` : ""}${safeHash}`;
}

export function resolveSelectedWorkspaceProvider<T extends { id?: unknown }>(
  providers: readonly T[],
  selectedProviderId: string
): T | null {
  const selectedId = cleanProviderId(selectedProviderId);
  if (!selectedId) return null;
  return providers.find((provider) => String(provider?.id ?? "") === selectedId) || null;
}

export function resolveBusinessesWorkspaceCountyChange({
  countyFips,
  workspaceStateCode,
  locationStateCode,
}: {
  countyFips: string;
  workspaceStateCode: string;
  locationStateCode: string | null | undefined;
}): Pick<BusinessesWorkspaceState, "stateCode" | "countyFips" | "selectedProviderId"> {
  return {
    stateCode: cleanStateCode(workspaceStateCode) || cleanStateCode(locationStateCode),
    countyFips: cleanCounty(countyFips),
    selectedProviderId: "",
  };
}

export function resolveBusinessesWorkspaceViewerCoordinates({
  workspaceStateCode,
  workspaceCountyFips,
  locationStateCode,
  locationCountyFips,
  locationLat,
  locationLng,
}: {
  workspaceStateCode: string;
  workspaceCountyFips: string;
  locationStateCode: string | null | undefined;
  locationCountyFips: string | null | undefined;
  locationLat: unknown;
  locationLng: unknown;
}): { lat: number | undefined; lng: number | undefined } {
  const workspaceState = cleanStateCode(workspaceStateCode);
  const workspaceCounty = cleanCounty(workspaceCountyFips);
  const locationState = cleanStateCode(locationStateCode);
  const locationCounty = cleanCounty(locationCountyFips);
  const areaChanged = Boolean(
    (workspaceState && workspaceState !== locationState) ||
    (workspaceCounty && workspaceCounty !== locationCounty)
  );

  if (areaChanged) return { lat: undefined, lng: undefined };
  return {
    lat: typeof locationLat === "number" && Number.isFinite(locationLat) ? locationLat : undefined,
    lng: typeof locationLng === "number" && Number.isFinite(locationLng) ? locationLng : undefined,
  };
}

export function resolveBusinessesWorkspaceEffectiveArea({
  workspaceStateCode,
  workspaceCountyFips,
  locationStateCode,
  locationCountyFips,
}: {
  workspaceStateCode: string;
  workspaceCountyFips: string;
  locationStateCode: string | null | undefined;
  locationCountyFips: string | null | undefined;
}): Pick<BusinessesWorkspaceState, "stateCode" | "countyFips"> {
  const workspaceState = cleanStateCode(workspaceStateCode);
  const workspaceCounty = cleanCounty(workspaceCountyFips);
  const locationState = cleanStateCode(locationStateCode);
  const locationCounty = cleanCounty(locationCountyFips);
  const mayUseLocationCounty = !workspaceState || workspaceState === locationState;

  return {
    stateCode: workspaceState || locationState,
    countyFips: workspaceCounty || (mayUseLocationCounty ? locationCounty : ""),
  };
}
