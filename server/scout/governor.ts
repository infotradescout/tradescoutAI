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
 */

import type { User } from "../assistantActions";

// ============================================================================
// PRIMITIVES - Universal building blocks that never change
// ============================================================================

export type Primitive =
  | "CAPTURE"    // text, media, notes, links, location, time
  | "INTERPRET"  // infer intent, stakes, ambiguity, risk
  | "CONSTRAIN"  // block, defer, gate, sequence
  | "CONNECT"    // people, information, assets, opportunities
  | "COMMIT";    // messages, posts, transactions, records

// ============================================================================
// SCOUT ACTIONS - Only 4 allowed responses to any input
// ============================================================================

export type ScoutAction =
  | "COMPLY"     // User intent is sound, low risk, reversible → proceed
  | "DEFER"      // Intent may be right, but timing/context wrong → "not yet"
  | "REDIRECT"   // Intent misframed, but goal valid → protective correction
  | "BLOCK";     // Action would cause harm/regret → "I can't help you do that yet"

// ============================================================================
// SCOUT ROLES - Selected based on situation assessment
// ============================================================================

export type ScoutRole =
  | "INTERPRETER"  // "Here's what's actually going on"
  | "AUTHORITY"    // "This is the right move. Here's why"
  | "SAFEGUARD"    // "Stop. Here's what could go wrong"
  | "EXECUTOR";    // "I've got this. Here's how we proceed"

// ============================================================================
// SITUATION - Working memory of the current real-world context
// ============================================================================

export interface Situation {
  // User's real-world situation (inferred, not just stated)
  goal: string;              // What user actually wants (may differ from stated)
  constraints: string[];     // Discovered limitations (money, time, knowledge, trust)
  risks: Risk[];             // Evaluated outcome risks
  unknowns: string[];        // Tracked missing critical info
  
  // Execution state
  completedSteps: Step[];    // Already done
  nextBestAction: Step | null; // Computed next move
  confidence: "low" | "medium" | "high";
  
  // Context
  local: LocalContext | null;
  temporal: TemporalContext | null;
  financial: FinancialContext | null;
  trust: TrustContext | null;
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
  localNorms?: string[];     // Inferred from knowledge base
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
  anchoringRisk?: boolean;   // User fixated on wrong number
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
  action: string;              // Human-readable description
  requiredInfo: string[];      // What's needed to execute
  blockedBy: string[];         // Dependencies
  estimatedTime?: string;
  userFacing: boolean;         // Does user see/do this?
}

// ============================================================================
// OUTCOME GRAPH - Temporary situation-specific plan composed at runtime
// ============================================================================

export interface OutcomeGraph {
  situationId: string;
  goal: string;
  steps: Step[];
  currentStep: number;
  mutable: boolean;            // Can be adjusted as new info appears
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
  reasoning: string;           // Why Scout chose this action
  userMessage: string;         // What Scout says to user
  nextSteps?: Step[];          // If DEFER/REDIRECT, what must happen first
  blockedReason?: string;      // If BLOCK, specific reason
}

// ============================================================================
// GOVERNOR DECISION - Complete assessment and response
// ============================================================================

export interface GovernorDecision {
  situation: Situation;
  intervention: Intervention;
  outcomeGraph: OutcomeGraph | null;
  confidence: "low" | "medium" | "high";
  requiresLLM: boolean;        // Does this need generative text or is it deterministic?
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
  
  // TODO: This will integrate with LLM for complex inference
  // For now, basic pattern matching to demonstrate the architecture
  
  const lower = message.toLowerCase();
  
  // Detect financial context
  const priceMatch = lower.match(/\$(\d+(?:,\d+)*(?:\.\d{2})?)/);
  const hasPriceQuestion = /is \$?\d+.*too much|how much should|what's (?:a )?fair price/.test(lower);
  
  // Detect contractor/service requests
  const serviceRequest = /need (?:a |an )?(?:contractor|roofer|plumber|electrician|hvac)/i.test(lower);
  
  // Detect urgency
  const urgency = /asap|urgent|emergency|right now|today/.test(lower)
    ? "immediate"
    : /soon|this week/.test(lower)
    ? "soon"
    : "flexible";
  
  const situation: Situation = {
    goal: inferGoal(message, lower),
    constraints: inferConstraints(message, lower, user),
    risks: await assessRisks(message, lower, { hasPriceQuestion, serviceRequest, priceMatch }),
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
    financial: priceMatch ? {
      estimatedCost: undefined,
      anchoringRisk: hasPriceQuestion,
    } : undefined,
    trust: {
      verification: "none",
      reputationSignals: [],
      trustGaps: serviceRequest ? ["No verified contractors yet", "No local reviews"] : [],
    },
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
  context: { hasPriceQuestion: boolean; serviceRequest: boolean; priceMatch: RegExpMatchArray | null }
): Promise<Risk[]> {
  const risks: Risk[] = [];
  
  // Price anchoring risk - user asking "is $X too much?" is dangerous
  if (context.hasPriceQuestion && context.priceMatch) {
    risks.push({
      type: "financial",
      severity: "high",
      description: "User is price-anchored on a number without context",
      reversibility: "irreversible",
      consequences: [
        "May overpay by accepting overpriced bid",
        "May accept low bid that leads to poor work",
        "Focusing on price rather than quality/scope",
      ],
    });
  }
  
  // High-stakes contractor work (foundation, roof, electrical, HVAC)
  const highStakesWork = /foundation|structural|roof|electrical|hvac|plumb/i.test(lower);
  
  // Contractor connection without verification
  if (context.serviceRequest || highStakesWork) {
    const severity = highStakesWork ? "high" : "medium";
    risks.push({
      type: "trust",
      severity,
      description: highStakesWork 
        ? "High-stakes irreversible work without verified contractor"
        : "Connecting to unverified contractor for irreversible work",
      reversibility: "irreversible",
      consequences: [
        "Poor quality work that must be redone",
        "Financial loss if contractor doesn't complete",
        "Property damage from unqualified work",
        ...(highStakesWork ? ["Structural/safety issues from improper work"] : []),
      ],
    });
  }
  
  // Financial risk for expensive work
  if (highStakesWork && !context.hasPriceQuestion) {
    risks.push({
      type: "financial",
      severity: "medium",
      description: "High-cost work without price context",
      reversibility: "partially_reversible",
      consequences: [
        "May not budget correctly",
        "Surprised by actual costs",
        "Unable to compare bids effectively",
      ],
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
  
  const highStakesWork = /foundation|structural|roof|electrical|hvac|plumb/i.test(lower);
  
  if (context.serviceRequest || highStakesWork) {
    // Critical missing info for contractor work
    if (!/photo|picture|image/.test(lower)) {
      unknowns.push("No photos of the issue/area");
    }
    
    if (!/age|old|built|installed/.test(lower)) {
      unknowns.push("Age of system/structure unknown");
    }
    
    if (!/square|size|footage/.test(lower)) {
      unknowns.push("Scope/size not specified");
    }
    
    // For foundation work, also need severity info
    if (/foundation/i.test(lower) && !/crack|settle|slope|shift/.test(lower)) {
      unknowns.push("Severity/symptoms not described");
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

/**
 * Select Scout's action based on situation and risk assessment.
 * This is the core decision point that determines whether Scout
 * complies, defers, redirects, or blocks.
 */
export function selectAction(situation: Situation): { action: ScoutAction; role: ScoutRole } {
  // BLOCK: Critical risks that must prevent action
  const criticalRisks = situation.risks.filter(r => r.severity === "critical");
  if (criticalRisks.length > 0) {
    return { action: "BLOCK", role: "SAFEGUARD" };
  }
  
  // DEFER: High risks + missing critical info
  const highRisks = situation.risks.filter(r => r.severity === "high");
  if (highRisks.length > 0 && situation.unknowns.length > 0) {
    return { action: "DEFER", role: "SAFEGUARD" };
  }
  
  // REDIRECT: User goal is valid but framing is wrong
  const hasAnchoringRisk = situation.risks.some(r => 
    r.type === "financial" && r.description.includes("anchored")
  );
  if (hasAnchoringRisk) {
    return { action: "REDIRECT", role: "AUTHORITY" };
  }
  
  // DEFER: Missing critical unknowns for high-stakes decision
  if (situation.unknowns.length >= 2 && highRisks.length > 0) {
    return { action: "DEFER", role: "INTERPRETER" };
  }
  
  // COMPLY: Low risk, sufficient info, clear path
  if (situation.risks.length === 0 || situation.risks.every(r => r.severity === "low")) {
    return { action: "COMPLY", role: "EXECUTOR" };
  }
  
  // Default: COMPLY with guidance
  return { action: "COMPLY", role: "INTERPRETER" };
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
      blockedBy: steps.map(s => s.id),
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
 */
export function generateIntervention(
  situation: Situation,
  action: ScoutAction,
  role: ScoutRole,
  outcomeGraph: OutcomeGraph | null
): Intervention {
  let reasoning = "";
  let userMessage = "";
  let nextSteps: Step[] | undefined = undefined;
  let blockedReason: string | undefined = undefined;
  
  switch (action) {
    case "DEFER":
      reasoning = `Missing critical information that could lead to poor outcome. ${situation.unknowns.join(", ")}`;
      const unknownsText = situation.unknowns.length === 1 
        ? situation.unknowns[0] 
        : `${situation.unknowns.length} pieces of critical information`;
      userMessage = `Before we proceed, I need ${unknownsText}. ${situation.risks[0]?.consequences[0] || "This will help ensure a good outcome."}\n\nHere's what I need:`;
      nextSteps = outcomeGraph?.steps.filter(s => s.userFacing) || [];
      break;
    
    case "REDIRECT":
      reasoning = `User's framing would lead to suboptimal decision. Need to reframe around actual goal.`;
      const risk = situation.risks[0];
      userMessage = `I'll answer your question — but if you focus on ${risk?.type === "financial" ? "price" : "this"} right now, you're likely to make a worse decision.\n\nHere's why: ${risk?.consequences[0] || "Your framing doesn't match your actual goal."}\n\nLet me help you approach this differently:`;
      nextSteps = outcomeGraph?.steps.slice(0, 3) || [];
      break;
    
    case "BLOCK":
      reasoning = `Critical risks with irreversible consequences. Cannot proceed safely.`;
      blockedReason = situation.risks.filter(r => r.severity === "critical")[0]?.description || "High risk of harm";
      userMessage = `I can't help you proceed yet.\n\n${blockedReason}\n\nHere's what must happen first:`;
      nextSteps = outcomeGraph?.steps.slice(0, 3) || [];
      break;
    
    case "COMPLY":
      reasoning = `Low risk, sufficient context, clear path forward.`;
      userMessage = role === "EXECUTOR" 
        ? "I've got this. Here's how we proceed:"
        : "Here's what you need to know:";
      break;
  }
  
  return {
    action,
    role,
    reasoning,
    userMessage,
    nextSteps,
    blockedReason,
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
}): Promise<GovernorDecision> {
  // 1. Infer situation (not just intent)
  const situation = await inferSituation(args);
  
  // 2. Select action based on risk assessment
  const { action, role } = selectAction(situation);
  
  // 3. Compose flow if needed
  const outcomeGraph = composeFlow(situation, action);
  
  // 4. Generate intervention
  const intervention = generateIntervention(situation, action, role, outcomeGraph);
  
  // 5. Determine if LLM is needed for response text
  const requiresLLM = action === "COMPLY" || (action === "REDIRECT" && !outcomeGraph);
  
  return {
    situation,
    intervention,
    outcomeGraph,
    confidence: situation.confidence,
    requiresLLM,
  };
}
