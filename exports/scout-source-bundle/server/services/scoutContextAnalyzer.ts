/**
 * Scout Context Analyzer - Phase 3
 * 
 * This service analyzes Scout's memory and current context to:
 * 1. Identify patterns in user behavior
 * 2. Generate proactive suggestions
 * 3. Detect opportunities for additional assistance
 * 4. Recommend next best actions
 */

import ScoutMemoryService from "./scoutMemoryService";

export interface ContextAnalysis {
  user_intent: string;
  detected_patterns: string[];
  proactive_suggestions: string[];
  next_best_actions: string[];
  confidence: number;
  reasoning: string;
}

export interface UserBehaviorPattern {
  pattern_name: string;
  frequency: number;
  last_observed: string;
  related_tools: string[];
  typical_outcomes: string[];
}

/**
 * Scout Context Analyzer
 */
export class ScoutContextAnalyzer {
  /**
   * Analyze current context and generate insights
   */
  static async analyzeContext(
    userId: string,
    currentIntent: string,
    recentToolsUsed: string[],
    recentFindings: Record<string, any>
  ): Promise<ContextAnalysis> {
    // Detect patterns from memory
    const patterns = await this.detectBehaviorPatterns(userId, currentIntent);

    // Generate proactive suggestions
    const suggestions = await this.generateProactiveSuggestions(
      userId,
      currentIntent,
      patterns,
      recentFindings
    );

    // Recommend next best actions
    const nextActions = await this.recommendNextActions(
      userId,
      currentIntent,
      recentToolsUsed,
      patterns
    );

    // Calculate overall confidence
    const confidence = this.calculateConfidence(patterns, suggestions);

    return {
      user_intent: currentIntent,
      detected_patterns: patterns.map((p) => p.pattern_name),
      proactive_suggestions: suggestions,
      next_best_actions: nextActions,
      confidence,
      reasoning: this.buildReasoningExplanation(patterns, suggestions, nextActions),
    };
  }

  /**
   * Detect behavior patterns from user history
   */
  private static async detectBehaviorPatterns(
    userId: string,
    currentIntent: string
  ): Promise<UserBehaviorPattern[]> {
    const patterns: UserBehaviorPattern[] = [];

    // Pattern 1: Contractor search followed by marketplace browse
    if (currentIntent.includes("contractor") || currentIntent.includes("professional")) {
      patterns.push({
        pattern_name: "contractor_research_pattern",
        frequency: 0, // Would be populated from memory
        last_observed: new Date().toISOString(),
        related_tools: ["search_contractors", "search_marketplace", "web_search"],
        typical_outcomes: ["contractor_selected", "project_created"],
      });
    }

    // Pattern 2: Project creation followed by contractor search
    if (currentIntent.includes("project") || currentIntent.includes("work")) {
      patterns.push({
        pattern_name: "project_workflow_pattern",
        frequency: 0,
        last_observed: new Date().toISOString(),
        related_tools: ["create_project", "search_contractors", "message_contractor"],
        typical_outcomes: ["contractor_contacted", "project_posted"],
      });
    }

    // Pattern 3: Marketplace browsing for specific categories
    if (currentIntent.includes("marketplace") || currentIntent.includes("buy") || currentIntent.includes("rent")) {
      patterns.push({
        pattern_name: "marketplace_browsing_pattern",
        frequency: 0,
        last_observed: new Date().toISOString(),
        related_tools: ["search_marketplace", "get_county_listings"],
        typical_outcomes: ["item_viewed", "inquiry_sent"],
      });
    }

    // Pattern 4: Community engagement
    if (currentIntent.includes("community") || currentIntent.includes("group") || currentIntent.includes("hoa")) {
      patterns.push({
        pattern_name: "community_engagement_pattern",
        frequency: 0,
        last_observed: new Date().toISOString(),
        related_tools: ["get_local_groups", "get_hoa_data", "post_to_group"],
        typical_outcomes: ["group_joined", "post_created"],
      });
    }

    return patterns;
  }

  /**
   * Generate proactive suggestions based on context
   */
  private static async generateProactiveSuggestions(
    userId: string,
    currentIntent: string,
    patterns: UserBehaviorPattern[],
    recentFindings: Record<string, any>
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Suggestion 1: If user is searching for contractors, suggest checking marketplace for materials
    if (currentIntent.includes("contractor") && patterns.some((p) => p.pattern_name === "contractor_research_pattern")) {
      suggestions.push(
        "Based on your contractor search, would you like to browse marketplace listings for materials or tools you might need?"
      );
    }

    // Suggestion 2: If user is creating a project, suggest finding contractors
    if (currentIntent.includes("project") && patterns.some((p) => p.pattern_name === "project_workflow_pattern")) {
      suggestions.push(
        "Now that you're creating a project, I can help you find qualified contractors in your area to bid on it."
      );
    }

    // Suggestion 3: If user is browsing marketplace, suggest related items
    if (currentIntent.includes("marketplace") && recentFindings.category) {
      suggestions.push(
        `I found several ${recentFindings.category} items. Would you like me to show you similar items or help you compare prices?`
      );
    }

    // Suggestion 4: If user is in a community, suggest related groups
    if (currentIntent.includes("community")) {
      suggestions.push(
        "I see you're interested in community features. Would you like to discover other local groups or HOA discussions?"
      );
    }

    // Suggestion 5: If user has been inactive on a project, suggest follow-up
    if (recentFindings.project_id && !recentFindings.recent_activity) {
      suggestions.push(
        "You have an active project with no recent bids. Would you like me to help you reach out to contractors?"
      );
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Recommend next best actions
   */
  private static async recommendNextActions(
    userId: string,
    currentIntent: string,
    recentToolsUsed: string[],
    patterns: UserBehaviorPattern[]
  ): Promise<string[]> {
    const actions: string[] = [];

    // Determine next actions based on current intent and patterns
    if (currentIntent.includes("contractor")) {
      actions.push("View contractor profiles and ratings");
      actions.push("Compare contractor specialties and pricing");
      actions.push("Send inquiry to selected contractors");
    } else if (currentIntent.includes("project")) {
      actions.push("Create and post your project");
      actions.push("Set project budget and timeline");
      actions.push("Review contractor bids");
    } else if (currentIntent.includes("marketplace")) {
      actions.push("Filter by category and price");
      actions.push("View item details and photos");
      actions.push("Contact seller for more information");
    } else if (currentIntent.includes("community")) {
      actions.push("Browse local groups");
      actions.push("Join relevant communities");
      actions.push("Participate in discussions");
    } else {
      // Default actions
      actions.push("Explore TradeScout features");
      actions.push("Find local contractors and services");
      actions.push("Join your community");
    }

    return actions.slice(0, 3); // Return top 3 actions
  }

  /**
   * Calculate confidence score for the analysis
   */
  private static calculateConfidence(
    patterns: UserBehaviorPattern[],
    suggestions: string[]
  ): number {
    let confidence = 50; // Base confidence

    // Increase confidence based on detected patterns
    confidence += patterns.length * 10;

    // Increase confidence based on suggestions
    confidence += suggestions.length * 5;

    // Cap at 100
    return Math.min(100, confidence);
  }

  /**
   * Build reasoning explanation
   */
  private static buildReasoningExplanation(
    patterns: UserBehaviorPattern[],
    suggestions: string[],
    nextActions: string[]
  ): string {
    let explanation = "Based on your activity, ";

    if (patterns.length > 0) {
      explanation += `I detected ${patterns.length} behavior pattern(s): ${patterns.map((p) => p.pattern_name).join(", ")}. `;
    }

    if (suggestions.length > 0) {
      explanation += `I have ${suggestions.length} proactive suggestion(s) for you. `;
    }

    explanation += `Your next best action(s) are: ${nextActions.join(", ")}.`;

    return explanation;
  }

  /**
   * Identify error recovery opportunities
   */
  static async identifyErrorRecoveryOpportunities(
    userId: string,
    failedToolName: string,
    error: string
  ): Promise<string[]> {
    const recoveryStrategies: string[] = [];

    // Strategy 1: Try alternative tool
    if (failedToolName === "search_contractors") {
      recoveryStrategies.push("Try searching all contractors in your county instead");
      recoveryStrategies.push("Search the web for contractors in your area");
    } else if (failedToolName === "search_marketplace") {
      recoveryStrategies.push("Browse all marketplace listings in your county");
      recoveryStrategies.push("Search the web for similar items");
    }

    // Strategy 2: Refine parameters
    recoveryStrategies.push("Try with different search parameters");
    recoveryStrategies.push("Expand your search area or category");

    // Strategy 3: Suggest manual action
    recoveryStrategies.push("I can help you manually browse or filter results");

    return recoveryStrategies;
  }

  /**
   * Analyze tool effectiveness
   */
  static async analyzeToolEffectiveness(
    userId: string,
    toolName: string,
    successRate: number,
    avgExecutionTimeMs: number
  ): Promise<{
    effectiveness_score: number;
    recommendation: string;
    should_use_alternative: boolean;
  }> {
    let effectivenessScore = successRate * 100;

    // Penalize slow tools
    if (avgExecutionTimeMs > 5000) {
      effectivenessScore -= 20;
    }

    let recommendation = "This tool is working well.";
    let shouldUseAlternative = false;

    if (effectivenessScore < 50) {
      recommendation = `${toolName} has low effectiveness. Consider using an alternative tool.`;
      shouldUseAlternative = true;
    } else if (effectivenessScore < 75) {
      recommendation = `${toolName} is moderately effective. Monitor performance.`;
    }

    return {
      effectiveness_score: Math.min(100, effectivenessScore),
      recommendation,
      should_use_alternative: shouldUseAlternative,
    };
  }
}

export default ScoutContextAnalyzer;
