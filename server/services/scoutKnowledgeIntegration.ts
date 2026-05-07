/**
 * Scout Knowledge Integration Service
 *
 * Bridges the gap between:
 * 1. Structured knowledge base (building codes, pricing, trade guides)
 * 2. OpenAI Responses API for intelligent synthesis
 * 3. Web search for real-time data (material prices, local regulations)
 *
 * This ensures Scout answers are grounded in verified data, not hallucinations.
 */

export interface KnowledgeContext {
  query: string;
  county?: string;
  state?: string;
  trade?: string;
  intent?: string;
}

export interface EnrichedPrompt {
  systemPrompt: string;
  userPrompt: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
}

/**
 * Detect if a query is about building codes, permits, or inspections.
 */
export function isCodeRelatedQuery(query: string): boolean {
  const codeKeywords = /\b(code|permit|permitting|inspection|inspector|zoning|setback|occupancy|egress|fire\s*safety|smoke\s*alarm|carbon\s*monoxide|electrical|panel|breaker|gfci|afci|receptacle|outlet|subpanel|service\s*entrance|plumbing|drain|sewer|cleanout|trap|vent|slope|foundation|slab|footing|framing|joist|beam|header|stair|handrail|guardrail|deck)\b/i;
  return codeKeywords.test(query);
}

/**
 * Detect if a query is about pricing or cost estimation.
 */
export function isPricingRelatedQuery(query: string): boolean {
  const pricingKeywords = /\b(price|cost|expense|budget|rate|quote|estimate|material|labor|hourly|per\s*square|per\s*foot|how\s*much|affordable|expensive|cheap)\b/i;
  return pricingKeywords.test(query);
}

/**
 * Build an enriched prompt that includes relevant knowledge context.
 * This ensures OpenAI has the right context to give accurate, grounded answers.
 */
export function buildEnrichedPrompt(
  userQuery: string,
  knowledgeContext: KnowledgeContext,
  relevantKnowledge?: {
    codes?: string;
    pricing?: string;
    guides?: string;
    localData?: string;
  }
): EnrichedPrompt {
  const sources: string[] = [];
  let knowledgeSection = "";

  // Add code-related context if applicable
  if (isCodeRelatedQuery(userQuery) && relevantKnowledge?.codes) {
    knowledgeSection += `\n\n## BUILDING CODES & REGULATIONS\n${relevantKnowledge.codes}`;
    sources.push("TradeScout Building Codes Database");
  }

  // Add pricing context if applicable
  if (isPricingRelatedQuery(userQuery) && relevantKnowledge?.pricing) {
    knowledgeSection += `\n\n## PRICING & COST ESTIMATES\n${relevantKnowledge.pricing}`;
    sources.push("TradeScout Pricing Database");
  }

  // Add trade guides
  if (relevantKnowledge?.guides) {
    knowledgeSection += `\n\n## TRADE GUIDES & BEST PRACTICES\n${relevantKnowledge.guides}`;
    sources.push("TradeScout Trade Guides");
  }

  // Add local data
  if (relevantKnowledge?.localData) {
    knowledgeSection += `\n\n## LOCAL INFORMATION (${knowledgeContext.county}, ${knowledgeContext.state})\n${relevantKnowledge.localData}`;
    sources.push(`Local Data for ${knowledgeContext.county}, ${knowledgeContext.state}`);
  }

  const systemPrompt = `You are Scout, the TradeScout operating system assistant.

Your role:
- Answer questions about local trades, contractors, projects, and community tools
- Ground all answers in verified TradeScout data, building codes, and pricing information
- If you reference codes, pricing, or guides, cite the source clearly
- If information comes from the open web, always say so explicitly
- Never invent data, contractors, prices, or regulations

When answering:
1. Use the knowledge provided below as your primary source
2. If the user asks about codes or pricing, reference the specific data provided
3. If you need to search the web for real-time info, indicate that clearly
4. Always be honest about what you know vs. don't know
5. Suggest next steps when you don't have complete information
${knowledgeSection}`;

  const userPrompt = userQuery;

  const confidence = sources.length > 0 ? "high" : "medium";

  return {
    systemPrompt,
    userPrompt,
    sources,
    confidence,
  };
}

import {
  getBuildingCodeData,
  getPricingData,
  getTradeGuide,
  getLocalGuide,
  formatBuildingCodeText,
  formatPricingText,
  formatTradeGuideText,
  formatLocalGuideText,
} from "./scoutKnowledgeLoader";

/**
 * Extract relevant knowledge from the knowledge base for a given query.
 * This integrates with scoutKnowledgeLoader to retrieve formatted knowledge.
 */
export function extractRelevantKnowledge(
  query: string,
  trade?: string,
  county?: string,
  state?: string
): {
  codes?: string;
  pricing?: string;
  guides?: string;
  localData?: string;
} {
  const relevant: any = {};

  // Load building codes if this is a code-related query
  if (isCodeRelatedQuery(query) && trade && state) {
    const codeData = getBuildingCodeData(trade, state);
    if (codeData) {
      relevant.codes = formatBuildingCodeText(codeData);
    }
  }

  // Load pricing data if this is a pricing-related query
  if (isPricingRelatedQuery(query) && trade && state) {
    const pricingData = getPricingData(trade, state);
    if (pricingData) {
      relevant.pricing = formatPricingText(pricingData);
    }
  }

  // Load trade guides
  if (trade) {
    const guideData = getTradeGuide(trade);
    if (guideData) {
      relevant.guides = formatTradeGuideText(guideData);
    }
  }

  // Load local guides
  if (county && state) {
    const localData = getLocalGuide(county, state);
    if (localData) {
      relevant.localData = formatLocalGuideText(localData);
    }
  }

  return relevant;
}
