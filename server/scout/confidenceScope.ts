/**
 * Confidence Scope Helpers
 *
 * Confidence must stay context-bounded:
 *   scope = hash(dominant_risk_profile + flow_type + context_fingerprint)
 */
import crypto from "crypto";
import type { Situation, Risk } from "./governor";

export type ConfidenceScope = {
  key: string;
  flowType: string;
  dominantRisk: string;
  contextFingerprint: string;
  summary: string;
};

const SEVERITY_ORDER: Record<Risk["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function hashScope(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 24);
}

export function dominantRiskProfile(risks: Risk[]): string {
  if (!risks || risks.length === 0) return "low_general";
  const sorted = [...risks].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  const top = sorted[0];
  return `${top.type}:${top.severity}`;
}

export function inferFlowTypeFromSituation(situation: Situation): string {
  const goal = situation.goal?.toLowerCase() || "";

  if (/contractor|roofer|plumber|electrician|hvac|service request/.test(goal)) {
    return "service_request";
  }

  if (/hoa|board|association|governance/.test(goal)) {
    return "governance";
  }

  if (/insurance|finance|loan|budget|payment|invoice|quote/.test(goal)) {
    return "financial";
  }

  if (/safety|permit|compliance|legal/.test(goal)) {
    return "compliance";
  }

  return "general";
}

export function buildContextFingerprint(situation: Situation): string {
  const goal = (situation.goal || "general_goal").toLowerCase().replace(/\s+/g, " ").trim();
  const constraintKey = (situation.constraints || [])
    .map((c) => c.toLowerCase())
    .sort()
    .join("|") || "no_constraints";
  const locality = situation.local?.countyCode || situation.local?.stateCode || "no_locale";
  return `${goal}|${constraintKey}|${locality}`;
}

export function computeConfidenceScope(situation: Situation): ConfidenceScope {
  const dominantRisk = dominantRiskProfile(situation.risks || []);
  const flowType = inferFlowTypeFromSituation(situation);
  const contextFingerprint = buildContextFingerprint(situation);
  const key = hashScope(`${dominantRisk}|${flowType}|${contextFingerprint}`);

  return {
    key,
    flowType,
    dominantRisk,
    contextFingerprint,
    summary: `${flowType}|${dominantRisk}`,
  };
}
