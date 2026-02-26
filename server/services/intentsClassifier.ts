/**
 * Intent Classification & Mapping for Objectives
 *
 * This layer converts Scout's existing intent classifier output into objective_intent_class values.
 * Phase 1: Uses existing Scout intent labels + simple heuristics
 * Phase 2: Can be enhanced with additional LLM-based classification if needed
 */

export type ScoutIntentLabel = "hire" | "advise" | "collaborate" | "unknown";
export type ObjectiveIntentClass =
  | "unknown"
  | "knowledge"
  | "local_advice"
  | "work_request"
  | "marketplace_buy"
  | "marketplace_sell"
  | "community_post"
  | "event"
  | "safety_report"
  | "account"
  | "admin"
  | "other";

/**
 * Maps Scout intent label to objective intent class
 * This is the primary mapping layer
 */
export function mapScoutIntentToObjectiveClass(
  scoutIntent: ScoutIntentLabel,
  context?: { messageText?: string; userRole?: string; previousIntent?: ObjectiveIntentClass }
): { intentClass: ObjectiveIntentClass; confidence: number } {
  // Base mapping from Scout classifier
  let intentClass: ObjectiveIntentClass = "unknown";
  let confidence = 0.5; // Default neutral confidence

  switch (scoutIntent) {
    // "hire" intent -> work_request (homeowner hiring) or marketplace_sell (contractor offering)
    case "hire":
      if (context?.userRole === "contractor" || context?.userRole === "service_provider") {
        intentClass = "marketplace_sell";
        confidence = 0.75; // High confidence for contractor
      } else {
        intentClass = "work_request";
        confidence = 0.8; // High confidence for homeowner hire intent
      }
      break;

    // "advise" intent -> could be knowledge, local_advice, or community_post
    case "advise":
      // Heuristic: if they're asking (not sharing), likely local_advice
      const isAsking = context?.messageText?.includes("?");
      if (isAsking) {
        intentClass = "local_advice";
        confidence = 0.7;
      } else {
        // Instead offering advice -> knowledge (learning) or community_post (sharing)
        intentClass = "knowledge";
        confidence = 0.65;
      }
      break;

    // "collaborate" intent -> work_request (hiring help) or marketplace_buy (buying service)
    case "collaborate":
      intentClass = "work_request";
      confidence = 0.7;
      break;

    // Unknown -> need further classification or heuristics
    case "unknown":
      intentClass = "unknown";
      confidence = 0.3; // Low confidence until updated
      break;

    default:
      intentClass = "unknown";
      confidence = 0.3;
  }

  return { intentClass, confidence };
}

/**
 * Enhanced classification using message text heuristics
 * Called when Scout returns "unknown" and we have message content
 * Looks for keywords indicating intent type
 */
export function classifyFromMessageHeuristics(messageText: string): {
  intentClass: ObjectiveIntentClass;
  confidence: number;
} {
  if (!messageText || messageText.length === 0) {
    return { intentClass: "unknown", confidence: 0.2 };
  }

  const text = messageText.toLowerCase();

  // Work request signals: hiring, need help, looking for, etc.
  if (
    /need|hire|looking for|find (a |the )?(contractor|plumber|electrician|builder|expert|help|someone)/i.test(
      text
    )
  ) {
    return { intentClass: "work_request", confidence: 0.8 };
  }

  // Marketplace sell signals: selling, for sale, want to sell, listing
  if (/sell|for sale|list (for sale)?|selling|want to sell|interested in selling/i.test(text)) {
    return { intentClass: "marketplace_sell", confidence: 0.85 };
  }

  // Marketplace buy signals: buy, looking to buy, want to buy, price check
  if (/buy|(want|looking) to buy|interested in buying|how much|price/i.test(text)) {
    // Distinguish from work_request: if it's about goods/items vs services
    if (/couch|furniture|car|tool|equipment|sofa|table|chair|appliance/i.test(text)) {
      return { intentClass: "marketplace_buy", confidence: 0.8 };
    }
    // Could still be work_request if about services
  }

  // Local advice signals: ask, opinion, recommend, suggest, think about
  if (
    /what do you|how should|which one|which is best|recommend|suggest|opinion|advice|local|[?]($|\s)/i.test(
      text
    )
  ) {
    return { intentClass: "local_advice", confidence: 0.75 };
  }

  // Community post signals: share, tell, announce, happened, found, lost
  if (
    /(tell|share|sharing|announce|post|posting|update|updating|happened|found|lost|here's|look at|check out|alert|warning|safety)/i.test(
      text
    )
  ) {
    return { intentClass: "community_post", confidence: 0.7 };
  }

  // Safety report signals
  if (/(safety|danger|hazard|accident|fire|flood|gas|electrical|broken|unsafe)/i.test(text)) {
    return { intentClass: "safety_report", confidence: 0.75 };
  }

  // Knowledge/learning signals
  if (/(learn|understand|how|what is|explain|definition|can you tell me about)/i.test(text)) {
    return { intentClass: "knowledge", confidence: 0.7 };
  }

  // Account/profile signals
  if (/(account|profile|settings|password|email|update (my |profile)|change)/i.test(text)) {
    return { intentClass: "account", confidence: 0.8 };
  }

  // Event planning signals (Phase 2)
  if (/(event|party|meeting|gathering|schedule|when|set up|plan)/i.test(text)) {
    return { intentClass: "event", confidence: 0.65 };
  }

  // Default: could not confidently classify
  return { intentClass: "unknown", confidence: 0.4 };
}

/**
 * Comprehensive intent classification combining Scout output + heuristics
 * This is the main entry point for objective creation
 */
export function classifyUserIntent(input: {
  scoutIntent?: ScoutIntentLabel;
  messageText?: string;
  userRole?: string;
  previousIntent?: ObjectiveIntentClass;
}): {
  intentClass: ObjectiveIntentClass;
  confidence: number;
  source: "scout_classifier" | "message_heuristics" | "fallback";
} {
  // If Scout classifier returned something other than unknown, use it
  if (input.scoutIntent && input.scoutIntent !== "unknown") {
    const mapped = mapScoutIntentToObjectiveClass(input.scoutIntent, {
      messageText: input.messageText,
      userRole: input.userRole,
      previousIntent: input.previousIntent,
    });
    return { ...mapped, source: "scout_classifier" };
  }

  // Scout returned unknown, try message heuristics
  if (input.messageText) {
    const heuristic = classifyFromMessageHeuristics(input.messageText);
    if (heuristic.intentClass !== "unknown") {
      return { ...heuristic, source: "message_heuristics" };
    }
  }

  // Fallback: return unknown
  return { intentClass: "unknown", confidence: 0.2, source: "fallback" };
}

/**
 * Detect topic shift: Compare new classification with previous intent
 * Returns true if user clearly moved to a different topic
 */
export function detectTopicShift(
  previousIntent: ObjectiveIntentClass,
  newIntent: ObjectiveIntentClass,
  confidenceThreshold: number = 0.65
): boolean {
  // If new classification is very different and high confidence, it's a shift
  if (previousIntent === "unknown" || newIntent === "unknown") {
    return false; // Don't trigger on unknown transitions
  }

  // Define related intent groups (not a topic shift if within same group)
  const shoppingGroup = ["marketplace_buy", "marketplace_sell"];
  const hireGroup = ["work_request", "marketplace_sell"];
  const communityGroup = ["community_post", "local_advice", "safety_report"];
  const personalGroup = ["account", "knowledge", "other"];

  const isSameGroup = (i1: ObjectiveIntentClass, i2: ObjectiveIntentClass): boolean => {
    return (
      (shoppingGroup.includes(i1) && shoppingGroup.includes(i2)) ||
      (hireGroup.includes(i1) && hireGroup.includes(i2)) ||
      (communityGroup.includes(i1) && communityGroup.includes(i2)) ||
      (personalGroup.includes(i1) && personalGroup.includes(i2))
    );
  };

  return previousIntent !== newIntent && !isSameGroup(previousIntent, newIntent);
}
