/**
 * Tool Discovery Observer — Scout's Subconscious
 *
 * CRITICAL RULES:
 * 1. This runs OFFLINE (async, after flow completes)
 * 2. It NEVER affects live user interactions
 * 3. It is OBSERVATIONAL intelligence, not OPERATIONAL intelligence
 * 4. Blueprints go to admins ONLY, never to users
 *
 * This is Scout's institutional learning layer — it watches what Scout does,
 * detects patterns, and proposes new capabilities to the admin team.
 *
 * Think of it as Scout's subconscious, not its voice.
 */

import type { Situation, OutcomeGraph, ScoutAction, Primitive } from "./governor";
import * as toolDiscoveryDB from "./toolDiscoveryDB";
import type { PatternInstance } from "./toolDiscoveryDB";

// ============================================================================
// OFFLINE OBSERVATION - Runs after user interaction completes
// ============================================================================

export interface FlowCompletionEvent {
  userId: string;
  sessionId: string;
  timestamp: string;

  // What happened
  userMessage: string;
  situation: Situation;
  action: ScoutAction;
  outcomeGraph: OutcomeGraph | null;

  // Outcome (if known)
  outcomeKnown?: boolean;
  outcomeSuccess?: boolean;
  userFeedback?: string;
}

/**
 * Observe a completed flow and detect patterns.
 * Called AFTER user interaction, NEVER during.
 */
export async function observeFlowCompletion(event: FlowCompletionEvent): Promise<void> {
  // Run async — don't block anything
  setImmediate(async () => {
    try {
      // 1. Detect missing capabilities
      const missingCapability = detectMissingCapability(
        event.situation,
        event.outcomeGraph,
        event.action
      );

      if (!missingCapability) {
        return; // No pattern detected
      }

      // 2. Create pattern instance
      const pattern: PatternInstance = {
        userId: event.userId,
        sessionId: event.sessionId,

        userMessage: event.userMessage,
        inferredGoal: event.situation.goal,
        missingCapability,
        workaroundUsed: describeWorkaround(event.action, event.outcomeGraph),
        primitivesUsed: event.outcomeGraph?.steps.map((s) => s.primitive) || [],

        situation: {
          goal: event.situation.goal,
          constraints: event.situation.constraints,
          risks: event.situation.risks.map((r) => `${r.type}: ${r.description}`),
          unknowns: event.situation.unknowns,
        },

        fingerprint: generateFingerprint(event.situation.goal, missingCapability),
      };

      // 3. Track pattern (async, non-blocking)
      await toolDiscoveryDB.trackPattern(pattern);

      // Convergence check is automatic in trackPattern
    } catch (error) {
      console.error("[Tool Discovery Observer] Error:", error);
      // Never throw — this is observational, not critical
    }
  });
}

/**
 * Observe a regret event.
 * Called when user expresses regret about a past decision.
 */
export async function observeRegret(args: {
  userId: string;
  originalDecision: string;
  originalTimestamp: string;
  regretStatement: string;
  consequences: string[];
  missingInfo: string[];
  preventionPattern: string;
}): Promise<void> {
  // Run async — don't block anything
  setImmediate(async () => {
    try {
      await toolDiscoveryDB.trackRegret({
        userId: args.userId,
        originalDecision: args.originalDecision,
        originalTimestamp: args.originalTimestamp,
        regretStatement: args.regretStatement,
        consequences: args.consequences,
        missingInfo: args.missingInfo,
        preventionPattern: args.preventionPattern,
      });
    } catch (error) {
      console.error("[Tool Discovery Observer] Regret tracking error:", error);
      // Never throw — this is observational, not critical
    }
  });
}

// ============================================================================
// PATTERN DETECTION - Identical to governor.ts but isolated here
// ============================================================================

/**
 * Detect if Scout is working around a missing capability
 */
function detectMissingCapability(
  situation: Situation,
  outcomeGraph: OutcomeGraph | null,
  action: ScoutAction
): string | null {
  // If we're deferring due to missing info, that's a missing capability
  if (action === "DEFER" && situation.unknowns.length > 0) {
    // Check if this is a pattern we're handling ad-hoc
    const adHocPatterns = [
      "photo upload",
      "document storage",
      "scope capture",
      "contractor tracking",
      "commitment tracking",
      "follow-up reminders",
    ];

    for (const pattern of adHocPatterns) {
      if (
        situation.goal.toLowerCase().includes(pattern) ||
        situation.unknowns.some((u) => u.toLowerCase().includes(pattern))
      ) {
        return `Missing tool: Structured ${pattern} capture`;
      }
    }
  }

  // If we're using multiple CAPTURE steps, might indicate need for structured tool
  if (outcomeGraph && outcomeGraph.steps.filter((s) => s.primitive === "CAPTURE").length >= 3) {
    return `Missing tool: Multi-step ${situation.goal} workflow`;
  }

  // Detect commitment/reminder patterns
  if (/track|remember|remind|follow.?up|commitment/i.test(situation.goal)) {
    return "Missing tool: Commitment and follow-up tracker";
  }

  // Detect note-taking patterns
  if (/note|record|save|keep track of|document/i.test(situation.goal)) {
    return "Missing tool: Action-oriented notes system";
  }

  return null;
}

/**
 * Describe how Scout worked around the missing capability
 */
function describeWorkaround(action: ScoutAction, outcomeGraph: OutcomeGraph | null): string {
  if (action === "DEFER") {
    return `Manually requested info through conversation, ${outcomeGraph?.steps.length || 0} ad-hoc steps`;
  }
  if (action === "REDIRECT") {
    return "Reframed user's question to avoid capability gap";
  }
  if (action === "BLOCK") {
    return "Blocked action due to missing verification capability";
  }
  return "Provided ad-hoc guidance";
}

/**
 * Generate fingerprint for clustering similar patterns
 */
function generateFingerprint(goal: string, missingCapability: string): string {
  // Extract capability type from missing capability string
  const capabilityMatch = missingCapability.match(/Missing tool: (.+)/);
  if (capabilityMatch) {
    const capabilityType = capabilityMatch[1]
      .toLowerCase()
      .replace(/\b(multi-step|structured|action-oriented)\b/g, "") // Remove modifiers
      .replace(/\s+/g, "_")
      .trim();

    // Normalize to common patterns
    if (capabilityType.includes("commitment") || capabilityType.includes("follow")) {
      return "commitment_tracker";
    }
    if (capabilityType.includes("note") || capabilityType.includes("record")) {
      return "notes_system";
    }
    if (capabilityType.includes("photo") || capabilityType.includes("document")) {
      return "document_capture";
    }
    if (capabilityType.includes("contractor") || capabilityType.includes("vendor")) {
      return "contractor_tracking";
    }

    return capabilityType;
  }

  // Fallback: normalize goal
  const normalizedGoal = goal
    .toLowerCase()
    .replace(/\b(i|my|me|you|we|they|need|want|how|what)\b/g, "")
    .replace(/\s+/g, "_")
    .trim()
    .substring(0, 30);

  return normalizedGoal || "general_workflow";
}

// ============================================================================
// ADMIN-ONLY QUERIES - Never exposed to users
// ============================================================================

/**
 * Get proposed blueprints for admin review.
 * This should ONLY be called from admin routes.
 */
export function getProposedBlueprints() {
  return toolDiscoveryDB.getProposedBlueprints();
}

/**
 * Get proposal by ID.
 * This should ONLY be called from admin routes.
 */
export function getProposalById(id: number) {
  return toolDiscoveryDB.getProposalById(id);
}

/**
 * Approve a blueprint.
 * This should ONLY be called from admin routes.
 */
export function approveBlueprint(proposalId: number, adminUserId: string, notes?: string) {
  return toolDiscoveryDB.approveBlueprint(proposalId, adminUserId, notes);
}

/**
 * Reject a blueprint.
 * This should ONLY be called from admin routes.
 */
export function rejectBlueprint(proposalId: number, adminUserId: string, reason?: string) {
  return toolDiscoveryDB.rejectBlueprint(proposalId, adminUserId, reason);
}

/**
 * Defer a blueprint.
 * This should ONLY be called from admin routes.
 */
export function deferBlueprint(proposalId: number, adminUserId: string, notes?: string) {
  return toolDiscoveryDB.deferBlueprint(proposalId, adminUserId, notes);
}

/**
 * Merge blueprints.
 * This should ONLY be called from admin routes.
 */
export function mergeBlueprints(
  proposalId: number,
  mergeIntoId: number,
  adminUserId: string,
  notes?: string
) {
  return toolDiscoveryDB.mergeBlueprints(proposalId, mergeIntoId, adminUserId, notes);
}
