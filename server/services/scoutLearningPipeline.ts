/**
 * Scout Learning Pipeline
 *
 * Automatically captures, indexes, and learns from every scouting report.
 * Every search result, every finding, every synthesis becomes part of Scout's brain.
 * All outputs are indexed and searchable by LISA.
 */

import { EventEmitter } from "events";

export interface ScoutingReportForIndexing {
  id: string;
  mission: string;
  query: string;
  findings: {
    knowledge: string[];
    local: string[];
    web: string[];
  };
  synthesis: string;
  confidence: "high" | "medium" | "low";
  sources: string[];
  jurisdiction?: string;
  trade?: string;
  timestamp: string;
  userId?: string;
}

export interface IndexedIntelligence {
  id: string;
  type: "finding" | "synthesis" | "web_search" | "local_data";
  content: string;
  keywords: string[];
  source: string;
  confidence: "high" | "medium" | "low";
  jurisdiction?: string;
  trade?: string;
  timestamp: string;
  scoutingReportId: string;
  lisaRelevance: number; // 0-1, how relevant this is to LISA's decision making
}

export interface LearningMetrics {
  totalReportsProcessed: number;
  totalIntelligenceIndexed: number;
  averageConfidence: number;
  lastLearningUpdate: string;
  knowledgeGrowthRate: number; // new intelligence per day
}

/**
 * Scout Learning Pipeline
 *
 * Processes every scouting report and:
 * 1. Extracts key intelligence
 * 2. Indexes it for searchability
 * 3. Calculates LISA relevance
 * 4. Feeds it into the decision layer
 * 5. Updates Scout's brain with new learnings
 */
export class ScoutLearningPipeline extends EventEmitter {
  private indexedIntelligence: Map<string, IndexedIntelligence> = new Map();
  private metrics: LearningMetrics = {
    totalReportsProcessed: 0,
    totalIntelligenceIndexed: 0,
    averageConfidence: 0,
    lastLearningUpdate: new Date().toISOString(),
    knowledgeGrowthRate: 0,
  };

  /**
   * Process a scouting report and add it to Scout's brain
   */
  async processScoutingReport(report: ScoutingReportForIndexing): Promise<IndexedIntelligence[]> {
    const indexedItems: IndexedIntelligence[] = [];

    // Extract and index findings from each source
    const knowledgeFindings = this.indexFindings(report.findings.knowledge, "knowledge", report);
    const localFindings = this.indexFindings(report.findings.local, "local_data", report);
    const webFindings = this.indexFindings(report.findings.web, "web_search", report);

    indexedItems.push(...knowledgeFindings, ...localFindings, ...webFindings);

    // Index the synthesis as a unified intelligence piece
    const synthesisIntelligence = this.indexSynthesis(report);
    indexedItems.push(synthesisIntelligence);

    // Add all to the index
    for (const item of indexedItems) {
      this.indexedIntelligence.set(item.id, item);
    }

    // Update metrics
    this.updateMetrics(report, indexedItems);

    // Emit event for LISA integration
    this.emit("intelligence-indexed", {
      reportId: report.id,
      intelligence: indexedItems,
      timestamp: new Date().toISOString(),
    });

    return indexedItems;
  }

  /**
   * Index findings from a specific source
   */
  private indexFindings(
    findings: string[],
    source: "knowledge" | "local_data" | "web_search",
    report: ScoutingReportForIndexing
  ): IndexedIntelligence[] {
    return findings.map((finding, idx) => {
      const intelligence: IndexedIntelligence = {
        id: `${report.id}-${source}-${idx}`,
        type: source === "knowledge" ? "finding" : source,
        content: finding,
        keywords: this.extractKeywords(finding),
        source,
        confidence: report.confidence,
        jurisdiction: report.jurisdiction,
        trade: report.trade,
        timestamp: report.timestamp,
        scoutingReportId: report.id,
        lisaRelevance: this.calculateLisaRelevance(finding, report),
      };
      return intelligence;
    });
  }

  /**
   * Index the synthesis as a unified intelligence piece
   */
  private indexSynthesis(report: ScoutingReportForIndexing): IndexedIntelligence {
    return {
      id: `${report.id}-synthesis`,
      type: "synthesis",
      content: report.synthesis,
      keywords: this.extractKeywords(report.synthesis),
      source: "scout-synthesis",
      confidence: report.confidence,
      jurisdiction: report.jurisdiction,
      trade: report.trade,
      timestamp: report.timestamp,
      scoutingReportId: report.id,
      lisaRelevance: this.calculateLisaRelevance(report.synthesis, report),
    };
  }

  /**
   * Extract keywords from content for searchability
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "is",
      "are",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
    ]);

    const words = content
      .toLowerCase()
      .split(/\\s+/)
      .filter(
        (word) =>
          word.length > 3 && !stopWords.has(word) && /^[a-z]+$/.test(word.replace(/[^a-z]/g, ""))
      )
      .slice(0, 20); // Top 20 keywords

    return [...new Set(words)];
  }

  /**
   * Calculate how relevant this intelligence is to LISA
   * Higher relevance = more useful for decision making
   */
  private calculateLisaRelevance(content: string, report: ScoutingReportForIndexing): number {
    let relevance = 0;

    // Base relevance from confidence
    const confidenceScore = {
      high: 0.9,
      medium: 0.6,
      low: 0.3,
    };
    relevance += confidenceScore[report.confidence] * 0.4;

    // Boost for actionable intelligence (contains "must", "required", "should", etc.)
    const actionableKeywords = [
      "must",
      "required",
      "should",
      "need",
      "permit",
      "license",
      "inspection",
      "code",
      "regulation",
    ];
    const hasActionable = actionableKeywords.some((kw) => content.toLowerCase().includes(kw));
    if (hasActionable) relevance += 0.3;

    // Boost for specific trades
    if (report.trade) relevance += 0.2;

    // Boost for specific jurisdiction
    if (report.jurisdiction) relevance += 0.1;

    return Math.min(relevance, 1.0);
  }

  /**
   * Update learning metrics
   */
  private updateMetrics(
    report: ScoutingReportForIndexing,
    indexedItems: IndexedIntelligence[]
  ): void {
    this.metrics.totalReportsProcessed += 1;
    this.metrics.totalIntelligenceIndexed += indexedItems.length;
    this.metrics.lastLearningUpdate = new Date().toISOString();

    // Update average confidence
    const allConfidenceScores = {
      high: 1,
      medium: 0.5,
      low: 0.25,
    };
    const newAverage =
      (this.metrics.averageConfidence * (this.metrics.totalReportsProcessed - 1) +
        allConfidenceScores[report.confidence]) /
      this.metrics.totalReportsProcessed;
    this.metrics.averageConfidence = newAverage;
  }

  /**
   * Search Scout's indexed intelligence
   */
  searchIntelligence(
    query: string,
    filters?: {
      source?: string;
      trade?: string;
      jurisdiction?: string;
      minConfidence?: "high" | "medium" | "low";
    }
  ): IndexedIntelligence[] {
    const queryKeywords = query.toLowerCase().split(/\\s+/);
    const results: IndexedIntelligence[] = [];

    for (const intelligence of this.indexedIntelligence.values()) {
      // Apply filters
      if (filters?.source && intelligence.source !== filters.source) continue;
      if (filters?.trade && intelligence.trade !== filters.trade) continue;
      if (filters?.jurisdiction && intelligence.jurisdiction !== filters.jurisdiction) continue;

      // Check confidence filter
      if (filters?.minConfidence) {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        if (confidenceOrder[intelligence.confidence] < confidenceOrder[filters.minConfidence]) {
          continue;
        }
      }

      // Check if keywords match
      const matchCount = queryKeywords.filter((kw) =>
        intelligence.keywords.some((keyword) => keyword.includes(kw))
      ).length;

      if (matchCount > 0) {
        results.push(intelligence);
      }
    }

    // Sort by relevance and recency
    return results.sort((a, b) => {
      // Primary: LISA relevance
      if (b.lisaRelevance !== a.lisaRelevance) {
        return b.lisaRelevance - a.lisaRelevance;
      }
      // Secondary: Recency
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  /**
   * Get all intelligence for a specific trade
   */
  getTradeIntelligence(trade: string): IndexedIntelligence[] {
    return Array.from(this.indexedIntelligence.values())
      .filter((i) => i.trade === trade)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get all intelligence for a specific jurisdiction
   */
  getJurisdictionIntelligence(jurisdiction: string): IndexedIntelligence[] {
    return Array.from(this.indexedIntelligence.values())
      .filter((i) => i.jurisdiction === jurisdiction)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get learning metrics
   */
  getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  /**
   * Get the size of Scout's brain
   */
  getBrainSize(): number {
    return this.indexedIntelligence.size;
  }

  /**
   * Export all indexed intelligence (for backup/analysis)
   */
  exportIntelligence(): IndexedIntelligence[] {
    return Array.from(this.indexedIntelligence.values());
  }

  /**
   * Clear all indexed intelligence (for reset)
   */
  clearBrain(): void {
    this.indexedIntelligence.clear();
    this.metrics = {
      totalReportsProcessed: 0,
      totalIntelligenceIndexed: 0,
      averageConfidence: 0,
      lastLearningUpdate: new Date().toISOString(),
      knowledgeGrowthRate: 0,
    };
  }
}

// Export singleton instance
export const scoutLearningPipeline = new ScoutLearningPipeline();
