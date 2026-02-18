/**
 * Scout Objectives Service
 *
 * Handles creation and updating of user objectives based on Scout interactions.
 * Called after Scout generates a response to persist user intent as an objective.
 */

import { db } from "../db";
import { objectives, objectiveEvents } from "@shared/schema";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  classifyUserIntent,
  detectTopicShift,
  type ObjectiveIntentClass,
  type ScoutIntentLabel,
} from "../services/intentsClassifier";

export interface ScoutObjectiveInput {
  userId: string;
  messageText: string;
  userRole?: string;
  scoutIntent?: ScoutIntentLabel;
  countyFips?: string;
  stateCode?: string;
  addressId?: string;
}

export interface SyncObjectiveResult {
  objectiveId: string;
  isNew: boolean;
  wasTopicShift: boolean;
  intentClass: ObjectiveIntentClass;
  confidence: number;
  rateLimitedReuse?: boolean;
}

/**
 * Get or create user's active objective based on Scout message
 * - If no active objective exists, creates one
 * - If active objective exists and topic shifted, pauses old and creates new
 * - Otherwise, updates existing objective with new message context
 */
export async function syncObjectiveFromScoutMessage(
  input: ScoutObjectiveInput
): Promise<SyncObjectiveResult | null> {
  try {
    if (process.env.OBJECTIVES_ENABLED !== "true") {
      return null;
    }

    const { userId, messageText, userRole, scoutIntent, countyFips, stateCode, addressId } = input;

    // Classify intent from Scout output + message heuristics
    const classification = classifyUserIntent({
      scoutIntent,
      messageText,
      userRole,
    });

    // Get current active objective if exists
    const currentActive = await db
      .select()
      .from(objectives)
      .where(and(eq(objectives.userId, userId), eq(objectives.status, "active")))
      .orderBy(asc(objectives.createdAt))
      .limit(1);

    const activeObjective = currentActive?.[0];

    // Detect topic shift if we have an active objective
    let shouldCreateNew = false;
    let wasTopicShift = false;
    if (activeObjective) {
      const shifted = detectTopicShift(
        activeObjective.intentClass as ObjectiveIntentClass,
        classification.intentClass,
        0.65 // confidence threshold
      );

      if (shifted) {
        wasTopicShift = true;
        shouldCreateNew = true;
      }
    } else {
      shouldCreateNew = true;
    }

    // Soft cap: at most 3 newly created objectives per user per hour.
    // If exceeded, update/reuse an existing objective instead of creating a new one.
    let rateLimitedReuse = false;
    if (shouldCreateNew) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCreations = await db
        .select({ count: count() })
        .from(objectiveEvents)
        .innerJoin(objectives, eq(objectiveEvents.objectiveId, objectives.id))
        .where(
          and(
            eq(objectives.userId, userId),
            eq(objectiveEvents.eventType, "created"),
            sql`${objectiveEvents.createdAt} > ${oneHourAgo}`
          )
        );
      const recentCreateCount = Number(recentCreations[0]?.count ?? 0);
      if (recentCreateCount >= 3) {
        shouldCreateNew = false;
        rateLimitedReuse = true;
      }
    }

    // Create new objective if needed
    if (shouldCreateNew || !activeObjective) {
      if (wasTopicShift && activeObjective) {
        // Only pause once we know we're actually creating a replacement objective.
        await db
          .update(objectives)
          .set({ status: "paused" })
          .where(eq(objectives.id, activeObjective.id));

        await db.insert(objectiveEvents).values({
          objectiveId: activeObjective.id,
          eventType: "topic_shift",
          actorType: "system",
          metadata: {
            reason: "user_shifted_to_new_topic",
            previousIntent: activeObjective.intentClass,
            newIntent: classification.intentClass,
          },
        });
      }

      const title = extractTitleFromMessage(messageText, classification.intentClass);
      const contextJson = buildContextJson({
        messageText,
        userRole,
        countyFips,
        stateCode,
        addressId,
      });

      const insertedObjective = await db
        .insert(objectives)
        .values({
          userId,
          title,
          summary: messageText.substring(0, 500), // First 500 chars as summary
          intentClass: classification.intentClass,
          confidence: String(Math.min(classification.confidence * 100, 100) / 100), // Ensure 0-1
          contextJson,
          status: "active",
          source: "scout",
        })
        .returning({ id: objectives.id });
      const newObjectiveId = insertedObjective[0]?.id;
      if (!newObjectiveId) {
        throw new Error("Failed to create objective record");
      }

      // Log creation
      await db.insert(objectiveEvents).values({
        objectiveId: newObjectiveId,
        eventType: "created",
        actorType: "system",
        metadata: {
          classificationSource: classification.source,
          scoutIntent,
          intentClass: classification.intentClass,
          confidence: classification.confidence,
        },
      });

      return {
        objectiveId: newObjectiveId,
        isNew: true,
        wasTopicShift: !!activeObjective && wasTopicShift,
        intentClass: classification.intentClass,
        confidence: classification.confidence,
      };
    } else {
      // Update existing objective with refined context. If no active objective exists
      // (e.g., rate-limited create), reuse the latest objective for this user.
      let objectiveToUpdate = activeObjective;
      if (!objectiveToUpdate) {
        const latestExisting = await db
          .select()
          .from(objectives)
          .where(eq(objectives.userId, userId))
          .orderBy(desc(objectives.createdAt))
          .limit(1);
        objectiveToUpdate = latestExisting[0];
      }

      if (!objectiveToUpdate) {
        // No prior objective to reuse; create a fallback objective.
        const fallbackInserted = await db
          .insert(objectives)
          .values({
            userId,
            title: extractTitleFromMessage(messageText, classification.intentClass),
            summary: messageText.substring(0, 500),
            intentClass: classification.intentClass,
            confidence: String(Math.min(classification.confidence * 100, 100) / 100),
            contextJson: buildContextJson({
              messageText,
              userRole,
              countyFips,
              stateCode,
              addressId,
            }),
            status: "active",
            source: "scout",
          })
          .returning({ id: objectives.id });
        const fallbackId = fallbackInserted[0]?.id;
        if (!fallbackId) throw new Error("Failed to create fallback objective record");
        return {
          objectiveId: fallbackId,
          isNew: true,
          wasTopicShift,
          intentClass: classification.intentClass,
          confidence: classification.confidence,
          rateLimitedReuse,
        };
      }

      const updatedContext = {
        ...((objectiveToUpdate.contextJson as Record<string, unknown> | null) ?? {}),
        ...buildContextJson({ messageText, userRole, countyFips, stateCode, addressId }),
        lastMessageText: messageText,
        lastMessageTs: new Date().toISOString(),
      };

      await db
        .update(objectives)
        .set({
          title:
            objectiveToUpdate.title ||
            extractTitleFromMessage(messageText, classification.intentClass),
          summary: messageText.substring(0, 500),
          contextJson: updatedContext,
          intentClass: classification.intentClass,
          status: "active",
          confidence: String(Math.min(classification.confidence * 100, 100) / 100),
          updatedAt: new Date(),
        })
        .where(eq(objectives.id, objectiveToUpdate.id));

      // Log update
      await db.insert(objectiveEvents).values({
        objectiveId: objectiveToUpdate.id,
        eventType: "summary_updated",
        actorType: "system",
        metadata: {
          classificationSource: classification.source,
          intentClass: classification.intentClass,
          confidence: classification.confidence,
          rateLimitedReuse,
          wasTopicShift,
        },
      });

      return {
        objectiveId: objectiveToUpdate.id,
        isNew: false,
        wasTopicShift,
        intentClass: classification.intentClass,
        confidence: classification.confidence,
        rateLimitedReuse,
      };
    }
  } catch (error) {
    console.error("[Scout Objectives] Error syncing objective:", error);
    // Silently fail - don't break Scout if objective creation fails
    return null;
  }
}

/**
 * Extract a short, user-friendly title from the message
 */
function extractTitleFromMessage(messageText: string, intentClass: ObjectiveIntentClass): string {
  if (!messageText) {
    return intentClassToDefaultTitle(intentClass);
  }

  // Take first sentence or first 80 chars
  const sentences = messageText.split(/[.!?]/);
  const firstSentence = sentences[0]?.trim() || messageText;

  const title = firstSentence.substring(0, 80).trim();
  return title || intentClassToDefaultTitle(intentClass);
}

/**
 * Provide intent-class-based default titles if we can't extract from message
 */
function intentClassToDefaultTitle(intentClass: ObjectiveIntentClass): string {
  const defaults: Record<ObjectiveIntentClass, string> = {
    unknown: "New Objective",
    knowledge: "Learning Question",
    local_advice: "Local Advice Request",
    work_request: "Work/Project Request",
    marketplace_buy: "Shopping/Buying",
    marketplace_sell: "Selling",
    community_post: "Community Post",
    event: "Event Planning",
    safety_report: "Safety Report",
    account: "Account Management",
    admin: "Admin Task",
    other: "Objective",
  };

  return defaults[intentClass] || "New Objective";
}

/**
 * Build context JSON blob from Scout message and metadata
 */
function buildContextJson(input: {
  messageText?: string;
  userRole?: string;
  countyFips?: string;
  stateCode?: string;
  addressId?: string;
}): Record<string, any> {
  return {
    messageText: input.messageText?.substring(0, 1000) || "", // Cap message length
    userRole: input.userRole,
    countyFips: input.countyFips,
    stateCode: input.stateCode,
    addressId: input.addressId,
    createdFromScoutTs: new Date().toISOString(),
  };
}

/**
 * Promote objective to work request if it's ready
 * Called when Scout intent is clearly work_request at high confidence
 */
export async function maybePromoteToWorkRequest(
  objectiveId: string,
  confidenceThreshold: number = 0.75
) {
  try {
    const objective = await db
      .select()
      .from(objectives)
      .where(eq(objectives.id, objectiveId))
      .limit(1);

    if (!objective || objective.length === 0) {
      return null;
    }

    const obj = objective[0];

    // Don't promote if already linked
    if (obj.linkedObjectType !== "none" && obj.linkedObjectId) {
      return null;
    }

    // Only promote work_request intent at sufficient confidence
    if (obj.intentClass !== "work_request") {
      return null;
    }

    const confidence = parseFloat(String(obj.confidence));
    if (confidence < confidenceThreshold) {
      return null;
    }

    // Promotion happens via API endpoint, not here
    // This is just a check function
    return { canPromote: true, confidence };
  } catch (error) {
    console.error("[Scout Objectives] Error checking promotion eligibility:", error);
    return null;
  }
}
