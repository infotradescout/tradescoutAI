/**
 * Scout Multi-Source Synthesis Engine
 *
 * Proactively combines multiple data sources into a single coherent response.
 *
 * SOURCE PRIORITY (highest to lowest):
 * 1. TradeScout Knowledge Base (your verified data - PRIMARY)
 * 2. Local Jurisdiction Data (regional rules - SECONDARY, overrides web)
 * 3. Live Web Search (general market data - TERTIARY, context only)
 *
 * Your knowledge base is PRIMARY. Local rules override web data.
 * Web data provides general context and market conditions.
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
    local?: SourcedData;
    webSearch?: SourcedData;
  };
}

/**
 * Proactively gather data from all sources in parallel
 */
export async function gatherMultiSourceData(
  context: MultiSourceContext
): Promise<{
  knowledge: any;
  local?: SourcedData;
  webSearch?: SourcedData;
}> {
  const { query, county, state, trade } = context;

  // Gather knowledge base data (synchronous)
  const knowledge = extractRelevantKnowledge(query, trade, county, state);

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

  return { knowledge, local: localData, webSearch: webSearchData };
}

/**
 * Synthesize multiple sources into a coherent system prompt
 *
 * Priority order (highest to lowest):
 * 1. TradeScout Knowledge Base (PRIMARY)
 * 2. Local Jurisdiction Data (SECONDARY - overrides web)
 * 3. Live Web Search (TERTIARY - context)
 */
export function synthesizeMultiSourcePrompt(
  userQuery: string,
  context: MultiSourceContext,
  sourceData: {
    knowledge: any;
    local?: SourcedData;
    webSearch?: SourcedData;
  }
): SynthesisResult {
  const sources: string[] = [];
  const warnings: string[] = [];
  const dataBySource: any = {};

  let knowledgeSection = "";
  let localSection = "";
  let webSearchSection = "";

  // 1. PRIMARY: TradeScout Knowledge Base (appears first, weighted highest)
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
      knowledgeSection += `\n## PRIMARY: TradeScout Knowledge Base - Building Codes\n(Your verified data - highest priority)\n${sourceData.knowledge.codes}`;
      sources.push("TradeScout Building Codes Database");
    }

    if (sourceData.knowledge.pricing) {
      knowledgeSection += `\n## PRIMARY: TradeScout Knowledge Base - Pricing\n(Your verified data - highest priority)\n${sourceData.knowledge.pricing}`;
      sources.push("TradeScout Pricing Database");
    }

    if (sourceData.knowledge.guides) {
      knowledgeSection += `\n## PRIMARY: TradeScout Knowledge Base - Trade Guides\n(Your verified data - highest priority)\n${sourceData.knowledge.guides}`;
      sources.push("TradeScout Trade Guides");
    }
  }

  // 2. SECONDARY: Local Jurisdiction Data (overrides web data)
  if (sourceData.local && sourceData.local.content) {
    dataBySource.local = sourceData.local;
    localSection = `\n## SECONDARY: Local Jurisdiction Data (${context.county}, ${context.state})\n(Regional rules - overrides general web data)\n${sourceData.local.content}`;
    sources.push(`Local Data (${context.county}, ${context.state})`);
  }

  // 3. TERTIARY: Web Search (general context, doesn't override local/knowledge)
  if (sourceData.webSearch && sourceData.webSearch.content) {
    dataBySource.webSearch = sourceData.webSearch;
    webSearchSection = `\n## TERTIARY: Live Web Search Results\n(General market data - context only, doesn't override local or TradeScout data)\n${sourceData.webSearch.content}`;
    sources.push("Live Web Search");
  }

  // Build comprehensive system prompt with clear source hierarchy
  const systemPrompt = `You are Scout, the TradeScout multi-source intelligence assistant.

Your role:
- Prioritize TradeScout Knowledge Base as the primary source (most trusted)
- Use Local Jurisdiction Data to override or contextualize general web data
- Add Live Web Search for general market context
- Clearly cite which source each piece of information comes from
- Highlight when sources agree vs. when they differ
- Never invent data - only use what's provided below

SOURCE PRIORITY (highest to lowest):
1. TradeScout Knowledge Base (PRIMARY - your verified data)
2. Local Jurisdiction Data (SECONDARY - regional rules override web)
3. Live Web Search (TERTIARY - general market context)

When answering:
1. Lead with TradeScout Knowledge Base data (most authoritative)
2. Contextualize with Local Jurisdiction data (e.g., "In ${context.county}, ${context.state}, this means...")
3. Add Live Web Search for market context (e.g., "The current market shows...")
4. When sources differ, explain why (market changes, regional variations, etc.)
5. Always cite sources explicitly
6. Be honest about what's not yet indexed or available

CRITICAL: Local rules ALWAYS override general web data. Your TradeScout Knowledge Base is the foundation.
${knowledgeSection}${localSection}${webSearchSection}`;

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
    local?: boolean;
    webSearch?: boolean;
  };
  warnings: string[];
} {
  const sourceBreakdown = {
    knowledge: !!synthesis.dataBySource.knowledge,
    local: !!synthesis.dataBySource.local,
    webSearch: !!synthesis.dataBySource.webSearch,
  };

  return {
    message: llmResponse,
    sources: synthesis.sources,
    sourceBreakdown,
    warnings: synthesis.warnings,
  };
}
