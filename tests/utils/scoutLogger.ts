/**
 * Scout Interaction Logger
 *
 * Captures structured Scout session data across three pipelines:
 * 1. Action Pipeline - Executes real things (invoices, profiles, routing)
 * 2. Observation Pipeline - Logs language, choices, friction signals
 * 3. Learning Pipeline - Updates prompts, heuristics (real users only, bots excluded)
 *
 * Real users → all 3 pipelines
 * Bots → pipelines 1 & 2 only (learning hard-disabled)
 */

export type ScoutMode = 'onboarding' | 'post_onboarding' | 'freeform';
export type UserRole = 'user' | 'scout';
export type ExecutionResult = 'success' | 'partial' | 'failed';
export type ExecutionPath = 'scout_direct' | 'user_routed';
export type FrictionSignalType =
  | 'user_skipped'
  | 'user_asked_why'
  | 'user_backtracked'
  | 'user_rephrased'
  | 'user_abandoned';

/**
 * Scout action that can be offered/executed
 */
export interface ScoutAction {
  id: string;
  type: string; // e.g., 'create_invoice', 'publish_profile', 'contact_business'
  label: string;
  description?: string;
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Single turn in Scout conversation
 */
export interface ScoutTurn {
  sequenceNumber: number;
  role: UserRole;
  intentDetected?: string[]; // ['request_invoice', 'ask_for_help']
  message?: string;
  actionsOffered?: ScoutAction[];
  actionChosen?: ScoutAction | null;
  actionExecuted?: boolean;
  executionResult?: ExecutionResult;
  executionPath?: ExecutionPath;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

/**
 * Complete Scout session
 */
export interface ScoutSessionLog {
  sessionId: string;
  userId: string | null; // null for anonymous
  isTestRun: boolean; // CRITICAL: marks bots vs real users
  mode: ScoutMode;
  turns: ScoutTurn[];
  frictionSignals: ScoutFrictionSignal[];
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  metadata?: {
    userAgent?: string;
    businessSlug?: string;
    requestSource?: 'web' | 'mobile' | 'api' | 'test';
  };
}

/**
 * Scout action execution record
 */
export interface ScoutActionExecution {
  sessionId: string;
  actionId: string;
  actionType: string;
  offered: boolean;
  selected: boolean;
  executed: boolean;
  executionPath: ExecutionPath;
  result: ExecutionResult;
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    actionDurationMs?: number;
    targetResourceId?: string;
    targetResourceType?: string;
  };
}

/**
 * Friction signal - indicates user hesitation or failure
 */
export interface ScoutFrictionSignal {
  sessionId: string;
  turnNumber: number;
  signalType: FrictionSignalType;
  context: {
    scoutMessage?: string;
    userMessage?: string;
    actionOffered?: ScoutAction;
  };
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

/**
 * Main Scout logger class
 */
export class ScoutInteractionLogger {
  private sessionId: string;
  private userId: string | null;
  private isTestRun: boolean;
  private turns: ScoutTurn[] = [];
  private frictionSignals: ScoutFrictionSignal[] = [];
  private actionExecutions: ScoutActionExecution[] = [];
  private startTime: Date;
  private mode: ScoutMode;

  constructor(config: {
    sessionId: string;
    userId?: string | null;
    isTestRun: boolean;
    mode: ScoutMode;
  }) {
    this.sessionId = config.sessionId;
    this.userId = config.userId || null;
    this.isTestRun = config.isTestRun;
    this.mode = config.mode;
    this.startTime = new Date();
  }

  /**
   * Log a turn in the Scout conversation
   */
  addTurn(turn: Omit<ScoutTurn, 'sequenceNumber' | 'timestamp'>): ScoutTurn {
    const newTurn: ScoutTurn = {
      ...turn,
      sequenceNumber: this.turns.length + 1,
      timestamp: new Date().toISOString(),
    };
    this.turns.push(newTurn);
    return newTurn;
  }

  /**
   * Log a friction signal (where user hesitated)
   */
  addFrictionSignal(signal: Omit<ScoutFrictionSignal, 'sessionId' | 'timestamp'>): ScoutFrictionSignal {
    const newSignal: ScoutFrictionSignal = {
      ...signal,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };
    this.frictionSignals.push(newSignal);
    return newSignal;
  }

  /**
   * Log an action execution (for action pipeline)
   */
  addActionExecution(execution: Omit<ScoutActionExecution, 'sessionId'>): ScoutActionExecution {
    const newExecution: ScoutActionExecution = {
      ...execution,
      sessionId: this.sessionId,
    };
    this.actionExecutions.push(newExecution);
    return newExecution;
  }

  /**
   * Get complete session log (observation pipeline)
   * CRITICAL: includes friction signals and action logs
   */
  getSessionLog(): ScoutSessionLog {
    const endTime = new Date();
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      isTestRun: this.isTestRun,
      mode: this.mode,
      turns: this.turns,
      frictionSignals: this.frictionSignals,
      startedAt: this.startTime.toISOString(),
      endedAt: endTime.toISOString(),
      durationMs: endTime.getTime() - this.startTime.getTime(),
    };
  }

  /**
   * Get action executions (for capability analysis)
   */
  getActionExecutions(): ScoutActionExecution[] {
    return [...this.actionExecutions];
  }

  /**
   * Get observations ONLY (for learning pipeline guard)
   * Returns null if isTestRun = true (bots excluded from learning)
   */
  getObservationsForLearning(): ScoutSessionLog | null {
    if (this.isTestRun) {
      // HARD GUARD: Test runs never influence learning
      return null;
    }
    return this.getSessionLog();
  }

  /**
   * Get friction signals for analysis
   */
  getFrictionSignals(): ScoutFrictionSignal[] {
    return [...this.frictionSignals];
  }

  /**
   * Summary statistics (for dashboards)
   */
  getSummary(): {
    totalTurns: number;
    scoutTurns: number;
    userTurns: number;
    actionsOffered: number;
    actionsSelected: number;
    actionsExecuted: number;
    successRate: number;
    frictionSignalCount: number;
    frictionTypes: Record<FrictionSignalType, number>;
  } {
    const scoutTurns = this.turns.filter((t) => t.role === 'scout').length;
    const userTurns = this.turns.filter((t) => t.role === 'user').length;
    const actionsOffered = this.turns.filter((t) => (t.actionsOffered?.length || 0) > 0).length;
    const actionsSelected = this.turns.filter((t) => t.actionChosen).length;
    const actionsExecuted = this.actionExecutions.filter((a) => a.executed).length;
    const successfulActions = this.actionExecutions.filter((a) => a.result === 'success').length;
    const successRate = this.actionExecutions.length > 0 ? successfulActions / this.actionExecutions.length : 0;

    const frictionTypes: Record<FrictionSignalType, number> = {
      user_skipped: 0,
      user_asked_why: 0,
      user_backtracked: 0,
      user_rephrased: 0,
      user_abandoned: 0,
    };

    this.frictionSignals.forEach((signal) => {
      frictionTypes[signal.signalType]++;
    });

    return {
      totalTurns: this.turns.length,
      scoutTurns,
      userTurns,
      actionsOffered,
      actionsSelected,
      actionsExecuted,
      successRate: Math.round(successRate * 100) / 100,
      frictionSignalCount: this.frictionSignals.length,
      frictionTypes,
    };
  }
}

/**
 * Insight summary generator (for weekly dashboards)
 * Auto-generates human-readable insights from aggregated logs
 */
export interface InsightSummary {
  period: string; // e.g., "2026-01-01 to 2026-01-07"
  totalSessions: number;
  realUserSessions: number;
  testRunSessions: number;
  stats: {
    avgActionSuccessRate: number;
    avgTurnsPerSession: number;
    totalFrictionSignals: number;
    topFrictionType: FrictionSignalType;
    preferredExecutionPath: ExecutionPath; // Most common user choice
  };
  insights: string[]; // Human-readable findings
}

export class InsightGenerator {
  static generateWeeklySummary(sessions: ScoutSessionLog[]): InsightSummary {
    const realSessions = sessions.filter((s) => !s.isTestRun);
    const testSessions = sessions.filter((s) => s.isTestRun);

    // Success rate calculation
    const allResults: ExecutionResult[] = [];
    const allActions: ScoutActionExecution[] = [];
    const allFriction: ScoutFrictionSignal[] = [];
    let totalTurns = 0;

    sessions.forEach((session) => {
      totalTurns += session.turns.length;
      session.frictionSignals.forEach((f) => allFriction.push(f));
    });

    const successCount = allActions.filter((a) => a.result === 'success').length;
    const avgActionSuccessRate =
      allActions.length > 0 ? Math.round((successCount / allActions.length) * 100) : 0;
    const avgTurnsPerSession = sessions.length > 0 ? Math.round(totalTurns / sessions.length) : 0;

    // Find most common friction type
    const frictionCounts: Record<FrictionSignalType, number> = {
      user_skipped: 0,
      user_asked_why: 0,
      user_backtracked: 0,
      user_rephrased: 0,
      user_abandoned: 0,
    };

    allFriction.forEach((f) => {
      frictionCounts[f.signalType]++;
    });

    const topFrictionType = (
      Object.entries(frictionCounts).sort(([, a], [, b]) => b - a)[0] || ['user_skipped', 0]
    )[0] as FrictionSignalType;

    // Generate insights
    const insights: string[] = [];

    if (avgActionSuccessRate < 80) {
      insights.push(`⚠️ Action success rate is ${avgActionSuccessRate}%. Review failed actions for common patterns.`);
    }

    if (frictionCounts.user_asked_why > frictionCounts.user_skipped * 0.5) {
      insights.push(
        `📝 Users asked "why" frequently (${frictionCounts.user_asked_why}x). Consider clarifying Scout's reasoning.`
      );
    }

    if (frictionCounts.user_abandoned > 10) {
      insights.push(
        `🚨 ${frictionCounts.user_abandoned} sessions were abandoned. Investigate for friction points.`
      );
    }

    if (realSessions.length > 0) {
      insights.push(`✅ ${realSessions.length} real user sessions captured (learning-eligible).`);
    }

    if (testSessions.length > 0) {
      insights.push(`🤖 ${testSessions.length} test run sessions (excluded from learning).`);
    }

    return {
      period: 'Weekly',
      totalSessions: sessions.length,
      realUserSessions: realSessions.length,
      testRunSessions: testSessions.length,
      stats: {
        avgActionSuccessRate,
        avgTurnsPerSession,
        totalFrictionSignals: allFriction.length,
        topFrictionType,
        preferredExecutionPath: 'scout_direct', // Placeholder - calculate from real data
      },
      insights,
    };
  }
}
