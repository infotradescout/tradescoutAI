import type { ScoutAction } from "../../client/src/scout/state";

export type SituationRole = "guest" | "homeowner" | "contractor" | "realtor" | "admin" | "other";

export type SituationStateTag = "initiating" | "exploring" | "executing" | "blocked" | "reengaging";

export type SituationConfidenceBand = "low" | "medium" | "high";

export type SituationUrgencySource =
  | "deadline"
  | "stalled_objective"
  | "unread_contact"
  | "failed_action"
  | "direct_user_signal"
  | "other";

export interface SituationUserContext {
  userId?: string;
  isAuthenticated: boolean;
  userRole?: string;
  trustLevel?: "low" | "medium" | "high";
  location?: {
    county?: string;
    state?: string;
    region?: string;
  };
}

export interface SituationObjective {
  id: string;
  title?: string;
  intentClass?: string;
  status: "active" | "paused" | "completed" | "abandoned";
  progressPct?: number;
  updatedAt?: string;
}

export interface SituationEvent {
  type:
    | "route_success"
    | "route_failure"
    | "action_success"
    | "action_failure"
    | "objective_started"
    | "objective_completed"
    | "contact_requested"
    | "contact_granted"
    | "contact_blocked"
    | "message_sent"
    | "other";
  timestamp: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface SituationUrgencySignal {
  source: SituationUrgencySource;
  level: 1 | 2 | 3;
  observedAt?: string;
  note?: string;
}

export interface SituationAnalysisInput {
  intent: string;
  userContext: SituationUserContext;
  activeObjectives?: SituationObjective[];
  recentEvents?: SituationEvent[];
  urgencySignals?: SituationUrgencySignal[];
  now?: Date;
}

export interface SituationFactorScore {
  factor:
    | "role_readiness"
    | "objective_momentum"
    | "event_signal"
    | "urgency"
    | "inactivity"
    | "trust";
  raw: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface SituationRoutingRecommendation {
  featureId: string;
  action: ScoutAction;
  priority: number;
  confidence: number;
  confidenceBand: SituationConfidenceBand;
  rationale: string;
}

export interface SituationAnalysisResult {
  stateTag: SituationStateTag;
  contextScore: number;
  confidenceAdjustment: number;
  confidenceBand: SituationConfidenceBand;
  factors: SituationFactorScore[];
  recommendations: SituationRoutingRecommendation[];
  rationale: string;
  deterministicSignature: string;
  computedAt: string;
}

const ROLE_BASELINE: Record<SituationRole, number> = {
  guest: 38,
  homeowner: 62,
  contractor: 68,
  realtor: 66,
  admin: 72,
  other: 55,
};

const FACTOR_WEIGHTS = {
  role: 0.18,
  objective: 0.26,
  event: 0.2,
  urgency: 0.2,
  inactivity: 0.1,
  trust: 0.06,
} as const;

const HOURS_48_MS = 48 * 60 * 60 * 1000;
const HOURS_72_MS = 72 * 60 * 60 * 1000;

const DEFAULT_ACTIONS: Record<string, ScoutAction> = {
  direct_connect: { type: "NAVIGATE", to: "/direct-connect", label: "Direct Connect" },
  community: { type: "NAVIGATE", to: "/community", label: "Community" },
  exchange: { type: "NAVIGATE", to: "/exchange", label: "Exchange" },
  homescout: { type: "NAVIGATE", to: "/real-estate-marketplace", label: "HomeScout" },
  maps: { type: "NAVIGATE", to: "/maps", label: "Maps" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRole(userRole?: string): SituationRole {
  const role = String(userRole || "")
    .trim()
    .toLowerCase();

  if (!role) return "guest";
  if (role.includes("home")) return "homeowner";
  if (role.includes("contract") || role.includes("service") || role.includes("provider")) {
    return "contractor";
  }
  if (role.includes("realtor") || role.includes("agent") || role.includes("broker")) {
    return "realtor";
  }
  if (role.includes("admin") || role.includes("owner")) return "admin";
  return "other";
}

function parseTimeMs(value?: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function sortEventsDeterministically(events: SituationEvent[]): SituationEvent[] {
  return [...events].sort((a, b) => {
    const ta = parseTimeMs(a.timestamp) ?? 0;
    const tb = parseTimeMs(b.timestamp) ?? 0;
    if (ta !== tb) return ta - tb;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return JSON.stringify(a.metadata ?? {}).localeCompare(JSON.stringify(b.metadata ?? {}));
  });
}

function sortSignalsDeterministically(signals: SituationUrgencySignal[]): SituationUrgencySignal[] {
  return [...signals].sort((a, b) => {
    if (a.level !== b.level) return b.level - a.level;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    const ta = parseTimeMs(a.observedAt) ?? 0;
    const tb = parseTimeMs(b.observedAt) ?? 0;
    return ta - tb;
  });
}

function describeBand(band: SituationConfidenceBand): string {
  if (band === "high") return "high confidence";
  if (band === "medium") return "medium confidence";
  return "low confidence";
}

/**
 * Situation-aware analyzer for Scout routing.
 * Deterministic by design so repeated inputs yield identical outputs.
 */
export class ScoutSituationAnalyzer {
  /**
   * Analyze state-of-play and produce confidence adjustments + recommendations.
   */
  static analyze(input: SituationAnalysisInput): SituationAnalysisResult {
    const now = input.now ?? new Date();
    const role = normalizeRole(input.userContext.userRole);
    const objectives = Array.isArray(input.activeObjectives)
      ? [...input.activeObjectives]
      : ([] as SituationObjective[]);
    const events = sortEventsDeterministically(
      Array.isArray(input.recentEvents) ? input.recentEvents : []
    );
    const signals = sortSignalsDeterministically(
      Array.isArray(input.urgencySignals) ? input.urgencySignals : []
    );

    const factors: SituationFactorScore[] = [
      this.scoreRoleReadiness(role),
      this.scoreObjectiveMomentum(objectives, now),
      this.scoreEventSignal(events, now),
      this.scoreUrgency(signals),
      this.scoreInactivity(objectives, events, now),
      this.scoreTrustSignal(input.userContext.trustLevel),
    ];

    const weighted = factors.reduce((sum, f) => sum + f.contribution, 0);
    const contextScore = clamp(Math.round(weighted), 0, 100);
    const confidenceBand = this.deriveConfidenceBand(contextScore);
    const stateTag = this.deriveStateTag({ objectives, events, signals, now, contextScore });
    const confidenceAdjustment = this.deriveAdjustment({
      confidenceBand,
      stateTag,
      urgencySignals: signals,
      contextScore,
    });
    const recommendations = this.buildRecommendations({
      intent: input.intent,
      confidenceBand,
      contextScore,
      stateTag,
      objectives,
      signals,
    });

    const rationale = this.buildRationale({ factors, stateTag, confidenceBand, contextScore });
    const deterministicSignature = this.buildSignature({
      intent: input.intent,
      role,
      objectives,
      events,
      signals,
      contextScore,
      confidenceBand,
      stateTag,
    });

    return {
      stateTag,
      contextScore,
      confidenceAdjustment,
      confidenceBand,
      factors,
      recommendations,
      rationale,
      deterministicSignature,
      computedAt: now.toISOString(),
    };
  }

  /**
   * Apply situation-based adjustment to a base confidence score.
   */
  static applyAdjustment(baseConfidence: number, analysis: SituationAnalysisResult): number {
    const boundedBase = clamp(baseConfidence, 0, 1);
    return clamp(Number((boundedBase + analysis.confidenceAdjustment).toFixed(3)), 0.01, 0.99);
  }

  /**
   * Build readable confidence band boundaries for UI labels.
   */
  static bandBoundaries(band: SituationConfidenceBand): {
    min: number;
    max: number;
    label: string;
  } {
    if (band === "high") return { min: 0.76, max: 0.99, label: "High confidence" };
    if (band === "medium") return { min: 0.46, max: 0.75, label: "Medium confidence" };
    return { min: 0.05, max: 0.45, label: "Low confidence" };
  }

  private static scoreRoleReadiness(role: SituationRole): SituationFactorScore {
    const raw = ROLE_BASELINE[role];
    return {
      factor: "role_readiness",
      raw,
      weight: FACTOR_WEIGHTS.role,
      contribution: raw * FACTOR_WEIGHTS.role,
      reason: `Role baseline for ${role}`,
    };
  }

  private static scoreObjectiveMomentum(
    objectives: SituationObjective[],
    now: Date
  ): SituationFactorScore {
    if (objectives.length === 0) {
      const raw = 45;
      return {
        factor: "objective_momentum",
        raw,
        weight: FACTOR_WEIGHTS.objective,
        contribution: raw * FACTOR_WEIGHTS.objective,
        reason: "No active objective history available",
      };
    }

    let total = 0;
    for (const objective of objectives) {
      const progress = clamp(Number(objective.progressPct ?? 0), 0, 100);
      const statusBias =
        objective.status === "completed"
          ? 90
          : objective.status === "active"
            ? 70
            : objective.status === "paused"
              ? 40
              : 15;
      const updatedMs = parseTimeMs(objective.updatedAt);
      const recencyPenalty =
        updatedMs === null ? 12 : now.getTime() - updatedMs > HOURS_72_MS ? 18 : 0;
      total += clamp(Math.round(statusBias * 0.6 + progress * 0.4 - recencyPenalty), 0, 100);
    }

    const raw = Math.round(total / objectives.length);
    return {
      factor: "objective_momentum",
      raw,
      weight: FACTOR_WEIGHTS.objective,
      contribution: raw * FACTOR_WEIGHTS.objective,
      reason: `Objective momentum across ${objectives.length} objective(s)`,
    };
  }

  private static scoreEventSignal(events: SituationEvent[], now: Date): SituationFactorScore {
    if (events.length === 0) {
      const raw = 50;
      return {
        factor: "event_signal",
        raw,
        weight: FACTOR_WEIGHTS.event,
        contribution: raw * FACTOR_WEIGHTS.event,
        reason: "No recent event data",
      };
    }

    let signal = 50;
    for (const event of events.slice(-20)) {
      const ageMs = Math.max(0, now.getTime() - (parseTimeMs(event.timestamp) ?? now.getTime()));
      const freshness = ageMs <= HOURS_48_MS ? 1 : 0.6;
      const weight = clamp(Number(event.weight ?? 1), 0.5, 2);

      if (event.type === "route_success" || event.type === "action_success")
        signal += 4 * freshness * weight;
      if (event.type === "objective_completed" || event.type === "contact_granted")
        signal += 5 * freshness * weight;
      if (event.type === "route_failure" || event.type === "action_failure")
        signal -= 6 * freshness * weight;
      if (event.type === "contact_blocked") signal -= 8 * freshness * weight;
    }

    const raw = clamp(Math.round(signal), 0, 100);
    return {
      factor: "event_signal",
      raw,
      weight: FACTOR_WEIGHTS.event,
      contribution: raw * FACTOR_WEIGHTS.event,
      reason: `Event-derived signal from ${Math.min(events.length, 20)} event(s)`,
    };
  }

  private static scoreUrgency(signals: SituationUrgencySignal[]): SituationFactorScore {
    if (signals.length === 0) {
      const raw = 48;
      return {
        factor: "urgency",
        raw,
        weight: FACTOR_WEIGHTS.urgency,
        contribution: raw * FACTOR_WEIGHTS.urgency,
        reason: "No explicit urgency indicators",
      };
    }

    let urgencyScore = 45;
    for (const signal of signals.slice(0, 8)) {
      const base = signal.level === 3 ? 16 : signal.level === 2 ? 11 : 6;
      const sourceBias =
        signal.source === "deadline"
          ? 1.2
          : signal.source === "failed_action"
            ? 1.15
            : signal.source === "direct_user_signal"
              ? 1.1
              : 1;
      urgencyScore += base * sourceBias;
    }

    const raw = clamp(Math.round(urgencyScore), 0, 100);
    return {
      factor: "urgency",
      raw,
      weight: FACTOR_WEIGHTS.urgency,
      contribution: raw * FACTOR_WEIGHTS.urgency,
      reason: `Urgency from ${signals.length} signal(s)`,
    };
  }

  private static scoreInactivity(
    objectives: SituationObjective[],
    events: SituationEvent[],
    now: Date
  ): SituationFactorScore {
    const allTimes: number[] = [];
    for (const objective of objectives) {
      const t = parseTimeMs(objective.updatedAt);
      if (t !== null) allTimes.push(t);
    }
    for (const event of events.slice(-10)) {
      const t = parseTimeMs(event.timestamp);
      if (t !== null) allTimes.push(t);
    }

    if (allTimes.length === 0) {
      const raw = 55;
      return {
        factor: "inactivity",
        raw,
        weight: FACTOR_WEIGHTS.inactivity,
        contribution: raw * FACTOR_WEIGHTS.inactivity,
        reason: "No activity timestamps available",
      };
    }

    const latest = Math.max(...allTimes);
    const ageMs = now.getTime() - latest;

    const raw =
      ageMs >= HOURS_72_MS
        ? 20
        : ageMs >= HOURS_48_MS
          ? 35
          : ageMs >= 24 * 60 * 60 * 1000
            ? 55
            : 75;

    return {
      factor: "inactivity",
      raw,
      weight: FACTOR_WEIGHTS.inactivity,
      contribution: raw * FACTOR_WEIGHTS.inactivity,
      reason: `Last activity ${Math.round(ageMs / (60 * 60 * 1000))}h ago`,
    };
  }

  private static scoreTrustSignal(trustLevel?: "low" | "medium" | "high"): SituationFactorScore {
    const raw =
      trustLevel === "high" ? 75 : trustLevel === "medium" ? 58 : trustLevel === "low" ? 42 : 52;
    return {
      factor: "trust",
      raw,
      weight: FACTOR_WEIGHTS.trust,
      contribution: raw * FACTOR_WEIGHTS.trust,
      reason: `Trust level: ${trustLevel ?? "unknown"}`,
    };
  }

  private static deriveConfidenceBand(contextScore: number): SituationConfidenceBand {
    if (contextScore >= 76) return "high";
    if (contextScore >= 46) return "medium";
    return "low";
  }

  private static deriveStateTag(input: {
    objectives: SituationObjective[];
    events: SituationEvent[];
    signals: SituationUrgencySignal[];
    now: Date;
    contextScore: number;
  }): SituationStateTag {
    const hasActiveObjective = input.objectives.some((o) => o.status === "active");
    const hasSevereUrgency = input.signals.some((s) => s.level === 3);
    const failures = input.events.filter(
      (e) =>
        e.type === "action_failure" || e.type === "route_failure" || e.type === "contact_blocked"
    ).length;

    const latestActivity = Math.max(
      0,
      ...input.events
        .map((e) => parseTimeMs(e.timestamp) ?? 0)
        .concat(input.objectives.map((o) => parseTimeMs(o.updatedAt) ?? 0))
    );
    const stale = latestActivity > 0 && input.now.getTime() - latestActivity >= HOURS_48_MS;

    if (failures >= 2 && hasSevereUrgency) return "blocked";
    if (stale && hasActiveObjective) return "reengaging";
    if (hasActiveObjective && input.contextScore >= 60) return "executing";
    if (input.contextScore >= 45) return "exploring";
    return "initiating";
  }

  private static deriveAdjustment(input: {
    confidenceBand: SituationConfidenceBand;
    stateTag: SituationStateTag;
    urgencySignals: SituationUrgencySignal[];
    contextScore: number;
  }): number {
    const bandBase =
      input.confidenceBand === "high" ? 0.1 : input.confidenceBand === "medium" ? 0.02 : -0.08;
    const urgencyBoost = input.urgencySignals.some((s) => s.level === 3) ? 0.04 : 0;
    const stateBias =
      input.stateTag === "blocked"
        ? -0.07
        : input.stateTag === "reengaging"
          ? -0.03
          : input.stateTag === "executing"
            ? 0.03
            : 0;

    const scoreBias = input.contextScore >= 85 ? 0.03 : input.contextScore <= 30 ? -0.04 : 0;
    return clamp(Number((bandBase + urgencyBoost + stateBias + scoreBias).toFixed(3)), -0.2, 0.2);
  }

  private static buildRecommendations(input: {
    intent: string;
    confidenceBand: SituationConfidenceBand;
    contextScore: number;
    stateTag: SituationStateTag;
    objectives: SituationObjective[];
    signals: SituationUrgencySignal[];
  }): SituationRoutingRecommendation[] {
    const text = input.intent.toLowerCase();

    const options: SituationRoutingRecommendation[] = [];
    const push = (featureId: string, priority: number, confidence: number, rationale: string) => {
      const action = DEFAULT_ACTIONS[featureId];
      if (!action) return;
      options.push({
        featureId,
        action,
        priority,
        confidence: clamp(Number(confidence.toFixed(3)), 0.05, 0.99),
        confidenceBand: this.deriveConfidenceBand(Math.round(confidence * 100)),
        rationale,
      });
    };

    const urgencyTop = input.signals[0]?.level ?? 1;
    const objectiveIntent = input.objectives.find((o) => o.status === "active")?.intentClass ?? "";

    if (
      text.includes("contract") ||
      text.includes("repair") ||
      text.includes("provider") ||
      objectiveIntent === "work_request"
    ) {
      push(
        "direct_connect",
        1,
        0.84 + urgencyTop * 0.03,
        "Work request path is most direct for local execution"
      );
      push("community", 2, 0.62, "Community path offers local validation before contact");
    }

    if (
      text.includes("community") ||
      text.includes("neighbor") ||
      objectiveIntent === "community_post"
    ) {
      push("community", 1, 0.82, "Community intent detected from language and objective context");
      push(
        "direct_connect",
        2,
        0.57,
        "Direct Connect available if the user needs immediate provider action"
      );
    }

    if (
      text.includes("buy") ||
      text.includes("sell") ||
      text.includes("market") ||
      objectiveIntent.includes("marketplace")
    ) {
      push("exchange", 1, 0.8, "Marketplace intent detected from current objective and phrasing");
      push("community", 2, 0.56, "Community can provide local buying/selling signal checks");
    }

    if (text.includes("map") || text.includes("near me") || text.includes("where")) {
      push("maps", 1, 0.75, "Location-discovery intent suggests map entry point");
    }

    if (text.includes("home") || text.includes("listing") || text.includes("property")) {
      push("homescout", 1, 0.78, "Property intent aligns with HomeScout discovery");
    }

    if (options.length === 0) {
      const fallbackConfidence =
        input.confidenceBand === "high" ? 0.72 : input.confidenceBand === "medium" ? 0.63 : 0.52;
      push(
        "direct_connect",
        1,
        fallbackConfidence,
        "Default action path keeps user in a governed local request flow"
      );
      push(
        "community",
        2,
        Math.max(0.45, fallbackConfidence - 0.08),
        "Secondary path preserves local read-only exploration"
      );
    }

    // Deterministic de-dup + ordering
    const dedup = new Map<string, SituationRoutingRecommendation>();
    for (const item of options) {
      const existing = dedup.get(item.featureId);
      if (!existing || item.priority < existing.priority || item.confidence > existing.confidence) {
        dedup.set(item.featureId, item);
      }
    }

    const sorted = [...dedup.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.featureId.localeCompare(b.featureId);
    });

    if (input.stateTag === "blocked") {
      return sorted.map((item, idx) => ({
        ...item,
        priority: idx + 1,
        confidence: clamp(item.confidence - 0.08, 0.1, 0.95),
        rationale: `${item.rationale}. State is blocked, so suggest smaller next step.`,
      }));
    }

    return sorted;
  }

  private static buildRationale(input: {
    factors: SituationFactorScore[];
    stateTag: SituationStateTag;
    confidenceBand: SituationConfidenceBand;
    contextScore: number;
  }): string {
    const strongest = [...input.factors]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2)
      .map((f) => `${f.factor}=${Math.round(f.raw)}`)
      .join(", ");

    return `State is ${input.stateTag} with ${describeBand(input.confidenceBand)} (${input.contextScore}/100), driven by ${strongest}.`;
  }

  private static buildSignature(input: {
    intent: string;
    role: SituationRole;
    objectives: SituationObjective[];
    events: SituationEvent[];
    signals: SituationUrgencySignal[];
    contextScore: number;
    confidenceBand: SituationConfidenceBand;
    stateTag: SituationStateTag;
  }): string {
    const payload = {
      intent: input.intent.toLowerCase().trim(),
      role: input.role,
      objectives: input.objectives.map((o) => ({
        id: o.id,
        status: o.status,
        progressPct: o.progressPct ?? 0,
        updatedAt: o.updatedAt ?? "",
        intentClass: o.intentClass ?? "",
      })),
      events: input.events.map((e) => ({
        type: e.type,
        timestamp: e.timestamp,
        weight: e.weight ?? 1,
      })),
      signals: input.signals,
      contextScore: input.contextScore,
      confidenceBand: input.confidenceBand,
      stateTag: input.stateTag,
    };

    return JSON.stringify(payload);
  }
}

export default ScoutSituationAnalyzer;
