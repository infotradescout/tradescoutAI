import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  botUiFindings,
  errorReports,
  missionControlActions,
  missionControlDecisions,
  missionControlSourceEnum,
  scoutInteractionFailureReasonEnum,
  scoutInteractionIntentEnum,
  scoutInteractions,
  type BotUiFinding,
  type InsertBotUiFinding,
  type InsertMissionControlAction,
  type InsertMissionControlDecision,
  type InsertScoutInteraction,
  type MissionControlAction,
  type MissionControlDecision,
  type ScoutInteraction,
} from "../../shared/schema";
import { db } from "../db";
import {
  FEATURE_CUSTOMER_IMPACT,
  FEATURE_RISK_SENTINEL,
  FEATURE_SCOPE_GOVERNOR,
  FEATURE_CHIEF_OF_STAFF,
} from "../../shared/governanceFlags";
import {
  type UserImpact,
  type RiskTag,
  type ChiefOfStaffStatus,
  type ScopeGovernorState,
} from "../../shared/missionControlGovernance";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = ONE_DAY_MS * 7;

export interface MissionControlSummary {
  last24hRange: { start: string; end: string };
  totalConnectionAttempts: number;
  successfulConnections: number;
  blockedConnections: number;
  confusingExperiences: number;
  scopeGovernor?: ScopeGovernorState;
  chiefOfStaffStatus?: ChiefOfStaffStatus;
}

export interface MissionControlFailure {
  id: string;
  sourceType: "bot_ui" | "scout" | "error_report";
  sourceId: string;
  who: string;
  countyFips?: string | null;
  role?: string | null;
  what: string;
  where: "UI" | "Scout" | "Route" | "Permission";
  why: string;
  fixLever: "ui" | "copy" | "route" | "permission" | "data";
  impactScore: number;
  occurrences: number;
  severity: number;
  intentStrength: number;
  latestAt: string;
  tags?: string[];
  userImpact?: UserImpact;
  riskTags?: RiskTag[];
}

export interface MissionControlCompromise {
  id: string;
  sourceType: "bot_ui" | "scout" | "error_report";
  description: string;
  route?: string;
  tag: "stub" | "partial" | "observer";
  observedAt: string;
}

export interface OneFixResult {
  action: MissionControlAction;
  failure: MissionControlFailure;
}

const INTENT_STRENGTH: Record<string, number> = {
  hire: 5,
  collaborate: 3,
  advise: 2,
  unknown: 1,
};

const PRIORITY_TO_SEVERITY: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
};

const FIX_LEVER_EFFORT: Record<MissionControlFailure["fixLever"], number> = {
  copy: 1,
  ui: 2,
  route: 3,
  permission: 4,
  data: 5,
};

function deriveUserImpact(failure: MissionControlFailure): UserImpact {
  if (failure.occurrences > 1) return "confusing";
  if (failure.where === "Permission" || failure.fixLever === "permission") return "frustrating";
  if (failure.tags?.includes("stub") || failure.tags?.includes("partial")) return "trust_breaking";
  return "neutral_incomplete";
}

function deriveRiskTags(failure: MissionControlFailure): RiskTag[] {
  const tags: RiskTag[] = [];
  const text = `${failure.why || ""} ${failure.what || ""}`.toLowerCase();

  if (text.includes("legal") || text.includes("license") || text.includes("compliance")) {
    tags.push("legal");
  }
  if (text.includes("safety") || text.includes("hazard") || text.includes("permit")) {
    tags.push("safety");
  }
  if (failure.fixLever === "permission" || text.includes("trust") || text.includes("fraud")) {
    tags.push("trust");
  }

  if (!tags.length) tags.push("operational");
  return tags;
}

function riskPriority(riskTags?: RiskTag[]): number {
  if (!riskTags || riskTags.length === 0) return 0;
  if (riskTags.includes("legal") || riskTags.includes("safety")) return 2;
  if (riskTags.includes("trust")) return 1;
  return 0;
}

function computeChiefStatus(failures: MissionControlFailure[]): ChiefOfStaffStatus {
  const highImpact = failures.some((f) => f.severity >= 4);
  const trustIssues = failures.some((f) => {
    const impact = f.userImpact ?? deriveUserImpact(f);
    const risks = f.riskTags ?? deriveRiskTags(f);
    return impact === "trust_breaking" || risks.includes("trust");
  });
  const safetyLegal = failures.some((f) => {
    const risks = f.riskTags ?? deriveRiskTags(f);
    return risks.some((r) => r === "legal" || r === "safety");
  });
  const repeats = failures.some((f) => f.occurrences > 1);

  if (highImpact || trustIssues || safetyLegal || repeats) return "action_required";
  return "no_action_required";
}

function clampSeverity(value: number | null | undefined): number {
  if (!Number.isFinite(value as number)) return 1;
  return Math.min(5, Math.max(1, Math.round(value as number)));
}

function intentStrength(intent?: string | null): number {
  if (!intent) return INTENT_STRENGTH.unknown;
  const normalized = intent.toLowerCase();
  return INTENT_STRENGTH[normalized] ?? INTENT_STRENGTH.unknown;
}

function severityFromScout(row: ScoutInteraction): number {
  if (row.outcome === "blocked") return 5;
  if (row.outcome === "abandoned") return 4;
  if (row.outcome === "handed_off") return 3;
  if (row.failureReason === "permission") return 4;
  if (row.failureReason === "no_route") return 4;
  if (row.failureReason === "ui_dead_end") return 4;
  if (row.failureReason === "unclear_copy") return 3;
  return 2;
}

function fixLeverFromScout(row: ScoutInteraction): MissionControlFailure["fixLever"] {
  switch (row.failureReason) {
    case "permission":
      return "permission";
    case "no_route":
      return "route";
    case "ui_dead_end":
      return "ui";
    case "unclear_copy":
      return "copy";
    case "missing_data":
      return "data";
    default:
      return "ui";
  }
}

function fixLeverFromBot(row: BotUiFinding): MissionControlFailure["fixLever"] {
  switch (row.failureType) {
    case "permission_block":
      return "permission";
    case "stub":
    case "misleading":
      return "copy";
    case "confusing":
      return "copy";
    case "broken":
    default:
      return "ui";
  }
}

function parseRoute(currentUrl?: string | null): string | null {
  if (!currentUrl) return null;
  try {
    const url = new URL(currentUrl);
    return url.pathname || null;
  } catch {
    // Fall back to bare path
    const stripped = currentUrl.split("?")[0];
    return stripped || null;
  }
}

function buildImpact(occurrences: number, severity: number, intentStrengthValue: number): number {
  return occurrences * severity * intentStrengthValue;
}

export async function recordBotUiFinding(input: InsertBotUiFinding) {
  const sanitized: InsertBotUiFinding = {
    ...input,
    severity: clampSeverity(input.severity ?? 1),
    botName: (input.botName || "unknown-bot").slice(0, 120),
    route: (input.route || "unknown").slice(0, 512),
    expectedOutcome: input.expectedOutcome?.slice(0, 4000),
    actualOutcome: input.actualOutcome?.slice(0, 4000),
    actionAttempted: input.actionAttempted?.slice(0, 4000),
  };

  await db.insert(botUiFindings).values(sanitized);
}

export async function recordScoutInteraction(input: InsertScoutInteraction) {
  const allowedFailureReasons = new Set(scoutInteractionFailureReasonEnum.enumValues);
  const allowedIntents = new Set(scoutInteractionIntentEnum.enumValues);

  const intent = allowedIntents.has(input.intent as any) ? input.intent : "unknown";
  const failureReason = input.failureReason;
  const outcome = input.outcome;

  if (!outcome) {
    throw new Error("Outcome is required for Scout interaction logging");
  }

  if (outcome !== "completed" && !failureReason) {
    throw new Error("failure_reason is required for non-completed Scout outcomes");
  }

  if (failureReason && !allowedFailureReasons.has(failureReason as any)) {
    throw new Error(`Invalid failure_reason for Scout interaction: ${failureReason}`);
  }

  const sanitized: InsertScoutInteraction = {
    ...input,
    intent,
    scoutConfidence: Number.isFinite(input.scoutConfidence)
      ? Math.max(0, Math.min(100, Math.round(input.scoutConfidence as number)))
      : 0,
    failureReason: outcome === "completed" ? null : failureReason,
  };

  await db.insert(scoutInteractions).values(sanitized);
}

export async function getMissionControlSummary(now = new Date()): Promise<MissionControlSummary> {
  const since = new Date(now.getTime() - ONE_DAY_MS);
  const baseWhere = gte(scoutInteractions.createdAt, since);

  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scoutInteractions)
    .where(baseWhere);

  const [success] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scoutInteractions)
    .where(
      and(baseWhere, inArray(scoutInteractions.outcome, ["completed", "handed_off"] as const))
    );

  const [blocked] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scoutInteractions)
    .where(and(baseWhere, eq(scoutInteractions.outcome, "blocked" as const)));

  const [confusing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scoutInteractions)
    .where(
      and(
        baseWhere,
        inArray(scoutInteractions.failureReason, ["unclear_copy", "ui_dead_end"] as const)
      )
    );

  const summary: MissionControlSummary = {
    last24hRange: { start: since.toISOString(), end: now.toISOString() },
    totalConnectionAttempts: total?.count ?? 0,
    successfulConnections: success?.count ?? 0,
    blockedConnections: blocked?.count ?? 0,
    confusingExperiences: confusing?.count ?? 0,
  };

  if (FEATURE_SCOPE_GOVERNOR) {
    summary.scopeGovernor = await getScopeGovernorState(now);
  }

  if (FEATURE_CHIEF_OF_STAFF) {
    const failures = await getMissionControlFailures(now);
    summary.chiefOfStaffStatus = computeChiefStatus(failures);
  }

  return summary;
}

async function fetchBotFailures(since: Date): Promise<MissionControlFailure[]> {
  const rows = await db
    .select({
      id: botUiFindings.id,
      route: botUiFindings.route,
      botName: botUiFindings.botName,
      actionAttempted: botUiFindings.actionAttempted,
      expectedOutcome: botUiFindings.expectedOutcome,
      actualOutcome: botUiFindings.actualOutcome,
      failureType: botUiFindings.failureType,
      severity: botUiFindings.severity,
      createdAt: botUiFindings.createdAt,
    })
    .from(botUiFindings)
    .where(gte(botUiFindings.createdAt, since))
    .orderBy(desc(botUiFindings.createdAt));

  const grouped = new Map<string, MissionControlFailure>();

  for (const row of rows) {
    const key = `${row.route}::${row.failureType}`;
    const existing = grouped.get(key);
    const severity = clampSeverity(row.severity ?? 1);
    const intentWeight = 2; // Bots report gaps; treat intent strength as medium-low
    const impactScore = buildImpact((existing?.occurrences ?? 0) + 1, severity, intentWeight);

    const failure: MissionControlFailure = {
      id: existing?.id || `bot:${key}`,
      sourceType: "bot_ui",
      sourceId: key,
      who: `${row.botName} (bot)`.substring(0, 120),
      countyFips: null,
      role: "bot",
      what: row.actionAttempted || row.expectedOutcome || row.route,
      where: "UI",
      why: row.actualOutcome || row.failureType,
      fixLever: fixLeverFromBot(row as BotUiFinding),
      impactScore,
      occurrences: (existing?.occurrences ?? 0) + 1,
      severity,
      intentStrength: intentWeight,
      latestAt:
        existing?.latestAt && existing.latestAt > (row.createdAt as any as string)
          ? existing.latestAt
          : new Date(row.createdAt || new Date()).toISOString(),
      tags: row.failureType === "stub" ? ["stub"] : undefined,
    };

    grouped.set(key, failure);
  }

  return Array.from(grouped.values());
}

async function fetchScoutFailures(since: Date): Promise<MissionControlFailure[]> {
  const rows = await db
    .select({
      id: scoutInteractions.id,
      userRole: scoutInteractions.userRole,
      countyFips: scoutInteractions.countyFips,
      intent: scoutInteractions.intent,
      outcome: scoutInteractions.outcome,
      failureReason: scoutInteractions.failureReason,
      scoutConfidence: scoutInteractions.scoutConfidence,
      createdAt: scoutInteractions.createdAt,
    })
    .from(scoutInteractions)
    .where(
      and(
        gte(scoutInteractions.createdAt, since),
        inArray(scoutInteractions.outcome, ["blocked", "handed_off", "abandoned"] as const)
      )
    )
    .orderBy(desc(scoutInteractions.createdAt));

  const grouped = new Map<string, MissionControlFailure>();

  for (const row of rows) {
    const key = `${row.intent}::${row.failureReason || row.outcome}::${row.countyFips ?? "unknown"}`;
    const existing = grouped.get(key);
    const severity = severityFromScout(row as ScoutInteraction);
    const intentWeight = intentStrength(row.intent);
    const impactScore = buildImpact((existing?.occurrences ?? 0) + 1, severity, intentWeight);

    const failure: MissionControlFailure = {
      id: existing?.id || `scout:${key}`,
      sourceType: "scout",
      sourceId: key,
      who: `${row.userRole || "homeowner"}${row.countyFips ? ` in ${row.countyFips}` : ""}`,
      countyFips: row.countyFips,
      role: row.userRole,
      what: row.intent || "unknown",
      where:
        row.failureReason === "permission"
          ? "Permission"
          : row.failureReason === "no_route"
            ? "Route"
            : row.failureReason === "ui_dead_end"
              ? "UI"
              : "Scout",
      why: row.failureReason || row.outcome,
      fixLever: fixLeverFromScout(row as ScoutInteraction),
      impactScore,
      occurrences: (existing?.occurrences ?? 0) + 1,
      severity,
      intentStrength: intentWeight,
      latestAt:
        existing?.latestAt && existing.latestAt > (row.createdAt as any as string)
          ? existing.latestAt
          : new Date(row.createdAt || new Date()).toISOString(),
      tags:
        row.failureReason === "ui_dead_end" || row.failureReason === "no_route"
          ? ["partial"]
          : undefined,
    };

    grouped.set(key, failure);
  }

  return Array.from(grouped.values());
}

async function fetchErrorFailures(since: Date): Promise<MissionControlFailure[]> {
  const rows = await db
    .select({
      id: errorReports.id,
      status: errorReports.status,
      priority: errorReports.priority,
      currentUrl: errorReports.currentUrl,
      title: errorReports.title,
      createdAt: errorReports.createdAt,
    })
    .from(errorReports)
    .where(
      and(
        gte(errorReports.createdAt, since),
        inArray(errorReports.status, ["open", "in_progress"] as const)
      )
    )
    .orderBy(desc(errorReports.createdAt));

  const grouped = new Map<string, MissionControlFailure>();

  for (const row of rows) {
    const route = parseRoute(row.currentUrl) || "unknown";
    const key = `${route}::${row.priority || "medium"}`;
    const existing = grouped.get(key);
    const severity = clampSeverity(PRIORITY_TO_SEVERITY[row.priority ?? "medium"] ?? 3);
    const intentWeight = 2;
    const impactScore = buildImpact((existing?.occurrences ?? 0) + 1, severity, intentWeight);

    const failure: MissionControlFailure = {
      id: existing?.id || `error:${key}`,
      sourceType: "error_report",
      sourceId: key,
      who: "unknown",
      countyFips: null,
      role: null,
      what: row.title,
      where: "Route",
      why: route,
      fixLever: "ui",
      impactScore,
      occurrences: (existing?.occurrences ?? 0) + 1,
      severity,
      intentStrength: intentWeight,
      latestAt:
        existing?.latestAt && existing.latestAt > (row.createdAt as any as string)
          ? existing.latestAt
          : new Date(row.createdAt || new Date()).toISOString(),
    };

    grouped.set(key, failure);
  }

  return Array.from(grouped.values());
}

export async function getMissionControlFailures(
  now = new Date()
): Promise<MissionControlFailure[]> {
  const since = new Date(now.getTime() - ONE_DAY_MS);
  const [bot, scout, errors] = await Promise.all([
    fetchBotFailures(since),
    fetchScoutFailures(since),
    fetchErrorFailures(since),
  ]);

  let combined: MissionControlFailure[] = [...bot, ...scout, ...errors];

  if (FEATURE_CUSTOMER_IMPACT || FEATURE_RISK_SENTINEL) {
    combined = combined.map((failure) => {
      const updated: MissionControlFailure = { ...failure };
      if (FEATURE_CUSTOMER_IMPACT) {
        updated.userImpact = deriveUserImpact(updated);
      }
      if (FEATURE_RISK_SENTINEL) {
        updated.riskTags = deriveRiskTags(updated);
      }
      return updated;
    });
  }

  return combined.sort((a, b) => {
    if (FEATURE_RISK_SENTINEL) {
      const riskDelta = riskPriority(b.riskTags) - riskPriority(a.riskTags);
      if (riskDelta !== 0) return riskDelta;
    }
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
    return (FIX_LEVER_EFFORT[a.fixLever] ?? 5) - (FIX_LEVER_EFFORT[b.fixLever] ?? 5);
  });
}

export async function getMissionControlCompromises(
  now = new Date()
): Promise<MissionControlCompromise[]> {
  const failures = await getMissionControlFailures(now);
  const compromises: MissionControlCompromise[] = [];

  for (const failure of failures) {
    if (failure.sourceType === "bot_ui") {
      const tag: MissionControlCompromise["tag"] =
        failure.why?.includes("stub") || failure.fixLever === "copy" ? "stub" : "partial";
      compromises.push({
        id: `compromise:${failure.sourceId}`,
        sourceType: failure.sourceType,
        description: failure.what,
        route: failure.sourceId.split("::")[0],
        tag,
        observedAt: failure.latestAt,
      });
    }

    if (failure.sourceType === "scout") {
      const tag: MissionControlCompromise["tag"] =
        failure.fixLever === "permission" ? "observer" : "partial";
      compromises.push({
        id: `compromise:${failure.sourceId}`,
        sourceType: failure.sourceType,
        description: `${failure.what} (${failure.why})`,
        route: failure.countyFips ?? undefined,
        tag,
        observedAt: failure.latestAt,
      });
    }
  }

  return compromises;
}

export async function getScopeGovernorState(now = new Date()): Promise<ScopeGovernorState> {
  if (!FEATURE_SCOPE_GOVERNOR) {
    return { scopeFrozen: false, reasons: [] };
  }

  const since = new Date(now.getTime() - ONE_DAY_MS * 3);
  const sinceDate = since.toISOString().split("T")[0];

  const [bot, scout, errors] = await Promise.all([
    fetchBotFailures(since),
    fetchScoutFailures(since),
    fetchErrorFailures(since),
  ]);

  const combined = [...bot, ...scout, ...errors];
  const reasons: string[] = [];

  if (combined.some((f) => f.occurrences > 1)) {
    reasons.push("Repeated failures in last 3 days");
  }

  const deferredWithoutReason = await db
    .select({ id: missionControlDecisions.id })
    .from(missionControlDecisions)
    .where(
      and(
        gte(missionControlDecisions.decisionDate, sinceDate),
        eq(missionControlDecisions.action, "defer" as const),
        sql`coalesce(${missionControlDecisions.deferReason}, '') = ''`
      )
    );

  if (deferredWithoutReason.length > 0) {
    reasons.push("Deferred fixes without reasons in last 3 days");
  }

  return {
    scopeFrozen: reasons.length > 0,
    reasons,
  };
}

export async function getScoutHealthSummary(now = new Date()): Promise<string> {
  const since = new Date(now.getTime() - ONE_WEEK_MS);
  const rows = await db
    .select({
      outcome: scoutInteractions.outcome,
      failureReason: scoutInteractions.failureReason,
      intent: scoutInteractions.intent,
      scoutConfidence: scoutInteractions.scoutConfidence,
      createdAt: scoutInteractions.createdAt,
    })
    .from(scoutInteractions)
    .where(gte(scoutInteractions.createdAt, since));

  const total = rows.length;
  if (total === 0) {
    return "Last 7 days: no Scout interactions recorded.";
  }

  const highConfidence = rows.filter((r) => (r.scoutConfidence ?? 0) >= 70).length;
  const lowConfidence = rows.filter((r) => (r.scoutConfidence ?? 0) < 40).length;
  const handoffs = rows.filter((r) => r.outcome === "handed_off").length;
  const blocked = rows.filter((r) => r.outcome === "blocked").length;

  const intents: Record<string, number> = {};
  for (const r of rows) {
    const key = r.intent || "unknown";
    intents[key] = (intents[key] ?? 0) + 1;
  }

  const topIntent = Object.entries(intents)
    .filter(([k]) => k && k !== "unknown")
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  const parts = [
    `Last 7 days: ${total} Scout interactions.`,
    `Confidence: high ${highConfidence}, low ${lowConfidence}. Handoffs: ${handoffs}.`,
    `Top intent: ${topIntent || "not yet classified"}.`,
    `Blocked: ${blocked}${blocked > 0 ? " (should be 0)." : " (good)."}`,
  ];

  return parts.join(" ");
}
export async function getOrCreateOneFix(now = new Date()): Promise<OneFixResult | null> {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Check for already-decided fixes today to avoid recommending again
  const decidedToday = await db
    .select({
      sourceType: missionControlDecisions.recommendedFixSourceType,
      sourceId: missionControlDecisions.recommendedFixSourceId,
    })
    .from(missionControlDecisions)
    .where(eq(missionControlDecisions.decisionDate, todayStr));

  const excludedKeys = new Set(decidedToday.map((d) => `${d.sourceType}::${d.sourceId}`));

  const existing = await db
    .select()
    .from(missionControlActions)
    .where(eq(missionControlActions.status, "open"))
    .orderBy(desc(missionControlActions.impactScore), desc(missionControlActions.createdAt))
    .limit(1);

  if (existing.length > 0) {
    const key = `${existing[0].sourceType}::${existing[0].sourceId}`;
    if (excludedKeys.has(key)) {
      // Already decided today; skip to next
    } else {
      const [failure] = (await getMissionControlFailures(now)).filter(
        (f) => f.sourceId === existing[0].sourceId
      );
      if (failure) {
        return { action: existing[0], failure };
      }
    }
  }

  const failures = await getMissionControlFailures(now);
  const candidate = failures.find((f) => {
    const key = `${f.sourceType}::${f.sourceId}`;
    return !excludedKeys.has(key);
  });

  if (!candidate) return null;

  const upsertPayload: InsertMissionControlAction = {
    sourceType: candidate.sourceType as (typeof missionControlSourceEnum.enumValues)[number],
    sourceId: candidate.sourceId,
    status: "open",
    summary: candidate.what,
    suggestedFix: candidate.fixLever,
    impactScore: Math.round(candidate.impactScore),
  } as InsertMissionControlAction;

  const [action] = await db
    .insert(missionControlActions)
    .values(upsertPayload)
    .onConflictDoUpdate({
      target: [missionControlActions.sourceType, missionControlActions.sourceId],
      set: {
        status: "open",
        impactScore: upsertPayload.impactScore,
        summary: upsertPayload.summary,
        suggestedFix: upsertPayload.suggestedFix,
        updatedAt: new Date(),
      },
    })
    .returning();

  return { action, failure: candidate };
}

export async function updateOneFixStatus(
  id: string,
  status: "done" | "deferred",
  reason?: string,
  decidedByUserId?: string
): Promise<MissionControlAction | null> {
  const [updated] = await db
    .update(missionControlActions)
    .set({
      status,
      decisionReason: reason,
      decidedByUserId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(missionControlActions.id, id))
    .returning();

  return updated ?? null;
}

export async function recordDecision(input: {
  recommendedFixSourceType: string;
  recommendedFixSourceId: string;
  action: "done" | "defer";
  deferReason?: string;
  actorUserId?: string;
}): Promise<MissionControlDecision> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const payload: InsertMissionControlDecision = {
    decisionDate: todayStr,
    recommendedFixSourceType: input.recommendedFixSourceType as any,
    recommendedFixSourceId: input.recommendedFixSourceId,
    action: input.action,
    deferReason: input.deferReason ?? null,
    actorUserId: input.actorUserId ?? null,
  };

  const [decision] = await db.insert(missionControlDecisions).values(payload).returning();
  return decision;
}

export async function getTodayDecisions(now = new Date()): Promise<MissionControlDecision[]> {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  return db
    .select()
    .from(missionControlDecisions)
    .where(eq(missionControlDecisions.decisionDate, todayStr))
    .orderBy(desc(missionControlDecisions.createdAt));
}
