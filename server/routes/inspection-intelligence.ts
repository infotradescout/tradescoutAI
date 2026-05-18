import { Router, type Request, type Response } from "express";
import { isStaff, requireAuth } from "../auth";
import { pool } from "../db/pg";
import { ensureInspectionIntelligenceTables } from "../db/ensureInspectionIntelligenceTables";
import {
  DEFAULT_CAPTURE_POLICIES,
  INSPECTION_MODES,
  INSPECTION_SURFACES,
  type InspectionMode,
  type InspectionSurface,
} from "@shared/inspectionIntelligence";
import {
  TRADESCOUT_TRANSACTION_FEE_MODEL,
  TRADESCOUT_TRANSACTION_FEE_USD,
} from "@shared/platformRevenue";

const inspectionIntelligenceRouter = Router();

inspectionIntelligenceRouter.use(requireAuth, isStaff);

function clean(value: unknown, maxLen = 400): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizeSurface(raw: unknown): InspectionSurface | null {
  const candidate = clean(raw, 80) as InspectionSurface;
  return INSPECTION_SURFACES.includes(candidate) ? candidate : null;
}

function normalizeMode(raw: unknown): InspectionMode | null {
  const candidate = clean(raw, 80) as InspectionMode;
  return INSPECTION_MODES.includes(candidate) ? candidate : null;
}

function normalizeCountyFips(raw: unknown): string | null {
  const value = clean(raw, 10);
  if (!value) return null;
  return /^\d{5}$/.test(value) ? value : null;
}

function normalizeStateCode(raw: unknown): string | null {
  const value = clean(raw, 8).toUpperCase();
  if (!value) return null;
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

function toFiniteNumber(raw: unknown): number | null {
  const value = typeof raw === "string" && raw.trim() ? Number(raw) : Number(raw);
  return Number.isFinite(value) ? value : null;
}

function toMoney(raw: unknown): number | null {
  const n = toFiniteNumber(raw);
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}

async function ensurePolicyDefaults(): Promise<void> {
  await ensureInspectionIntelligenceTables();
  for (const policy of DEFAULT_CAPTURE_POLICIES) {
    await pool.query(
      `
      INSERT INTO inspection_capture_policies (mode, min_photos, max_billable_photos, target_confidence_tier)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (mode) DO NOTHING
      `,
      [policy.mode, policy.minPhotos, policy.maxBillablePhotos, policy.targetConfidence]
    );
  }
}

const HOMESCOUT_DYNAMIC_CACHE_HOURS = 24;
const INSPECTION_GENERIC_DYNAMIC_CACHE_HOURS = 12;

function getStableKnowledgeWindowDays(modeRaw: unknown): number {
  const mode = normalizeMode(modeRaw);
  if (!mode) return 30;
  if (mode === "permit_inspection" || mode === "home_inspection" || mode === "pre_sale") return 180;
  if (mode === "insurance_claim") return 90;
  return 45;
}

function confidenceTierToPoints(confidenceTierRaw: unknown): number {
  const tier = clean(confidenceTierRaw, 8).toUpperCase();
  if (tier === "A") return 35;
  if (tier === "B") return 24;
  return 12;
}

function calculateRequirementQuality(row: Record<string, unknown>) {
  const now = Date.now();
  const updatedAt = row?.updated_at ? new Date(String(row.updated_at)) : null;
  const expiresAt = row?.expires_at ? new Date(String(row.expires_at)) : null;
  const evidence = Array.isArray(row?.evidence_json) ? (row.evidence_json as unknown[]) : [];
  const requirements = Array.isArray(row?.requirements_json)
    ? (row.requirements_json as unknown[]).map((item) => clean(item, 320)).filter(Boolean)
    : [];

  let freshnessPoints = 0;
  if (expiresAt && Number.isFinite(expiresAt.getTime())) {
    const msRemaining = expiresAt.getTime() - now;
    const hoursRemaining = msRemaining / (1000 * 60 * 60);
    if (hoursRemaining > 24 * 90) freshnessPoints = 40;
    else if (hoursRemaining > 24 * 30) freshnessPoints = 34;
    else if (hoursRemaining > 24 * 7) freshnessPoints = 28;
    else if (hoursRemaining > 24 * 1) freshnessPoints = 20;
    else if (hoursRemaining > 0) freshnessPoints = 10;
    else freshnessPoints = 0;
  } else if (updatedAt && Number.isFinite(updatedAt.getTime())) {
    const hoursSinceUpdate = (now - updatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate <= 24) freshnessPoints = 30;
    else if (hoursSinceUpdate <= 24 * 7) freshnessPoints = 24;
    else if (hoursSinceUpdate <= 24 * 30) freshnessPoints = 18;
    else freshnessPoints = 10;
  }

  const confidencePoints = confidenceTierToPoints(row?.confidence_tier);
  const evidencePoints = Math.min(15, evidence.length * 5);
  const requirementDepthPoints = Math.min(10, requirements.length * 2);
  const score = Math.max(
    0,
    Math.min(100, freshnessPoints + confidencePoints + evidencePoints + requirementDepthPoints)
  );

  const band = score >= 85 ? "high" : score >= 65 ? "medium" : "low";

  return {
    score,
    band,
    freshnessPoints,
    confidencePoints,
    evidencePoints,
    requirementDepthPoints,
    requirementCount: requirements.length,
    evidenceCount: evidence.length,
  };
}

async function getCachedRequirements(params: {
  countyFips?: string | null;
  stateCode?: string | null;
  surface?: string | null;
  mode?: string | null;
  knowledgeKey?: string;
}) {
  const countyFips = normalizeCountyFips(params.countyFips || null);
  const stateCode = normalizeStateCode(params.stateCode || null);
  const surface = normalizeSurface(params.surface || null);
  const mode = normalizeMode(params.mode || null);
  const knowledgeKey = clean(params.knowledgeKey || "regulatory_requirements", 80);

  if (!countyFips || !surface || !mode) return null;

  const result = await pool.query(
    `
    SELECT *
    FROM inspection_requirement_cache
    WHERE county_fips = $1
      ${stateCode ? "AND state_code = $2" : "AND state_code IS NULL"}
      AND surface = $${stateCode ? 3 : 2}
      AND mode = $${stateCode ? 4 : 3}
      AND knowledge_key = $${stateCode ? 5 : 4}
      AND expires_at > NOW()
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    stateCode
      ? [countyFips, stateCode, surface, mode, knowledgeKey]
      : [countyFips, surface, mode, knowledgeKey]
  );

  const row = (result.rows[0] as Record<string, unknown> | undefined) || null;
  if (!row) return null;
  return {
    ...row,
    quality: calculateRequirementQuality(row),
  };
}

async function upsertRequirementCache(params: {
  countyFips?: string | null;
  stateCode?: string | null;
  surface?: string | null;
  mode?: string | null;
  knowledgeKey?: string;
  requirements: string[];
  evidence?: Array<Record<string, unknown> | string>;
  sourcePriority?: string;
  sourceCaseId?: string | null;
  confidenceTier?: string;
  ttlDays?: number;
}) {
  const countyFips = normalizeCountyFips(params.countyFips || null);
  const stateCode = normalizeStateCode(params.stateCode || null);
  const surface = normalizeSurface(params.surface || null);
  const mode = normalizeMode(params.mode || null);
  if (!countyFips || !surface || !mode) return;

  const knowledgeKey =
    clean(params.knowledgeKey || "regulatory_requirements", 80) || "regulatory_requirements";
  const sourcePriority = clean(params.sourcePriority || "first_party", 80) || "first_party";
  const sourceCaseId = clean(params.sourceCaseId, 80) || null;
  const confidenceTier = clean(params.confidenceTier || "B", 8) || "B";
  const ttlDays = Math.max(1, Math.floor(params.ttlDays || 90));
  const requirements = (params.requirements || []).map((item) => clean(item, 360)).filter(Boolean);
  const evidence = Array.isArray(params.evidence) ? params.evidence : [];

  if (!requirements.length) return;

  await pool.query(
    `
    INSERT INTO inspection_requirement_cache
    (county_fips, state_code, surface, mode, knowledge_key, requirements_json, evidence_json, source_priority, source_case_id, confidence_tier, expires_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, NOW() + ($11::text || ' days')::interval, NOW())
    ON CONFLICT (county_fips, (COALESCE(state_code, '')), surface, mode, knowledge_key)
    DO UPDATE SET
      requirements_json = EXCLUDED.requirements_json,
      evidence_json = EXCLUDED.evidence_json,
      source_priority = EXCLUDED.source_priority,
      source_case_id = EXCLUDED.source_case_id,
      confidence_tier = EXCLUDED.confidence_tier,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    `,
    [
      countyFips,
      stateCode,
      surface,
      mode,
      knowledgeKey,
      JSON.stringify(requirements),
      JSON.stringify(evidence),
      sourcePriority,
      sourceCaseId,
      confidenceTier,
      String(ttlDays),
    ]
  );
}

async function findReusableHomeScoutSnapshot(params: {
  countyFips: string;
  stateCode?: string | null;
  mode?: string | null;
  surface?: string | null;
  stableWindowDays: number;
}) {
  const countyFips = params.countyFips;
  const stateCode = normalizeStateCode(params.stateCode || null);
  const mode = normalizeMode(params.mode || null);
  const surface = normalizeSurface(params.surface || null) || "homescout";
  const stableWindowDays = Math.max(1, Math.floor(params.stableWindowDays || 30));

  if (!countyFips || !mode) return null;

  const result = await pool.query(
    `
    SELECT
      rs.*,
      c.id AS source_case_id
    FROM inspection_recommendation_snapshots rs
    INNER JOIN inspection_cases c ON c.id = rs.case_id
    WHERE c.county_fips = $1
      ${stateCode ? "AND c.state_code = $2" : ""}
      AND c.surface = $${stateCode ? 3 : 2}
      AND c.mode = $${stateCode ? 4 : 3}
      AND rs.created_at >= now() - ($${stateCode ? 5 : 4}::text || ' days')::interval
      AND rs.source_priority IN (
        'first_party_homescout_data',
        'fallback_homescout_heuristic',
        'reused_homescout_cache',
        'reused_homescout_stable_knowledge'
      )
    ORDER BY rs.created_at DESC
    LIMIT 1
    `,
    stateCode
      ? [countyFips, stateCode, surface, mode, String(stableWindowDays)]
      : [countyFips, surface, mode, String(stableWindowDays)]
  );

  return (result.rows[0] as Record<string, unknown> | undefined) || null;
}

async function findReusableSnapshotForCase(params: {
  countyFips: string;
  stateCode?: string | null;
  surface: InspectionSurface;
  mode: InspectionMode;
  maxAgeHours: number;
}) {
  const countyFips = params.countyFips;
  const stateCode = normalizeStateCode(params.stateCode || null);
  const surface = params.surface;
  const mode = params.mode;
  const maxAgeHours = Math.max(1, Math.floor(params.maxAgeHours || 12));

  const result = await pool.query(
    `
    SELECT
      rs.*,
      c.id AS source_case_id
    FROM inspection_recommendation_snapshots rs
    INNER JOIN inspection_cases c ON c.id = rs.case_id
    WHERE c.county_fips = $1
      ${stateCode ? "AND c.state_code = $2" : ""}
      AND c.surface = $${stateCode ? 3 : 2}
      AND c.mode = $${stateCode ? 4 : 3}
      AND rs.created_at >= now() - ($${stateCode ? 5 : 4}::text || ' hours')::interval
      AND rs.source_priority NOT IN ('manual_override')
    ORDER BY rs.created_at DESC
    LIMIT 1
    `,
    stateCode
      ? [countyFips, stateCode, surface, mode, String(maxAgeHours)]
      : [countyFips, surface, mode, String(maxAgeHours)]
  );

  return (result.rows[0] as Record<string, unknown> | undefined) || null;
}

async function cloneSnapshotToCase(params: {
  caseId: string;
  sourceSnapshot: Record<string, unknown>;
  sourcePriority: string;
}) {
  const { caseId, sourceSnapshot, sourcePriority } = params;
  const inserted = await pool.query(
    `
    INSERT INTO inspection_recommendation_snapshots
    (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
    RETURNING *
    `,
    [
      caseId,
      sourcePriority,
      Boolean(sourceSnapshot?.fallback_used),
      JSON.stringify((sourceSnapshot as any)?.next_steps_json || []),
      JSON.stringify((sourceSnapshot as any)?.products_json || []),
      JSON.stringify((sourceSnapshot as any)?.pros_json || []),
      JSON.stringify((sourceSnapshot as any)?.requirements_json || []),
      JSON.stringify((sourceSnapshot as any)?.cost_ranges_json || []),
    ]
  );
  return inserted.rows[0];
}

async function createHomeScoutRecommendationSnapshot(params: {
  caseId: string;
  caseRow: Record<string, unknown>;
  listingIdOverride?: string | null;
  forceFresh?: boolean;
}) {
  const caseId = params.caseId;
  const caseRow = params.caseRow;
  const listingIdOverride = clean(params.listingIdOverride, 180) || null;
  const forceFresh = Boolean(params.forceFresh);

  const countyFips =
    normalizeCountyFips((caseRow as any).county_fips) ||
    normalizeCountyFips((caseRow as any).countyFips);
  const stateCode =
    normalizeStateCode((caseRow as any).state_code) ||
    normalizeStateCode((caseRow as any).stateCode);
  const caseMode = normalizeMode((caseRow as any).mode);
  const caseSurface = normalizeSurface((caseRow as any).surface) || "homescout";
  const stableWindowDays = getStableKnowledgeWindowDays(caseMode);
  const cachedRequirementRow =
    !forceFresh && countyFips && caseMode
      ? await getCachedRequirements({
          countyFips,
          stateCode,
          surface: caseSurface,
          mode: caseMode,
          knowledgeKey: "regulatory_requirements",
        })
      : null;

  const reusableSnapshot =
    countyFips && caseMode
      ? await findReusableHomeScoutSnapshot({
          countyFips,
          stateCode,
          mode: caseMode,
          surface: caseSurface,
          stableWindowDays,
        })
      : null;

  const reusableCreatedAt = reusableSnapshot?.created_at
    ? new Date(String(reusableSnapshot.created_at))
    : null;
  const reusableAgeHours =
    reusableCreatedAt && Number.isFinite(reusableCreatedAt.getTime())
      ? Math.max(0, (Date.now() - reusableCreatedAt.getTime()) / (1000 * 60 * 60))
      : null;

  const canReuseDynamicSnapshot =
    !forceFresh &&
    reusableSnapshot &&
    reusableAgeHours !== null &&
    reusableAgeHours <= HOMESCOUT_DYNAMIC_CACHE_HOURS;

  if (canReuseDynamicSnapshot) {
    const inserted = await pool.query(
      `
      INSERT INTO inspection_recommendation_snapshots
      (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
      VALUES ($1, 'reused_homescout_cache', $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)
      RETURNING *
      `,
      [
        caseId,
        Boolean(reusableSnapshot?.fallback_used),
        JSON.stringify((reusableSnapshot as any)?.next_steps_json || []),
        JSON.stringify((reusableSnapshot as any)?.products_json || []),
        JSON.stringify((reusableSnapshot as any)?.pros_json || []),
        JSON.stringify((reusableSnapshot as any)?.requirements_json || []),
        JSON.stringify((reusableSnapshot as any)?.cost_ranges_json || []),
      ]
    );

    return {
      snapshot: inserted.rows[0],
      adapter: {
        sourcePriority: "reused_homescout_cache",
        fallbackUsed: Boolean(reusableSnapshot?.fallback_used),
        cache: {
          reused: true,
          dynamic: true,
          sourceCaseId: reusableSnapshot?.source_case_id || null,
          sourceSnapshotCreatedAt: reusableSnapshot?.created_at || null,
          requirementQuality: (cachedRequirementRow as any)?.quality || null,
        },
      },
    };
  }

  const listingId =
    listingIdOverride ||
    clean((caseRow as any).listing_id, 180) ||
    clean((caseRow as any).listingId, 180) ||
    null;

  let listing: Record<string, unknown> | null = null;
  if (listingId) {
    const listingResult = await pool.query(
      `
      SELECT
        id,
        title,
        status,
        county_fips,
        state_code,
        city,
        address_1,
        address_2,
        property_type,
        price::numeric AS price,
        beds,
        baths::numeric AS baths,
        sqft
      FROM home_scout_listings
      WHERE id = $1
      LIMIT 1
      `,
      [listingId]
    );
    listing = (listingResult.rows[0] as Record<string, unknown> | undefined) || null;
  }

  const effectiveCountyFips = normalizeCountyFips((listing as any)?.county_fips) || countyFips;
  const effectiveStateCode = normalizeStateCode((listing as any)?.state_code) || stateCode;
  const propertyType = clean((listing as any)?.property_type, 40) || null;

  let comps: Record<string, unknown> = {
    scope: "none",
    count: 0,
    min: null,
    median: null,
    avg: null,
    max: null,
  };

  if (effectiveCountyFips && effectiveStateCode) {
    const compResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS count,
        MIN(price::numeric)::numeric AS min_price,
        percentile_cont(0.5) within group (order by price::numeric) AS median_price,
        AVG(price::numeric)::numeric AS avg_price,
        MAX(price::numeric)::numeric AS max_price
      FROM home_scout_listings
      WHERE status = 'active'
        AND county_fips = $1
        AND state_code = $2
        AND price IS NOT NULL
        ${propertyType ? "AND property_type = $3" : ""}
        ${listing ? `AND id <> $${propertyType ? 4 : 3}` : ""}
      `,
      (() => {
        const values: unknown[] = [effectiveCountyFips, effectiveStateCode];
        if (propertyType) values.push(propertyType);
        if (listing) values.push((listing as any).id);
        return values;
      })()
    );
    const row = compResult.rows[0] || {};
    comps = {
      scope: "county",
      count: Number((row as any).count || 0),
      min: toMoney((row as any).min_price),
      median: toMoney((row as any).median_price),
      avg: toMoney((row as any).avg_price),
      max: toMoney((row as any).max_price),
    };
  }

  let listingReportSummary: Array<{ reportType: string; count: number }> = [];
  if (listing) {
    const reportsByListing = await pool.query(
      `
      SELECT report_type, COUNT(*)::int AS count
      FROM home_scout_inspection_reports
      WHERE listing_id = $1
        AND status = 'published'
      GROUP BY report_type
      ORDER BY count DESC, report_type ASC
      `,
      [(listing as any).id]
    );
    listingReportSummary = reportsByListing.rows.map((row) => ({
      reportType: clean((row as any).report_type, 64) || "other",
      count: Number((row as any).count || 0),
    }));
  }

  let countyServiceStatus: Array<{ status: string; count: number }> = [];
  let topServiceCategories: Array<{ category: string; count: number }> = [];
  if (effectiveCountyFips && effectiveStateCode) {
    const serviceStatusResult = await pool.query(
      `
      SELECT status, COUNT(*)::int AS count
      FROM home_scout_inspection_service_requests
      WHERE county_fips = $1
        AND state_code = $2
      GROUP BY status
      ORDER BY count DESC, status ASC
      `,
      [effectiveCountyFips, effectiveStateCode]
    );
    countyServiceStatus = serviceStatusResult.rows.map((row) => ({
      status: clean((row as any).status, 32) || "unknown",
      count: Number((row as any).count || 0),
    }));

    const topCategoriesResult = await pool.query(
      `
      SELECT service_category, COUNT(*)::int AS count
      FROM home_scout_inspection_service_requests
      WHERE county_fips = $1
        AND state_code = $2
      GROUP BY service_category
      ORDER BY count DESC, service_category ASC
      LIMIT 5
      `,
      [effectiveCountyFips, effectiveStateCode]
    );
    topServiceCategories = topCategoriesResult.rows.map((row) => ({
      category: clean((row as any).service_category, 120) || "general",
      count: Number((row as any).count || 0),
    }));
  }

  let countyPros: Array<{ type: string; label: string; status: string }> = [];
  if (effectiveCountyFips) {
    const prosResult = await pool.query(
      `
      SELECT entity_type, label, status
      FROM county_entities
      WHERE county_fips = $1
        AND status = 'active'
        AND entity_type IN ('contractor', 'service_provider', 'inspector', 'realtor', 'pro')
      ORDER BY updated_at DESC
      LIMIT 8
      `,
      [effectiveCountyFips]
    );
    countyPros = prosResult.rows.map((row) => ({
      type: clean((row as any).entity_type, 64) || "pro",
      label: clean((row as any).label, 180) || "County pro",
      status: clean((row as any).status, 32) || "active",
    }));
  }

  const compCount = Number((comps as any).count || 0);
  const listingReportCount = listingReportSummary.reduce((sum, item) => sum + item.count, 0);
  const countyServiceCount = countyServiceStatus.reduce((sum, item) => sum + item.count, 0);
  const hasFirstPartySignals = compCount > 0 || listingReportCount > 0 || countyServiceCount > 0;

  const marketMedian = toMoney((comps as any).median);
  const marketAvg = toMoney((comps as any).avg);
  const marketCenter = toMoney(marketMedian ?? marketAvg ?? (listing as any)?.price ?? null);

  const nextSteps = hasFirstPartySignals
    ? [
        "Use HomeScout county data first to scope inspection and pricing next actions.",
        "Route priority follow-up through the most active local service category.",
        "Capture only required photos first; add one incremental photo if confidence remains low.",
      ]
    : [
        "No county HomeScout demand signal was strong enough yet; use county containers and checklist fallback.",
        "Capture required minimum photos and keep report summary concise for fast routing.",
        "Route to HomeScout listing flow, then service-request flow once report findings are confirmed.",
      ];

  const stableRequirementCandidates = Array.isArray(
    (cachedRequirementRow as any)?.requirements_json
  )
    ? ((cachedRequirementRow as any).requirements_json as unknown[])
    : Array.isArray((reusableSnapshot as any)?.requirements_json)
      ? ((reusableSnapshot as any).requirements_json as unknown[])
      : [];

  const cachedRequirements = stableRequirementCandidates
    .map((item) => clean(item, 320))
    .filter(Boolean);
  const cachedRequirementQualityScore = Number((cachedRequirementRow as any)?.quality?.score || 0);
  const allowStableRequirementReuse =
    !forceFresh && cachedRequirements.length > 0 && cachedRequirementQualityScore >= 65;

  const baseRequirements = [
    "Visibility does not grant contact access; all contact remains Intent -> Decision Card -> Contact.",
    "County/state assignment must stay aligned to county intelligence containers.",
    ...(effectiveCountyFips && effectiveStateCode
      ? [`County scope: ${effectiveCountyFips}-${effectiveStateCode}`]
      : ["County scope missing on case/listing; set county for higher-confidence routing."]),
  ];

  const requirements = Array.from(
    new Set([...baseRequirements, ...(allowStableRequirementReuse ? cachedRequirements : [])])
  );

  const products = [
    {
      type: "homescout_adapter",
      durabilityClass: "stable",
      listing,
      comparables: comps,
      listingReportSummary,
      countyServiceStatus,
      topServiceCategories,
      generatedAt: new Date().toISOString(),
    },
  ];

  const costRanges = marketCenter
    ? [
        {
          name: "homescout_local_market_center",
          min: toMoney(marketCenter * 0.95),
          max: toMoney(marketCenter * 1.05),
          currency: "USD",
          note: "Center band from first-party HomeScout comps.",
        },
      ]
    : [];

  const inserted = await pool.query(
    `
    INSERT INTO inspection_recommendation_snapshots
    (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
    RETURNING *
    `,
    [
      caseId,
      hasFirstPartySignals
        ? allowStableRequirementReuse
          ? "reused_homescout_stable_knowledge"
          : "first_party_homescout_data"
        : "fallback_homescout_heuristic",
      !hasFirstPartySignals,
      JSON.stringify(nextSteps),
      JSON.stringify(products),
      JSON.stringify(countyPros),
      JSON.stringify(requirements),
      JSON.stringify(costRanges),
    ]
  );

  await upsertRequirementCache({
    countyFips: effectiveCountyFips || countyFips,
    stateCode: effectiveStateCode || stateCode,
    surface: caseSurface,
    mode: caseMode,
    knowledgeKey: "regulatory_requirements",
    requirements,
    evidence: [
      { type: "home_scout_comparables_count", value: compCount },
      { type: "home_scout_service_signal_count", value: countyServiceCount },
      { type: "listing_report_count", value: listingReportCount },
    ],
    sourcePriority: hasFirstPartySignals
      ? "first_party_homescout_data"
      : "fallback_homescout_heuristic",
    sourceCaseId: caseId,
    confidenceTier: hasFirstPartySignals ? "A" : "B",
    ttlDays: stableWindowDays,
  });

  return {
    snapshot: inserted.rows[0],
    adapter: {
      sourcePriority: hasFirstPartySignals
        ? allowStableRequirementReuse
          ? "reused_homescout_stable_knowledge"
          : "first_party_homescout_data"
        : "fallback_homescout_heuristic",
      fallbackUsed: !hasFirstPartySignals,
      listing,
      comparables: comps,
      listingReportSummary,
      countyServiceStatus,
      topServiceCategories,
      countyProsCount: countyPros.length,
      cache: {
        reusedStableKnowledge: allowStableRequirementReuse,
        reusedDynamicSnapshot: false,
        sourceCaseId: reusableSnapshot?.source_case_id || null,
        sourceSnapshotCreatedAt: reusableSnapshot?.created_at || null,
        requirementQuality: (cachedRequirementRow as any)?.quality || null,
      },
    },
  };
}

async function createDirectConnectRecommendationSnapshot(params: {
  caseId: string;
  caseRow: Record<string, unknown>;
  forceFresh?: boolean;
}) {
  const caseId = params.caseId;
  const caseRow = params.caseRow;
  const forceFresh = Boolean(params.forceFresh);

  const countyFips =
    normalizeCountyFips((caseRow as any).county_fips) ||
    normalizeCountyFips((caseRow as any).countyFips);
  const stateCode =
    normalizeStateCode((caseRow as any).state_code) ||
    normalizeStateCode((caseRow as any).stateCode);
  const caseMode = normalizeMode((caseRow as any).mode);
  const caseSurface = normalizeSurface((caseRow as any).surface) || "direct_connect";
  const stableWindowDays = getStableKnowledgeWindowDays(caseMode);

  const cachedRequirementRow =
    !forceFresh && countyFips && caseMode
      ? await getCachedRequirements({
          countyFips,
          stateCode,
          surface: caseSurface,
          mode: caseMode,
          knowledgeKey: "regulatory_requirements",
        })
      : null;

  const reusableSnapshot =
    !forceFresh && countyFips && caseMode
      ? await findReusableSnapshotForCase({
          countyFips,
          stateCode,
          surface: caseSurface,
          mode: caseMode,
          maxAgeHours: INSPECTION_GENERIC_DYNAMIC_CACHE_HOURS,
        })
      : null;

  if (reusableSnapshot) {
    const cloned = await cloneSnapshotToCase({
      caseId,
      sourceSnapshot: reusableSnapshot,
      sourcePriority: "reused_direct_connect_cache",
    });
    return {
      snapshot: cloned,
      adapter: {
        sourcePriority: "reused_direct_connect_cache",
        fallbackUsed: Boolean(reusableSnapshot?.fallback_used),
        cache: {
          reused: true,
          sourceCaseId: reusableSnapshot?.source_case_id || null,
          sourceSnapshotCreatedAt: reusableSnapshot?.created_at || null,
          requirementQuality: (cachedRequirementRow as any)?.quality || null,
        },
      },
    };
  }

  let workRequestStats = {
    total: 0,
    open: 0,
    routed: 0,
    inProgress: 0,
    completed: 0,
    medianBudgetLow: null as number | null,
    medianBudgetHigh: null as number | null,
  };
  let assignmentStats = {
    accepted: 0,
    completed: 0,
    invited: 0,
    declined: 0,
  };
  let topTrades: Array<{ tradeId: string; count: number }> = [];
  let countyPros: Array<{ type: string; label: string; status: string }> = [];

  if (countyFips && stateCode) {
    const wr = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'routed')::int AS routed,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        percentile_cont(0.5) within group (order by budget_min::numeric) AS median_budget_low,
        percentile_cont(0.5) within group (order by budget_max::numeric) AS median_budget_high
      FROM work_requests
      WHERE county_fips = $1
        AND state_code = $2
        AND created_at >= now() - interval '30 days'
      `,
      [countyFips, stateCode]
    );
    const wrRow = wr.rows[0] || {};
    workRequestStats = {
      total: Number((wrRow as any).total || 0),
      open: Number((wrRow as any).open || 0),
      routed: Number((wrRow as any).routed || 0),
      inProgress: Number((wrRow as any).in_progress || 0),
      completed: Number((wrRow as any).completed || 0),
      medianBudgetLow: toMoney((wrRow as any).median_budget_low),
      medianBudgetHigh: toMoney((wrRow as any).median_budget_high),
    };

    const assignments = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE a.status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE a.status = 'invited')::int AS invited,
        COUNT(*) FILTER (WHERE a.status = 'declined')::int AS declined
      FROM work_request_assignments a
      INNER JOIN work_requests w ON w.id = a.work_request_id
      WHERE w.county_fips = $1
        AND w.state_code = $2
        AND w.created_at >= now() - interval '30 days'
      `,
      [countyFips, stateCode]
    );
    const asRow = assignments.rows[0] || {};
    assignmentStats = {
      accepted: Number((asRow as any).accepted || 0),
      completed: Number((asRow as any).completed || 0),
      invited: Number((asRow as any).invited || 0),
      declined: Number((asRow as any).declined || 0),
    };

    const trades = await pool.query(
      `
      SELECT COALESCE(trade_id, 'unknown') AS trade_id, COUNT(*)::int AS count
      FROM work_requests
      WHERE county_fips = $1
        AND state_code = $2
        AND created_at >= now() - interval '30 days'
      GROUP BY COALESCE(trade_id, 'unknown')
      ORDER BY count DESC
      LIMIT 5
      `,
      [countyFips, stateCode]
    );
    topTrades = trades.rows.map((row) => ({
      tradeId: clean((row as any).trade_id, 120) || "unknown",
      count: Number((row as any).count || 0),
    }));
  }

  if (countyFips) {
    const pros = await pool.query(
      `
      SELECT entity_type, label, status
      FROM county_entities
      WHERE county_fips = $1
        AND status = 'active'
        AND entity_type IN ('contractor', 'service_provider', 'pro')
      ORDER BY updated_at DESC
      LIMIT 8
      `,
      [countyFips]
    );
    countyPros = pros.rows.map((row) => ({
      type: clean((row as any).entity_type, 64) || "pro",
      label: clean((row as any).label, 180) || "County pro",
      status: clean((row as any).status, 32) || "active",
    }));
  }

  const stableRequirementCandidates = Array.isArray(
    (cachedRequirementRow as any)?.requirements_json
  )
    ? ((cachedRequirementRow as any).requirements_json as unknown[])
    : [];
  const cachedRequirements = stableRequirementCandidates
    .map((item) => clean(item, 320))
    .filter(Boolean);
  const cachedRequirementQualityScore = Number((cachedRequirementRow as any)?.quality?.score || 0);
  const allowStableRequirementReuse =
    !forceFresh && cachedRequirements.length > 0 && cachedRequirementQualityScore >= 65;

  const hasFirstPartySignals =
    workRequestStats.total > 0 ||
    assignmentStats.accepted > 0 ||
    assignmentStats.completed > 0 ||
    countyPros.length > 0;

  const acceptanceRate =
    assignmentStats.invited > 0
      ? Math.round((assignmentStats.accepted / assignmentStats.invited) * 1000) / 10
      : null;

  const nextSteps = hasFirstPartySignals
    ? [
        "Route through Direct Connect using county demand and active trade signals first.",
        "Use gated intent -> decision card -> contact flow for every recommendation.",
        "Prioritize top county trades and active pros for first outreach set.",
      ]
    : [
        "Direct Connect county signal is thin; start with controlled county requirements and objective text.",
        "Keep request scoped and local, then route to county pros through governed contact flow.",
        "Capture only minimum required media and expand if confidence remains low.",
      ];

  const requirements = Array.from(
    new Set([
      "Visibility does not grant access; contact stays gated by Intent -> Decision Card -> Contact.",
      "No pay-to-play routing. County trust/CVS exposure rules must remain enforced.",
      countyFips && stateCode
        ? `County scope: ${countyFips}-${stateCode}`
        : "County scope missing; set county/state for Direct Connect routing quality.",
      ...(allowStableRequirementReuse ? cachedRequirements : []),
    ])
  );

  const products = [
    {
      type: "direct_connect_adapter",
      durabilityClass: "stable",
      workRequestStats,
      assignmentStats: {
        ...assignmentStats,
        acceptanceRatePercent: acceptanceRate,
      },
      topTrades,
      generatedAt: new Date().toISOString(),
    },
  ];

  const costRanges =
    workRequestStats.medianBudgetLow !== null || workRequestStats.medianBudgetHigh !== null
      ? [
          {
            name: "direct_connect_county_budget_band",
            min: workRequestStats.medianBudgetLow,
            max: workRequestStats.medianBudgetHigh,
            currency: "USD",
            note: "Median county work-request budget band from first-party data (30d).",
          },
        ]
      : [];

  const sourcePriority = hasFirstPartySignals
    ? allowStableRequirementReuse
      ? "reused_direct_connect_stable_knowledge"
      : "first_party_direct_connect_data"
    : "fallback_direct_connect_heuristic";

  const inserted = await pool.query(
    `
    INSERT INTO inspection_recommendation_snapshots
    (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
    RETURNING *
    `,
    [
      caseId,
      sourcePriority,
      !hasFirstPartySignals,
      JSON.stringify(nextSteps),
      JSON.stringify(products),
      JSON.stringify(countyPros),
      JSON.stringify(requirements),
      JSON.stringify(costRanges),
    ]
  );

  await upsertRequirementCache({
    countyFips,
    stateCode,
    surface: caseSurface,
    mode: caseMode,
    knowledgeKey: "regulatory_requirements",
    requirements,
    evidence: [
      { type: "work_request_total_30d", value: workRequestStats.total },
      { type: "assignment_accepted_30d", value: assignmentStats.accepted },
      { type: "assignment_completed_30d", value: assignmentStats.completed },
    ],
    sourcePriority,
    sourceCaseId: caseId,
    confidenceTier: hasFirstPartySignals ? "A" : "B",
    ttlDays: stableWindowDays,
  });

  return {
    snapshot: inserted.rows[0],
    adapter: {
      sourcePriority,
      fallbackUsed: !hasFirstPartySignals,
      workRequestStats,
      assignmentStats: {
        ...assignmentStats,
        acceptanceRatePercent: acceptanceRate,
      },
      topTrades,
      countyProsCount: countyPros.length,
      cache: {
        reusedStableKnowledge: allowStableRequirementReuse,
        requirementQuality: (cachedRequirementRow as any)?.quality || null,
      },
    },
  };
}

inspectionIntelligenceRouter.post("/cases", async (req: Request, res: Response) => {
  try {
    const userId = clean((req.user as any)?.id, 120);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const surface = normalizeSurface(req.body?.surface);
    const mode = normalizeMode(req.body?.mode);
    if (!surface || !mode) {
      return res.status(400).json({
        error: "surface and mode are required.",
        allowedSurfaces: INSPECTION_SURFACES,
        allowedModes: INSPECTION_MODES,
      });
    }

    const countyFips = normalizeCountyFips(req.body?.countyFips);
    const stateCode = normalizeStateCode(req.body?.stateCode);
    const listingId = clean(req.body?.listingId, 180) || null;
    const objectiveText = clean(req.body?.objectiveText, 4000) || null;

    await ensurePolicyDefaults();
    const result = await pool.query(
      `
      INSERT INTO inspection_cases
      (user_id, county_fips, state_code, surface, mode, status, listing_id, objective_text)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)
      RETURNING *
      `,
      [userId, countyFips, stateCode, surface, mode, listingId, objectiveText]
    );

    return res.status(201).json({
      ok: true,
      case: result.rows[0],
      visibility: "staff_admin_test_only",
    });
  } catch (error) {
    console.error("[inspection] create case failed", error);
    return res.status(500).json({ error: "Could not create inspection case." });
  }
});

inspectionIntelligenceRouter.get("/cases", async (req: Request, res: Response) => {
  try {
    const userId = clean((req.user as any)?.id, 120);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await ensurePolicyDefaults();
    const limitRaw = toFiniteNumber(req.query.limit);
    const limit = Math.min(100, Math.max(1, Math.floor(limitRaw ?? 30)));
    const surface = normalizeSurface(req.query.surface);
    const mode = normalizeMode(req.query.mode);

    const params: unknown[] = [userId];
    let whereSql = `WHERE c.user_id = $1`;
    if (surface) {
      params.push(surface);
      whereSql += ` AND c.surface = $${params.length}`;
    }
    if (mode) {
      params.push(mode);
      whereSql += ` AND c.mode = $${params.length}`;
    }
    params.push(limit);

    const result = await pool.query(
      `
      SELECT
        c.*,
        COALESCE(art.total_photos, 0)::int AS total_photos,
        rec.created_at AS latest_recommendation_at
      FROM inspection_cases c
      LEFT JOIN (
        SELECT case_id, COUNT(*)::int AS total_photos
        FROM inspection_case_artifacts
        GROUP BY case_id
      ) art ON art.case_id = c.id
      LEFT JOIN LATERAL (
        SELECT created_at
        FROM inspection_recommendation_snapshots r
        WHERE r.case_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) rec ON TRUE
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT $${params.length}
      `,
      params
    );

    return res.json({ ok: true, rows: result.rows, visibility: "staff_admin_test_only" });
  } catch (error) {
    console.error("[inspection] list cases failed", error);
    return res.status(500).json({ error: "Could not list inspection cases." });
  }
});

inspectionIntelligenceRouter.get(
  "/county/:countyFips/folder",
  async (req: Request, res: Response) => {
    try {
      const userId = clean((req.user as any)?.id, 120);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await ensurePolicyDefaults();
      const countyFips = normalizeCountyFips(req.params.countyFips);
      if (!countyFips) return res.status(400).json({ error: "Valid county FIPS is required." });

      const stateCode = normalizeStateCode(req.query.stateCode);
      const params: unknown[] = [countyFips];
      const stateFilter = stateCode ? `AND c.state_code = $2` : "";
      if (stateCode) params.push(stateCode);

      const rows = await pool.query(
        `
      SELECT
        c.id,
        c.surface,
        c.mode,
        c.status,
        c.state_code,
        c.listing_id,
        c.objective_text,
        c.created_at,
        COALESCE(a.total_photos, 0)::int AS total_photos,
        COALESCE(a.avg_quality, 0)::numeric AS avg_quality,
        r.created_at AS latest_snapshot_at
      FROM inspection_cases c
      LEFT JOIN (
        SELECT case_id, COUNT(*)::int AS total_photos, AVG(quality_score)::numeric AS avg_quality
        FROM inspection_case_artifacts
        GROUP BY case_id
      ) a ON a.case_id = c.id
      LEFT JOIN LATERAL (
        SELECT created_at
        FROM inspection_recommendation_snapshots rs
        WHERE rs.case_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) r ON TRUE
      WHERE c.county_fips = $1
      ${stateFilter}
      ORDER BY c.created_at DESC
      `,
        params
      );

      const requirementCacheRows = await pool.query(
        `
      SELECT
        surface,
        mode,
        knowledge_key,
        requirements_json,
        evidence_json,
        confidence_tier,
        source_priority,
        expires_at,
        updated_at
      FROM inspection_requirement_cache
      WHERE county_fips = $1
      ${stateFilter}
      ORDER BY updated_at DESC
      LIMIT 50
      `,
        params
      );

      const summaryMap = new Map<
        string,
        { surface: string; mode: string; cases: number; photos: number }
      >();
      for (const row of rows.rows) {
        const surface = clean((row as any).surface, 80) || "unknown";
        const mode = clean((row as any).mode, 80) || "unknown";
        const key = `${surface}::${mode}`;
        const current = summaryMap.get(key) || { surface, mode, cases: 0, photos: 0 };
        current.cases += 1;
        current.photos += Number((row as any).total_photos || 0);
        summaryMap.set(key, current);
      }

      return res.json({
        ok: true,
        countyFips,
        stateCode: stateCode || null,
        summary: Array.from(summaryMap.values()).sort((a, b) => b.cases - a.cases),
        cases: rows.rows,
        requirementCache: requirementCacheRows.rows.map((row) => ({
          ...row,
          durabilityClass: "stable",
          quality: calculateRequirementQuality(row as Record<string, unknown>),
        })),
        visibility: "staff_admin_test_only",
      });
    } catch (error) {
      console.error("[inspection] county folder failed", error);
      return res.status(500).json({ error: "Could not load county folder." });
    }
  }
);

inspectionIntelligenceRouter.post("/cases/:id/artifacts", async (req: Request, res: Response) => {
  try {
    const userId = clean((req.user as any)?.id, 120);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const caseId = clean(req.params.id, 80);
    const storageUrl = clean(req.body?.storageUrl, 4000);
    if (!caseId || !storageUrl) {
      return res.status(400).json({ error: "case id and storageUrl are required." });
    }

    await ensurePolicyDefaults();
    const caseResult = await pool.query(
      `
      SELECT id, mode
      FROM inspection_cases
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [caseId, userId]
    );

    const caseRow = caseResult.rows[0];
    if (!caseRow) return res.status(404).json({ error: "Inspection case not found." });

    const mode = normalizeMode(caseRow.mode);
    if (!mode) return res.status(400).json({ error: "Inspection case mode is invalid." });

    const policyResult = await pool.query(
      `
      SELECT min_photos, max_billable_photos, target_confidence_tier
      FROM inspection_capture_policies
      WHERE mode = $1
      LIMIT 1
      `,
      [mode]
    );

    const policyRow = policyResult.rows[0] || {
      min_photos: 2,
      max_billable_photos: 6,
      target_confidence_tier: "B",
    };

    const counts = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inspection_case_artifacts
      WHERE case_id = $1
      `,
      [caseId]
    );
    const currentCount = Number(counts.rows[0]?.total || 0);
    const maxBillablePhotos = Number(policyRow.max_billable_photos || 0);

    if (currentCount >= maxBillablePhotos) {
      return res.status(400).json({
        error: "Capture cap reached for this case.",
        maxBillablePhotos,
        currentCount,
      });
    }

    const artifactType = clean(req.body?.artifactType, 80) || "photo";
    const providedOrder = toFiniteNumber(req.body?.captureOrder);
    const captureOrder =
      providedOrder !== null && providedOrder > 0 ? Math.floor(providedOrder) : currentCount + 1;
    const qualityScore = toFiniteNumber(req.body?.qualityScore);
    const metadata =
      req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};

    const inserted = await pool.query(
      `
      INSERT INTO inspection_case_artifacts
      (case_id, artifact_type, capture_order, storage_url, quality_score, metadata_json)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING *
      `,
      [caseId, artifactType, captureOrder, storageUrl, qualityScore, JSON.stringify(metadata)]
    );

    const totalAfterInsert = currentCount + 1;
    const minPhotos = Number(policyRow.min_photos || 0);
    const remainingToMinimum = Math.max(minPhotos - totalAfterInsert, 0);

    return res.status(201).json({
      ok: true,
      artifact: inserted.rows[0],
      capturePolicy: {
        mode,
        minPhotos,
        maxBillablePhotos,
        targetConfidenceTier: String(policyRow.target_confidence_tier || "B"),
      },
      captureProgress: {
        totalPhotos: totalAfterInsert,
        remainingToMinimum,
        capReached: totalAfterInsert >= maxBillablePhotos,
      },
      visibility: "staff_admin_test_only",
    });
  } catch (error) {
    console.error("[inspection] add artifact failed", error);
    return res.status(500).json({ error: "Could not add artifact." });
  }
});

inspectionIntelligenceRouter.post(
  "/cases/:id/recommendations",
  async (req: Request, res: Response) => {
    try {
      const userId = clean((req.user as any)?.id, 120);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const caseId = clean(req.params.id, 80);
      if (!caseId) return res.status(400).json({ error: "Case id is required." });

      await ensurePolicyDefaults();
      const caseResult = await pool.query(
        `
        SELECT id
        FROM inspection_cases
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [caseId, userId]
      );
      if (!caseResult.rows.length) {
        return res.status(404).json({ error: "Inspection case not found." });
      }

      const sourcePriority = clean(req.body?.sourcePriority, 80) || "first_party";
      const fallbackUsed = Boolean(req.body?.fallbackUsed);
      const nextSteps = Array.isArray(req.body?.nextSteps) ? req.body.nextSteps : [];
      const products = Array.isArray(req.body?.products) ? req.body.products : [];
      const pros = Array.isArray(req.body?.pros) ? req.body.pros : [];
      const requirements = Array.isArray(req.body?.requirements) ? req.body.requirements : [];
      const costRanges = Array.isArray(req.body?.costRanges) ? req.body.costRanges : [];

      const inserted = await pool.query(
        `
        INSERT INTO inspection_recommendation_snapshots
        (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
        RETURNING *
        `,
        [
          caseId,
          sourcePriority,
          fallbackUsed,
          JSON.stringify(nextSteps),
          JSON.stringify(products),
          JSON.stringify(pros),
          JSON.stringify(requirements),
          JSON.stringify(costRanges),
        ]
      );

      return res.status(201).json({
        ok: true,
        snapshot: inserted.rows[0],
        visibility: "staff_admin_test_only",
      });
    } catch (error) {
      console.error("[inspection] save recommendation snapshot failed", error);
      return res.status(500).json({ error: "Could not save recommendation snapshot." });
    }
  }
);

inspectionIntelligenceRouter.post(
  "/cases/:id/exchange-valuation",
  async (req: Request, res: Response) => {
    try {
      const userId = clean((req.user as any)?.id, 120);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const caseId = clean(req.params.id, 80);
      if (!caseId) return res.status(400).json({ error: "Case id is required." });

      await ensurePolicyDefaults();
      const caseResult = await pool.query(
        `
      SELECT id, surface, mode, listing_id
      FROM inspection_cases
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
        [caseId, userId]
      );
      const caseRow = caseResult.rows[0];
      if (!caseRow) return res.status(404).json({ error: "Inspection case not found." });

      const listingId = clean(req.body?.listingId, 180) || clean(caseRow.listing_id, 180);
      let listingRow: Record<string, unknown> | null = null;
      if (listingId) {
        const listingResult = await pool.query(
          `
        SELECT id, title, category_id, county, state, condition, price::numeric AS price
        FROM marketplace_listings
        WHERE id = $1
        LIMIT 1
        `,
          [listingId]
        );
        listingRow = (listingResult.rows[0] as Record<string, unknown> | undefined) || null;
      }

      const categoryId =
        clean(req.body?.categoryId, 180) || clean((listingRow as any)?.category_id, 180);
      if (!categoryId) {
        return res
          .status(400)
          .json({ error: "categoryId (or case/listing category) is required." });
      }

      const county = clean(req.body?.county, 120) || clean((listingRow as any)?.county, 120);
      const state = (
        clean(req.body?.state, 8) || clean((listingRow as any)?.state, 8)
      ).toUpperCase();
      const askPrice = toMoney(req.body?.askPrice) ?? toMoney((listingRow as any)?.price);

      const byCountyState =
        county && state
          ? await pool.query(
              `
            SELECT COUNT(*)::int AS count,
                   AVG(price::numeric)::numeric AS avg_price,
                   MIN(price::numeric)::numeric AS min_price,
                   MAX(price::numeric)::numeric AS max_price,
                   percentile_cont(0.5) within group (order by price::numeric) AS median_price
            FROM marketplace_listings
            WHERE status = 'active'
              AND category_id = $1
              AND county = $2
              AND state = $3
              AND price IS NOT NULL
              ${listingId ? "AND id <> $4" : ""}
            `,
              listingId ? [categoryId, county, state, listingId] : [categoryId, county, state]
            )
          : null;

      const byState = state
        ? await pool.query(
            `
            SELECT COUNT(*)::int AS count,
                   AVG(price::numeric)::numeric AS avg_price,
                   MIN(price::numeric)::numeric AS min_price,
                   MAX(price::numeric)::numeric AS max_price,
                   percentile_cont(0.5) within group (order by price::numeric) AS median_price
            FROM marketplace_listings
            WHERE status = 'active'
              AND category_id = $1
              AND state = $2
              AND price IS NOT NULL
              ${listingId ? "AND id <> $3" : ""}
            `,
            listingId ? [categoryId, state, listingId] : [categoryId, state]
          )
        : null;

      const byCategory = await pool.query(
        `
      SELECT COUNT(*)::int AS count,
             AVG(price::numeric)::numeric AS avg_price,
             MIN(price::numeric)::numeric AS min_price,
             MAX(price::numeric)::numeric AS max_price,
             percentile_cont(0.5) within group (order by price::numeric) AS median_price
      FROM marketplace_listings
      WHERE status = 'active'
        AND category_id = $1
        AND price IS NOT NULL
        ${listingId ? "AND id <> $2" : ""}
      `,
        listingId ? [categoryId, listingId] : [categoryId]
      );

      const pickStats = (() => {
        const countyStats = byCountyState?.rows?.[0] as any;
        const countyCount = Number(countyStats?.count || 0);
        if (countyCount >= 3) return { scope: "county_state", stats: countyStats };

        const stateStats = byState?.rows?.[0] as any;
        const stateCount = Number(stateStats?.count || 0);
        if (stateCount >= 3) return { scope: "state", stats: stateStats };

        return { scope: "category", stats: (byCategory.rows?.[0] as any) || {} };
      })();

      const compCount = Number(pickStats.stats?.count || 0);
      const min = toMoney(pickStats.stats?.min_price);
      const median = toMoney(pickStats.stats?.median_price);
      const avg = toMoney(pickStats.stats?.avg_price);
      const max = toMoney(pickStats.stats?.max_price);
      const fairCenter = toMoney(median ?? avg ?? askPrice ?? 0) || 0;
      const fairLow = toMoney(fairCenter * 0.9);
      const fairHigh = toMoney(fairCenter * 1.1);

      const priceForFee = askPrice ?? fairCenter;
      const platformFee = TRADESCOUT_TRANSACTION_FEE_USD;
      const sellerNet = Math.round((priceForFee - platformFee) * 100) / 100;

      const valuationPayload = {
        listingId: listingId || null,
        categoryId,
        comparables: {
          scope: pickStats.scope,
          count: compCount,
          min,
          median,
          avg,
          max,
        },
        fairPriceBand: {
          low: fairLow,
          center: toMoney(fairCenter),
          high: fairHigh,
        },
        askPrice,
        feePreview: {
          platformFeeType: "fixed",
          platformFeeValue: TRADESCOUT_TRANSACTION_FEE_USD,
          platformFeeModel: TRADESCOUT_TRANSACTION_FEE_MODEL,
          platformFee,
          sellerNet,
          note: "TradeScout earns a flat $1 fee on on-platform purchases.",
        },
        sourcePriority: compCount > 0 ? "first_party_exchange_data" : "fallback_heuristic",
        fallbackUsed: compCount === 0,
        generatedAt: new Date().toISOString(),
      };

      const nextSteps = [
        "Compare ask price against the fair-price center and adjust if needed.",
        "Minimize photos to required minimum first, then add only when confidence is low.",
        "Keep listing details complete to improve valuation confidence and close rate.",
      ];
      const costRanges = [
        {
          name: "exchange_transaction_fee_preview",
          min: platformFee,
          max: platformFee,
          currency: "USD",
          note: "TradeScout earns a flat $1 fee on on-platform purchases.",
        },
      ];

      const inserted = await pool.query(
        `
      INSERT INTO inspection_recommendation_snapshots
      (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
      RETURNING *
      `,
        [
          caseId,
          valuationPayload.sourcePriority,
          valuationPayload.fallbackUsed,
          JSON.stringify(nextSteps),
          JSON.stringify([{ type: "exchange_valuation", payload: valuationPayload }]),
          JSON.stringify([]),
          JSON.stringify([
            "Fair-price guidance uses first-party exchange comps first.",
            "Fallback logic is only used when comps are insufficient.",
          ]),
          JSON.stringify(costRanges),
        ]
      );

      return res.status(201).json({
        ok: true,
        valuation: valuationPayload,
        snapshot: inserted.rows[0],
        visibility: "staff_admin_test_only",
      });
    } catch (error) {
      console.error("[inspection] exchange valuation failed", error);
      return res.status(500).json({ error: "Could not run exchange valuation." });
    }
  }
);

inspectionIntelligenceRouter.post(
  "/cases/:id/homescout-adapter",
  async (req: Request, res: Response) => {
    try {
      const userId = clean((req.user as any)?.id, 120);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const caseId = clean(req.params.id, 80);
      if (!caseId) return res.status(400).json({ error: "Case id is required." });

      await ensurePolicyDefaults();
      const caseResult = await pool.query(
        `
      SELECT id, county_fips, state_code, surface, mode, listing_id, objective_text
      FROM inspection_cases
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
        [caseId, userId]
      );
      const caseRow = caseResult.rows[0];
      if (!caseRow) return res.status(404).json({ error: "Inspection case not found." });

      const listingIdOverride = clean(req.body?.listingId, 180) || null;
      const adapterResult = await createHomeScoutRecommendationSnapshot({
        caseId,
        caseRow,
        listingIdOverride,
        forceFresh: Boolean(req.body?.forceFresh),
      });

      return res.status(201).json({
        ok: true,
        adapter: adapterResult.adapter,
        snapshot: adapterResult.snapshot,
        visibility: "staff_admin_test_only",
      });
    } catch (error) {
      console.error("[inspection] homescout adapter failed", error);
      return res.status(500).json({ error: "Could not run HomeScout adapter." });
    }
  }
);

inspectionIntelligenceRouter.post(
  "/cases/:id/direct-connect-adapter",
  async (req: Request, res: Response) => {
    try {
      const userId = clean((req.user as any)?.id, 120);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const caseId = clean(req.params.id, 80);
      if (!caseId) return res.status(400).json({ error: "Case id is required." });

      await ensurePolicyDefaults();
      const caseResult = await pool.query(
        `
      SELECT id, county_fips, state_code, surface, mode, listing_id, objective_text
      FROM inspection_cases
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
        [caseId, userId]
      );
      const caseRow = caseResult.rows[0];
      if (!caseRow) return res.status(404).json({ error: "Inspection case not found." });

      const adapterResult = await createDirectConnectRecommendationSnapshot({
        caseId,
        caseRow,
        forceFresh: Boolean(req.body?.forceFresh),
      });

      return res.status(201).json({
        ok: true,
        adapter: adapterResult.adapter,
        snapshot: adapterResult.snapshot,
        visibility: "staff_admin_test_only",
      });
    } catch (error) {
      console.error("[inspection] direct-connect adapter failed", error);
      return res.status(500).json({ error: "Could not run Direct Connect adapter." });
    }
  }
);

inspectionIntelligenceRouter.get(
  "/cases/:id/recommendations",
  async (req: Request, res: Response) => {
    try {
      const userId = clean((req.user as any)?.id, 120);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const caseId = clean(req.params.id, 80);
      if (!caseId) return res.status(400).json({ error: "Case id is required." });

      await ensurePolicyDefaults();
      const caseResult = await pool.query(
        `
      SELECT id, county_fips, state_code, surface, mode, objective_text
      FROM inspection_cases
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
        [caseId, userId]
      );
      const caseRow = caseResult.rows[0];
      if (!caseRow) return res.status(404).json({ error: "Inspection case not found." });

      const latest = await pool.query(
        `
      SELECT *
      FROM inspection_recommendation_snapshots
      WHERE case_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
        [caseId]
      );

      let snapshot = latest.rows[0];
      if (!snapshot) {
        const caseSurface = clean((caseRow as any).surface, 80);
        const caseMode = normalizeMode((caseRow as any).mode);
        const countyFips = normalizeCountyFips((caseRow as any).county_fips);
        const stateCode = normalizeStateCode((caseRow as any).state_code);

        if (countyFips && caseMode) {
          const reusableSnapshot = await findReusableSnapshotForCase({
            countyFips,
            stateCode,
            surface: normalizeSurface(caseSurface) || "scout",
            mode: caseMode,
            maxAgeHours: INSPECTION_GENERIC_DYNAMIC_CACHE_HOURS,
          });
          if (reusableSnapshot) {
            snapshot = await cloneSnapshotToCase({
              caseId,
              sourceSnapshot: reusableSnapshot,
              sourcePriority: "reused_surface_cache",
            });
          }
        }

        if (snapshot) {
          // Snapshot already cloned from recent county+surface+mode learning.
        } else if (caseSurface === "homescout") {
          const adapterResult = await createHomeScoutRecommendationSnapshot({
            caseId,
            caseRow: caseRow as Record<string, unknown>,
            listingIdOverride: clean((caseRow as any).listing_id, 180) || null,
            forceFresh: false,
          });
          snapshot = adapterResult.snapshot;
        } else if (caseSurface === "direct_connect") {
          const adapterResult = await createDirectConnectRecommendationSnapshot({
            caseId,
            caseRow: caseRow as Record<string, unknown>,
            forceFresh: false,
          });
          snapshot = adapterResult.snapshot;
        }
      }

      if (!snapshot) {
        const countyFips = clean(caseRow.county_fips, 10);

        const metricsResult =
          countyFips.length > 0
            ? await pool.query(
                `
              SELECT metric_key, metric_value, updated_at
              FROM county_metrics
              WHERE county_fips = $1
              ORDER BY updated_at DESC
              LIMIT 8
              `,
                [countyFips]
              )
            : { rows: [] as Array<Record<string, unknown>> };

        const entitiesResult =
          countyFips.length > 0
            ? await pool.query(
                `
              SELECT entity_type, label, status
              FROM county_entities
              WHERE county_fips = $1
                AND status = 'active'
              ORDER BY updated_at DESC
              LIMIT 8
              `,
                [countyFips]
              )
            : { rows: [] as Array<Record<string, unknown>> };

        const notesResult =
          countyFips.length > 0
            ? await pool.query(
                `
              SELECT category, content, created_at
              FROM county_notes
              WHERE county_fips = $1
              ORDER BY created_at DESC
              LIMIT 3
              `,
                [countyFips]
              )
            : { rows: [] as Array<Record<string, unknown>> };

        const hasFirstPartyCountySignals =
          metricsResult.rows.length > 0 ||
          entitiesResult.rows.length > 0 ||
          notesResult.rows.length > 0;

        if (hasFirstPartyCountySignals) {
          const firstPartyNextSteps = [
            "Use county intelligence containers first (metrics/entities/notes) before any fallback logic.",
            "Capture only minimum required photos; request extras only if confidence is below target.",
            "Route execution through the selected TradeScout surface with county-specific requirements.",
          ];
          const firstPartyProducts = metricsResult.rows.map((row) => ({
            type: "county_metric",
            key: clean((row as any).metric_key, 120),
            value: String((row as any).metric_value ?? ""),
            observedAt: (row as any).updated_at ?? null,
          }));
          const firstPartyPros = entitiesResult.rows.map((row) => ({
            type: clean((row as any).entity_type, 80) || "county_entity",
            label: clean((row as any).label, 255) || "County entity",
            status: clean((row as any).status, 40) || "active",
          }));
          const firstPartyRequirements = [
            "County container guidance included from site data snapshots.",
            ...notesResult.rows.map((row) => {
              const category = clean((row as any).category, 80) || "general";
              const content = clean((row as any).content, 400);
              return `${category}: ${content}`;
            }),
          ];
          const costRanges = [
            {
              name: "capture_session",
              min: 10,
              max: 10,
              currency: "USD",
              note: "Base capture fee applies; photo caps prevent overcapture.",
            },
          ];

          const inserted = await pool.query(
            `
          INSERT INTO inspection_recommendation_snapshots
          (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
          VALUES ($1, 'first_party_site_data', false, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
          RETURNING *
          `,
            [
              caseId,
              JSON.stringify(firstPartyNextSteps),
              JSON.stringify(firstPartyProducts),
              JSON.stringify(firstPartyPros),
              JSON.stringify(firstPartyRequirements),
              JSON.stringify(costRanges),
            ]
          );
          snapshot = inserted.rows[0];
        } else {
          const fallbackNextSteps = [
            "Validate scope and county-specific requirement checklist before submitting.",
            "Capture minimum required photos first; add more only when confidence is below threshold.",
            "Route to the correct TradeScout surface flow for execution and pricing.",
          ];
          const fallbackProducts = [
            {
              type: "reference_marker",
              label: "ArUco marker sheet",
              reason: "Primary calibration for highest measurement confidence.",
            },
          ];
          const fallbackPros = [
            {
              type: "verified_pro",
              label: "County-relevant pro shortlist",
              reason: "Use Trust/CVS-governed matching for the next execution step.",
            },
          ];
          const fallbackRequirements = [
            "County permit and inspection requirements vary; confirm local municipality final rules.",
            "Attach clear timestamp/GPS evidence and declared reference method.",
          ];
          const fallbackCosts = [
            {
              name: "capture_session",
              min: 10,
              max: 10,
              currency: "USD",
              note: "Base capture fee applies.",
            },
          ];

          const inserted = await pool.query(
            `
          INSERT INTO inspection_recommendation_snapshots
          (case_id, source_priority, fallback_used, next_steps_json, products_json, pros_json, requirements_json, cost_ranges_json)
          VALUES ($1, 'fallback_heuristic', true, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
          RETURNING *
          `,
            [
              caseId,
              JSON.stringify(fallbackNextSteps),
              JSON.stringify(fallbackProducts),
              JSON.stringify(fallbackPros),
              JSON.stringify(fallbackRequirements),
              JSON.stringify(fallbackCosts),
            ]
          );
          snapshot = inserted.rows[0];
        }
      }

      const artifactCount = await pool.query(
        `SELECT COUNT(*)::int AS total, AVG(quality_score)::numeric AS avg_quality FROM inspection_case_artifacts WHERE case_id = $1`,
        [caseId]
      );

      const policy = await pool.query(
        `
      SELECT min_photos, max_billable_photos, target_confidence_tier
      FROM inspection_capture_policies
      WHERE mode = $1
      LIMIT 1
      `,
        [caseRow.mode]
      );

      const totalPhotos = Number(artifactCount.rows[0]?.total || 0);
      const avgQuality = toFiniteNumber(artifactCount.rows[0]?.avg_quality) ?? null;
      const minPhotos = Number(policy.rows[0]?.min_photos || 2);
      const maxBillablePhotos = Number(policy.rows[0]?.max_billable_photos || 6);
      const meetsMinimum = totalPhotos >= minPhotos;
      const qualitySufficient = avgQuality === null ? true : avgQuality >= 0.75;
      const canStopCapture = meetsMinimum && qualitySufficient;

      return res.json({
        ok: true,
        case: caseRow,
        snapshot,
        captureProgress: {
          totalPhotos,
          remainingToMinimum: Math.max(minPhotos - totalPhotos, 0),
          maxBillablePhotos,
          capReached: totalPhotos >= maxBillablePhotos,
          targetConfidenceTier: String(policy.rows[0]?.target_confidence_tier || "B"),
        },
        billingGuidance: {
          canStopCapture,
          additionalPhotosSuggested: canStopCapture ? 0 : Math.max(minPhotos - totalPhotos, 1),
          reason: canStopCapture
            ? "Minimum capture and quality threshold met."
            : !meetsMinimum
              ? "Minimum required photo count not met yet."
              : "Quality threshold below target; one additional photo recommended.",
        },
        visibility: "staff_admin_test_only",
      });
    } catch (error) {
      console.error("[inspection] recommendations failed", error);
      return res.status(500).json({ error: "Could not get recommendations." });
    }
  }
);

export default inspectionIntelligenceRouter;
