/**
 * Scout Knowledge Integration Service
 *
 * Bridges the gap between:
 * 1. Real knowledge base (building codes, pricing, trade guides)
 * 2. OpenAI Responses API for intelligent synthesis
 * 3. Web search for real-time data (material prices, local regulations)
 *
 * This ensures Scout answers are grounded in verified data, not hallucinations.
 * NO MOCK DATA - only real, verified content from your knowledge base.
 * If data is not indexed yet, reports honestly as "not yet indexed".
 */

import {
  getBuildingCodeFiles,
  getTradeGuideFiles,
  getPricingFiles,
  getNotIndexedResponse,
  getKnowledgeBaseStatus,
} from "./scoutKnowledgeLoader";

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
  warnings?: string[];
}

/**
 * Detect if a query is about building codes, permits, or inspections.
 */
export function isCodeRelatedQuery(query: string): boolean {
  const codeKeywords =
    /\b(code|permit|permitting|inspection|inspector|zoning|setback|occupancy|egress|fire\s*safety|smoke\s*alarm|carbon\s*monoxide|electrical|panel|breaker|gfci|afci|receptacle|outlet|subpanel|service\s*entrance|plumbing|drain|sewer|cleanout|trap|vent|slope|foundation|slab|footing|framing|joist|beam|header|stair|handrail|guardrail|deck)\b/i;
  return codeKeywords.test(query);
}

/**
 * Detect if a query is about pricing or cost estimation.
 */
export function isPricingRelatedQuery(query: string): boolean {
  const pricingKeywords =
    /\b(price|cost|expense|budget|rate|quote|estimate|material|labor|hourly|per\s*square|per\s*foot|how\s*much|affordable|expensive|cheap)\b/i;
  return pricingKeywords.test(query);
}

/**
 * Extract relevant knowledge from the knowledge base for a given query.
 * Returns real data if indexed, or honest "not yet indexed" message if not.
 * NO MOCK DATA - only real verified content.
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
  notIndexed?: string[];
} {
  const relevant: any = {};
  const notIndexed: string[] = [];

  // Check if knowledge base is available
  const status = getKnowledgeBaseStatus();
  if (!status.available) {
    notIndexed.push(
      "Knowledge base not found. Building codes, pricing, and guides are not available."
    );
    relevant.notIndexed = notIndexed;
    return relevant;
  }

  // Building codes: Check if files exist
  if (isCodeRelatedQuery(query)) {
    const buildingCodeFiles = getBuildingCodeFiles();
    if (buildingCodeFiles.length > 0) {
      // Files exist but are not yet parsed/indexed
      notIndexed.push(getNotIndexedResponse("building codes", trade ? `for ${trade}` : undefined));
    } else {
      notIndexed.push("Building code files have not been added to the knowledge base yet.");
    }
  }

  // Pricing data: Check if files exist
  if (isPricingRelatedQuery(query)) {
    const pricingFiles = getPricingFiles();
    if (pricingFiles.length > 0) {
      // Files exist but are not yet parsed/indexed
      notIndexed.push(getNotIndexedResponse("pricing data", state ? `for ${state}` : undefined));
    } else {
      notIndexed.push("Pricing files have not been added to the knowledge base yet.");
    }
  }

  // Trade guides: Check if files exist
  if (trade) {
    const tradeGuideFiles = getTradeGuideFiles();
    if (tradeGuideFiles.length > 0) {
      // Files exist but are not yet parsed/indexed
      notIndexed.push(getNotIndexedResponse("trade guides", `for ${trade}`));
    } else {
      notIndexed.push("Trade guide files have not been added to the knowledge base yet.");
    }
  }

  if (notIndexed.length > 0) {
    relevant.notIndexed = notIndexed;
  }

  return relevant;
}

/**
 * Build an enriched prompt that includes relevant knowledge context.
 * This ensures OpenAI has the right context to give accurate, grounded answers.
 * If knowledge is not indexed, includes honest warnings.
 */
export function buildEnrichedPrompt(
  userQuery: string,
  knowledgeContext: KnowledgeContext,
  relevantKnowledge?: {
    codes?: string;
    pricing?: string;
    guides?: string;
    localData?: string;
    notIndexed?: string[];
  }
): EnrichedPrompt {
  const sources: string[] = [];
  const warnings: string[] = [];
  let knowledgeSection = "";

  // Add warnings if data is not indexed
  if (relevantKnowledge?.notIndexed && relevantKnowledge.notIndexed.length > 0) {
    warnings.push(...relevantKnowledge.notIndexed);
  }

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

  // Build system prompt
  const systemPrompt = `You are Scout, the TradeScout local search and summary surface.

Your role:
- Answer questions about local trades, contractors, projects, and community tools
- Ground all answers in verified TradeScout data, building codes, and pricing information
- If you reference codes, pricing, or guides, cite the source clearly
- If information comes from the open web, always say so explicitly
- Never invent data, contractors, prices, or regulations
- Be honest about what you don't know

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
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
