/**
 * Scout Multi-Source Synthesis Engine
 *
 * Proactively combines multiple data sources into a single coherent response:
 * 1. Your TradeScout Knowledge Base (building codes, pricing, guides)
 * 2. Live Web Search (current market data, recent regulations, real-time info)
 * 3. Local Jurisdiction Data (county-specific rules, local resources)
 *
 * Scout synthesizes these sources together, not as fallbacks, but as
 * complementary intelligence that gives users a complete picture.
 */

import { webSearch } from "./webSearchService";
import {
  extractRelevantKnowledge,
  isCodeRelatedQuery,
  isPricingRelatedQuery,
} from "./scoutKnowledgeIntegration";

export interface MultiSourceContext {
  query: string;
  county?: string;
  state?: string;
  trade?: string;
}

export interface SourcedData {
  content: string;
  source: string;
  confidence: "high" | "medium" | "low";
  timestamp?: string;
}

export interface SynthesisResult {
  systemPrompt: string;
  sources: string[];
  warnings: string[];
  dataBySource: {
    knowledge?: SourcedData;
    webSearch?: SourcedData;
    local?: SourcedData;
  };
}

/**
 * Proactively gather data from all sources in parallel
 */
export async function gatherMultiSourceData(
  context: MultiSourceContext
): Promise<{
  knowledge: any;
  webSearch?: SourcedData;
  local?: SourcedData;
}> {
  const { query, county, state, trade } = context;

  // Gather knowledge base data (synchronous)
  const knowledge = extractRelevantKnowledge(query, trade, county, state);

  // Proactively search the web for real-time data (async, don't wait)
  let webSearchData: SourcedData | undefined;
  try {
    // Always do web search for code and pricing queries
    if (isCodeRelatedQuery(query) || isPricingRelatedQuery(query)) {
      const searchResult = await webSearch(query, 5);
      if (searchResult.success && searchResult.content) {
        webSearchData = {
          content: searchResult.content,
          source: searchResult.provider || "web-search",
          confidence: "high",
          timestamp: new Date().toISOString(),
        };
      }
    }
  } catch (error) {
    console.warn("[Multi-Source] Web search failed:", error);
    // Continue without web search, it's not a blocker
  }

  // Local jurisdiction data (would be fetched from database in production)
  let localData: SourcedData | undefined;
  if (county && state) {
    // Placeholder for local data retrieval
    // In production, this would query a database or API
    localData = {
      content: `Local data for ${county}, ${state} is available but not yet indexed.`,
      source: `Local Data (${county}, ${state})`,
      confidence: "medium",
      timestamp: new Date().toISOString(),
    };
  }

  return { knowledge, webSearch: webSearchData, local: localData };
}

/**
 * Synthesize multiple sources into a coherent system prompt
 */
export function synthesizeMultiSourcePrompt(
  userQuery: string,
  context: MultiSourceContext,
  sourceData: {
    knowledge: any;
    webSearch?: SourcedData;
    local?: SourcedData;
  }
): SynthesisResult {
  const sources: string[] = [];
  const warnings: string[] = [];
  const dataBySource: any = {};

  let knowledgeSection = "";
  let webSearchSection = "";
  let localSection = "";

  // 1. Knowledge Base Section
  if (sourceData.knowledge) {
    dataBySource.knowledge = {
      content: JSON.stringify(sourceData.knowledge),
      source: "TradeScout Knowledge Base",
      confidence: "high",
    };

    if (sourceData.knowledge.notIndexed && sourceData.knowledge.notIndexed.length > 0) {
      warnings.push(...sourceData.knowledge.notIndexed);
    }

    if (sourceData.knowledge.codes) {
      knowledgeSection += `\n## TradeScout Knowledge Base - Building Codes\n${sourceData.knowledge.codes}`;
      sources.push("TradeScout Building Codes Database");
    }

    if (sourceData.knowledge.pricing) {
      knowledgeSection += `\n## TradeScout Knowledge Base - Pricing\n${sourceData.knowledge.pricing}`;
      sources.push("TradeScout Pricing Database");
    }

    if (sourceData.knowledge.guides) {
      knowledgeSection += `\n## TradeScout Knowledge Base - Trade Guides\n${sourceData.knowledge.guides}`;
      sources.push("TradeScout Trade Guides");
    }
  }

  // 2. Web Search Section (proactive, not fallback)
  if (sourceData.webSearch && sourceData.webSearch.content) {
    dataBySource.webSearch = sourceData.webSearch;
    webSearchSection = `\n## Live Web Search Results (Current Market Data)\n${sourceData.webSearch.content}`;
    sources.push("Live Web Search");
  }

  // 3. Local Data Section
  if (sourceData.local && sourceData.local.content) {
    dataBySource.local = sourceData.local;
    localSection = `\n## Local Jurisdiction Data (${context.county}, ${context.state})\n${sourceData.local.content}`;
    sources.push(`Local Data (${context.county}, ${context.state})`);
  }

  // Build comprehensive system prompt that synthesizes all sources
  const systemPrompt = `You are Scout, the TradeScout multi-source intelligence assistant.

Your role:
- Synthesize information from multiple sources (TradeScout Knowledge, Live Web, Local Data)
- Give users a complete picture by combining all available sources
- Clearly cite which source each piece of information comes from
- Highlight when sources agree vs. when they differ
- Never invent data - only use what's provided below

When answering:
1. Start with TradeScout Knowledge Base data (most trusted)
2. Supplement with Live Web Search for current market conditions
3. Include Local Jurisdiction data for regional specifics
4. When sources differ, explain the difference and why (e.g., "Your TradeScout data shows X, but the 2026 market shows Y")
5. Always cite sources explicitly
6. Be honest about what's not yet indexed or available

IMPORTANT: Use ALL sources together, not as fallbacks. Your job is to synthesize them into one coherent answer.
${knowledgeSection}${webSearchSection}${localSection}`;

  return {
    systemPrompt,
    sources: Array.from(new Set(sources)), // Deduplicate
    warnings,
    dataBySource,
  };
}

/**
 * Build a multi-source response that cites all sources
 */
export function buildMultiSourceResponse(
  synthesis: SynthesisResult,
  llmResponse: string
): {
  message: string;
  sources: string[];
  sourceBreakdown: {
    knowledge?: boolean;
    webSearch?: boolean;
    local?: boolean;
  };
  warnings: string[];
} {
  const sourceBreakdown = {
    knowledge: !!synthesis.dataBySource.knowledge,
    webSearch: !!synthesis.dataBySource.webSearch,
    local: !!synthesis.dataBySource.local,
  };

  return {
    message: llmResponse,
    sources: synthesis.sources,
    sourceBreakdown,
    warnings: synthesis.warnings,
  };
}
