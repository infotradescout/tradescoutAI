/**
 * Scout Governor — Situation-Driven Intelligence
 *
 * Scout is a flow composer, not a domain expert.
 * Scout may comply, defer, redirect, or block — and it must explain why.
 *
 * Core law: "Connection without compromise"
 *
 * Primary loop:
 * Signal → Situation Inference → Outcome Risk Assessment → Action Selection → Intervention → Memory
 *
 * Tool Discovery runs OFFLINE (not in this flow).
 */

import type { User } from "../assistantActions";
import { classifyRisk, explainRisk, type RiskAssessment } from "./riskClassifier";
import { assessConfidence, getAllowedActions, type ConfidenceAssessment } from "./confidenceScorer";
import { getUserConfidenceState, getOutcomeStats } from "./outcomeTracker";
import { computeConfidenceScope, type ConfidenceScope } from "./confidenceScope";
import { db } from "../db";
import { toolProposals } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { toolDiscovery } from "./toolDiscovery";

import {
  DEFAULT_SCOUT_CONTROL_STATE,
  getScoutControlState,
  type ScoutControlState,
} from "../services/scoutControlState";

let toolProposalTableAvailable: boolean | null = null;

function isMissingRelationError(err: unknown, relationName: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as any).code;
  const message = String((err as any).message ?? "");
  return (
    code === "42P01" ||
    message.toLowerCase().includes(`relation "${relationName.toLowerCase()}" does not exist`)
  );
}

async function getApprovedToolsCountForScope(contextFingerprint: string): Promise<number> {
  if (toolProposalTableAvailable === false) {
    return 0;
  }

  try {
    const approvedTools = await db
      .select({ count: sql<number>`count(*)` })
      .from(toolProposals)
      .where(
        and(
          eq(toolProposals.status, "approved" as any),
          eq(toolProposals.fingerprint, contextFingerprint)
        )
      );

    toolProposalTableAvailable = true;
    return approvedTools?.[0]?.count ? Number(approvedTools[0].count) : 0;
  } catch (err) {
    if (isMissingRelationError(err, "tool_proposals")) {
      // Fail-soft when this optional table has not been migrated yet.
      toolProposalTableAvailable = false;
      console.warn(
        "[Governor] tool_proposals table missing; continuing with zero approved tool signals."
      );
      return 0;
    }

    // Governor should never take Scout down because of telemetry/storage issues.
    console.warn("[Governor] approved tool lookup failed; continuing without tool signals.", err);
    return 0;
  }
}

// ============================================================================
// PRIMITIVES - Universal building blocks that never change
// ============================================================================

export type Primitive =
  | "CAPTURE" // text, media, notes, links, location, time
  | "INTERPRET" // infer intent, stakes, ambiguity, risk
  | "CONSTRAIN" // block, defer, gate, sequence
  | "CONNECT" // people, information, assets, opportunities
  | "COMMIT"; // messages, posts, transactions, records

// ============================================================================
// SCOUT ACTIONS - Only 4 allowed responses to any input
// ============================================================================

export type ScoutAction =
  | "COMPLY" // User intent is sound, low risk, reversible → proceed
  | "DEFER" // Intent may be right, but timing/context wrong → "not yet"
  | "REDIRECT" // Intent misframed, but goal valid → protective correction
  | "BLOCK"; // Action would cause harm/regret → "I can't help you do that yet"

// ============================================================================
// SCOUT ROLES - Selected based on situation assessment
// ============================================================================

export type ScoutRole =
  | "INTERPRETER" // "Here's what's actually going on"
  | "AUTHORITY" // "This is the right move. Here's why"
  | "SAFEGUARD" // "Stop. Here's what could go wrong"
  | "EXECUTOR"; // "I've got this. Here's how we proceed"

export interface AuthorityEvidence {
  scopeKey?: string;
  scopeFlowType?: string;
  scopeDominantRisk?: string;
  institutionalMemoryDensity: number;
  approvedToolsForScope: number;
  successes: number;
  regrets: number;
  recentSuccesses: number;
  recentRegrets: number;
}

type AuthorityProof = {
  hasProof: boolean;
  proofSources: {
    institutionalMemory: boolean;
    approvedTool: boolean;
    repeatedOutcomes: boolean;
  };
  imd: number;
};

// ============================================================================
// SITUATION - Working memory of the current real-world context
// ============================================================================

export interface Situation {
  // User's real-world situation (inferred, not just stated)
  goal: string; // What user actually wants (may differ from stated)
  constraints: string[]; // Discovered limitations (money, time, knowledge, trust)
  risks: Risk[]; // Evaluated outcome risks
  unknowns: string[]; // Tracked missing critical info

  // Execution state
  completedSteps: Step[]; // Already done
  nextBestAction: Step | null; // Computed next move
  confidence: "low" | "medium" | "high";

  // Authority assessment (NEW: confidence-weighted governance)
  confidenceAssessment?: ConfidenceAssessment;

  // Context
  local: LocalContext | null;
  temporal: TemporalContext | null;
  financial: FinancialContext | null;
  trust: TrustContext | null;
  confidenceScope?: ConfidenceScope;
  authorityEvidence?: AuthorityEvidence;
}

export interface Risk {
  type: "financial" | "trust" | "legal" | "irreversible" | "timing";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  reversibility: "fully_reversible" | "partially_reversible" | "irreversible";
  consequences: string[];
}

export interface LocalContext {
  countyCode?: string;
  stateCode?: string;
  region?: string;
  localNorms?: string[]; // Inferred from knowledge base
  marketConditions?: string[];
}

export interface TemporalContext {
  urgency: "immediate" | "soon" | "flexible" | "long_term";
  seasonalFactors?: string[];
  timingRisks?: string[];
}

export interface FinancialContext {
  estimatedCost?: { min: number; max: number; confidence: string };
  userBudget?: number;
  anchoringRisk?: boolean; // User fixated on wrong number
  priceComparisonAvailable?: boolean;
}

export interface TrustContext {
  verification: "none" | "partial" | "strong";
  reputationSignals: string[];
  trustGaps: string[];
}

// ============================================================================
// STEP - Individual executable action in a flow
// ============================================================================

export interface Step {
  id: string;
  primitive: Primitive;
  action: string; // Human-readable description
  requiredInfo: string[]; // What's needed to execute
  blockedBy: string[]; // Dependencies
  estimatedTime?: string;
  userFacing: boolean; // Does user see/do this?
}

// ============================================================================
// OUTCOME GRAPH - Temporary situation-specific plan composed at runtime
// ============================================================================

export interface OutcomeGraph {
  situationId: string;
  goal: string;
  steps: Step[];
  currentStep: number;
  mutable: boolean; // Can be adjusted as new info appears
  interrupted: boolean;
  createdAt: string;
  lastUpdated: string;
}

// ============================================================================
// INTERVENTION - Scout's decision and explanation
// ============================================================================

export interface Intervention {
  action: ScoutAction;
  role: ScoutRole;
  reasoning: string; // Why Scout chose this action
  userMessage: string; // User-facing search status or next step
  nextSteps?: Step[]; // If DEFER/REDIRECT, what must happen first
  blockedReason?: string; // If BLOCK, specific reason
  overrideOption?: {
    label: string;
    message: string;
    scope?: string;
    logAction: "ignored_advice";
  };
}

// ============================================================================
// GOVERNOR DECISION - Complete assessment and response
// ============================================================================

export interface GovernorDecision {
  situation: Situation;
  intervention: Intervention;
  outcomeGraph: OutcomeGraph | null;
  confidence: "low" | "medium" | "high";
  effectiveConfidence: number;
  requiresLLM: boolean; // Does this need generative text or is it deterministic?
}

// ============================================================================
// CORE GOVERNOR LOGIC
// ============================================================================

/**
 * Infer the user's real-world situation from their message and context.
 * This is NOT intent classification - it's situation reconstruction.
 */
export async function inferSituation(args: {
  message: string;
  user?: User;
  history: Array<{ role: string; content: string }>;
  recentActivity?: Array<{ type: string; timestamp: string }>;
  countyCode?: string;
  stateCode?: string;
}): Promise<Situation> {
  const { message, user, history, recentActivity, countyCode, stateCode } = args;

  // Deterministic situation inference keeps governance predictable.

  const lower = message.toLowerCase();

  // Detect financial context
  const priceMatch = lower.match(/\$(\d+(?:,\d+)*(?:\.\d{2})?)/);
  const hasPriceQuestion = /is \$?\d+.*too much|how much should|what's (?:a )?fair price/.test(
    lower
  );

  // Detect contractor/service requests
  const serviceRequest = /need (?:a |an )?(?:contractor|roofer|plumber|electrician|hvac)/i.test(
    lower
  );

  // Detect urgency
  const urgency = /asap|urgent|emergency|right now|today/.test(lower)
    ? "immediate"
    : /soon|this week/.test(lower)
      ? "soon"
      : "flexible";

  const situation: Situation = {
    goal: inferGoal(message, lower),
    constraints: inferConstraints(message, lower, user),
    risks: [], // Will be populated below
    unknowns: inferUnknowns(message, lower, { serviceRequest }),
    completedSteps: [],
    nextBestAction: null,
    confidence: "medium",
    local: {
      countyCode,
      stateCode,
      region: stateCode ? getRegionFromState(stateCode) : undefined,
    },
    temporal: {
      urgency,
    },
    financial: priceMatch
      ? {
          estimatedCost: undefined,
          anchoringRisk: hasPriceQuestion,
        }
      : null,
    trust: {
      verification: "none",
      reputationSignals: [],
      trustGaps: serviceRequest ? ["No verified contractors yet", "No local reviews"] : [],
    },
  };

  // Assess risks using domain-agnostic classifier
  situation.risks = await assessRisks(
    message,
    lower,
    situation.goal,
    situation.constraints,
    situation.unknowns
  );

  // Confidence scope: bound authority to a context fingerprint
  const confidenceScope = computeConfidenceScope(situation);
  situation.confidenceScope = confidenceScope;

  // Load confidence state and outcome stats (real signals only)
  const userIdStr = user?.id ? String(user.id) : undefined;
  const userState = userIdStr
    ? await getUserConfidenceState(userIdStr, confidenceScope.key)
    : undefined;
  const outcomeStats = userIdStr
    ? await getOutcomeStats({ userId: userIdStr, scope: confidenceScope.key })
    : { successes: 0, regrets: 0, recentSuccesses: 0, recentRegrets: 0 };
  const approvedToolsCount = await getApprovedToolsCountForScope(
    confidenceScope.contextFingerprint
  );

  // Assess confidence in authority (how safe to intervene strongly)
  situation.confidenceAssessment = assessConfidence(message, situation, {
    userId: user?.id?.toString(),
    // Evidence signals
    hasMedia: Array.isArray(recentActivity)
      ? recentActivity.some((a) => /photo|image|video|upload/i.test(String(a?.type || "")))
      : false,
    hasDocuments: false,
    hasVerifiedRecords: false,
    // Institutional memory signals (real counts)
    approvedToolsCount,
    regretPatternsCount: outcomeStats.regrets,
    successfulOutcomesCount: outcomeStats.successes,
    // User familiarity signals (inferred trajectory)
    priorSimilarInteractions: history.length > 3 ? Math.min(history.length, 10) : 0,
    correctTerminologyUsed: serviceRequest, // Heuristic for now
    stateConfidence: userState?.currentConfidence,
  });

  // Update confidence label and authority evidence for downstream gating
  const blendedConfidence = situation.confidenceAssessment.confidence;
  situation.confidence =
    blendedConfidence < 0.5 ? "low" : blendedConfidence < 0.7 ? "medium" : "high";
  situation.authorityEvidence = {
    scopeKey: confidenceScope.key,
    scopeFlowType: confidenceScope.flowType,
    scopeDominantRisk: confidenceScope.dominantRisk,
    institutionalMemoryDensity: situation.confidenceAssessment.signals.institutionalMemoryDensity,
    approvedToolsForScope: approvedToolsCount,
    successes: outcomeStats.successes,
    regrets: outcomeStats.regrets,
    recentSuccesses: outcomeStats.recentSuccesses,
    recentRegrets: outcomeStats.recentRegrets,
  };

  return situation;
}

function inferGoal(message: string, lower: string): string {
  // Strip helper language to get to actual goal
  const stripped = message
    .replace(/^(can|could|would)\s+you\s+(please\s+)?/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^i\s*(am|'m)\s*(just\s*)?(looking|trying)\s*for\s+/i, "")
    .trim();

  // Detect underlying goals beyond stated request
  if (/is \$?\d+.*too much|how much should/.test(lower)) {
    return "Avoid overpaying and ensure fair pricing";
  }

  if (/need (?:a |an )?contractor|find (?:a |an )?(?:roofer|plumber)/i.test(lower)) {
    return "Find trustworthy contractor who will do good work";
  }

  if (/hoa|association|board/.test(lower)) {
    return "Navigate community governance effectively";
  }

  return stripped || "Get help with local decision";
}

function inferConstraints(message: string, lower: string, user?: User): string[] {
  const constraints: string[] = [];

  // Financial constraints
  if (/budget|afford|expensive|cheap/.test(lower)) {
    constraints.push("Budget-conscious");
  }

  // Time constraints
  if (/asap|urgent|emergency/.test(lower)) {
    constraints.push("Time-sensitive");
  }

  // Knowledge constraints
  if (/how do i|what is|explain|don't know|not sure/.test(lower)) {
    constraints.push("Needs education");
  }

  // Trust constraints
  if (/trustworthy|reliable|scam|ripped off|bad experience/.test(lower)) {
    constraints.push("Trust-sensitive");
  }

  return constraints;
}

async function assessRisks(
  message: string,
  lower: string,
  goal: string,
  constraints: string[],
  unknowns: string[]
): Promise<Risk[]> {
  // Use domain-agnostic risk classifier
  const riskAssessment = classifyRisk({
    message,
    goal,
    constraints,
    unknowns,
  });

  const risks: Risk[] = [];

  // Convert risk dimensions to Risk objects
  if (riskAssessment.dimensions.financial >= 5) {
    risks.push({
      type: "financial",
      severity:
        riskAssessment.dimensions.financial >= 8
          ? "critical"
          : riskAssessment.dimensions.financial >= 6
            ? "high"
            : "medium",
      description: `Financial exposure detected (score: ${riskAssessment.dimensions.financial}/10)`,
      reversibility: riskAssessment.reversibility,
      consequences: [
        "Potential financial loss",
        ...riskAssessment.criticalMissingInfo.filter(
          (i) => i.includes("Cost") || i.includes("budget")
        ),
      ],
    });
  }

  if (riskAssessment.dimensions.safety >= 5) {
    risks.push({
      type: "trust", // Using trust as proxy for safety verification
      severity:
        riskAssessment.dimensions.safety >= 8
          ? "critical"
          : riskAssessment.dimensions.safety >= 6
            ? "high"
            : "medium",
      description: `Safety concerns require verification (score: ${riskAssessment.dimensions.safety}/10)`,
      reversibility: "irreversible",
      consequences: [
        "Potential safety hazard",
        "Property or personal injury risk",
        ...riskAssessment.criticalMissingInfo.filter(
          (i) => i.includes("qualification") || i.includes("licensing")
        ),
      ],
    });
  }

  if (riskAssessment.dimensions.legal >= 5) {
    risks.push({
      type: "legal",
      severity: riskAssessment.dimensions.legal >= 7 ? "high" : "medium",
      description: `Legal/regulatory implications (score: ${riskAssessment.dimensions.legal}/10)`,
      reversibility: "irreversible",
      consequences: [
        "Potential legal complications",
        ...riskAssessment.criticalMissingInfo.filter(
          (i) => i.includes("Permit") || i.includes("compliance")
        ),
      ],
    });
  }

  if (riskAssessment.dimensions.irreversibility >= 6) {
    risks.push({
      type: "irreversible",
      severity: riskAssessment.dimensions.irreversibility >= 8 ? "high" : "medium",
      description: `Irreversible decision point (score: ${riskAssessment.dimensions.irreversibility}/10)`,
      reversibility: "irreversible",
      consequences: [
        "Cannot be undone easily",
        ...riskAssessment.criticalMissingInfo.filter(
          (i) => i.includes("scope") || i.includes("implications")
        ),
      ],
    });
  }

  if (riskAssessment.dimensions.timeCritical >= 7) {
    risks.push({
      type: "timing",
      severity: "medium",
      description: `Time-sensitive decision (score: ${riskAssessment.dimensions.timeCritical}/10)`,
      reversibility: "partially_reversible",
      consequences: ["Rushed decision may lead to regret", "Need to verify before acting urgently"],
    });
  }

  return risks;
}

function inferUnknowns(
  message: string,
  lower: string,
  context: { serviceRequest: boolean }
): string[] {
  const unknowns: string[] = [];

  // Generic unknowns for any service request
  if (context.serviceRequest) {
    // Visual context
    if (!/photo|picture|image/.test(lower)) {
      unknowns.push("No photos of the issue/area");
    }

    // Timeline context
    if (!/age|old|built|installed|when/.test(lower)) {
      unknowns.push("Age/timeline information missing");
    }

    // Scope context
    if (!/square|size|footage|how (much|many|big)/.test(lower)) {
      unknowns.push("Scope/size not specified");
    }

    // Severity/urgency context
    if (
      !/urgent|emergency|asap|bad|severe|critical/.test(lower) &&
      !/minor|small|simple|easy/.test(lower)
    ) {
      unknowns.push("Severity/urgency level unclear");
    }
  }

  return unknowns;
}

function getRegionFromState(stateCode: string): string {
  const regions: Record<string, string> = {
    TX: "South",
    CA: "West",
    NY: "Northeast",
    FL: "South",
    // Add more as needed
  };
  return regions[stateCode] || "Unknown";
}

function evaluateAuthorityProof(situation: Situation): AuthorityProof {
  const imd = situation.authorityEvidence?.institutionalMemoryDensity ?? 0;
  const approvedTool = (situation.authorityEvidence?.approvedToolsForScope ?? 0) > 0;
  const repeatedOutcomes = (situation.authorityEvidence?.recentSuccesses ?? 0) >= 2;

  const hasProof = imd >= 0.35 || approvedTool || repeatedOutcomes;

  return {
    hasProof,
    proofSources: {
      institutionalMemory: imd >= 0.35,
      approvedTool,
      repeatedOutcomes,
    },
    imd,
  };
}

/**
 * Select Scout's action based on situation and risk assessment.
 * This is the core decision point that determines whether Scout
 * complies, defers, redirects, or blocks.
 */
export function selectAction(
  situation: Situation,
  controls: Pick<ScoutControlState, "authorityMode" | "confidenceDampener"> =
    DEFAULT_SCOUT_CONTROL_STATE
): {
  action: ScoutAction;
  role: ScoutRole;
  authorityProof: AuthorityProof;
  allowOverride: boolean;
  effectiveConfidence: number;
} {
  const authorityMode = controls.authorityMode;
  const dampener = controls.confidenceDampener;

  const authorityProof = evaluateAuthorityProof(situation);
  const rawConfidence = situation.confidenceAssessment?.confidence ?? 0.25;
  const effectiveConfidence = Math.min(1, Math.max(0, rawConfidence * dampener));
  const confidence = effectiveConfidence;
  const allowedActions = getAllowedActions(effectiveConfidence);
  let allowOverride = false;

  // AUTHORITY MODE OVERRIDES
  if (authorityMode === "advisory") {
    // Advisory mode: only COMPLY or DEFER, never BLOCK/REDIRECT
    const highRisks = situation.risks.filter(
      (r) => r.severity === "high" || r.severity === "critical"
    );
    if (highRisks.length > 0) {
      allowOverride = true;
      return { action: "DEFER", role: "INTERPRETER", authorityProof, allowOverride, effectiveConfidence };
    }
    return { action: "COMPLY", role: "INTERPRETER", authorityProof, allowOverride, effectiveConfidence };
  }

  // BLOCK: Only allowed when confidence > 0.85 AND critical risks present
  const criticalRisks = situation.risks.filter((r) => r.severity === "critical");

  // Conservative mode: never BLOCK
  if (authorityMode === "conservative" && criticalRisks.length > 0) {
    allowOverride = true;
    return { action: "DEFER", role: "SAFEGUARD", authorityProof, allowOverride, effectiveConfidence };
  }

  if (
    criticalRisks.length > 0 &&
    effectiveConfidence >= 0.85 &&
    allowedActions.includes("BLOCK") &&
    authorityProof.hasProof
  ) {
    allowOverride = true;
    return { action: "BLOCK", role: "SAFEGUARD", authorityProof, allowOverride, effectiveConfidence };
  }

  if (criticalRisks.length > 0 && allowedActions.includes("BLOCK") && !authorityProof.hasProof) {
    allowOverride = true;
    return { action: "DEFER", role: "SAFEGUARD", authorityProof, allowOverride, effectiveConfidence };
  }

  // If BLOCK needed but confidence too low, DEFER instead
  if (criticalRisks.length > 0 && !allowedActions.includes("BLOCK")) {
    allowOverride = true;
    return { action: "DEFER", role: "SAFEGUARD", authorityProof, allowOverride, effectiveConfidence };
  }

  // DEFER: High risks + missing critical info (allowed at confidence >= 0.30)
  const highRisks = situation.risks.filter((r) => r.severity === "high");
  if (highRisks.length > 0 && situation.unknowns.length > 0) {
    allowOverride = !authorityProof.hasProof;
    return { action: "DEFER", role: "SAFEGUARD", authorityProof, allowOverride, effectiveConfidence };
  }

  // REDIRECT: User goal valid but framing wrong (requires confidence >= 0.30)
  const hasAnchoringRisk =
    situation.financial?.anchoringRisk ||
    situation.risks.some((r) => r.description.includes("Financial exposure"));
  if (hasAnchoringRisk && allowedActions.includes("REDIRECT")) {
    // Soft redirect at low confidence, assertive at high confidence
    const role = confidence < 0.7 ? "INTERPRETER" : "AUTHORITY";
    return { action: "REDIRECT", role, authorityProof, allowOverride, effectiveConfidence };
  }

  // DEFER: Missing critical unknowns for high-stakes decision
  if (situation.unknowns.length >= 2 && highRisks.length > 0) {
    allowOverride = !authorityProof.hasProof;
    return { action: "DEFER", role: "INTERPRETER", authorityProof, allowOverride, effectiveConfidence };
  }

  // COMPLY: Low risk, sufficient info, clear path
  if (situation.risks.length === 0 || situation.risks.every((r) => r.severity === "low")) {
    return { action: "COMPLY", role: "EXECUTOR", authorityProof, allowOverride, effectiveConfidence };
  }

  // Default: COMPLY with guidance (always allowed)
  return { action: "COMPLY", role: "INTERPRETER", authorityProof, allowOverride, effectiveConfidence };
}

/**
 * Compose a flow from primitives based on the situation.
 * This is where Scout becomes a flow composer, not a responder.
 */
export function composeFlow(situation: Situation, action: ScoutAction): OutcomeGraph | null {
  if (action === "COMPLY" && situation.risks.length === 0) {
    // Simple query, no flow needed
    return null;
  }

  const steps: Step[] = [];

  // Example: Contractor request with missing info
  if (situation.unknowns.includes("No photos of the issue/area")) {
    steps.push({
      id: "capture_photos",
      primitive: "CAPTURE",
      action: "Upload photos of the area needing work",
      requiredInfo: [],
      blockedBy: [],
      userFacing: true,
    });
  }

  if (situation.unknowns.includes("Age of system/structure unknown")) {
    steps.push({
      id: "capture_age",
      primitive: "CAPTURE",
      action: "Provide age of roof/system (or year built)",
      requiredInfo: [],
      blockedBy: [],
      userFacing: true,
    });
  }

  if (situation.unknowns.includes("Scope/size not specified")) {
    steps.push({
      id: "capture_scope",
      primitive: "CAPTURE",
      action: "Specify approximate size/scope",
      requiredInfo: [],
      blockedBy: [],
      userFacing: true,
    });
  }

  // After capture, interpret the situation
  if (steps.length > 0) {
    steps.push({
      id: "interpret_scope",
      primitive: "INTERPRET",
      action: "Analyze project scope and local pricing",
      requiredInfo: ["photos", "age", "scope"],
      blockedBy: steps.map((s) => s.id),
      userFacing: false,
    });
  }

  // Then connect to contractors
  steps.push({
    id: "connect_contractors",
    primitive: "CONNECT",
    action: "Surface verified contractors in your area",
    requiredInfo: [],
    blockedBy: steps.length > 1 ? ["interpret_scope"] : [],
    userFacing: true,
  });

  return {
    situationId: `situation_${Date.now()}`,
    goal: situation.goal,
    steps,
    currentStep: 0,
    mutable: true,
    interrupted: false,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generate intervention message based on action and role.
 * Scout must explain why it's taking this action.
 *
 * NEW: Explanation depth and tone scale with confidence.
 * - Low confidence (< 0.5): Gentle framing, more questions
 * - Medium confidence (0.5-0.7): Structured guidance
 * - High confidence (> 0.7): Assertive, decisive
 */
export function generateIntervention(
  situation: Situation,
  action: ScoutAction,
  role: ScoutRole,
  outcomeGraph: OutcomeGraph | null,
  options: {
    authorityProof?: AuthorityProof;
    allowOverride?: boolean;
    effectiveConfidence?: number;
  } = {}
): Intervention {
  const { authorityProof, allowOverride } = options;
  const confidence =
    options.effectiveConfidence ?? situation.confidenceAssessment?.confidence ?? 0.25;
  const confidenceLevel = confidence < 0.5 ? "low" : confidence < 0.7 ? "medium" : "high";

  let reasoning = "";
  let userMessage = "";
  let nextSteps: Step[] | undefined = undefined;
  let blockedReason: string | undefined = undefined;
  let overrideOption: Intervention["overrideOption"] = undefined;

  switch (action) {
    case "DEFER":
      reasoning = `Missing critical information that could lead to poor outcome. ${situation.unknowns.join(", ")}`;
      const unknownsText =
        situation.unknowns.length === 1
          ? situation.unknowns[0]
          : `${situation.unknowns.length} pieces of critical information`;

      // Explanation depth scales with confidence
      if (confidenceLevel === "low") {
        // Gentle, questioning approach
        userMessage = `I want to make sure you get the best outcome here. To do that, I need to understand ${unknownsText}.\n\nCould you help me with:`;
      } else if (confidenceLevel === "medium") {
        // Structured guidance
        userMessage = `Before we proceed, I need ${unknownsText}. ${situation.risks[0]?.consequences[0] || "This will help ensure a good outcome."}\n\nHere's what I need:`;
      } else {
        // Assertive, protective
        userMessage = `We need to pause here. Based on similar situations, proceeding without ${unknownsText} typically leads to ${situation.risks[0]?.consequences[0]?.toLowerCase() || "poor outcomes"}.\n\nHere's what's required:`;
      }
      if (allowOverride && !authorityProof?.hasProof) {
        userMessage +=
          "\n\nI'm being careful because this scope doesn't have institutional proof yet. If you proceed anyway, we'll log it so we can learn from the outcome.";
      }
      nextSteps = outcomeGraph?.steps.filter((s) => s.userFacing) || [];
      if (allowOverride) {
        overrideOption = {
          label: "Proceed anyway",
          message:
            "You can continue, but we'll record that you chose to bypass protective steps so we can learn from the outcome.",
          scope: situation.confidenceScope?.key,
          logAction: "ignored_advice",
        };
      }
      break;

    case "REDIRECT":
      reasoning = `User's framing would lead to suboptimal decision. Need to reframe around actual goal.`;
      const risk = situation.risks[0];

      // Tone scales with confidence
      if (confidenceLevel === "low") {
        // Soft redirect - suggest alternative framing
        userMessage = `I can answer that, but there might be a better way to think about this.\n\nConsider: ${risk?.consequences[0] || "Your framing might not match your actual goal."}\n\nWould you like to explore:`;
      } else if (confidenceLevel === "medium") {
        // Structured redirect
        userMessage = `I'll answer your question — but if you focus on ${risk?.type === "financial" ? "price" : "this"} right now, you might make a less optimal decision.\n\nHere's why: ${risk?.consequences[0] || "Your framing doesn't match your actual goal."}\n\nLet me help you approach this differently:`;
      } else {
        // Assertive redirect - protective authority
        userMessage = `I need to redirect you here. Focusing on ${risk?.type === "financial" ? "price alone" : "this"} consistently leads to worse outcomes.\n\nHere's what actually matters: ${risk?.consequences[0] || "Your underlying goal deserves a better approach."}\n\nHere's the right way to frame this:`;
      }
      nextSteps = outcomeGraph?.steps.slice(0, 3) || [];
      break;

    case "BLOCK":
      reasoning = `Critical risks with irreversible consequences. Cannot proceed safely.`;
      blockedReason =
        situation.risks.filter((r) => r.severity === "critical")[0]?.description ||
        "High risk of harm";

      // BLOCK requires high confidence (> 0.85), so always assertive
      userMessage = `I can't help you proceed yet.\n\n${blockedReason}\n\nThis isn't arbitrary — this pattern has led to serious regret in the past. Here's what must happen first:`;
      nextSteps = outcomeGraph?.steps.slice(0, 3) || [];
      overrideOption = {
        label: "Proceed anyway",
        message:
          "Proceeding overrides Scout's safeguard. We'll log this so we can strengthen protections if regret occurs.",
        scope: situation.confidenceScope?.key,
        logAction: "ignored_advice",
      };
      break;

    case "COMPLY":
      reasoning = `Low risk, sufficient context, clear path forward.`;

      // Even COMPLY tone varies
      if (confidenceLevel === "low") {
        userMessage = "Here's what I can tell you:";
      } else if (role === "EXECUTOR") {
        userMessage = "I've got this. Here's how we proceed:";
      } else {
        userMessage = "Here's what you need to know:";
      }
      break;
  }

  return {
    action,
    role,
    reasoning,
    userMessage,
    nextSteps,
    blockedReason,
    overrideOption,
  };
}

/**
 * Main governor entry point.
 * This is what replaces the current LLM-first approach.
 */
export async function govern(args: {
  message: string;
  user?: User;
  history: Array<{ role: string; content: string }>;
  recentActivity?: Array<{ type: string; timestamp: string }>;
  countyCode?: string;
  stateCode?: string;
  sessionId?: string;
}): Promise<GovernorDecision> {
  // 1. Infer situation (not just intent)
  const situation = await inferSituation(args);

  // 2. Load durable controls and select an action using effective confidence.
  const controls = await getScoutControlState();
  const { action, role, authorityProof, allowOverride, effectiveConfidence } =
    selectAction(situation, controls);

  // 3. Compose flow if needed
  const outcomeGraph = composeFlow(situation, action);

  // 4. Generate intervention
  const intervention = generateIntervention(situation, action, role, outcomeGraph, {
    authorityProof,
    allowOverride,
    effectiveConfidence,
  });

  // 5. Determine if LLM is needed for response text
  const requiresLLM = action === "COMPLY" || (action === "REDIRECT" && !outcomeGraph);

  // Tool Discovery runs OFFLINE after completion
  // See observeFlowCompletion() in toolDiscoveryObserver.ts

  return {
    situation,
    intervention,
    outcomeGraph,
    confidence: situation.confidence,
    effectiveConfidence,
    requiresLLM,
  };
}

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

/**
 * Track regret event (called when user expresses regret)
 */
export function trackRegret(args: {
  userId: string;
  originalDecision: string;
  originalTimestamp: string;
  regretStatement: string;
  consequences: string[];
  missingInfo: string[];
  preventionPattern: string;
}): void {
  toolDiscovery.trackRegret({
    id: `regret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: args.userId,
    timestamp: new Date().toISOString(),
    originalDecision: args.originalDecision,
    originalTimestamp: args.originalTimestamp,
    regretStatement: args.regretStatement,
    consequences: args.consequences,
    reversibility: args.consequences.some((c) => /irreversible|permanent|can't undo/i.test(c))
      ? "irreversible"
      : args.consequences.some((c) => /expensive|costly/i.test(c))
        ? "reversible_expensive"
        : "partially_reversible",
    shouldHaveBeenBlocked: args.consequences.some((c) => /financial loss|property damage/i.test(c)),
    shouldHaveBeenDeferred: args.missingInfo.length > 0,
    missingInfo: args.missingInfo,
    preventionPattern: args.preventionPattern,
    scoutFailure: null, // Would analyze Scout's original decision
  });
}
