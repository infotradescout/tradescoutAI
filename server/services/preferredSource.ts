import { db } from "../db";
import { userCompletedActions, users, type InsertUserCompletedAction } from "../../shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const ACTIONS_REQUIRED_FOR_PROMPT = 5;

export interface PreferredSourceEligibility {
  isEligible: boolean;
  completedActionsCount: number;
  alreadyShown: boolean;
  alreadyAccepted: boolean;
}

/**
 * Log a completed action (outcome-based, not clicks).
 * Append-only. No updates or deletes.
 */
export async function logCompletedAction(input: {
  userId: string;
  actionType: string;
  source: "scout" | "ui" | "system";
}): Promise<void> {
  const payload: InsertUserCompletedAction = {
    userId: input.userId,
    actionType: input.actionType.slice(0, 120),
    source: input.source,
  };

  await db.insert(userCompletedActions).values(payload);
}

/**
 * Check if user is eligible for the Preferred Source Prompt.
 * Only eligible once, at the 5th action.
 */
export async function checkPreferredSourceEligibility(
  userId: string,
): Promise<PreferredSourceEligibility> {
  // Get user's prompt state
  const [user] = await db
    .select({
      shownAt: users.preferredSourcePromptShownAt,
      acceptedAt: users.preferredSourcePromptAcceptedAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return {
      isEligible: false,
      completedActionsCount: 0,
      alreadyShown: false,
      alreadyAccepted: false,
    };
  }

  const alreadyShown = Boolean(user.shownAt);
  const alreadyAccepted = Boolean(user.acceptedAt);

  // If already shown (accepted or dismissed), never show again
  if (alreadyShown) {
    return {
      isEligible: false,
      completedActionsCount: 0, // Don't need to query if already shown
      alreadyShown,
      alreadyAccepted,
    };
  }

  // Count completed actions
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userCompletedActions)
    .where(eq(userCompletedActions.userId, userId));

  const completedActionsCount = countResult?.count ?? 0;

  // Eligible only if count === 5 and never shown
  const isEligible = completedActionsCount === ACTIONS_REQUIRED_FOR_PROMPT;

  return {
    isEligible,
    completedActionsCount,
    alreadyShown,
    alreadyAccepted,
  };
}

/**
 * Mark the prompt as shown (even if dismissed).
 * This ensures it never appears again.
 */
export async function markPreferredSourcePromptShown(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ preferredSourcePromptShownAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Mark the prompt as accepted (user agreed to set TradeScout as preferred source).
 */
export async function markPreferredSourcePromptAccepted(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      preferredSourcePromptShownAt: new Date(),
      preferredSourcePromptAcceptedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Mission Control metrics: How many prompts shown/accepted in a time window.
 */
export async function getPreferredSourceMetrics(since: Date): Promise<{
  promptsShown: number;
  promptsAccepted: number;
  acceptanceRate: number;
}> {
  const [shown] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        sql`${users.preferredSourcePromptShownAt} IS NOT NULL`,
        gte(users.preferredSourcePromptShownAt, since),
      ),
    );

  const [accepted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        sql`${users.preferredSourcePromptAcceptedAt} IS NOT NULL`,
        gte(users.preferredSourcePromptAcceptedAt, since),
      ),
    );

  const promptsShown = shown?.count ?? 0;
  const promptsAccepted = accepted?.count ?? 0;
  const acceptanceRate = promptsShown > 0 ? (promptsAccepted / promptsShown) * 100 : 0;

  return {
    promptsShown,
    promptsAccepted,
    acceptanceRate: Math.round(acceptanceRate * 10) / 10, // One decimal place
  };
}
