/**
 * Scout Tool Discovery — Institutional Intelligence
 * 
 * Scout detects repeated patterns, missing capabilities, and workarounds,
 * then emits Tool Blueprints for admin review.
 * 
 * Core principle: Scout invents capabilities. Humans decide which become permanent tools.
 */

import type { Primitive } from "./governor";

// ============================================================================
// TOOL BLUEPRINT - Product gold generated from real user friction
// ============================================================================

export interface ToolBlueprint {
  id: string;
  name: string;
  problemStatement: string;
  
  // What user behavior triggered this discovery
  triggerPatterns: string[];
  
  // Data flow
  inputs: string[];
  outputs: string[];
  
  // Which primitives Scout used to handle this ad-hoc
  primitivesUsed: Primitive[];
  
  // Evidence this is needed
  frequency: number;           // How often this gap appears
  affectedUsers: number;       // Unique users who hit this
  firstDetected: string;       // ISO timestamp
  lastDetected: string;        // ISO timestamp
  
  // Impact assessment
  riskLevel: "low" | "medium" | "high";  // Risk if not implemented
  estimatedImpact: {
    timesSaved: number;        // Estimated monthly occurrences
    outcomeImprovement: string; // What gets better
    regretPrevention: string;   // What bad outcome is avoided
  };
  
  // Examples from real usage
  exampleFlows: string[];      // How Scout handled this ad-hoc
  exampleConversations: Array<{
    userId: string;
    message: string;
    workaround: string;
    timestamp: string;
  }>;
  
  // Admin workflow
  status: "proposed" | "approved" | "rejected" | "implemented" | "merged";
  proposedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  mergedWith?: string;         // If combined with another blueprint
}

// ============================================================================
// CONVERGENCE SIGNALS - When Scout should emit a blueprint
// ============================================================================

export interface ConvergenceSignals {
  // Pattern detection
  sameWorkaroundRepeated: number;     // Same ad-hoc solution used N times
  sameFrictionAcrossUsers: number;    // N different users hit same gap
  sameStepInventedAdHoc: number;      // Same invented step across flows
  sameRiskAvoidedManually: number;    // Same manual intervention needed
  
  // Temporal signals
  frequencyIncreasing: boolean;       // Gap appearing more often
  clusteringInTime: boolean;          // Many instances in short window
  
  // Impact signals
  highRiskWorkaround: boolean;        // Current solution is risky
  significantCognitiveLoad: boolean;  // Users struggle with this
  outcomeGapVisible: boolean;         // Clear before/after difference
}

export const CONVERGENCE_THRESHOLDS = {
  // Emit blueprint when ANY of these conditions are met:
  minWorkaroundRepetitions: 5,        // Same workaround used 5+ times
  minAffectedUsers: 3,                // 3+ different users hit this
  minFrequencyPerWeek: 10,            // Happening 10+ times per week
  minHighRiskWorkarounds: 2,          // 2+ high-risk manual interventions
  
  // Confidence boosters (lower thresholds if these are true):
  outcomeImpactMultiplier: 0.5,       // 50% threshold if outcome impact is clear
  regretPreventionMultiplier: 0.3,    // 30% threshold if prevents regret
} as const;

// ============================================================================
// PATTERN TRACKING - What Scout remembers
// ============================================================================

export interface PatternInstance {
  id: string;
  userId: string;
  sessionId: string;
  timestamp: string;
  
  // What happened
  userMessage: string;
  inferredGoal: string;
  missingCapability: string;   // What tool doesn't exist
  workaroundUsed: string;       // How Scout handled it anyway
  primitivesUsed: Primitive[];
  
  // Context
  situation: {
    goal: string;
    constraints: string[];
    risks: string[];
    unknowns: string[];
  };
  
  // Outcome (if tracked)
  outcomeKnown: boolean;
  outcomeQuality?: "good" | "neutral" | "bad" | "regret";
  regretSignal?: string;
  
  // Fingerprint for clustering similar patterns
  fingerprint: string;
}

// ============================================================================
// REGRET TRACKING - First-class regret data
// ============================================================================

export interface RegretEvent {
  id: string;
  userId: string;
  timestamp: string;
  
  // What they regret
  originalDecision: string;
  originalTimestamp: string;
  regretStatement: string;
  
  // Why they regret it
  consequences: string[];
  reversibility: "irreversible" | "partially_reversible" | "reversible_expensive";
  
  // What should have happened
  shouldHaveBeenBlocked: boolean;
  shouldHaveBeenDeferred: boolean;
  missingInfo: string[];
  
  // Pattern for future prevention
  preventionPattern: string;    // How to detect this in future
  scoutFailure: "missed_risk" | "insufficient_defer" | "wrong_compliance" | null;
}

// ============================================================================
// TACIT KNOWLEDGE - Unwritten rules discovered from outcomes
// ============================================================================

export interface TacitKnowledge {
  id: string;
  
  // What we learned
  rule: string;                 // "This inspector is strict about X"
  confidence: "low" | "medium" | "high";
  
  // Evidence
  inferredFrom: Array<{
    userId: string;
    outcome: string;
    timestamp: string;
  }>;
  
  // Scope
  localContext: {
    countyCode?: string;
    stateCode?: string;
    tradeType?: string;
    vendorType?: string;
  };
  
  // Usage
  timesRelevant: number;        // How often this applies
  timesHelped: number;          // How often surfacing this improved outcomes
  
  // Protection
  sourceProtection: "anonymous"; // Never expose individual sources
  
  createdAt: string;
  lastRelevant: string;
}

// ============================================================================
// TOOL DISCOVERY ENGINE
// ============================================================================

export class ToolDiscoveryEngine {
  private patterns: Map<string, PatternInstance[]> = new Map();
  private blueprints: Map<string, ToolBlueprint> = new Map();
  private regrets: RegretEvent[] = [];
  private tacitKnowledge: TacitKnowledge[] = [];
  
  /**
   * Track a pattern instance (called by governor when it detects a workaround)
   */
  trackPattern(pattern: PatternInstance): void {
    const fingerprint = pattern.fingerprint;
    
    if (!this.patterns.has(fingerprint)) {
      this.patterns.set(fingerprint, []);
    }
    
    this.patterns.get(fingerprint)!.push(pattern);
    
    // Check if convergence signals warrant a blueprint
    this.checkConvergence(fingerprint);
  }
  
  /**
   * Track a regret event (called when user expresses regret)
   */
  trackRegret(regret: RegretEvent): void {
    this.regrets.push(regret);
    
    // Extract tacit knowledge from regret
    this.extractTacitKnowledge(regret);
    
    // If this regret maps to a pattern, boost blueprint priority
    this.amplifyBlueprintFromRegret(regret);
  }
  
  /**
   * Check if pattern has reached convergence threshold
   */
  private checkConvergence(fingerprint: string): void {
    const instances = this.patterns.get(fingerprint) || [];
    if (instances.length === 0) return;
    
    const signals = this.calculateConvergenceSignals(instances);
    
    // Check thresholds
    const shouldEmit = 
      instances.length >= CONVERGENCE_THRESHOLDS.minWorkaroundRepetitions ||
      this.countUniqueUsers(instances) >= CONVERGENCE_THRESHOLDS.minAffectedUsers ||
      signals.highRiskWorkaround ||
      (signals.outcomeGapVisible && instances.length >= CONVERGENCE_THRESHOLDS.minWorkaroundRepetitions * 0.5);
    
    if (shouldEmit) {
      this.emitBlueprint(fingerprint, instances, signals);
    }
  }
  
  /**
   * Calculate convergence signals from pattern instances
   */
  private calculateConvergenceSignals(instances: PatternInstance[]): ConvergenceSignals {
    const uniqueUsers = this.countUniqueUsers(instances);
    const hasHighRiskWorkaround = instances.some(i => 
      i.situation.risks.some(r => r.includes("high") || r.includes("irreversible"))
    );
    
    const recentInstances = instances.filter(i => {
      const hoursSince = (Date.now() - new Date(i.timestamp).getTime()) / (1000 * 60 * 60);
      return hoursSince <= 24 * 7; // Last week
    });
    
    return {
      sameWorkaroundRepeated: instances.length,
      sameFrictionAcrossUsers: uniqueUsers,
      sameStepInventedAdHoc: instances.length, // Simplified
      sameRiskAvoidedManually: instances.filter(i => i.situation.risks.length > 0).length,
      frequencyIncreasing: recentInstances.length > instances.length * 0.5,
      clusteringInTime: recentInstances.length > 5,
      highRiskWorkaround: hasHighRiskWorkaround,
      significantCognitiveLoad: true, // Would need user feedback
      outcomeGapVisible: instances.some(i => i.outcomeKnown && i.outcomeQuality === "bad"),
    };
  }
  
  /**
   * Emit a Tool Blueprint for admin review
   */
  private emitBlueprint(
    fingerprint: string,
    instances: PatternInstance[],
    signals: ConvergenceSignals
  ): void {
    // Check if we already have a blueprint for this pattern
    if (this.blueprints.has(fingerprint)) {
      // Update existing blueprint with new data
      const existing = this.blueprints.get(fingerprint)!;
      existing.frequency = instances.length;
      existing.affectedUsers = this.countUniqueUsers(instances);
      existing.lastDetected = instances[instances.length - 1].timestamp;
      return;
    }
    
    const firstInstance = instances[0];
    const recentInstances = instances.slice(-5); // Last 5 examples
    
    const blueprint: ToolBlueprint = {
      id: `blueprint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: this.inferToolName(instances),
      problemStatement: this.inferProblemStatement(instances),
      
      triggerPatterns: this.extractTriggerPatterns(instances),
      inputs: this.extractCommonInputs(instances),
      outputs: this.extractExpectedOutputs(instances),
      primitivesUsed: this.extractPrimitivesUsed(instances),
      
      frequency: instances.length,
      affectedUsers: this.countUniqueUsers(instances),
      firstDetected: instances[0].timestamp,
      lastDetected: instances[instances.length - 1].timestamp,
      
      riskLevel: signals.highRiskWorkaround ? "high" : signals.significantCognitiveLoad ? "medium" : "low",
      estimatedImpact: {
        timesSaved: instances.length * 4, // Project monthly
        outcomeImprovement: this.inferOutcomeImprovement(instances),
        regretPrevention: this.inferRegretPrevention(instances),
      },
      
      exampleFlows: recentInstances.map(i => i.workaroundUsed),
      exampleConversations: recentInstances.map(i => ({
        userId: i.userId,
        message: i.userMessage,
        workaround: i.workaroundUsed,
        timestamp: i.timestamp,
      })),
      
      status: "proposed",
      proposedAt: new Date().toISOString(),
    };
    
    this.blueprints.set(fingerprint, blueprint);
    
    console.log(`[Tool Discovery] Emitted blueprint: ${blueprint.name}`);
    console.log(`  Frequency: ${blueprint.frequency}, Users: ${blueprint.affectedUsers}`);
    console.log(`  Risk: ${blueprint.riskLevel}, Impact: ${blueprint.estimatedImpact.timesSaved} saves/month`);
  }
  
  /**
   * Extract tacit knowledge from regret events
   */
  private extractTacitKnowledge(regret: RegretEvent): void {
    if (!regret.preventionPattern) return;
    
    // Check if we already have this tacit knowledge
    const existing = this.tacitKnowledge.find(tk => tk.rule === regret.preventionPattern);
    
    if (existing) {
      existing.inferredFrom.push({
        userId: regret.userId,
        outcome: regret.regretStatement,
        timestamp: regret.timestamp,
      });
      existing.timesRelevant++;
      existing.lastRelevant = regret.timestamp;
      
      // Increase confidence with more evidence
      if (existing.inferredFrom.length >= 3 && existing.confidence === "low") {
        existing.confidence = "medium";
      }
      if (existing.inferredFrom.length >= 5 && existing.confidence === "medium") {
        existing.confidence = "high";
      }
    } else {
      // Create new tacit knowledge
      this.tacitKnowledge.push({
        id: `tacit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        rule: regret.preventionPattern,
        confidence: "low",
        inferredFrom: [{
          userId: regret.userId,
          outcome: regret.regretStatement,
          timestamp: regret.timestamp,
        }],
        localContext: {},
        timesRelevant: 1,
        timesHelped: 0,
        sourceProtection: "anonymous",
        createdAt: regret.timestamp,
        lastRelevant: regret.timestamp,
      });
    }
  }
  
  /**
   * Boost blueprint priority based on regret
   */
  private amplifyBlueprintFromRegret(regret: RegretEvent): void {
    // Find blueprints that would have prevented this regret
    for (const [fingerprint, blueprint] of this.blueprints) {
      if (blueprint.status !== "proposed") continue;
      
      // If regret mentions missing info that blueprint would have captured
      const wouldHavePrevented = regret.missingInfo.some(missing =>
        blueprint.inputs.some(input => 
          input.toLowerCase().includes(missing.toLowerCase()) ||
          missing.toLowerCase().includes(input.toLowerCase())
        )
      );
      
      if (wouldHavePrevented) {
        blueprint.riskLevel = "high";
        blueprint.estimatedImpact.regretPrevention += `\n• Would have prevented: ${regret.regretStatement}`;
      }
    }
  }
  
  // Helper methods for blueprint generation
  private countUniqueUsers(instances: PatternInstance[]): number {
    return new Set(instances.map(i => i.userId)).size;
  }
  
  private inferToolName(instances: PatternInstance[]): string {
    const firstGoal = instances[0].inferredGoal;
    // Extract key nouns/verbs to create name
    return `${firstGoal.split(' ').slice(0, 3).join(' ')} Tool`;
  }
  
  private inferProblemStatement(instances: PatternInstance[]): string {
    const commonGoals = instances.map(i => i.inferredGoal);
    return `Users need to ${commonGoals[0]} but no dedicated tool exists`;
  }
  
  private extractTriggerPatterns(instances: PatternInstance[]): string[] {
    return Array.from(new Set(
      instances.map(i => i.userMessage.toLowerCase())
        .flatMap(msg => {
          const patterns = [];
          if (msg.includes("track")) patterns.push("tracking intent");
          if (msg.includes("remind")) patterns.push("reminder intent");
          if (msg.includes("follow up")) patterns.push("follow-up intent");
          if (msg.includes("keep record")) patterns.push("record keeping");
          return patterns;
        })
    )).slice(0, 5);
  }
  
  private extractCommonInputs(instances: PatternInstance[]): string[] {
    // Simplified - would analyze what data users provided
    return ["user input", "context", "timing"];
  }
  
  private extractExpectedOutputs(instances: PatternInstance[]): string[] {
    return ["structured data", "reminder", "searchable record"];
  }
  
  private extractPrimitivesUsed(instances: PatternInstance[]): Primitive[] {
    const allPrimitives = instances.flatMap(i => i.primitivesUsed);
    return Array.from(new Set(allPrimitives));
  }
  
  private inferOutcomeImprovement(instances: PatternInstance[]): string {
    return "Reduced cognitive load, fewer missed follow-ups, better trust";
  }
  
  private inferRegretPrevention(instances: PatternInstance[]): string {
    const regretCases = instances.filter(i => i.outcomeQuality === "regret");
    if (regretCases.length > 0) {
      return `Prevents regret seen in ${regretCases.length} cases`;
    }
    return "Prevents forgotten commitments and broken trust";
  }
  
  /**
   * Get all proposed blueprints for admin review
   */
  getProposedBlueprints(): ToolBlueprint[] {
    return Array.from(this.blueprints.values())
      .filter(b => b.status === "proposed")
      .sort((a, b) => {
        // Sort by impact (high risk first, then frequency)
        if (a.riskLevel === "high" && b.riskLevel !== "high") return -1;
        if (b.riskLevel === "high" && a.riskLevel !== "high") return 1;
        return b.frequency - a.frequency;
      });
  }
  
  /**
   * Get tacit knowledge for a given context
   */
  getTacitKnowledge(context: {
    countyCode?: string;
    stateCode?: string;
    tradeType?: string;
  }): TacitKnowledge[] {
    return this.tacitKnowledge.filter(tk => {
      if (tk.confidence === "low") return false; // Only surface medium+ confidence
      
      // Match context if specified
      if (context.countyCode && tk.localContext.countyCode) {
        return tk.localContext.countyCode === context.countyCode;
      }
      if (context.stateCode && tk.localContext.stateCode) {
        return tk.localContext.stateCode === context.stateCode;
      }
      if (context.tradeType && tk.localContext.tradeType) {
        return tk.localContext.tradeType === context.tradeType;
      }
      
      return true; // No context filter, return all
    });
  }
  
  /**
   * Approve a blueprint (admin action)
   */
  approveBlueprint(blueprintId: string, adminId: string, notes?: string): void {
    for (const [fingerprint, blueprint] of this.blueprints) {
      if (blueprint.id === blueprintId) {
        blueprint.status = "approved";
        blueprint.reviewedAt = new Date().toISOString();
        blueprint.reviewedBy = adminId;
        blueprint.reviewNotes = notes;
        break;
      }
    }
  }
  
  /**
   * Reject a blueprint (admin action)
   */
  rejectBlueprint(blueprintId: string, adminId: string, reason: string): void {
    for (const [fingerprint, blueprint] of this.blueprints) {
      if (blueprint.id === blueprintId) {
        blueprint.status = "rejected";
        blueprint.reviewedAt = new Date().toISOString();
        blueprint.reviewedBy = adminId;
        blueprint.reviewNotes = reason;
        break;
      }
    }
  }
}

// Global singleton (in production, this would be backed by database)
export const toolDiscovery = new ToolDiscoveryEngine();
