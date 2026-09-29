import {
  buildMigrationManifest,
  migrationSha256,
  normalizeMigrationUrl,
  type MigrationCoverage,
  type MigrationManifestInput,
  type MigrationPlanRef,
  type NormalizedMigrationPage,
} from "./siteMigrationManifest";

/** The caller must obtain this snapshot through the owner-scoped presence service. */
export type ReviewedMigrationPlanSnapshot = {
  id: string;
  businessId: string;
  profileId: string;
  revision: number;
  evidenceDigest: string;
  planHash: string;
  status: string;
  selectedSitePath: string | null;
};

export type MigrationShadowPageInput = {
  sourceUrl: string;
  previewUrl: string;
  observedAt: string;
  access: "private" | "public" | "unknown";
  metaRobots: readonly string[];
  xRobotsTag: readonly string[];
  inSitemap: boolean | null;
};

export type MigrationShadowInput = {
  planRef: MigrationPlanRef;
  previewOrigin: string;
  declaredPageCount: number | null;
  truncated: boolean;
  pages: readonly MigrationShadowPageInput[];
};

export type MigrationParityInput = {
  plan: ReviewedMigrationPlanSnapshot;
  legacy: MigrationManifestInput;
  predictedLive: MigrationManifestInput;
  shadow: MigrationShadowInput;
};

export type MigrationFinding = {
  code: string;
  severity: "blocking" | "advisory";
  /** Private URL identity only; never leak query values in the report. */
  urlKeySha256: string | null;
};

export type MigrationParityAssessment = {
  scope: "url_metadata_schema_indexability_assessment_only";
  planBinding: {
    planId: string;
    businessId: string;
    profileId: string;
    revision: number;
    evidenceDigest: string;
    planHash: string;
    selectedSitePath: "preserve_migrate";
  };
  manifestSha256: { legacy: string; predictedLive: string; shadow: string };
  coverage: {
    legacy: MigrationCoverage;
    predictedLive: MigrationCoverage;
    shadow: {
      declaredPageCount: number | null;
      observedPageCount: number;
      complete: boolean;
      truncated: boolean;
    };
  };
  parity: {
    status: "blocked";
    reasons: readonly string[];
    blockingCount: number;
    advisoryCount: number;
    findings: readonly MigrationFinding[];
    findingsTruncated: boolean;
  };
  shadowSafety: {
    status: "blocked" | "supplied_evidence_safe";
    reasons: readonly string[];
    examinedPageCount: number;
  };
  unassessed: readonly [
    "body_content_fidelity",
    "visual_fidelity",
    "functional_fidelity",
    "live_dns_tls",
  ];
  assessmentOnly: true;
  externalWriteAuthorized: false;
  cutoverEligible: false;
  assessmentSha256: string;
};

export class MigrationParityInputError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MigrationParityInputError";
  }
}

const MAX_FINDINGS = 2_048;

function validDigest(value: string): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function validatePlan(plan: ReviewedMigrationPlanSnapshot) {
  if (
    !plan ||
    !plan.id ||
    plan.id.length > 200 ||
    !plan.businessId ||
    plan.businessId.length > 200 ||
    !plan.profileId ||
    plan.profileId.length > 200 ||
    !Number.isSafeInteger(plan.revision) ||
    plan.revision < 1 ||
    !validDigest(plan.evidenceDigest) ||
    !validDigest(plan.planHash)
  ) {
    throw new MigrationParityInputError(
      "INVALID_PLAN_BINDING",
      "A reviewed plan identity is required"
    );
  }
  if (plan.status !== "site_path_selected" || plan.selectedSitePath !== "preserve_migrate") {
    throw new MigrationParityInputError(
      "MIGRATION_PATH_NOT_SELECTED",
      "Only an owned reviewed preserve_migrate plan can be assessed"
    );
  }
  return {
    planId: plan.id,
    businessId: plan.businessId,
    profileId: plan.profileId,
    revision: plan.revision,
    evidenceDigest: plan.evidenceDigest.toLowerCase(),
    planHash: plan.planHash.toLowerCase(),
    selectedSitePath: "preserve_migrate" as const,
  };
}

function samePlanRef(
  ref: MigrationPlanRef | undefined,
  binding: ReturnType<typeof validatePlan>
): boolean {
  if (!ref) return false;
  return (
    ref.planId === binding.planId &&
    ref.revision === binding.revision &&
    ref.evidenceDigest?.toLowerCase() === binding.evidenceDigest &&
    ref.planHash?.toLowerCase() === binding.planHash
  );
}

function normalizedDirectives(values: readonly string[]): string[] {
  if (
    !Array.isArray(values) ||
    values.length > 32 ||
    values.some((value) => typeof value !== "string" || value.length > 200)
  ) {
    throw new MigrationParityInputError(
      "INVALID_SHADOW",
      "Shadow robots directives must be bounded strings"
    );
  }
  return values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function safeShadow(
  input: MigrationShadowInput,
  legacyUrls: Set<string>,
  liveOrigins: readonly string[]
) {
  if (!input || !Array.isArray(input.pages) || input.pages.length > 4_096) {
    throw new MigrationParityInputError("INVALID_SHADOW", "Shadow page observations exceed bounds");
  }
  if (
    input.declaredPageCount !== null &&
    (!Number.isSafeInteger(input.declaredPageCount) || input.declaredPageCount < 0)
  ) {
    throw new MigrationParityInputError("INVALID_SHADOW", "Shadow page count is invalid");
  }
  if (typeof input.truncated !== "boolean") {
    throw new MigrationParityInputError("INVALID_SHADOW", "Shadow truncation flag is required");
  }
  const normalizedPreview = normalizeMigrationUrl(input.previewOrigin);
  const preview = new URL(normalizedPreview);
  if (preview.pathname !== "/" || preview.search) {
    throw new MigrationParityInputError(
      "INVALID_SHADOW",
      "Preview origin must not contain a path or query"
    );
  }
  const reasons = new Set<string>();
  if (liveOrigins.includes(preview.origin)) reasons.add("SHADOW_ORIGIN_EQUALS_LIVE");
  const seen = new Set<string>();
  const normalizedPages: Array<Record<string, unknown>> = [];
  for (const page of input.pages) {
    const sourceUrl = normalizeMigrationUrl(page.sourceUrl);
    const previewUrl = normalizeMigrationUrl(page.previewUrl);
    const observedAt =
      typeof page.observedAt === "string" && page.observedAt.length <= 50
        ? Date.parse(page.observedAt)
        : NaN;
    if (
      !Number.isFinite(observedAt) ||
      new URL(previewUrl).origin !== preview.origin ||
      !legacyUrls.has(sourceUrl)
    ) {
      reasons.add("SHADOW_MAPPING_INVALID");
    }
    if (seen.has(sourceUrl)) reasons.add("SHADOW_MAPPING_DUPLICATE");
    seen.add(sourceUrl);
    if (page.access !== "private") reasons.add("SHADOW_NOT_PRIVATE");
    const metaRobots = normalizedDirectives(page.metaRobots);
    const xRobotsTag = normalizedDirectives(page.xRobotsTag);
    const directives = [...metaRobots, ...xRobotsTag];
    normalizedPages.push({
      sourceUrl,
      previewUrl,
      observedAt: page.observedAt,
      access: page.access,
      metaRobots,
      xRobotsTag,
      inSitemap: page.inSitemap,
    });
    if (!directives.some((directive) => directive.split(/[\s,]+/).includes("noindex"))) {
      reasons.add("SHADOW_NOINDEX_UNPROVED");
    }
    if (page.inSitemap !== false) reasons.add("SHADOW_SITEMAP_EXPOSURE_UNKNOWN");
  }
  if (
    input.truncated ||
    input.declaredPageCount !== input.pages.length ||
    input.pages.length !== legacyUrls.size ||
    input.pages.length === 0
  ) {
    reasons.add("SHADOW_COVERAGE_INCOMPLETE");
  }
  normalizedPages.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    sha256: migrationSha256(
      JSON.stringify({
        previewOrigin: preview.origin,
        declaredPageCount: input.declaredPageCount,
        truncated: input.truncated,
        pages: normalizedPages,
      })
    ),
    coverage: {
      declaredPageCount: input.declaredPageCount,
      observedPageCount: input.pages.length,
      complete: reasons.size === 0,
      truncated: input.truncated,
    },
    result: {
      status: (reasons.size ? "blocked" : "supplied_evidence_safe") as
        | "blocked"
        | "supplied_evidence_safe",
      reasons: [...reasons].sort(),
      examinedPageCount: input.pages.length,
    },
  };
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function observed(
  page: NormalizedMigrationPage | undefined
): page is Extract<NormalizedMigrationPage, { state: "observed" }> {
  return page?.state === "observed";
}

/**
 * Compares a bounded set of caller-supplied observations. No result can
 * authorize DNS, publication, provider writes, or a 1:1 migration claim.
 */
export function assessSiteMigrationParity(input: MigrationParityInput): MigrationParityAssessment {
  const planBinding = validatePlan(input.plan);
  if (
    !samePlanRef(input.legacy?.planRef, planBinding) ||
    !samePlanRef(input.predictedLive?.planRef, planBinding) ||
    !samePlanRef(input.shadow?.planRef, planBinding)
  ) {
    throw new MigrationParityInputError(
      "STALE_PLAN_BINDING",
      "All observations must match the reviewed plan revision and hashes"
    );
  }
  const legacy = buildMigrationManifest(input.legacy);
  const predictedLive = buildMigrationManifest(input.predictedLive);
  if (legacy.side !== "legacy_live" || predictedLive.side !== "predicted_live") {
    throw new MigrationParityInputError("INVALID_SIDES", "Legacy and predicted sides are required");
  }
  const findings: MigrationFinding[] = [];
  const reasons = new Set<string>([
    "ASSESSMENT_ONLY",
    "BODY_CONTENT_FIDELITY_UNASSESSED",
    "LIVE_CUTOVER_UNOBSERVED",
  ]);
  const add = (code: string, url?: string, severity: MigrationFinding["severity"] = "blocking") => {
    findings.push({ code, severity, urlKeySha256: url ? migrationSha256(url) : null });
    if (severity === "blocking") reasons.add(code);
  };
  if (!equalJson(legacy.origins, predictedLive.origins)) add("LIVE_ORIGIN_SET_CHANGED");
  if (legacy.pages.length === 0) add("LEGACY_URL_UNIVERSE_EMPTY");
  if (!legacy.coverage.complete) add("LEGACY_COVERAGE_INCOMPLETE");
  if (!predictedLive.coverage.complete) add("PREDICTED_COVERAGE_INCOMPLETE");
  if (legacy.coverage.unknownCount || predictedLive.coverage.unknownCount)
    add("OBSERVATIONS_UNAVAILABLE");

  const oldPages = new Map(legacy.pages.map((page) => [page.requestedUrl, page]));
  const projectedPages = new Map(predictedLive.pages.map((page) => [page.requestedUrl, page]));
  for (const url of [...new Set([...oldPages.keys(), ...projectedPages.keys()])].sort()) {
    const old = oldPages.get(url);
    const projected = projectedPages.get(url);
    if (!old) {
      add("UNREVIEWED_TARGET_URL", url);
      continue;
    }
    if (!projected) {
      add("LEGACY_URL_MISSING", url);
      continue;
    }
    if (!observed(old) || !observed(projected)) {
      add("PAGE_EVIDENCE_UNAVAILABLE", url);
      continue;
    }
    if (old.status !== projected.status) add("STATUS_CHANGED", url);
    if (old.finalUrl !== projected.finalUrl) add("FINAL_URL_CHANGED", url);
    if (!equalJson(old.redirects, projected.redirects)) add("REDIRECT_CHAIN_CHANGED", url);
    if (!old.document || !projected.document) {
      if (
        old.status === 200 ||
        projected.status === 200 ||
        Boolean(old.document) !== Boolean(projected.document)
      ) {
        add("DOCUMENT_EVIDENCE_MISSING", url);
      }
      continue;
    }
    if (old.document.title !== projected.document.title) add("TITLE_CHANGED", url);
    if (old.document.description !== projected.document.description)
      add("DESCRIPTION_CHANGED", url);
    if (!equalJson(old.document.h1, projected.document.h1)) add("H1_CHANGED", url);
    if (old.document.canonical !== projected.document.canonical) add("CANONICAL_CHANGED", url);
    if (!equalJson(old.document.metaRobots, projected.document.metaRobots))
      add("META_ROBOTS_CHANGED", url);
    if (!equalJson(old.document.xRobotsTag, projected.document.xRobotsTag))
      add("X_ROBOTS_CHANGED", url);
    if (old.document.robotsTxt !== projected.document.robotsTxt) add("ROBOTS_TXT_CHANGED", url);
    if (old.document.robotsTxt === "unknown" || projected.document.robotsTxt === "unknown")
      add("ROBOTS_TXT_UNKNOWN", url);
    if (old.document.inSitemap !== projected.document.inSitemap)
      add("SITEMAP_MEMBERSHIP_CHANGED", url);
    if (old.document.inSitemap === null || projected.document.inSitemap === null)
      add("SITEMAP_MEMBERSHIP_UNKNOWN", url);
    if (!equalJson(old.document.schema, projected.document.schema)) add("JSON_LD_CHANGED", url);
  }
  const shadow = safeShadow(
    input.shadow,
    new Set(legacy.pages.map((page) => page.requestedUrl)),
    legacy.origins
  );
  findings.sort(
    (a, b) =>
      a.code.localeCompare(b.code) || String(a.urlKeySha256).localeCompare(String(b.urlKeySha256))
  );
  if (findings.length > MAX_FINDINGS) reasons.add("FINDINGS_TRUNCATED");
  const blockingCount = findings.filter((finding) => finding.severity === "blocking").length;
  const advisoryCount = findings.length - blockingCount;
  const body = {
    scope: "url_metadata_schema_indexability_assessment_only" as const,
    planBinding,
    manifestSha256: {
      legacy: legacy.sha256,
      predictedLive: predictedLive.sha256,
      shadow: shadow.sha256,
    },
    coverage: {
      legacy: legacy.coverage,
      predictedLive: predictedLive.coverage,
      shadow: shadow.coverage,
    },
    parity: {
      status: "blocked" as const,
      reasons: [...reasons].sort(),
      blockingCount,
      advisoryCount,
      findings: findings.slice(0, MAX_FINDINGS),
      findingsTruncated: findings.length > MAX_FINDINGS,
    },
    shadowSafety: shadow.result,
    unassessed: [
      "body_content_fidelity",
      "visual_fidelity",
      "functional_fidelity",
      "live_dns_tls",
    ] as const,
    assessmentOnly: true as const,
    externalWriteAuthorized: false as const,
    cutoverEligible: false as const,
  };
  return { ...body, assessmentSha256: migrationSha256(JSON.stringify(body)) };
}
