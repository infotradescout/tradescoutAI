import { getCountyByFips } from "@shared/states-counties";

export const JOBS_WORKSPACE_CANONICAL_PATH = "/direct-connect/opportunities";

const JOBS_WORKSPACE_STORAGE_PREFIX = "tradescout:jobs-workspace:v1:";
const MAX_STORED_WORKSPACE_LENGTH = 4_096;

export type JobsWorkspaceMode = "job" | "resume";

export type JobsWorkspaceState = {
  mode: JobsWorkspaceMode;
  searchQuery: string;
  tradeSlug: string;
  stateCode: string;
  countyFips: string;
  selectedPostId: string;
};

type WorkspaceField = keyof JobsWorkspaceState;

type ParsedJobsWorkspaceRoute = {
  values: JobsWorkspaceState;
  explicit: Record<WorkspaceField, boolean>;
};

const EMPTY_JOBS_WORKSPACE_STATE: JobsWorkspaceState = {
  mode: "job",
  searchQuery: "",
  tradeSlug: "",
  stateCode: "",
  countyFips: "",
  selectedPostId: "",
};

const WORKSPACE_QUERY_ALIASES = {
  mode: ["mode", "tab", "type"],
  searchQuery: ["q", "query", "search"],
  tradeSlug: ["trade", "tradeId"],
  stateCode: ["state", "stateCode"],
  countyFips: ["county", "countyFips"],
  selectedPostId: ["selected", "postId", "employmentPostId"],
} as const satisfies Record<WorkspaceField, readonly string[]>;

const FILTER_FIELDS = [
  "mode",
  "searchQuery",
  "tradeSlug",
  "stateCode",
  "countyFips",
] as const satisfies readonly WorkspaceField[];

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

function cleanMode(value: unknown): JobsWorkspaceMode {
  const candidate = cleanSingleLine(value, 16).toLowerCase();
  if (["resume", "resumes"].includes(candidate)) return "resume";
  return "job";
}

function cleanSearchQuery(value: unknown): string {
  return cleanSingleLine(value, 160);
}

function cleanTradeSlug(value: unknown): string {
  const candidate = cleanSingleLine(value, 80).toLowerCase();
  return /^[a-z0-9][a-z0-9_-]*$/.test(candidate) ? candidate : "";
}

function cleanStateCode(value: unknown): string {
  const candidate = cleanSingleLine(value, 8).toUpperCase();
  return /^[A-Z]{2}$/.test(candidate) ? candidate : "";
}

function cleanCountyFips(value: unknown): string {
  const candidate = cleanSingleLine(value, 16);
  return /^\d{5}$/.test(candidate) ? candidate : "";
}

function cleanPostId(value: unknown): string {
  return cleanSingleLine(value, 120);
}

export function sanitizeJobsWorkspaceState(input: unknown): JobsWorkspaceState {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    mode: cleanMode(source.mode),
    searchQuery: cleanSearchQuery(source.searchQuery),
    tradeSlug: cleanTradeSlug(source.tradeSlug),
    stateCode: cleanStateCode(source.stateCode),
    countyFips: cleanCountyFips(source.countyFips),
    selectedPostId: cleanPostId(source.selectedPostId),
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

export function parseJobsWorkspaceRoute(search: string): ParsedJobsWorkspaceRoute {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const values = Object.fromEntries(
    Object.entries(WORKSPACE_QUERY_ALIASES).map(([field, aliases]) => [
      field,
      readFirstQueryValue(params, aliases),
    ])
  ) as Record<WorkspaceField, { explicit: boolean; value: string }>;

  return {
    values: sanitizeJobsWorkspaceState({
      mode: values.mode.value,
      searchQuery: values.searchQuery.value,
      tradeSlug: values.tradeSlug.value,
      stateCode: values.stateCode.value,
      countyFips: values.countyFips.value,
      selectedPostId: values.selectedPostId.value,
    }),
    explicit: {
      mode: values.mode.explicit,
      searchQuery: values.searchQuery.explicit,
      tradeSlug: values.tradeSlug.explicit,
      stateCode: values.stateCode.explicit,
      countyFips: values.countyFips.explicit,
      selectedPostId: values.selectedPostId.explicit,
    },
  };
}

export function canonicalizeJobsWorkspacePathname(pathname: string): string {
  const cleanPath = cleanSingleLine(pathname.split("?")[0].split("#")[0], 240);
  const withoutTrailingSlash = cleanPath.length > 1 ? cleanPath.replace(/\/+$/, "") : cleanPath;
  if (
    withoutTrailingSlash === "/direct-connect/employment" ||
    withoutTrailingSlash === JOBS_WORKSPACE_CANONICAL_PATH
  ) {
    return JOBS_WORKSPACE_CANONICAL_PATH;
  }
  return withoutTrailingSlash.startsWith("/")
    ? withoutTrailingSlash
    : JOBS_WORKSPACE_CANONICAL_PATH;
}

export function getJobsWorkspaceStorageKey(
  authenticatedUserId: string | null | undefined,
  pathname: string
): string | null {
  const userId = cleanSingleLine(authenticatedUserId, 160);
  if (!userId) return null;
  const canonicalPathname = canonicalizeJobsWorkspacePathname(pathname);
  return `${JOBS_WORKSPACE_STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(canonicalPathname)}`;
}

function readStoredJobsWorkspaceState(
  storage: Storage | null,
  storageKey: string | null
): JobsWorkspaceState {
  if (!storage || !storageKey) return { ...EMPTY_JOBS_WORKSPACE_STATE };

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { ...EMPTY_JOBS_WORKSPACE_STATE };
    if (raw.length > MAX_STORED_WORKSPACE_LENGTH) {
      storage.removeItem(storageKey);
      return { ...EMPTY_JOBS_WORKSPACE_STATE };
    }
    return sanitizeJobsWorkspaceState(JSON.parse(raw));
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      // Storage continuity is optional and must never block the workspace.
    }
    return { ...EMPTY_JOBS_WORKSPACE_STATE };
  }
}

export function resolveJobsWorkspaceState({
  search,
  storage,
  authenticatedUserId,
  pathname,
  defaultStateCode,
  defaultCountyFips,
}: {
  search: string;
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
  defaultStateCode?: string | null;
  defaultCountyFips?: string | null;
}): JobsWorkspaceState {
  const route = parseJobsWorkspaceRoute(search);
  const stored = readStoredJobsWorkspaceState(
    storage,
    getJobsWorkspaceStorageKey(authenticatedUserId, pathname)
  );

  const resolved: JobsWorkspaceState = {
    mode: route.explicit.mode ? route.values.mode : stored.mode,
    searchQuery: route.explicit.searchQuery ? route.values.searchQuery : stored.searchQuery,
    tradeSlug: route.explicit.tradeSlug ? route.values.tradeSlug : stored.tradeSlug,
    stateCode: route.explicit.stateCode ? route.values.stateCode : stored.stateCode,
    countyFips: route.explicit.countyFips ? route.values.countyFips : stored.countyFips,
    selectedPostId: "",
  };

  if (
    route.explicit.stateCode &&
    !route.explicit.countyFips &&
    route.values.stateCode !== stored.stateCode
  ) {
    resolved.countyFips = "";
  }

  if (!resolved.stateCode && !route.explicit.stateCode) {
    resolved.stateCode = cleanStateCode(defaultStateCode);
  }
  if (
    !resolved.countyFips &&
    !route.explicit.countyFips &&
    (!resolved.stateCode || resolved.stateCode === cleanStateCode(defaultStateCode))
  ) {
    resolved.countyFips = cleanCountyFips(defaultCountyFips);
  }

  if (resolved.countyFips) {
    const resolvedCounty = getCountyByFips(resolved.countyFips);
    if (!resolvedCounty) {
      resolved.countyFips = "";
    } else if (route.explicit.countyFips && !route.explicit.stateCode) {
      // A copied county-only URL is authoritative; derive its state instead of
      // pairing it with an unrelated state restored from the current account.
      resolved.stateCode = resolvedCounty.state;
    } else if (!resolved.stateCode) {
      resolved.stateCode = resolvedCounty.state;
    } else if (resolved.stateCode !== resolvedCounty.state) {
      // An explicit or stored state wins, but a county from another state does not.
      resolved.countyFips = "";
    }
  }

  const storedContextStillMatches = FILTER_FIELDS.every(
    (field) => resolved[field] === stored[field]
  );
  resolved.selectedPostId = route.explicit.selectedPostId
    ? route.values.selectedPostId
    : storedContextStillMatches
      ? stored.selectedPostId
      : "";

  return sanitizeJobsWorkspaceState(resolved);
}

export function resolveJobsWorkspaceScopeHydration({
  restoredState,
  previousScope,
  currentScope,
}: {
  restoredState: JobsWorkspaceState;
  previousScope: string;
  currentScope: string;
}): JobsWorkspaceState {
  const restored = sanitizeJobsWorkspaceState(restoredState);
  if (previousScope && previousScope !== currentScope) {
    return { ...restored, selectedPostId: "" };
  }
  return restored;
}

export function writeJobsWorkspaceState({
  storage,
  authenticatedUserId,
  pathname,
  state,
}: {
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
  state: JobsWorkspaceState;
}): void {
  const storageKey = getJobsWorkspaceStorageKey(authenticatedUserId, pathname);
  if (!storage || !storageKey) return;
  try {
    storage.setItem(storageKey, JSON.stringify(sanitizeJobsWorkspaceState(state)));
  } catch {
    // URL state remains available when session storage is blocked.
  }
}

export function clearJobsWorkspaceState({
  storage,
  authenticatedUserId,
  pathname,
}: {
  storage: Storage | null;
  authenticatedUserId: string | null | undefined;
  pathname: string;
}): void {
  const storageKey = getJobsWorkspaceStorageKey(authenticatedUserId, pathname);
  if (!storage || !storageKey) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // The in-memory controls and canonical URL still clear.
  }
}

export function buildCanonicalJobsWorkspaceHref({
  pathname,
  currentSearch,
  hash = "",
  state,
}: {
  pathname: string;
  currentSearch: string;
  hash?: string;
  state: JobsWorkspaceState;
}): string {
  const params = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch
  );
  for (const aliases of Object.values(WORKSPACE_QUERY_ALIASES)) {
    for (const alias of aliases) params.delete(alias);
  }

  const sanitized = sanitizeJobsWorkspaceState(state);
  params.set("mode", sanitized.mode);
  if (sanitized.searchQuery) params.set("q", sanitized.searchQuery);
  if (sanitized.tradeSlug) params.set("trade", sanitized.tradeSlug);
  if (sanitized.stateCode) params.set("state", sanitized.stateCode);
  if (sanitized.countyFips) params.set("county", sanitized.countyFips);
  if (sanitized.selectedPostId) params.set("selected", sanitized.selectedPostId);

  const query = params.toString();
  const safeHash = hash.startsWith("#") ? hash : hash ? `#${hash}` : "";
  return `${canonicalizeJobsWorkspacePathname(pathname)}${query ? `?${query}` : ""}${safeHash}`;
}

export function updateJobsWorkspaceState(
  current: JobsWorkspaceState,
  patch: Partial<JobsWorkspaceState>
): JobsWorkspaceState {
  const before = sanitizeJobsWorkspaceState(current);
  const after = sanitizeJobsWorkspaceState({ ...before, ...patch });
  if (after.stateCode && after.countyFips) {
    const county = getCountyByFips(after.countyFips);
    if (!county || county.state !== after.stateCode) after.countyFips = "";
  }
  const filtersChanged = FILTER_FIELDS.some((field) => before[field] !== after[field]);
  if (filtersChanged) after.selectedPostId = "";
  return after;
}

export function resolveJobsWorkspaceStateChange(
  current: JobsWorkspaceState,
  stateCode: string
): JobsWorkspaceState {
  return updateJobsWorkspaceState(current, {
    stateCode,
    countyFips: "",
  });
}

export function createClearedJobsWorkspaceState(mode: JobsWorkspaceMode): JobsWorkspaceState {
  return { ...EMPTY_JOBS_WORKSPACE_STATE, mode: cleanMode(mode) };
}

export function resolveSelectedJobsWorkspacePost<T extends { id?: unknown }>(
  posts: readonly T[],
  selectedPostId: string
): T | null {
  const selectedId = cleanPostId(selectedPostId);
  if (!selectedId) return null;
  return posts.find((post) => String(post?.id ?? "") === selectedId) || null;
}

export type JobsInspectorLifecycle = {
  isOpen: boolean;
  isClosed: boolean;
  isApplicationStateLoading: boolean;
  hasApplicationStateError: boolean;
  showApplicants: boolean;
  showClose: boolean;
  showApply: boolean;
  showApplicationStatus: boolean;
  showStartReply: boolean;
};

export function resolveJobsInspectorLifecycle({
  postType,
  status,
  isOwner,
  applicationStatus,
  applicationLookupState = "ready",
}: {
  postType: unknown;
  status: unknown;
  isOwner: unknown;
  applicationStatus?: unknown;
  applicationLookupState?: "ready" | "loading" | "error";
}): JobsInspectorLifecycle {
  const normalizedType = cleanMode(postType);
  const normalizedStatus = cleanSingleLine(status, 24).toLowerCase();
  const owner = Boolean(isOwner);
  const hasApplication = Boolean(cleanSingleLine(applicationStatus, 40));
  const isOpen = normalizedStatus === "open";
  const isClosed = normalizedStatus === "closed";
  const applicationStateReady = applicationLookupState === "ready";

  return {
    isOpen,
    isClosed,
    isApplicationStateLoading: applicationLookupState === "loading",
    hasApplicationStateError: applicationLookupState === "error",
    showApplicants: owner,
    showClose: owner && isOpen,
    showApply:
      !owner && normalizedType === "job" && isOpen && applicationStateReady && !hasApplication,
    showApplicationStatus:
      !owner && normalizedType === "job" && applicationStateReady && hasApplication,
    showStartReply: !owner && normalizedType === "resume" && isOpen,
  };
}

export function formatJobsPay({
  payMin,
  payMax,
  payUnit,
}: {
  payMin?: string | number | null;
  payMax?: string | number | null;
  payUnit?: string | null;
}): string | null {
  const unit = cleanSingleLine(payUnit, 20).toLowerCase();
  const min = payMin == null ? null : Number(payMin);
  const max = payMax == null ? null : Number(payMax);
  if (!Number.isFinite(min as number) && !Number.isFinite(max as number)) return null;

  const formatValue = (value: number) =>
    unit === "year" && Math.abs(value) >= 1_000
      ? `$${Math.round(value).toLocaleString("en-US")}`
      : `$${value}`;
  const suffix = unit === "hour" ? "/hr" : unit === "month" ? "/mo" : unit === "year" ? "/yr" : "";

  if (Number.isFinite(min as number) && Number.isFinite(max as number)) {
    if (min === max) return `${formatValue(min as number)}${suffix}`;
    return `${formatValue(min as number)} – ${formatValue(max as number)}${suffix}`;
  }
  if (Number.isFinite(min as number)) return `${formatValue(min as number)}${suffix}`;
  return `${formatValue(max as number)}${suffix}`;
}
