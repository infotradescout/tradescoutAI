/**
 * D2-1: Onboarding Detection & Persistence
 * D2-2: Question Injection & Contextual Guidance
 * D2-3: Snapshot Updates & Confidence Handling
 * D2-4: Auto-Expiration Logic
 *
 * Manages first-time Scout guidance when onboarding=true.
 *
 * Session storage has been migrated from an in-memory Map (which was lost on
 * every server restart) to the `scout_onboarding_sessions` Postgres table.
 * All async functions are drop-in replacements for the previous sync versions.
 */

import { db } from "../db";
import { scoutOnboardingSessions } from "../../shared/schema";
import { eq, lt } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingSession {
  isOnboarding: boolean;
  startedAt: Date;
  answeredQuestions: string[];
  snapshot: {
    intent?: "seek_help" | "offer_help" | "explore";
    urgencySignal?: "high" | "medium" | "low" | "none";
    timelineSignal?: "immediate" | "soon" | "planned" | "browsing";
    context?: {
      scope?: "residential" | "business" | "community" | "multi";
      businessType?: string;
    };
    tradeSignal?: string;
    confidence: number;
  };
  skippedQuestions: string[];
  expirationReason?: "confidence" | "action" | "timeout" | "user_exit";
}

// Session TTL: 2 hours (was 30 min in-memory; DB allows longer retention)
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// ─── Serialization helpers ────────────────────────────────────────────────────

function rowToSession(row: {
  snapshot: string;
  answeredQuestions: string;
  skippedQuestions: string;
  expirationReason: string | null;
  startedAt: Date;
}): OnboardingSession {
  let snapshot: OnboardingSession["snapshot"] = { confidence: 0.35 };
  let answeredQuestions: string[] = [];
  let skippedQuestions: string[] = [];

  try { snapshot = JSON.parse(row.snapshot); } catch { /* use default */ }
  try { answeredQuestions = JSON.parse(row.answeredQuestions); } catch { /* use default */ }
  try { skippedQuestions = JSON.parse(row.skippedQuestions); } catch { /* use default */ }

  return {
    isOnboarding: true,
    startedAt: row.startedAt,
    answeredQuestions,
    snapshot,
    skippedQuestions,
    expirationReason: (row.expirationReason as OnboardingSession["expirationReason"]) ?? undefined,
  };
}

function sessionToRow(session: OnboardingSession) {
  return {
    snapshot: JSON.stringify(session.snapshot),
    answeredQuestions: JSON.stringify(session.answeredQuestions),
    skippedQuestions: JSON.stringify(session.skippedQuestions),
    expirationReason: session.expirationReason ?? null,
    updatedAt: new Date(),
  };
}

// ─── D2-1: Detect onboarding flag ─────────────────────────────────────────────

/**
 * Returns true if onboarding=true is present in the query params.
 */
export function isOnboardingRequest(queryParams: Record<string, string>): boolean {
  return queryParams.onboarding === "true";
}

// ─── D2-1: Session CRUD ───────────────────────────────────────────────────────

/**
 * Initialize a new onboarding session in the DB.
 * If a session already exists for this sessionId it is replaced.
 */
export async function initializeOnboardingSession(
  sessionId: string,
  userId?: string
): Promise<OnboardingSession> {
  const session: OnboardingSession = {
    isOnboarding: true,
    startedAt: new Date(),
    answeredQuestions: [],
    snapshot: { confidence: 0.35 },
    skippedQuestions: [],
  };

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .insert(scoutOnboardingSessions)
    .values({
      sessionId,
      userId: userId ?? null,
      ...sessionToRow(session),
      startedAt: session.startedAt,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: scoutOnboardingSessions.sessionId,
      set: {
        ...sessionToRow(session),
        startedAt: session.startedAt,
        expiresAt,
      },
    });

  return session;
}

/**
 * Retrieve an onboarding session from the DB.
 * Returns undefined if the session does not exist or has expired.
 */
export async function getOnboardingSession(
  sessionId: string
): Promise<OnboardingSession | undefined> {
  const rows = await db
    .select()
    .from(scoutOnboardingSessions)
    .where(eq(scoutOnboardingSessions.sessionId, sessionId))
    .limit(1);

  if (!rows.length) return undefined;

  const row = rows[0];

  // Lazily clean up expired sessions
  if (row.expiresAt < new Date()) {
    await db
      .delete(scoutOnboardingSessions)
      .where(eq(scoutOnboardingSessions.sessionId, sessionId));
    return undefined;
  }

  return rowToSession(row);
}

/**
 * Persist an updated session back to the DB.
 */
export async function saveOnboardingSession(
  sessionId: string,
  session: OnboardingSession
): Promise<void> {
  await db
    .update(scoutOnboardingSessions)
    .set(sessionToRow(session))
    .where(eq(scoutOnboardingSessions.sessionId, sessionId));
}

/**
 * Delete an onboarding session (e.g. after completion or expiration).
 */
export async function deleteOnboardingSession(sessionId: string): Promise<void> {
  await db
    .delete(scoutOnboardingSessions)
    .where(eq(scoutOnboardingSessions.sessionId, sessionId));
}

/**
 * D2-4: Cleanup all expired sessions.
 * Called periodically by the server and lazily on each read.
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await db
      .delete(scoutOnboardingSessions)
      .where(lt(scoutOnboardingSessions.expiresAt, new Date()));
  } catch (err) {
    console.warn("[onboardingService] cleanupExpiredSessions error:", err);
  }
}

// Run cleanup every 10 minutes
if (typeof global !== "undefined") {
  setInterval(() => {
    cleanupExpiredSessions().catch(() => { /* swallow */ });
  }, 10 * 60 * 1000);
}

// ─── D2-2: Question logic ─────────────────────────────────────────────────────

/**
 * Determine which question to ask next.
 * Returns question key (Q1, Q2, Q3, Q4) or null if no more questions needed.
 */
export function getNextQuestion(session: OnboardingSession): string | null {
  // Q1: Intent — always ask first if not answered
  if (!session.snapshot.intent) return "Q1";

  // Q2: Urgency — ask after Q1, unless intent is 'explore'
  if (session.snapshot.intent !== "explore" && !session.snapshot.urgencySignal) {
    return "Q2";
  }

  // Q3: Scope — ask if Q1 or Q2 answered (skippable)
  if (!session.snapshot.context?.scope) {
    if (session.snapshot.intent || session.snapshot.urgencySignal) {
      return "Q3";
    }
  }

  // Q4: Category — optional refinement, ask if Q3 answered
  if (session.snapshot.context?.scope && !session.snapshot.tradeSignal) {
    if (!session.skippedQuestions.includes("Q3")) {
      return "Q4";
    }
  }

  return null;
}

/**
 * D2-2: Check if a question should still be asked.
 */
export function shouldAskQuestion(session: OnboardingSession, questionKey: string): boolean {
  if (session.answeredQuestions.includes(questionKey)) return false;
  const skipCount = session.skippedQuestions.filter((q) => q === questionKey).length;
  if (skipCount >= 2) return false;
  return true;
}

// ─── D2-3: Answer recording ───────────────────────────────────────────────────

/**
 * Record an answer to a question and update the snapshot confidence.
 * Callers must call saveOnboardingSession() afterwards to persist.
 */
export function recordAnswer(
  session: OnboardingSession,
  questionKey: string,
  answer: string
): void {
  session.answeredQuestions.push(questionKey);

  switch (questionKey) {
    case "Q1": {
      if (answer === "seek_help" || answer === "offer_help" || answer === "explore") {
        session.snapshot.intent = answer;
        session.snapshot.confidence += 0.20; // +20% per D1 spec
      }
      break;
    }
    case "Q2": {
      if (answer === "immediate") {
        session.snapshot.urgencySignal = "high";
        session.snapshot.timelineSignal = "immediate";
      } else if (answer === "soon") {
        session.snapshot.urgencySignal = "medium";
        session.snapshot.timelineSignal = "soon";
      } else if (answer === "planned") {
        session.snapshot.urgencySignal = "low";
        session.snapshot.timelineSignal = "planned";
      } else if (answer === "browsing") {
        session.snapshot.urgencySignal = "none";
        session.snapshot.timelineSignal = "browsing";
      }
      session.snapshot.confidence += 0.15; // +15% per D1 spec
      break;
    }
    case "Q3": {
      if (!session.snapshot.context) session.snapshot.context = {};
      if (answer === "residential") {
        session.snapshot.context.scope = "residential";
        session.snapshot.context.businessType = "homeowner";
      } else if (answer === "business") {
        session.snapshot.context.scope = "business";
        session.snapshot.context.businessType = "business_owner";
      } else if (answer === "community") {
        session.snapshot.context.scope = "community";
        session.snapshot.confidence += 0.05; // Extra +5% for strong community signal
      } else if (answer === "multi") {
        session.snapshot.context.scope = "multi";
      }
      session.snapshot.confidence += 0.15; // +15% per D1 spec
      break;
    }
    case "Q4": {
      session.snapshot.tradeSignal = answer;
      session.snapshot.confidence += 0.10; // +10% per D1 spec
      break;
    }
  }

  // Cap confidence at 1.0
  session.snapshot.confidence = Math.min(session.snapshot.confidence, 1.0);
}

/**
 * D2-3: Record a skipped question.
 * Callers must call saveOnboardingSession() afterwards to persist.
 */
export function recordSkip(session: OnboardingSession, questionKey: string): void {
  session.skippedQuestions.push(questionKey);

  // Apply sensible defaults when a question is skipped
  switch (questionKey) {
    case "Q2": {
      if (!session.snapshot.urgencySignal) {
        session.snapshot.urgencySignal = "medium";
      }
      break;
    }
    case "Q3": {
      if (!session.snapshot.context?.scope) {
        if (!session.snapshot.context) session.snapshot.context = {};
        session.snapshot.context.scope = "multi";
      }
      break;
    }
  }
}

// ─── D2-4: Expiration helpers ─────────────────────────────────────────────────

/**
 * Returns the expiration reason if the session should auto-expire, null otherwise.
 */
export function checkAutoExpiration(
  session: OnboardingSession
): "confidence" | "timeout" | null {
  if (session.snapshot.confidence >= 0.80) return "confidence";

  const elapsedMinutes = (Date.now() - session.startedAt.getTime()) / 1000 / 60;
  if (elapsedMinutes >= 5) return "timeout";

  return null;
}

/**
 * Mark an onboarding session as expired (in-memory mutation only;
 * call saveOnboardingSession() or deleteOnboardingSession() to persist).
 */
export function expireOnboarding(
  session: OnboardingSession,
  reason: "confidence" | "action" | "timeout" | "user_exit"
): void {
  session.isOnboarding = false;
  session.expirationReason = reason;
}

/**
 * Record the first successful action (triggers auto-expiration).
 */
export function recordFirstAction(session: OnboardingSession): void {
  expireOnboarding(session, "action");
}

// ─── D2-2: Question prompt content ───────────────────────────────────────────

/**
 * Get question prompt and options for display.
 * Used to inject questions contextually into Scout responses.
 */
export function getQuestionPrompt(
  questionKey: string,
  _context?: { scope?: string; intent?: string }
): {
  question: string;
  options: { label: string; value: string; why: string }[];
  skipLabel: string;
  explanation: string;
} | null {
  switch (questionKey) {
    case "Q1":
      return {
        question: "What brings you to TradeScout right now?",
        options: [
          {
            label: "I need help with something",
            value: "seek_help",
            why: "Helps Scout find contractors, pros, or peers who can help",
          },
          {
            label: "I'm here to help others",
            value: "offer_help",
            why: "Helps Scout route you to people looking for your skills",
          },
          {
            label: "I'm exploring / learning",
            value: "explore",
            why: "Helps Scout show relevant projects and community first",
          },
        ],
        skipLabel: "Skip for now",
        explanation: "This helps Scout suggest the right people and projects for you",
      };

    case "Q2":
      return {
        question: "How soon do you need help or want to start?",
        options: [
          {
            label: "Right now / This week",
            value: "immediate",
            why: "Scout will prioritize active contractors and same-day response options",
          },
          {
            label: "Next 1–2 weeks",
            value: "soon",
            why: "Scout will balance availability and quality",
          },
          {
            label: "Next month or later",
            value: "planned",
            why: "Scout can show more options and help you plan",
          },
          {
            label: "No specific timeline",
            value: "browsing",
            why: "Scout will show featured projects and trending in your area",
          },
        ],
        skipLabel: "I'm not sure yet",
        explanation: "Helps Scout filter contractors and projects by availability",
      };

    case "Q3":
      return {
        question: "Is this for your home, a business, or the community?",
        options: [
          {
            label: "My home / Personal",
            value: "residential",
            why: "Scout prioritizes contractors, maintenance experts, and community helpers",
          },
          {
            label: "My business",
            value: "business",
            why: "Scout shows B2B services, bulk rates, and business networks",
          },
          {
            label: "Community / Volunteering",
            value: "community",
            why: "Scout connects you with local groups and initiatives",
          },
          {
            label: "Multiple / All of the above",
            value: "multi",
            why: "Scout will show both personal and business tools",
          },
        ],
        skipLabel: "Show me everything",
        explanation: "Helps Scout show the right type of projects and people for you",
      };

    case "Q4":
      return {
        question: "Is there a specific type of work or category you're interested in?",
        options: [
          {
            label: "See All Categories",
            value: "all",
            why: "Scout will show comprehensive category list",
          },
        ],
        skipLabel: "Not sure / Skip this",
        explanation: "Optional — Scout can show your category first if you'd like",
      };

    default:
      return null;
  }
}

// ─── D2-5: Softer language ────────────────────────────────────────────────────

/**
 * Wrap a Scout response with a confidence indicator and explanatory preamble
 * when the user is in onboarding mode.
 */
export function applySofterLanguage(message: string, session: OnboardingSession): string {
  if (!session.isOnboarding) return message;

  const confidencePercent = Math.round(session.snapshot.confidence * 100);
  const confidenceBar = buildConfidenceBar(confidencePercent);

  let preamble = "";
  if (confidencePercent < 50) {
    preamble = "To give you better suggestions, let me ask a quick question first:\n\n";
  } else if (confidencePercent < 80) {
    preamble = "Here's what I can suggest based on what you've told me:\n\n";
  }

  return `${preamble}${message}\n\n${confidenceBar}`;
}

function buildConfidenceBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `Confidence: ${bar} ${percent}%`;
}
