import { BoundedTaskQueue } from "../utils/boundedTaskQueue";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const CANONICAL_ORIGIN = "https://www.thetradescout.com";
const DEFAULT_INDEXNOW_KEY = "c41a532d2d0f4e5ca37a53bd3d138495";
const MAX_URLS_PER_REQUEST = 10_000;
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;
const PRIVATE_PATH_PREFIXES = [
  "/api",
  "/admin",
  "/dashboard",
  "/messages",
  "/settings",
  "/auth",
  "/scout",
];

type FetchLike = typeof fetch;

export type IndexNowSubmissionResult = {
  status: "submitted" | "disabled" | "empty";
  submittedUrlCount: number;
};

function configuredKey(): string {
  return String(
    process.env.INDEXNOW_KEY || process.env.BING_INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY
  ).trim();
}

export function normalizeIndexNowUrls(urls: Iterable<string>): string[] {
  const unique = new Set<string>();

  for (const value of urls) {
    if (unique.size >= MAX_URLS_PER_REQUEST) break;
    try {
      const url = new URL(String(value || "").trim(), CANONICAL_ORIGIN);
      if (url.origin !== CANONICAL_ORIGIN) continue;
      if (
        PRIVATE_PATH_PREFIXES.some(
          (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
        )
      ) {
        continue;
      }
      url.hash = "";
      unique.add(url.toString());
    } catch {
      // Ignore malformed publication events rather than failing the whole batch.
    }
  }

  return [...unique];
}

export async function submitIndexNowUrls(
  urls: Iterable<string>,
  options: { fetchImpl?: FetchLike; key?: string } = {}
): Promise<IndexNowSubmissionResult> {
  const key = String(options.key ?? configuredKey()).trim();
  if (!KEY_PATTERN.test(key)) {
    return { status: "disabled", submittedUrlCount: 0 };
  }

  const urlList = normalizeIndexNowUrls(urls);
  if (urlList.length === 0) {
    return { status: "empty", submittedUrlCount: 0 };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: "www.thetradescout.com",
      key,
      keyLocation: `${CANONICAL_ORIGIN}/indexnow-key.txt`,
      urlList,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok && response.status !== 202) {
    throw new Error(`IndexNow submission failed with HTTP ${response.status}`);
  }

  return { status: "submitted", submittedUrlCount: urlList.length };
}

const indexNowQueue = new BoundedTaskQueue({
  maxConcurrent: 1,
  maxOutstanding: 100,
  maxRetries: 2,
  baseBackoffMs: 500,
  maxBackoffMs: 2_000,
  shouldRetry: (error) => /HTTP (?:429|5\d\d)\b/.test(String((error as Error)?.message || error)),
  onFinalError: (error) => {
    console.warn("[IndexNow] Publication notification failed:", error);
  },
});

export function notifyIndexNow(urls: Iterable<string>): boolean {
  const urlList = normalizeIndexNowUrls(urls);
  if (urlList.length === 0 || !KEY_PATTERN.test(configuredKey())) return false;
  return indexNowQueue.enqueue(async () => {
    await submitIndexNowUrls(urlList);
  });
}

export function getIndexNowQueueStatus() {
  return indexNowQueue.snapshot();
}

let reconciliationScheduled = false;
let productionAuditScheduled = false;

/**
 * Starts one non-blocking reconciliation after the production server has had
 * time to finish database setup and profile provisioning. The reconciliation
 * itself persists an exact graph fingerprint, so unchanged deployments do not
 * resubmit the same URLs.
 */
export function schedulePublicProfileIndexNowReconciliation(): boolean {
  if (reconciliationScheduled) return false;
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.INDEXNOW_PROFILE_RECONCILIATION_DISABLED === "true") return false;

  reconciliationScheduled = true;
  const requestedDelay = Number(process.env.INDEXNOW_PROFILE_RECONCILIATION_DELAY_MS || 20_000);
  const delayMs = Number.isFinite(requestedDelay)
    ? Math.max(1_000, Math.min(300_000, requestedDelay))
    : 20_000;
  const timer = setTimeout(() => {
    void import("./publicProfileIndexNowReconciliation")
      .then(({ reconcilePublicProfileIndexNow }) => reconcilePublicProfileIndexNow())
      .then((result) => {
        console.log(
          `[IndexNow] Public profile reconciliation ${result.status}: ${result.submittedUrlCount}/${result.urlCount} URL(s), ${result.profileCount} profile(s), ${result.batchCount} batch(es).`
        );
      })
      .catch((error) => {
        console.warn("[IndexNow] Public profile reconciliation failed; a later deploy will retry:", error);
      });
  }, delayMs);
  timer.unref?.();
  return true;
}

/**
 * Audits the actual deployed profile graph after startup. This is intentionally
 * independent from IndexNow: disabling notifications must never disable live
 * HTTP and HTML verification.
 */
export function schedulePublicProfileProductionAudit(): boolean {
  if (productionAuditScheduled) return false;
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.PUBLIC_PROFILE_PRODUCTION_AUDIT_DISABLED === "true") return false;

  productionAuditScheduled = true;
  const requestedDelay = Number(process.env.PUBLIC_PROFILE_PRODUCTION_AUDIT_DELAY_MS || 45_000);
  const delayMs = Number.isFinite(requestedDelay)
    ? Math.max(5_000, Math.min(600_000, requestedDelay))
    : 45_000;
  const timer = setTimeout(() => {
    void import("./publicProfileProductionAudit")
      .then(({ runPublicProfileProductionAudit }) => runPublicProfileProductionAudit())
      .then((result) => {
        console.log(
          `[ProfileAudit] Production graph ${result.status}: ${result.verifiedCount} verified, ${result.failedCount} failed, ${result.unavailableCount} unavailable across ${result.urlCount} URL(s) and ${result.profileCount} profile(s).`
        );
      })
      .catch((error) => {
        console.warn(
          "[ProfileAudit] Production graph audit failed; a later deploy will retry:",
          error
        );
      });
  }, delayMs);
  timer.unref?.();
  return true;
}

schedulePublicProfileIndexNowReconciliation();
schedulePublicProfileProductionAudit();