export type WatchdogObjectiveStatus = "active" | "paused" | "completed" | "abandoned";

export interface WatchdogObjectiveSnapshot {
  id: string;
  title: string;
  intentClass?: string;
  status: WatchdogObjectiveStatus;
  completionPct: number;
  updatedAt: string;
  route?: string;
}

export interface WatchdogUserEvent {
  type:
    | "session_start"
    | "message_sent"
    | "action_executed"
    | "action_failed"
    | "objective_updated"
    | "objective_completed"
    | "contact_requested"
    | "contact_granted"
    | "other";
  occurredAt: string;
  value?: number;
}

export interface UserSuccessSnapshot {
  userId: string;
  role?: string;
  countyFips?: string;
  lastActiveAt?: string;
  objectives: WatchdogObjectiveSnapshot[];
  events?: WatchdogUserEvent[];
}

export interface EngagementBreakdown {
  activityScore: number;
  objectiveScore: number;
  executionScore: number;
  consistencyScore: number;
}

export interface WatchdogIntervention {
  id: string;
  type: "continue_project" | "unblock_action" | "objective_refresh" | "success_nudge";
  priority: number;
  urgency: "low" | "medium" | "high";
  title: string;
  body: string;
  ctaLabel: string;
  ctaRoute: string;
  objectiveId?: string;
  reason: string;
}

export interface SuccessWatchdogResult {
  userId: string;
  inactivityHours: number;
  engagementScore: number;
  engagementBand: "high" | "medium" | "low";
  needsIntervention: boolean;
  interventions: WatchdogIntervention[];
  nextSteps: string[];
  breakdown: EngagementBreakdown;
  computedAt: string;
}

export interface WatchdogConfig {
  inactivityThresholdHours: number;
  staleObjectiveHours: number;
  interventionCap: number;
}

const DEFAULT_CONFIG: WatchdogConfig = {
  inactivityThresholdHours: 48,
  staleObjectiveHours: 72,
  interventionCap: 3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toMs(iso?: string): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

function normalizeRoute(route?: string): string {
  if (!route || !route.trim()) return "/direct-connect";
  return route.startsWith("/") ? route : `/${route}`;
}

function objectiveStateLabel(objective: WatchdogObjectiveSnapshot): string {
  if (objective.status === "completed") return "completed";
  if (objective.status === "paused") return "paused";
  if (objective.completionPct >= 80) return "near completion";
  if (objective.completionPct >= 40) return "in progress";
  return "just started";
}

/**
 * Proactive user-success watchdog for Scout.
 */
export class ScoutProactiveWatchdog {
  /**
   * Evaluate a user snapshot and return interventions ranked by priority.
   */
  static evaluate(
    snapshot: UserSuccessSnapshot,
    now: Date = new Date(),
    config?: Partial<WatchdogConfig>
  ): SuccessWatchdogResult {
    const mergedConfig = { ...DEFAULT_CONFIG, ...(config || {}) };
    const inactivityHours = this.computeInactivityHours(snapshot, now);
    const breakdown = this.computeEngagementBreakdown(snapshot, inactivityHours, now, mergedConfig);
    const engagementScore = this.rollupEngagementScore(breakdown);
    const engagementBand =
      engagementScore >= 75 ? "high" : engagementScore >= 50 ? "medium" : "low";

    const interventions = this.generateInterventions({
      snapshot,
      inactivityHours,
      engagementScore,
      engagementBand,
      now,
      config: mergedConfig,
    });

    const nextSteps = this.buildNextSteps(snapshot, interventions);

    return {
      userId: snapshot.userId,
      inactivityHours,
      engagementScore,
      engagementBand,
      needsIntervention: interventions.length > 0,
      interventions,
      nextSteps,
      breakdown,
      computedAt: now.toISOString(),
    };
  }

  /**
   * Compute inactivity hours using latest known activity source.
   */
  static computeInactivityHours(snapshot: UserSuccessSnapshot, now: Date): number {
    const eventTimes = (snapshot.events ?? [])
      .map((event) => toMs(event.occurredAt))
      .filter((t): t is number => t !== null);
    const objectiveTimes = snapshot.objectives
      .map((objective) => toMs(objective.updatedAt))
      .filter((t): t is number => t !== null);

    const explicitLast = toMs(snapshot.lastActiveAt);
    const latestMs = Math.max(0, explicitLast ?? 0, ...eventTimes, ...objectiveTimes);

    if (latestMs <= 0) return 999;
    return Math.max(0, Math.round((now.getTime() - latestMs) / (60 * 60 * 1000)));
  }

  /**
   * Convert raw user activity into deterministic engagement sub-scores.
   */
  static computeEngagementBreakdown(
    snapshot: UserSuccessSnapshot,
    inactivityHours: number,
    now: Date,
    config: WatchdogConfig
  ): EngagementBreakdown {
    const activityScore =
      inactivityHours <= 6
        ? 92
        : inactivityHours <= 24
          ? 78
          : inactivityHours <= config.inactivityThresholdHours
            ? 55
            : inactivityHours <= config.staleObjectiveHours
              ? 35
              : 18;

    const objectives = snapshot.objectives;
    const active = objectives.filter((o) => o.status === "active").length;
    const completed = objectives.filter((o) => o.status === "completed").length;
    const paused = objectives.filter((o) => o.status === "paused").length;
    const avgCompletion =
      objectives.length > 0
        ? objectives.reduce((sum, objective) => sum + clamp(objective.completionPct, 0, 100), 0) /
          objectives.length
        : 0;

    const objectiveScore = clamp(
      Math.round(35 + completed * 16 + active * 9 - paused * 8 + avgCompletion * 0.32),
      0,
      100
    );

    const events = snapshot.events ?? [];
    const successEvents = events.filter(
      (event) =>
        event.type === "action_executed" ||
        event.type === "objective_updated" ||
        event.type === "objective_completed" ||
        event.type === "contact_granted"
    ).length;
    const failureEvents = events.filter((event) => event.type === "action_failed").length;

    const executionScore = clamp(Math.round(55 + successEvents * 7 - failureEvents * 11), 0, 100);

    const recentObjectiveMs = objectives
      .map((objective) => toMs(objective.updatedAt))
      .filter((value): value is number => value !== null)
      .sort((a, b) => b - a);

    let consistencyScore = 48;
    if (recentObjectiveMs.length >= 2) {
      const cadenceMs = Math.abs(recentObjectiveMs[0] - recentObjectiveMs[1]);
      if (cadenceMs <= 24 * 60 * 60 * 1000) consistencyScore = 82;
      else if (cadenceMs <= 48 * 60 * 60 * 1000) consistencyScore = 68;
      else consistencyScore = 44;
    } else if (recentObjectiveMs.length === 1) {
      const ageHours = (now.getTime() - recentObjectiveMs[0]) / (60 * 60 * 1000);
      consistencyScore = ageHours <= 24 ? 64 : ageHours <= 72 ? 46 : 28;
    }

    return {
      activityScore,
      objectiveScore,
      executionScore,
      consistencyScore: clamp(Math.round(consistencyScore), 0, 100),
    };
  }

  /**
   * Weighted engagement score for intervention decisions.
   */
  static rollupEngagementScore(breakdown: EngagementBreakdown): number {
    const score =
      breakdown.activityScore * 0.34 +
      breakdown.objectiveScore * 0.29 +
      breakdown.executionScore * 0.23 +
      breakdown.consistencyScore * 0.14;
    return clamp(Math.round(score), 0, 100);
  }

  /**
   * Build prioritized interventions from engagement + objective state.
   */
  static generateInterventions(input: {
    snapshot: UserSuccessSnapshot;
    inactivityHours: number;
    engagementScore: number;
    engagementBand: "high" | "medium" | "low";
    now: Date;
    config: WatchdogConfig;
  }): WatchdogIntervention[] {
    const interventions: WatchdogIntervention[] = [];
    const objectives = [...input.snapshot.objectives].sort(
      (a, b) => b.completionPct - a.completionPct
    );
    const topActive = objectives.find((objective) => objective.status === "active");
    const stalled = objectives.find((objective) => {
      const updated = toMs(objective.updatedAt);
      if (updated === null) return false;
      const ageHours = (input.now.getTime() - updated) / (60 * 60 * 1000);
      return objective.status === "active" && ageHours >= input.config.inactivityThresholdHours;
    });

    if (input.inactivityHours >= input.config.inactivityThresholdHours && (stalled || topActive)) {
      const objective = stalled || topActive;
      if (objective) {
        interventions.push(this.buildContinueProjectIntervention(objective, input.inactivityHours));
      }
    }

    const failedActions = (input.snapshot.events ?? []).filter(
      (event) => event.type === "action_failed"
    ).length;
    if (failedActions >= 2) {
      interventions.push({
        id: `unblock_${input.snapshot.userId}`,
        type: "unblock_action",
        priority: 92,
        urgency: "high",
        title: "Unblock your last action",
        body: "Scout detected repeated action failures. Route through a smaller verified next step.",
        ctaLabel: "Unblock now",
        ctaRoute: "/direct-connect",
        reason: "Repeated action failures suggest user is stuck",
      });
    }

    const paused = objectives.find((objective) => objective.status === "paused");
    if (paused) {
      interventions.push({
        id: `refresh_${paused.id}`,
        type: "objective_refresh",
        priority: 70,
        urgency: input.engagementBand === "low" ? "high" : "medium",
        title: `Refresh objective: ${paused.title}`,
        body: "This objective is paused. Re-open it with one fast-win action to regain momentum.",
        ctaLabel: "Resume objective",
        ctaRoute: normalizeRoute(paused.route || "/scout"),
        objectiveId: paused.id,
        reason: "Paused objective available for quick restart",
      });
    }

    if (input.engagementScore >= 70) {
      interventions.push({
        id: `nudge_${input.snapshot.userId}`,
        type: "success_nudge",
        priority: 44,
        urgency: "low",
        title: "Keep momentum",
        body: "You are making steady progress. Capture one more outcome while context is fresh.",
        ctaLabel: "Open Scout",
        ctaRoute: "/scout",
        reason: "High engagement users benefit from light nudges",
      });
    }

    return this.prioritizeInterventions(interventions).slice(0, input.config.interventionCap);
  }

  /**
   * Build continue-project intervention for 48h inactivity threshold.
   */
  static buildContinueProjectIntervention(
    objective: WatchdogObjectiveSnapshot,
    inactivityHours: number
  ): WatchdogIntervention {
    const urgency: "low" | "medium" | "high" =
      inactivityHours >= 96 ? "high" : inactivityHours >= 48 ? "medium" : "low";

    const priority = clamp(
      Math.round(84 + inactivityHours * 0.12 + objective.completionPct * 0.1),
      60,
      99
    );

    return {
      id: `continue_${objective.id}`,
      type: "continue_project",
      priority,
      urgency,
      title: `Continue project: ${objective.title}`,
      body: `Last known state is ${objectiveStateLabel(objective)}. Resume now to avoid stale routing context.`,
      ctaLabel: "Continue project",
      ctaRoute: normalizeRoute(objective.route || "/scout"),
      objectiveId: objective.id,
      reason: `Inactive for ${inactivityHours}h with an active objective`,
    };
  }

  /**
   * Priority sort for interventions.
   */
  static prioritizeInterventions(interventions: WatchdogIntervention[]): WatchdogIntervention[] {
    return [...interventions].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.urgency !== b.urgency) {
        const rank = { high: 3, medium: 2, low: 1 } as const;
        return rank[b.urgency] - rank[a.urgency];
      }
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Contextual next-step strings for UI display.
   */
  static buildNextSteps(
    snapshot: UserSuccessSnapshot,
    interventions: WatchdogIntervention[]
  ): string[] {
    const steps: string[] = [];

    const topIntervention = interventions[0];
    if (topIntervention) {
      steps.push(`${topIntervention.title}: ${topIntervention.ctaLabel}`);
    }

    const activeObjectives = snapshot.objectives.filter(
      (objective) => objective.status === "active"
    );
    if (activeObjectives.length > 0) {
      const top = [...activeObjectives].sort((a, b) => b.completionPct - a.completionPct)[0];
      steps.push(`Advance "${top.title}" from ${Math.round(top.completionPct)}% to next milestone`);
    }

    const hasCommunityObjective = snapshot.objectives.some((objective) =>
      String(objective.intentClass || "").includes("community")
    );
    if (hasCommunityObjective) {
      steps.push("Capture local proof before sending direct contact requests");
    }

    if (steps.length === 0) {
      steps.push("Start with one governed local request through Direct Connect");
    }

    return steps.slice(0, 3);
  }
}

export default ScoutProactiveWatchdog;
