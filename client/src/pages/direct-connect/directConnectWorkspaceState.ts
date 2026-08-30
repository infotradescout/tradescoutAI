export const DIRECT_CONNECT_START_PATH = "/direct-connect";
export const DIRECT_CONNECT_INCOMING_PATH = "/direct-connect/inbox";
export const DIRECT_CONNECT_REQUESTS_PATH = "/direct-connect/active";
export const DIRECT_CONNECT_TASKBAR_RESUME_HREF = "/direct-connect?resume=last-task";

const DIRECT_CONNECT_WORKSPACE_STORAGE_PREFIX = "tradescout:direct-connect-workspace:v1:";
const DIRECT_CONNECT_COMPOSER_DRAFT_STORAGE_PREFIX = "tradescout:direct-connect-composer-draft:v1:";
const DIRECT_CONNECT_LAST_TASK_STORAGE_PREFIX = "tradescout:direct-connect-last-task:v1:";
const MAX_STORED_WORKSPACE_LENGTH = 2_048;
const MAX_CLOSED_REQUEST_AGE_MS = 120 * 24 * 60 * 60 * 1000;

export type DirectConnectWorkspaceTask = "start" | "incoming" | "requests";
export type DirectConnectWorkspaceFilter =
  | "all"
  | "suggested"
  | "accepted"
  | "declined"
  | "open"
  | "routed"
  | "in_progress"
  | "pending_outcome"
  | "completed"
  | "cancelled";

export type DirectConnectWorkspaceState = {
  filter: DirectConnectWorkspaceFilter;
  selectedId: string;
  countyFips: string;
};

const DIRECT_CONNECT_TASK_PATHS: Record<DirectConnectWorkspaceTask, string> = {
  start: DIRECT_CONNECT_START_PATH,
  incoming: DIRECT_CONNECT_INCOMING_PATH,
  requests: DIRECT_CONNECT_REQUESTS_PATH,
};

type ParsedWorkspaceRoute = {
  values: DirectConnectWorkspaceState;
  explicit: Record<keyof DirectConnectWorkspaceState, boolean>;
};

const FILTERS_BY_TASK: Record<DirectConnectWorkspaceTask, readonly DirectConnectWorkspaceFilter[]> =
  {
    start: ["all"],
    incoming: ["all", "suggested", "accepted", "declined"],
    requests: ["all", "open", "routed", "in_progress", "pending_outcome", "completed", "cancelled"],
  };

const QUERY_ALIASES = {
  filter: ["filter", "status"],
  selectedId: ["selected", "selectedId"],
  countyFips: ["county", "countyFips"],
} as const satisfies Record<keyof DirectConnectWorkspaceState, readonly string[]>;

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

function cleanCountyFips(value: unknown): string {
  const candidate = cleanSingleLine(value, 16);
  return /^\d{5}$/.test(candidate) ? candidate : "";
}

function cleanSelectedId(value: unknown): string {
  return cleanSingleLine(value, 120);
}

function cleanFilter(
  value: unknown,
  task: DirectConnectWorkspaceTask
): DirectConnectWorkspaceFilter {
  const candidate = cleanSingleLine(value, 32).toLowerCase() as DirectConnectWorkspaceFilter;
  return FILTERS_BY_TASK[task].includes(candidate) ? candidate : "all";
}

export function getDirectConnectWorkspaceTask(pathname: string): DirectConnectWorkspaceTask | null {
  const cleanPath = cleanSingleLine(pathname, 240).split("?")[0].replace(/\/+$/, "") || "/";
  if (cleanPath === "/direct-connect" || cleanPath === "/direct-connect/post") return "start";
  if (cleanPath === "/direct-connect/inbox") return "incoming";
  if (cleanPath === "/direct-connect/active" || cleanPath === "/direct-connect/engagements") {
    return "requests";
  }
  return null;
}

export function canonicalizeDirectConnectWorkspacePathname(pathname: string): string {
  const task = getDirectConnectWorkspaceTask(pathname);
  if (task === "start") return DIRECT_CONNECT_START_PATH;
  if (task === "incoming") return DIRECT_CONNECT_INCOMING_PATH;
  if (task === "requests") return DIRECT_CONNECT_REQUESTS_PATH;
  const cleanPath = cleanSingleLine(pathname, 240).split("?")[0].replace(/\/+$/, "");
  return cleanPath.startsWith("/") ? cleanPath : DIRECT_CONNECT_START_PATH;
}

export function sanitizeDirectConnectWorkspaceState(
  input: unknown,
  task: DirectConnectWorkspaceTask
): DirectConnectWorkspaceState {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  return {
    filter: cleanFilter(source.filter, task),
    selectedId: task === "start" ? "" : cleanSelectedId(source.selectedId),
    countyFips: cleanCountyFips(source.countyFips),
  };
}

function readFirstQueryValue(
  params: URLSearchParams,
  aliases: readonly string[]
): { explicit: boolean; value: string } {
  for (const alias of aliases) {
    if (params.has(alias)) return { explicit: true, value: params.get(alias) || "" };
  }
  return { explicit: false, value: "" };
}

export function parseDirectConnectWorkspaceRoute(
  search: string,
  task: DirectConnectWorkspaceTask
): ParsedWorkspaceRoute {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const filter = readFirstQueryValue(params, QUERY_ALIASES.filter);
  const selectedId = readFirstQueryValue(params, QUERY_ALIASES.selectedId);
  const countyFips = readFirstQueryValue(params, QUERY_ALIASES.countyFips);
  return {
    values: sanitizeDirectConnectWorkspaceState(
      {
        filter: filter.value,
        selectedId: selectedId.value,
        countyFips: countyFips.value,
      },
      task
    ),
    explicit: {
      filter: filter.explicit,
      selectedId: selectedId.explicit,
      countyFips: countyFips.explicit,
    },
  };
}

export function getDirectConnectWorkspaceStorageKey(
  authenticatedUserId: string | null | undefined,
  pathname: string
): string | null {
  const userId = cleanSingleLine(authenticatedUserId, 160);
  const task = getDirectConnectWorkspaceTask(pathname);
  if (!userId || !task) return null;
  const canonicalPath = canonicalizeDirectConnectWorkspacePathname(pathname);
  return `${DIRECT_CONNECT_WORKSPACE_STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(canonicalPath)}`;
}

export function getDirectConnectLastTaskStorageKey(
  authenticatedUserId: string | null | undefined
): string | null {
  const userId = cleanSingleLine(authenticatedUserId, 160);
  return userId ? `${DIRECT_CONNECT_LAST_TASK_STORAGE_PREFIX}${encodeURIComponent(userId)}` : null;
}

export function writeDirectConnectLastTask({
  storage,
  authenticatedUserId,
  task,
}: {
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  task: DirectConnectWorkspaceTask;
}): void {
  const storageKey = getDirectConnectLastTaskStorageKey(authenticatedUserId);
  if (!storage || !storageKey || !DIRECT_CONNECT_TASK_PATHS[task]) return;
  try {
    storage.setItem(storageKey, task);
  } catch {
    // Bare Start remains the safe fallback when session storage is unavailable.
  }
}

function readDirectConnectLastTask(
  storage: Storage | null,
  authenticatedUserId: string | null | undefined
): DirectConnectWorkspaceTask | null {
  const storageKey = getDirectConnectLastTaskStorageKey(authenticatedUserId);
  if (!storage || !storageKey) return null;
  try {
    const task = cleanSingleLine(storage.getItem(storageKey), 32) as DirectConnectWorkspaceTask;
    return DIRECT_CONNECT_TASK_PATHS[task] ? task : null;
  } catch {
    return null;
  }
}

export function hasDirectConnectTaskbarResumeSignal(pathOrSearch: string): boolean {
  const query = pathOrSearch.includes("?")
    ? pathOrSearch.split("?", 2)[1].split("#", 1)[0]
    : pathOrSearch.startsWith("?")
      ? pathOrSearch.slice(1)
      : "";
  return new URLSearchParams(query).get("resume") === "last-task";
}

export function resolveDirectConnectTaskbarResumeHref({
  pathOrSearch,
  storage,
  authenticatedUserId,
}: {
  pathOrSearch: string;
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
}): string | null {
  if (!hasDirectConnectTaskbarResumeSignal(pathOrSearch)) return null;
  const task = readDirectConnectLastTask(storage, authenticatedUserId) || "start";
  return DIRECT_CONNECT_TASK_PATHS[task];
}

export function resolveDirectConnectComposerLocation(
  currentLocation: string,
  taskbarResumeHref: string | null
): string {
  return taskbarResumeHref && getDirectConnectWorkspaceTask(taskbarResumeHref) === "start"
    ? DIRECT_CONNECT_START_PATH
    : currentLocation;
}

export function resolveDirectConnectComposerReturnPath(
  entryLocation: string | null | undefined,
  fallbackLocation: string | null | undefined
): string {
  const stableEntry = typeof entryLocation === "string" ? entryLocation.trim() : "";
  if (stableEntry) return stableEntry;
  const fallback = typeof fallbackLocation === "string" ? fallbackLocation.trim() : "";
  return fallback || DIRECT_CONNECT_START_PATH;
}

export function buildDirectConnectAuthHandoffHref(returnPath: string): string {
  const fallback = DIRECT_CONNECT_START_PATH;
  const candidate = resolveDirectConnectComposerReturnPath(returnPath, fallback);

  try {
    const baseOrigin = "https://www.thetradescout.com";
    const parsed = new URL(candidate, baseOrigin);
    const isSameOrigin = parsed.origin === baseOrigin;
    const isComposerRoute = getDirectConnectWorkspaceTask(parsed.pathname) === "start";
    if (!isSameOrigin || !isComposerRoute) {
      return `/pre-scout-setup?mode=signin&next=${encodeURIComponent(fallback)}`;
    }

    const safeReturnPath =
      `${canonicalizeDirectConnectWorkspacePathname(parsed.pathname)}${parsed.search}${parsed.hash}`;
    return `/pre-scout-setup?mode=signin&next=${encodeURIComponent(safeReturnPath)}`;
  } catch {
    return `/pre-scout-setup?mode=signin&next=${encodeURIComponent(fallback)}`;
  }
}

export function getDirectConnectComposerDraftSessionKey(
  authenticatedUserId: string | null | undefined,
  pathname: string,
  entrySignature: string | null | undefined
): string | null {
  const userId = cleanSingleLine(authenticatedUserId, 160);
  if (!userId || getDirectConnectWorkspaceTask(pathname) !== "start") return null;
  const signature = cleanSingleLine(entrySignature, 512) || "default";
  return `${DIRECT_CONNECT_COMPOSER_DRAFT_STORAGE_PREFIX}${encodeURIComponent(
    userId
  )}:${encodeURIComponent(DIRECT_CONNECT_START_PATH)}:${encodeURIComponent(signature)}`;
}

export function resolveDirectConnectComposerDraftText(
  storedValue: unknown,
  explicitValue: unknown
): string {
  const explicit = typeof explicitValue === "string" ? explicitValue.trim() : "";
  if (explicit) return explicit;
  return typeof storedValue === "string" ? storedValue.trim() : "";
}

export function shouldConsumeDirectConnectDraftAfterHydration(authHandoff: unknown): boolean {
  return authHandoff === true;
}

function readStoredDirectConnectWorkspaceState(
  storage: Storage | null,
  storageKey: string | null,
  task: DirectConnectWorkspaceTask
): DirectConnectWorkspaceState {
  const empty = sanitizeDirectConnectWorkspaceState({}, task);
  if (!storage || !storageKey) return empty;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return empty;
    if (raw.length > MAX_STORED_WORKSPACE_LENGTH) {
      storage.removeItem(storageKey);
      return empty;
    }
    return sanitizeDirectConnectWorkspaceState(JSON.parse(raw), task);
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      // URL continuity still works when browser storage is unavailable.
    }
    return empty;
  }
}

export function resolveDirectConnectWorkspaceState({
  search,
  storage,
  authenticatedUserId,
  pathname,
  currentCountyFips,
}: {
  search: string;
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
  currentCountyFips?: string | null;
}): DirectConnectWorkspaceState {
  const task = getDirectConnectWorkspaceTask(pathname) || "start";
  const route = parseDirectConnectWorkspaceRoute(search, task);
  const stored = readStoredDirectConnectWorkspaceState(
    storage,
    getDirectConnectWorkspaceStorageKey(authenticatedUserId, pathname),
    task
  );
  const currentCounty = cleanCountyFips(currentCountyFips);
  const filter = route.explicit.filter ? route.values.filter : stored.filter;
  const countyFips = route.explicit.countyFips
    ? route.values.countyFips
    : currentCounty || stored.countyFips;
  const storedContextMatches = filter === stored.filter && countyFips === stored.countyFips;
  const selectedId = route.explicit.selectedId
    ? route.values.selectedId
    : storedContextMatches
      ? stored.selectedId
      : "";
  return sanitizeDirectConnectWorkspaceState({ filter, selectedId, countyFips }, task);
}

export function resolveDirectConnectWorkspaceScopeHydration({
  restoredState,
  previousScope,
  currentScope,
  task,
}: {
  restoredState: DirectConnectWorkspaceState;
  previousScope: string;
  currentScope: string;
  task: DirectConnectWorkspaceTask;
}): DirectConnectWorkspaceState {
  const restored = sanitizeDirectConnectWorkspaceState(restoredState, task);
  if (previousScope && previousScope !== currentScope) {
    return { ...restored, selectedId: "" };
  }
  return restored;
}

export function writeDirectConnectWorkspaceState({
  storage,
  authenticatedUserId,
  pathname,
  state,
}: {
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
  state: DirectConnectWorkspaceState;
}): void {
  const task = getDirectConnectWorkspaceTask(pathname);
  const storageKey = getDirectConnectWorkspaceStorageKey(authenticatedUserId, pathname);
  if (!storage || !storageKey || !task) return;
  try {
    storage.setItem(storageKey, JSON.stringify(sanitizeDirectConnectWorkspaceState(state, task)));
  } catch {
    // Session continuity is progressive enhancement.
  }
}

export function buildCanonicalDirectConnectWorkspaceHref({
  pathname,
  currentSearch,
  hash = "",
  state,
}: {
  pathname: string;
  currentSearch: string;
  hash?: string;
  state: DirectConnectWorkspaceState;
}): string {
  const task = getDirectConnectWorkspaceTask(pathname) || "start";
  const params = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch
  );
  for (const aliases of Object.values(QUERY_ALIASES)) {
    for (const alias of aliases) params.delete(alias);
  }
  const sanitized = sanitizeDirectConnectWorkspaceState(state, task);
  if (sanitized.filter !== "all") params.set("filter", sanitized.filter);
  if (sanitized.countyFips) params.set("county", sanitized.countyFips);
  if (sanitized.selectedId) params.set("selected", sanitized.selectedId);
  const query = params.toString();
  const safeHash = hash.startsWith("#") ? hash : hash ? `#${hash}` : "";
  return `${canonicalizeDirectConnectWorkspacePathname(pathname)}${query ? `?${query}` : ""}${safeHash}`;
}

export function updateDirectConnectWorkspaceState(
  current: DirectConnectWorkspaceState,
  patch: Partial<DirectConnectWorkspaceState>,
  task: DirectConnectWorkspaceTask
): DirectConnectWorkspaceState {
  const before = sanitizeDirectConnectWorkspaceState(current, task);
  const after = sanitizeDirectConnectWorkspaceState({ ...before, ...patch }, task);
  if (before.filter !== after.filter || before.countyFips !== after.countyFips) {
    after.selectedId = "";
  }
  return after;
}

export function resolveSelectedDirectConnectWorkspaceItem<T>(
  items: readonly T[],
  selectedId: string,
  getId: (item: T) => unknown = (item) => (item as { id?: unknown })?.id
): T | null {
  const safeId = cleanSelectedId(selectedId);
  if (!safeId) return null;
  return items.find((item) => String(getId(item) ?? "") === safeId) || null;
}

export function shouldInvalidateDirectConnectWorkspaceSelection({
  workspaceHydrated,
  selectedId,
  selectionResolved,
  queryIsSuccess,
  queryIsFetching,
  queryFetchedAfterMount,
}: {
  workspaceHydrated: boolean;
  selectedId: string;
  selectionResolved: boolean;
  queryIsSuccess: boolean;
  queryIsFetching: boolean;
  queryFetchedAfterMount: boolean;
}): boolean {
  return Boolean(
    workspaceHydrated &&
    cleanSelectedId(selectedId) &&
    !selectionResolved &&
    queryIsSuccess &&
    !queryIsFetching &&
    queryFetchedAfterMount
  );
}

export function isRealDirectConnectAssignmentId(value: unknown): boolean {
  const id = cleanSelectedId(value);
  return Boolean(id) && !id.startsWith("request-");
}

export function shouldKeepDirectConnectWorkspaceRequest(
  request: {
    status?: unknown;
    dcLastEventAt?: unknown;
    updatedAt?: unknown;
    createdAt?: unknown;
  },
  now = Date.now()
): boolean {
  const status = cleanSingleLine(request.status, 32).toLowerCase();
  if (status !== "completed" && status !== "cancelled") return true;
  const rawTimestamp = request.dcLastEventAt || request.updatedAt || request.createdAt;
  if (!rawTimestamp) return false;
  const timestamp = new Date(String(rawTimestamp)).getTime();
  return Number.isFinite(timestamp) && now - timestamp <= MAX_CLOSED_REQUEST_AGE_MS;
}
