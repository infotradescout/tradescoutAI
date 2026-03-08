/**
 * Confidence Scorer
 * 
 * Confidence is NOT "how right Scout feels."
 * Confidence is "how safe it is for Scout to assert authority."
 * 
 * This measures authority legitimacy, not correctness probability.
 */

import type { Situation } from "./governor";
import { computeFinalConfidence } from "./outcomeTracker";

// ============================================================================
// TYPES
// ============================================================================

export interface ConfidenceSignals {
  evidenceStrength: number;        // 0-1: How concrete is the data?
  institutionalMemoryDensity: number; // 0-1: Has the system seen this before?
  userFamiliarity: number;          // 0-1: Does the user know this domain?
  ambiguity: number;                // 0-1: How much is missing/unclear?
  outcomeRiskMagnitude: number;     // 0-1: How bad if Scout is wrong?
}

export interface ConfidenceAssessment {
  confidence: number;               // 0-1: Final blended confidence
  rawConfidence: number;            // 0-1: Situational confidence before state blending
  stateConfidence?: number;         // 0-1: Historical confidence (if provided)
  signals: ConfidenceSignals;
  explanation: string;
  allowedActions: GovernorAction[];
}

export type GovernorAction = "COMPLY" | "DEFER" | "REDIRECT" | "BLOCK";

// ============================================================================
// SIGNAL SCORING
// ============================================================================

/**
 * Evidence Strength (ES) - Strongest signal
 * 
 * Answers: "Is Scout reasoning from real data or inference alone?"
 * 
 * 0.0 = speculative
 * 0.5 = partial, inferred
 * 1.0 = concrete, verified
 * 
 * Rule: Scout should almost never BLOCK without ES ≥ 0.7
 */
export function scoreEvidenceStrength(
  message: string,
  situation: Situation,
  context: {
    hasMedia?: boolean;
    hasDocuments?: boolean;
    hasVerifiedRecords?: boolean;
    factCount?: number;
  }
): number {
  let score = 0.3; // baseline (some inference always present)

  // Explicit facts increase confidence
  const factualIndicators = [
    /\$[\d,]+/,           // concrete amounts
    /\d+ (years?|months?|days?)/,  // specific timeframes
    /^\d{5}(-\d{4})?$/,   // zip codes
    /\b\d+ [A-Z][a-z]+ (St|Ave|Rd|Blvd)\b/, // addresses
  ];

  const factCount = context.factCount || 
    factualIndicators.filter(pattern => pattern.test(message)).length;

  score += Math.min(factCount * 0.1, 0.3);

  // Media/documents provide strong evidence
  if (context.hasMedia) score += 0.2;
  if (context.hasDocuments) score += 0.2;
  if (context.hasVerifiedRecords) score += 0.3;

  // Goal specificity
  if (situation.goal && situation.goal.length > 50) {
    score += 0.1; // detailed goals show clarity
  }

  return Math.min(score, 1.0);
}

/**
 * Institutional Memory Density (IMD) - Second strongest signal
 * 
 * Answers: "Has the system seen this before and learned from outcomes?"
 * 
 * 0.0 = novel situation
 * 0.5 = seen before, weak outcomes
 * 1.0 = strongly institutionalized
 * 
 * Rule: IMD legitimizes authority across users - makes Scout "wise"
 */
export function scoreInstitutionalMemoryDensity(
  situation: Situation,
  context: {
    approvedToolsCount?: number;
    regretPatternsCount?: number;
    successfulOutcomesCount?: number;
    tacitKnowledgeConfidence?: number;
  }
): number {
  // Brand new situation
  if (!context.approvedToolsCount && !context.regretPatternsCount && !context.successfulOutcomesCount) {
    return 0.0;
  }

  let score = 0.0;

  // Approved tools for this pattern = strong institutionalization
  if (context.approvedToolsCount && context.approvedToolsCount > 0) {
    score += Math.min(context.approvedToolsCount * 0.25, 0.5);
  }

  // Historical regret patterns = learned protective wisdom
  if (context.regretPatternsCount && context.regretPatternsCount > 0) {
    score += Math.min(context.regretPatternsCount * 0.3, 0.4);
  }

  // Successful repeated outcomes = validated approach
  if (context.successfulOutcomesCount && context.successfulOutcomesCount > 0) {
    score += Math.min(context.successfulOutcomesCount * 0.15, 0.3);
  }

  // Tacit knowledge (if available)
  if (context.tacitKnowledgeConfidence) {
    score += context.tacitKnowledgeConfidence * 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * User Familiarity (UF) - Tone modulator
 * 
 * Answers: "Does the user already understand this domain?"
 * 
 * 0.0 = first-time, novice
 * 1.0 = experienced, consistent success
 * 
 * Rule: UF should change HOW Scout intervenes, not WHETHER it intervenes
 */
export function scoreUserFamiliarity(
  userId: string,
  situation: Situation,
  context: {
    priorSimilarInteractions?: number;
    correctTerminologyUsed?: boolean;
    priorSuccessfulOutcomes?: number;
    clarificationRequestsCount?: number;
  }
): number {
  // New user or first interaction
  if (!context.priorSimilarInteractions) {
    return 0.2; // baseline assumption of some general competence
  }

  let score = 0.2;

  // Repeated similar interactions show familiarity
  if (context.priorSimilarInteractions > 0) {
    score += Math.min(context.priorSimilarInteractions * 0.15, 0.4);
  }

  // Correct terminology = domain knowledge
  if (context.correctTerminologyUsed) {
    score += 0.2;
  }

  // Prior successful outcomes = competence
  if (context.priorSuccessfulOutcomes && context.priorSuccessfulOutcomes > 0) {
    score += Math.min(context.priorSuccessfulOutcomes * 0.1, 0.3);
  }

  // Reduced clarification needs = understanding
  if (context.clarificationRequestsCount !== undefined) {
    const clarificationPenalty = Math.min(context.clarificationRequestsCount * 0.1, 0.3);
    score -= clarificationPenalty;
  }

  return Math.max(0.0, Math.min(score, 1.0));
}

/**
 * Ambiguity / Unknowns (AMB) - Confidence killer
 * 
 * Answers: "How much is missing or unclear?"
 * 
 * 0.0 = fully specified
 * 1.0 = highly ambiguous
 * 
 * Rule: High ambiguity should force DEFER regardless of other signals
 */
export function scoreAmbiguity(
  message: string,
  situation: Situation
): number {
  let ambiguityScore = 0.0;

  // Count unknowns
  const unknownsCount = situation.unknowns?.length || 0;
  ambiguityScore += Math.min(unknownsCount * 0.15, 0.5);

  // Vague language indicators
  const vagueIndicators = [
    /\b(maybe|perhaps|might|could|possibly|probably)\b/gi,
    /\b(some|few|several|many|most)\b/gi,
    /\b(soon|later|eventually|sometime)\b/gi,
    /\b(thing|stuff|whatever|something)\b/gi,
  ];

  const vagueCount = vagueIndicators.filter(pattern => pattern.test(message)).length;
  ambiguityScore += Math.min(vagueCount * 0.1, 0.3);

  // Missing critical fields
  if (!situation.goal || situation.goal.length < 20) {
    ambiguityScore += 0.2;
  }

  // Conflicting signals (constraints that oppose each other)
  if (situation.constraints && situation.constraints.length > 1) {
    // Simple heuristic: timeline + budget constraints often conflict
    const hasTimeline = situation.constraints.some(c => /time|deadline|urgent|asap/i.test(c));
    const hasBudget = situation.constraints.some(c => /budget|cost|price|cheap|afford/i.test(c));
    if (hasTimeline && hasBudget) {
      ambiguityScore += 0.15; // time vs money trade-off = ambiguity
    }
  }

  return Math.min(ambiguityScore, 1.0);
}

/**
 * Outcome Risk Magnitude (ORM) - Authority amplifier
 * 
 * Answers: "How bad is it if Scout is wrong?"
 * 
 * This comes from the risk classifier (7 dimensions).
 * High risk does NOT increase confidence — it increases the NEED for confidence.
 * ORM penalizes confidence unless supported by ES + IMD.
 */
export function scoreOutcomeRiskMagnitude(
  situation: Situation
): number {
  if (!situation.risks || situation.risks.length === 0) {
    return 0.1; // baseline - every action has some risk
  }

  // Get max risk level from situation
  const riskLevels: Record<string, number> = {
    'low': 0.2,
    'medium': 0.5,
    'high': 0.75,
    'critical': 1.0,
  };

  const maxRisk = situation.risks.reduce((max, risk) => {
    const level = riskLevels[risk.severity] || 0.5;
    return Math.max(max, level);
  }, 0.1);

  // Weight by risk types (from classifier)
  let weightedRisk = maxRisk;

  // Safety and irreversibility amplify risk magnitude
  const hasSafetyRisk = false; // safety not in current risk enum
  const hasIrreversibleRisk = situation.risks.some(r => r.type === 'irreversible');
  const hasFinancialRisk = situation.risks.some(r => r.type === 'financial');

  if (hasSafetyRisk) weightedRisk = Math.min(weightedRisk * 1.3, 1.0);
  if (hasIrreversibleRisk) weightedRisk = Math.min(weightedRisk * 1.2, 1.0);
  if (hasFinancialRisk && maxRisk >= 0.75) weightedRisk = Math.min(weightedRisk * 1.1, 1.0);

  return weightedRisk;
}

// ============================================================================
// CONFIDENCE FORMULA
// ============================================================================

/**
 * The canonical confidence formula.
 * 
 * confidence = 
 *   ( (0.30 * ES) + (0.30 * IMD) + (0.15 * UF) )
 *   * (1 - Ambiguity)
 *   * (1 - RiskPenalty)
 * 
 * Where: RiskPenalty = clamp(ORM * 0.5, 0, 0.5)
 * 
 * Why this works:
 * - ES + IMD dominate (authority must be earned)
 * - Ambiguity is multiplicative (missing info nukes confidence)
 * - Risk doesn't zero confidence, but caps authority
 * - UF softens tone without overpowering evidence
 */
export function calculateConfidence(signals: ConfidenceSignals): number {
  const { 
    evidenceStrength, 
    institutionalMemoryDensity, 
    userFamiliarity,
    ambiguity,
    outcomeRiskMagnitude 
  } = signals;

  // Risk penalty (caps at 0.5 to prevent zeroing)
  const riskPenalty = Math.min(outcomeRiskMagnitude * 0.5, 0.5);

  // Core confidence from evidence + memory + familiarity
  const coreConfidence = 
    (0.30 * evidenceStrength) +
    (0.30 * institutionalMemoryDensity) +
    (0.15 * userFamiliarity);

  // Apply multiplicative penalties
  const confidence = coreConfidence * (1 - ambiguity) * (1 - riskPenalty);

  return Math.max(0.0, Math.min(confidence, 1.0));
}

/**
 * Determine allowed actions based on confidence thresholds.
 * 
 * Mapping:
 * < 0.30     → COMPLY / gentle DEFER only
 * 0.30-0.55  → REDIRECT (soft), structured guidance
 * 0.55-0.70  → REDIRECT (assertive), DEFER confidently
 * 0.70-0.85  → DEFER strongly, constrain actions
 * > 0.85     → BLOCK allowed (rare, justified)
 */
export function getAllowedActions(confidence: number): GovernorAction[] {
  if (confidence < 0.30) {
    return ["COMPLY", "DEFER"];
  } else if (confidence < 0.55) {
    return ["COMPLY", "DEFER", "REDIRECT"];
  } else if (confidence < 0.70) {
    return ["DEFER", "REDIRECT"];
  } else if (confidence < 0.85) {
    return ["DEFER", "REDIRECT"];
  } else {
    return ["DEFER", "REDIRECT", "BLOCK"];
  }
}

/**
 * Generate explanation of confidence assessment.
 */
export function explainConfidence(
  confidence: number,
  signals: ConfidenceSignals
): string {
  const parts: string[] = [];

  // Overall assessment
  if (confidence < 0.30) {
    parts.push("Scout is operating with limited confidence in this situation.");
  } else if (confidence < 0.55) {
    parts.push("Scout has moderate confidence based on available information.");
  } else if (confidence < 0.70) {
    parts.push("Scout has good confidence in this assessment.");
  } else if (confidence < 0.85) {
    parts.push("Scout has strong confidence based on evidence and institutional memory.");
  } else {
    parts.push("Scout has very high confidence - this pattern is well-established.");
  }

  // Key factors
  if (signals.evidenceStrength < 0.5) {
    parts.push("Limited concrete evidence available.");
  }
  if (signals.institutionalMemoryDensity > 0.6) {
    parts.push("This situation has been seen before with documented outcomes.");
  }
  if (signals.ambiguity > 0.5) {
    parts.push("Several important details are still unclear.");
  }
  if (signals.outcomeRiskMagnitude > 0.7) {
    parts.push("The potential consequences are significant.");
  }

  return parts.join(" ");
}

// ============================================================================
// FULL ASSESSMENT
// ============================================================================

/**
 * Perform complete confidence assessment.
 */
export function assessConfidence(
  message: string,
  situation: Situation,
  context: {
    userId?: string;
    hasMedia?: boolean;
    hasDocuments?: boolean;
    hasVerifiedRecords?: boolean;
    factCount?: number;
    approvedToolsCount?: number;
    regretPatternsCount?: number;
    successfulOutcomesCount?: number;
    tacitKnowledgeConfidence?: number;
    priorSimilarInteractions?: number;
    correctTerminologyUsed?: boolean;
    priorSuccessfulOutcomes?: number;
    clarificationRequestsCount?: number;
    stateConfidence?: number; // Persisted user confidence (0-1)
  } = {}
): ConfidenceAssessment {
  // Score individual signals
  const evidenceStrength = scoreEvidenceStrength(message, situation, context);
  const institutionalMemoryDensity = scoreInstitutionalMemoryDensity(situation, context);
  const userFamiliarity = scoreUserFamiliarity(context.userId || 'unknown', situation, context);
  const ambiguity = scoreAmbiguity(message, situation);
  const outcomeRiskMagnitude = scoreOutcomeRiskMagnitude(situation);

  const signals: ConfidenceSignals = {
    evidenceStrength,
    institutionalMemoryDensity,
    userFamiliarity,
    ambiguity,
    outcomeRiskMagnitude,
  };

  // Calculate confidence
  const rawConfidence = calculateConfidence(signals);
  const blended = computeFinalConfidence(rawConfidence, context.stateConfidence ?? rawConfidence);

  // Determine allowed actions
  const allowedActions = getAllowedActions(blended);

  // Generate explanation
  const explanation = explainConfidence(blended, signals);

  return {
    confidence: blended,
    rawConfidence,
    stateConfidence: context.stateConfidence,
    signals,
    explanation,
    allowedActions,
  };
}
