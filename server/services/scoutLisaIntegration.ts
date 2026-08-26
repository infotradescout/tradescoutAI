/**
 * Scout-LISA Integration
 *
 * Feeds Scout's indexed intelligence into LISA's decision layer.
 * LISA uses Scout's findings to make smarter routing and recommendation decisions.
 */

import { unavailableRuntimeCapability } from "./runtimeCapability";
import { scoutLearningPipeline, IndexedIntelligence } from "./scoutLearningPipeline";

export interface LisaDecisionContext {
  userId?: string;
  trade?: string;
  jurisdiction?: string;
  query: string;
  scoutIntelligence: IndexedIntelligence[];
  confidenceThreshold?: "high" | "medium" | "low";
}

export interface LisaDecision {
  action: string;
  confidence: number;
  reasoning: string;
  scoutIntelligenceUsed: string[]; // IDs of intelligence used
  recommendations: string[];
}

/**
 * Scout-LISA Integration Service
 *
 * Provides LISA with Scout's intelligence for decision making.
 * LISA can query Scout's brain to inform routing, recommendations, and user guidance.
 */
export class ScoutLisaIntegration {
  /**
   * Get relevant Scout intelligence for a LISA decision
   */
  static getRelevantIntelligence(context: LisaDecisionContext): IndexedIntelligence[] {
    // Search Scout's brain for relevant intelligence
    const intelligence = scoutLearningPipeline.searchIntelligence(context.query, {
      trade: context.trade,
      jurisdiction: context.jurisdiction,
      minConfidence: context.confidenceThreshold || "medium",
    });

    // Filter by LISA relevance (only high-relevance intelligence)
    return intelligence.filter((i) => i.lisaRelevance >= 0.6);
  }

  /**
   * Make a LISA decision informed by Scout intelligence
   */
  static makeDecision(context: LisaDecisionContext): LisaDecision {
    const relevantIntelligence = this.getRelevantIntelligence(context);

    if (relevantIntelligence.length === 0) {
      return {
        action: "insufficient_intelligence",
        confidence: 0,
        reasoning: "Scout has not gathered enough intelligence on this topic yet",
        scoutIntelligenceUsed: [],
        recommendations: [
          "Send Scout to gather more information",
          "Consider manual research or expert consultation",
        ],
      };
    }

    // Analyze the intelligence to make a decision
    const decision = this.analyzeIntelligence(relevantIntelligence, context);
    return decision;
  }

  /**
   * Analyze Scout intelligence to make a decision
   */
  private static analyzeIntelligence(
    intelligence: IndexedIntelligence[],
    context: LisaDecisionContext
  ): LisaDecision {
    // Calculate overall confidence
    const avgConfidence =
      intelligence.reduce((sum, i) => {
        const confidenceScore = { high: 1, medium: 0.5, low: 0.25 };
        return sum + confidenceScore[i.confidence];
      }, 0) / intelligence.length;

    // Determine the most relevant action based on intelligence
    const actionableIntelligence = intelligence.filter(
      (i) =>
        i.content.toLowerCase().includes("must") ||
        i.content.toLowerCase().includes("required") ||
        i.content.toLowerCase().includes("need")
    );

    let action = "provide_guidance";
    let reasoning = "Scout has gathered relevant intelligence";

    if (actionableIntelligence.length > 0) {
      action = "enforce_requirement";
      reasoning = `Scout found ${actionableIntelligence.length} actionable requirements`;
    }

    // Build recommendations from intelligence
    const recommendations = intelligence
      .filter((i) => i.lisaRelevance >= 0.7)
      .slice(0, 3)
      .map((i) => i.content);

    return {
      action,
      confidence: Math.min(avgConfidence, 1),
      reasoning,
      scoutIntelligenceUsed: intelligence.map((i) => i.id),
      recommendations,
    };
  }

  /**
   * Get Scout intelligence for a specific user context
   * Used by LISA to personalize recommendations
   */
  static getContextualIntelligence(
    userId: string,
    trade?: string,
    jurisdiction?: string
  ): IndexedIntelligence[] {
    const intelligence: IndexedIntelligence[] = [];

    if (trade) {
      intelligence.push(...scoutLearningPipeline.getTradeIntelligence(trade));
    }

    if (jurisdiction) {
      intelligence.push(...scoutLearningPipeline.getJurisdictionIntelligence(jurisdiction));
    }

    // Remove duplicates and sort by relevance
    const uniqueIntelligence = Array.from(new Map(intelligence.map((i) => [i.id, i])).values());

    return uniqueIntelligence.sort((a, b) => b.lisaRelevance - a.lisaRelevance);
  }

  /**
   * Get Scout's brain stats for LISA monitoring
   */
  static getBrainStats() {
    return {
      metrics: scoutLearningPipeline.getMetrics(),
      brainSize: scoutLearningPipeline.getBrainSize(),
      status: "learning",
    };
  }

  /**
   * Suggest a scouting mission based on LISA's needs
   */
  static suggestScoutingMission(
    trade: string,
    jurisdiction: string
  ): {
    mission: string;
    reason: string;
    priority: "high" | "medium" | "low";
  } {
    const existingIntelligence = scoutLearningPipeline.searchIntelligence(
      `${trade} ${jurisdiction}`,
      { trade, jurisdiction }
    );

    if (existingIntelligence.length === 0) {
      return {
        mission: `Scout for ${trade} requirements in ${jurisdiction}`,
        reason: "No intelligence exists for this trade/jurisdiction combination",
        priority: "high",
      };
    }

    if (existingIntelligence.length < 5) {
      return {
        mission: `Scout for more ${trade} details in ${jurisdiction}`,
        reason: "Limited intelligence available",
        priority: "medium",
      };
    }

    // Check if intelligence is stale (older than 30 days)
    const oldestIntelligence = existingIntelligence[existingIntelligence.length - 1];
    const ageInDays =
      (Date.now() - new Date(oldestIntelligence.timestamp).getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > 30) {
      return {
        mission: `Scout for updated ${trade} information in ${jurisdiction}`,
        reason: "Intelligence is outdated",
        priority: "low",
      };
    }

    return {
      mission: `Scout for advanced ${trade} topics in ${jurisdiction}`,
      reason: "Deepen existing knowledge",
      priority: "low",
    };
  }
}

/**
 * Hook for Scout learning pipeline to notify LISA of new intelligence
 */
let lisaHookWarningEmitted = false;

export function setupScoutLisaHooks(): void {
  if (lisaHookWarningEmitted) return;
  lisaHookWarningEmitted = true;
  console.warn(
    "[Scout-LISA] unavailable: no durable decision notification queue is configured"
  );
}

export const scoutLisaIntegration = {
  async triggerCountyUpdate(_fips: string, _reason: string): Promise<void> {
    unavailableRuntimeCapability(
      "Scout-LISA county update",
      "a durable decision notification queue is not configured"
    );
  },

  async monitorMission(_missionId: string, _fips?: string): Promise<void> {
    unavailableRuntimeCapability(
      "Scout-LISA mission monitoring",
      "a durable mission monitor is not configured"
    );
  },
};
