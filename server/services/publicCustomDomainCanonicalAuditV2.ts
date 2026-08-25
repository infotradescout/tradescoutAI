import {
  runPublicCustomDomainCanonicalAudit,
  type PublicCustomDomainCanonicalAuditResult,
  type PublicCustomDomainCanonicalAuditTarget,
} from "./publicCustomDomainCanonicalAudit";

const DEFAULT_REQUEST_INTERVAL_MS = 225;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CONCURRENCY = 2;
const MAX_RETRY_DELAY_MS = 10_000;

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

type HeadersLike = {
  get: (name: string) => string | null;
};

type FetchResponseLike = {
  status: number;
  url: string;
  headers: HeadersLike;
  text: () => Promise<string>;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<FetchResponseLike>;

type SleepLike = (delayMs: number) => Promise<void>;

export type PublicCustomDomainCanonicalAuditV2Options = {
  queryable?: Queryable;
  fetchImpl?: FetchLike;
  targets?: PublicCustomDomainCanonicalAuditTarget[];
  loadTargets?: () => Promise<PublicCustomDomainCanonicalAuditTarget[]>;
  now?: () => Date;
  timeoutMs?: number;
  concurrency?: number;
  persist?: boolean;
  requestIntervalMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  sleep?: SleepLike;
};

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function configuredRequestIntervalMs(): number {
  return clampInteger(
    process.env.PUBLIC_CUSTOM_DOMAIN_CANONICAL_AUDIT_REQUEST_INTERVAL_MS,
    0,
    5_000,
    DEFAULT_REQUEST_INTERVAL_MS
  );
}

function isRetryableAuditStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryAfterDelayMs(
  response: FetchResponseLike,
  attempt: number,
  retryBaseMs: number
): number {
  const raw = String(response.headers.get("retry-after") || "").trim();
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.round(seconds * 1_000));
    }
    const dateValue = Date.parse(raw);
    if (Number.isFinite(dateValue)) {
      return Math.max(0, Math.min(MAX_RETRY_DELAY_MS, dateValue - Date.now()));
    }
  }
  return Math.min(MAX_RETRY_DELAY_MS, retryBaseMs * 2 ** attempt);
}

/**
 * Spaces the live requests across one shared queue and retries only evidence
 * availability failures. A persistent 429, timeout, or server failure throws,
 * allowing the base audit to record the target as unavailable rather than as a
 * false redirect failure.
 */
export function createThrottledCanonicalAuditFetch(
  options: {
    fetchImpl?: FetchLike;
    requestIntervalMs?: number;
    maxRetries?: number;
    retryBaseMs?: number;
    sleep?: SleepLike;
  } = {}
): FetchLike {
  const sourceFetch =
    options.fetchImpl ||
    ((url: string, init?: RequestInit) => fetch(url, init) as Promise<FetchResponseLike>);
  const requestIntervalMs = clampInteger(
    options.requestIntervalMs,
    0,
    5_000,
    configuredRequestIntervalMs()
  );
  const maxRetries = clampInteger(options.maxRetries, 0, 5, DEFAULT_MAX_RETRIES);
  const retryBaseMs = clampInteger(options.retryBaseMs, 0, 5_000, DEFAULT_RETRY_BASE_MS);
  const sleep: SleepLike =
    options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));

  let queueTail: Promise<void> = Promise.resolve();
  let nextStartAt = 0;

  const waitForRequestSlot = async () => {
    const scheduled = queueTail.then(async () => {
      const delayMs = Math.max(0, nextStartAt - Date.now());
      if (delayMs > 0) await sleep(delayMs);
      nextStartAt = Date.now() + requestIntervalMs;
    });
    queueTail = scheduled.catch(() => undefined);
    await scheduled;
  };

  return async (url, init) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await waitForRequestSlot();
      try {
        const response = await sourceFetch(url, init);
        if (!isRetryableAuditStatus(response.status)) return response;
        lastError = new Error(`Canonical alias audit received HTTP ${response.status} for ${url}`);
        if (attempt >= maxRetries) throw lastError;
        await sleep(retryAfterDelayMs(response, attempt, retryBaseMs));
      } catch (error) {
        lastError = error;
        if (attempt >= maxRetries || init?.signal?.aborted) throw error;
        await sleep(Math.min(MAX_RETRY_DELAY_MS, retryBaseMs * 2 ** attempt));
      }
    }
    throw lastError || new Error(`Canonical alias audit could not evaluate ${url}`);
  };
}

/**
 * Production canonical proof with rate-limit-aware evidence semantics. Wrong
 * redirects and duplicate 200 pages remain failures; unavailable HTTP evidence
 * remains unavailable.
 */
export async function runPublicCustomDomainCanonicalAuditV2(
  options: PublicCustomDomainCanonicalAuditV2Options = {}
): Promise<PublicCustomDomainCanonicalAuditResult> {
  const auditFetch = createThrottledCanonicalAuditFetch({
    fetchImpl: options.fetchImpl,
    requestIntervalMs: options.requestIntervalMs,
    maxRetries: options.maxRetries,
    retryBaseMs: options.retryBaseMs,
    sleep: options.sleep,
  });

  return runPublicCustomDomainCanonicalAudit({
    queryable: options.queryable,
    fetchImpl: auditFetch,
    targets: options.targets,
    loadTargets: options.loadTargets,
    now: options.now,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    persist: options.persist,
  });
}
