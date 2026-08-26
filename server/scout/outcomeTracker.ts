/**
 * Outcome Feedback Loop
 *
 * Records real-world outcome signals and evolves per-user confidence state.
 * Confidence legitimacy comes from outcomes, not model feelings.
 */
import { db } from "../db";
import { scoutOutcomeEvents, scoutUserConfidenceState } from "../../shared/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { getScoutControlState } from "../services/scoutControlState";

// NOTE: Drizzle type helpers may not be exported for these inserts; we guard with inline types.
type OutcomeAction =
  | "followed_advice"
  | "ignored_advice"
  | "completed_flow"
  | "canceled"
  | "dispute"
  | "refund"
  | "reported_spam"
  | "regret_reported"
  | "success_reported";
type OutcomeContext = "general" | "trade_deal" | "direct_connect" | "community" | "tool";

type OutcomeEventInput = {
  userId: string;
  conversationId?: string | null;
  contextType: OutcomeContext;
  contextId?: string | null;
  scope?: string | null;
  action: OutcomeAction;
  value?: number | null;
  confidenceDeltaHint?: number | null;
};

type ConfidenceState = {
  userId: string;
  scope: string;
  baselineConfidence: number;
  currentConfidence: number;
  lastUpdatedAt: Date;
};

const DEFAULT_BASELINE = 0.2;
const DEFAULT_SCOPE = "global";
const POSITIVE_DELTA = 0.05;
const NEGATIVE_DELTA = 0.15;
const MIN_CONFIDENCE = 0.05;
const MAX_CONFIDENCE = 0.95;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Record a real outcome event. No fabrication.
 */
export async function recordOutcomeEvent(event: OutcomeEventInput): Promise<void> {
  const scope = event.scope ?? DEFAULT_SCOPE;
  await db.insert(scoutOutcomeEvents).values({
    userId: event.userId,
    conversationId: event.conversationId ?? null,
    contextType: event.contextType,
    contextId: event.contextId ?? null,
    scope,
    action: event.action,
    value: event.value != null ? String(event.value) : null,
    confidenceDeltaHint: event.confidenceDeltaHint ?? null,
  });
}

/**
 * Load or initialize the user's confidence state.
 */
export async function getUserConfidenceState(
  userId: string,
  scope: string = DEFAULT_SCOPE
): Promise<ConfidenceState> {
  const existing = await db.query.scoutUserConfidenceState.findFirst({
    where: and(
      eq(scoutUserConfidenceState.userId, userId),
      eq(scoutUserConfidenceState.scope, scope)
    ),
  });

  if (existing) {
    return {
      userId: existing.userId!, // Non-null assertion: userId is primary key, always exists
      scope: existing.scope,
      baselineConfidence: Number(existing.baselineConfidence ?? DEFAULT_BASELINE),
      currentConfidence: Number(existing.currentConfidence ?? DEFAULT_BASELINE),
      lastUpdatedAt: existing.lastUpdatedAt,
    };
  }

  // Initialize state
  const now = new Date();
  try {
    await db.insert(scoutUserConfidenceState).values({
      userId,
      scope,
      baselineConfidence: DEFAULT_BASELINE as any,
      currentConfidence: DEFAULT_BASELINE as any,
      lastUpdatedAt: now,
    });
  } catch (error) {
    // userId references a session for a user row that no longer exists
    // (e.g. deleted account with a lingering session). Fall back to an
    // unpersisted default rather than throwing on every CTA check.
    if ((error as { code?: string })?.code !== "23503") {
      throw error;
    }
  }

  return {
    userId,
    scope,
    baselineConfidence: DEFAULT_BASELINE,
    currentConfidence: DEFAULT_BASELINE,
    lastUpdatedAt: now,
  };
}

/**
 * Apply time decay toward baseline.
 */
function applyDecay(state: ConfidenceState, now: Date): ConfidenceState {
  const daysElapsed = Math.max(
    0,
    Math.floor((now.getTime() - state.lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24))
  );
  if (daysElapsed === 0) return state;

  const decayFactor = Math.pow(0.98, daysElapsed); // 2% decay per day toward baseline
  const decayed =
    state.baselineConfidence + (state.currentConfidence - state.baselineConfidence) * decayFactor;

  return {
    ...state,
    currentConfidence: decayed,
    lastUpdatedAt: now,
  };
}

/**
 * Update user confidence state based on an outcome event.
 */
export async function updateUserConfidenceStateFromOutcome(
  userId: string,
  event: OutcomeEventInput,
  scope: string = DEFAULT_SCOPE
): Promise<ConfidenceState> {
  const now = new Date();
  const resolvedScope = event.scope ?? scope ?? DEFAULT_SCOPE;
  let state = await getUserConfidenceState(userId, resolvedScope);

  // Durable admin control. Read failures return the conservative fail-safe state.
  const controls = await getScoutControlState();
  if (!controls.outcomeLearningEnabled) {
    console.log(`[ADMIN CONTROL] Outcome learning disabled - no confidence update`);
    return state;
  }

  // Apply decay first
  state = applyDecay(state, now);

  // Positive / negative deltas
  const positiveActions: OutcomeAction[] = [
    "followed_advice",
    "completed_flow",
    "success_reported",
  ];
  const negativeActions: OutcomeAction[] = [
    "ignored_advice",
    "canceled",
    "dispute",
    "refund",
    "reported_spam",
    "regret_reported",
  ];

  let next = state.currentConfidence;

  if (positiveActions.includes(event.action)) {
    next = clamp(next + POSITIVE_DELTA, MIN_CONFIDENCE, MAX_CONFIDENCE);
  }

  if (negativeActions.includes(event.action)) {
    next = clamp(next - NEGATIVE_DELTA, MIN_CONFIDENCE, MAX_CONFIDENCE);
  }

  // Optional hint
  if (event.confidenceDeltaHint) {
    next = clamp(next + event.confidenceDeltaHint / 100, MIN_CONFIDENCE, MAX_CONFIDENCE);
  }

  try {
    await db
      .insert(scoutUserConfidenceState)
      .values({
        userId,
        scope: resolvedScope,
        baselineConfidence: state.baselineConfidence as any,
        currentConfidence: next as any,
        lastUpdatedAt: now,
      })
      .onConflictDoUpdate({
        target: [scoutUserConfidenceState.userId, scoutUserConfidenceState.scope],
        set: {
          currentConfidence: next as any,
          lastUpdatedAt: now,
        },
      });
  } catch (error) {
    // Same stale-session/deleted-user case as getUserConfidenceState above.
    if ((error as { code?: string })?.code !== "23503") {
      throw error;
    }
  }

  return {
    ...state,
    currentConfidence: next,
    lastUpdatedAt: now,
  };
}

/**
 * Blend raw situational confidence with stateful trust.
 */
export function computeFinalConfidence(rawConfidence: number, stateConfidence: number): number {
  return clamp(0.5 * rawConfidence + 0.5 * stateConfidence, 0, 1);
}

/**
 * Convenience helper to fetch recent outcome stats for IMD.
 */
export async function getOutcomeStats(args: {
  userId: string;
  contextType?: OutcomeContext;
  scope?: string;
}): Promise<{
  successes: number;
  regrets: number;
  recentSuccesses: number;
  recentRegrets: number;
}> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);

  const scopeFilter = args.scope ? eq(scoutOutcomeEvents.scope, args.scope) : undefined;

  const successes = await db
    .select()
    .from(scoutOutcomeEvents)
    .where(
      and(
        eq(scoutOutcomeEvents.userId, args.userId),
        eq(scoutOutcomeEvents.action, "success_reported"),
        ...(scopeFilter ? [scopeFilter] : [])
      )
    );

  const regrets = await db
    .select()
    .from(scoutOutcomeEvents)
    .where(
      and(
        eq(scoutOutcomeEvents.userId, args.userId),
        eq(scoutOutcomeEvents.action, "regret_reported"),
        ...(scopeFilter ? [scopeFilter] : [])
      )
    );

  const recentSuccesses = await db
    .select()
    .from(scoutOutcomeEvents)
    .where(
      and(
        eq(scoutOutcomeEvents.userId, args.userId),
        eq(scoutOutcomeEvents.action, "success_reported"),
        gte(scoutOutcomeEvents.createdAt, windowStart),
        ...(scopeFilter ? [scopeFilter] : [])
      )
    );

  const recentRegrets = await db
    .select()
    .from(scoutOutcomeEvents)
    .where(
      and(
        eq(scoutOutcomeEvents.userId, args.userId),
        eq(scoutOutcomeEvents.action, "regret_reported"),
        gte(scoutOutcomeEvents.createdAt, windowStart),
        ...(scopeFilter ? [scopeFilter] : [])
      )
    );

  return {
    successes: successes.length,
    regrets: regrets.length,
    recentSuccesses: recentSuccesses.length,
    recentRegrets: recentRegrets.length,
  };
}
