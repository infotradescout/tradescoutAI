import { createHash } from "node:crypto";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import { pool } from "../db";
import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";
import { SitemapRepository } from "../repositories/sitemapRepository";
import { storage } from "../storage";
import type { IndexNowSubmissionResult } from "./indexNowService";

const CANONICAL_ORIGIN = "https://www.thetradescout.com";
const RECONCILIATION_EVENT_TYPE = "indexnow_public_profile_reconciliation";
const INDEXNOW_BATCH_SIZE = 10_000;

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

export type PublicProfileIndexNowCandidate = {
  slug?: unknown;
  status?: unknown;
  contentBlocks?: unknown;
  seoMeta?: unknown;
};

export type PublicProfileIndexNowReconciliationResult = {
  status: "submitted" | "skipped" | "disabled" | "empty";
  profileCount: number;
  urlCount: number;
  submittedUrlCount: number;
  fingerprint: string | null;
  batchCount: number;
};

type ReconciliationOptions = {
  candidates?: PublicProfileIndexNowCandidate[];
  loadCandidates?: () => Promise<PublicProfileIndexNowCandidate[]>;
  queryable?: Queryable;
  submit?: (urls: Iterable<string>) => Promise<IndexNowSubmissionResult>;
  now?: () => Date;
};

function profileSeoMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canonicalProfileUrl(slug: string): string {
  return `${CANONICAL_ORIGIN}/u/${encodeURIComponent(slug)}`;
}

function normalizeGeneratedProfileUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || "").trim(), CANONICAL_ORIGIN);
    if (url.origin !== CANONICAL_ORIGIN) return null;
    if (!url.pathname.startsWith("/u/")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function profileSlugFromCanonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/u\/([^/]+)/);
    if (!match?.[1]) return null;
    return decodeURIComponent(match[1]).trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Builds the exact platform-host URL set owned by the current profile graph.
 * Custom-domain profiles remain on their own host and are not claimed through
 * TradeScout's IndexNow key. Direct-only and otherwise non-indexable profiles
 * are excluded even if a repository compatibility read happens to return them.
 */
export function collectPublicProfileIndexNowReconciliationUrls(
  candidates: PublicProfileIndexNowCandidate[]
): string[] {
  const urls = new Set<string>();

  for (const candidate of candidates) {
    const slug = String(candidate?.slug || "")
      .trim()
      .toLowerCase();
    if (!slug || !shouldIndexPublicProfileSlug(slug)) continue;
    if (candidate.status != null && String(candidate.status).trim() !== "published") continue;

    const seoMeta = profileSeoMeta(candidate.seoMeta);
    if (String(seoMeta.customDomain || "").trim()) continue;

    const profileUrl = canonicalProfileUrl(slug);
    const root = normalizeGeneratedProfileUrl(profileUrl);
    if (root) urls.add(root);

    for (const childUrl of buildProfileSitemapUrls({
      profileSlug: slug,
      profileUrl,
      contentBlocks: candidate.contentBlocks,
    })) {
      const normalized = normalizeGeneratedProfileUrl(childUrl);
      if (normalized) urls.add(normalized);
    }
  }

  return [...urls].sort();
}

export function fingerprintPublicProfileIndexNowUrls(urls: Iterable<string>): string | null {
  const normalized = [...new Set([...urls].map((value) => String(value || "").trim()).filter(Boolean))]
    .sort();
  if (normalized.length === 0) return null;
  return createHash("sha256").update(normalized.join("\n")).digest("hex");
}

async function loadCurrentCandidates(): Promise<PublicProfileIndexNowCandidate[]> {
  const targets = await new SitemapRepository().listPublicProfilesForSitemap();
  const profiles = await Promise.all(
    targets.map(async ({ slug }): Promise<PublicProfileIndexNowCandidate | null> => {
      const profile = await storage.getProfileBySlugPublic(slug);
      return profile
        ? {
            slug: profile.slug,
            status: "published",
            contentBlocks: profile.contentBlocks,
            seoMeta: profile.seoMeta,
          }
        : null;
    })
  );
  return profiles.filter((profile): profile is PublicProfileIndexNowCandidate => Boolean(profile));
}

async function recordReconciliation(args: {
  queryable: Queryable;
  fingerprint: string;
  status: PublicProfileIndexNowReconciliationResult["status"];
  profileCount: number;
  urlCount: number;
  submittedUrlCount: number;
  batchCount: number;
  occurredAt: Date;
  detail?: string;
}) {
  await args.queryable.query(
    `insert into events (event_type, data)
     values ($1, $2::jsonb)`,
    [
      RECONCILIATION_EVENT_TYPE,
      JSON.stringify({
        fingerprint: args.fingerprint,
        status: args.status,
        profileCount: args.profileCount,
        urlCount: args.urlCount,
        submittedUrlCount: args.submittedUrlCount,
        batchCount: args.batchCount,
        occurredAt: args.occurredAt.toISOString(),
        evidenceBoundary:
          "IndexNow is a change notification. It is not proof of indexing, ranking, traffic, or requests.",
        ...(args.detail ? { detail: args.detail } : {}),
      }),
    ]
  );
}

/**
 * Reconciles existing public profiles once per exact URL graph. The persisted
 * fingerprint prevents unchanged deployments from resubmitting the same graph,
 * while a new profile, child page, route, or publication decision creates a new
 * fingerprint and therefore a new submission automatically.
 */
export async function reconcilePublicProfileIndexNow(
  options: ReconciliationOptions = {}
): Promise<PublicProfileIndexNowReconciliationResult> {
  const queryable = options.queryable || pool;
  const candidates = options.candidates || (await (options.loadCandidates || loadCurrentCandidates)());
  const urls = collectPublicProfileIndexNowReconciliationUrls(candidates);
  const fingerprint = fingerprintPublicProfileIndexNowUrls(urls);
  const profileCount = new Set(
    urls.map(profileSlugFromCanonicalUrl).filter((slug): slug is string => Boolean(slug))
  ).size;

  if (!fingerprint || urls.length === 0) {
    return {
      status: "empty",
      profileCount,
      urlCount: 0,
      submittedUrlCount: 0,
      fingerprint: null,
      batchCount: 0,
    };
  }

  const existing = await queryable.query(
    `select 1
       from events
      where event_type = $1
        and data->>'fingerprint' = $2
        and data->>'status' = 'submitted'
      limit 1`,
    [RECONCILIATION_EVENT_TYPE, fingerprint]
  );
  if (existing.rows.length > 0) {
    return {
      status: "skipped",
      profileCount,
      urlCount: urls.length,
      submittedUrlCount: 0,
      fingerprint,
      batchCount: 0,
    };
  }

  const submit =
    options.submit ||
    (async (batch: Iterable<string>) => {
      const module = await import("./indexNowService");
      return module.submitIndexNowUrls(batch);
    });
  let submittedUrlCount = 0;
  let batchCount = 0;

  for (let offset = 0; offset < urls.length; offset += INDEXNOW_BATCH_SIZE) {
    const batch = urls.slice(offset, offset + INDEXNOW_BATCH_SIZE);
    const result = await submit(batch);
    if (result.status === "disabled") {
      await recordReconciliation({
        queryable,
        fingerprint,
        status: "disabled",
        profileCount,
        urlCount: urls.length,
        submittedUrlCount,
        batchCount,
        occurredAt: (options.now || (() => new Date()))(),
        detail: "IndexNow key configuration is unavailable; the graph will be retried later.",
      });
      return {
        status: "disabled",
        profileCount,
        urlCount: urls.length,
        submittedUrlCount,
        fingerprint,
        batchCount,
      };
    }
    submittedUrlCount += result.submittedUrlCount;
    batchCount += 1;
  }

  const now = (options.now || (() => new Date()))();
  await recordReconciliation({
    queryable,
    fingerprint,
    status: "submitted",
    profileCount,
    urlCount: urls.length,
    submittedUrlCount,
    batchCount,
    occurredAt: now,
  });

  return {
    status: "submitted",
    profileCount,
    urlCount: urls.length,
    submittedUrlCount,
    fingerprint,
    batchCount,
  };
}
