/**
 * Scout Conflict Resolver
 *
 * Handles discrepancies when Scout's sources disagree:
 * - Your Knowledge Base vs. Local Data vs. Web Search
 * - Different versions of the same information
 * - Conflicting requirements or prices
 *
 * Features:
 * - Automatic conflict detection
 * - Source credibility scoring
 * - Conflict resolution strategies
 * - Manual override capability
 * - Audit trail
 */

export type ConflictSource = "knowledge-base" | "local-data" | "web-search" | "user-override";

export interface DataConflict {
  id: string;
  topic: string; // e.g., "deck-railing-height", "electrician-hourly-rate"
  jurisdiction?: string;
  sources: ConflictData[];
  resolvedValue?: ConflictData;
  resolutionStrategy?: "highest-credibility" | "most-recent" | "manual-override" | "consensus";
  status: "unresolved" | "resolved" | "escalated";
  severity: "critical" | "high" | "medium" | "low";
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

export interface ConflictData {
  source: ConflictSource;
  value: string | number | boolean;
  confidence: "high" | "medium" | "low";
  credibilityScore: number; // 0-100
  lastUpdated: Date;
  evidence?: string;
}

export interface ResolutionStrategy {
  strategy: "highest-credibility" | "most-recent" | "manual-override" | "consensus";
  selectedValue: ConflictData;
  reasoning: string;
  confidence: number; // 0-100
}

export interface ConflictReport {
  period: "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  totalConflicts: number;
  resolvedConflicts: number;
  escalatedConflicts: number;
  conflictsByTopic: Record<string, number>;
  conflictsBySeverity: Record<string, number>;
  resolutionStrategies: Record<string, number>;
  topicsNeedingAttention: string[];
}

class ScoutConflictResolver {
  private conflicts: Map<string, DataConflict> = new Map();
  private conflictHistory: DataConflict[] = [];
  private credibilityScores: Map<ConflictSource, number> = new Map([
    ["knowledge-base", 95],
    ["local-data", 85],
    ["web-search", 70],
    ["user-override", 100],
  ]);

  /**
   * Detect a conflict between sources
   */
  detectConflict(
    topic: string,
    sources: ConflictData[],
    jurisdiction?: string
  ): DataConflict | null {
    // Check if all sources agree
    const values = sources.map((s) => s.value.toString()).filter((v, i, a) => a.indexOf(v) === i);

    if (values.length <= 1) {
      // No conflict
      return null;
    }

    // Conflict detected
    const conflict: DataConflict = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      topic,
      jurisdiction,
      sources,
      status: "unresolved",
      severity: this.calculateSeverity(topic, sources),
      createdAt: new Date(),
    };

    this.conflicts.set(conflict.id, conflict);
    console.log(`[Conflict Resolver] Detected conflict: ${conflict.id}`);

    return conflict;
  }

  /**
   * Resolve a conflict automatically
   */
  resolveConflict(
    conflictId: string,
    strategy?: "highest-credibility" | "most-recent" | "consensus"
  ): ResolutionStrategy | null {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    const resolveStrategy = strategy || "highest-credibility";
    let selectedSource: ConflictData | null = null;
    let reasoning = "";
    let confidence = 0;

    switch (resolveStrategy) {
      case "highest-credibility":
        selectedSource = conflict.sources.reduce((prev, curr) =>
          curr.credibilityScore > prev.credibilityScore ? curr : prev
        );
        reasoning = `Selected ${selectedSource.source} due to highest credibility score (${selectedSource.credibilityScore})`;
        confidence = selectedSource.credibilityScore;
        break;

      case "most-recent":
        selectedSource = conflict.sources.reduce((prev, curr) =>
          curr.lastUpdated > prev.lastUpdated ? curr : prev
        );
        reasoning = `Selected ${selectedSource.source} as most recent update (${selectedSource.lastUpdated.toISOString()})`;
        confidence = 80;
        break;

      case "consensus":
        // If majority agrees on a value, use that
        const valueGroups = new Map<string, ConflictData[]>();
        conflict.sources.forEach((source) => {
          const key = source.value.toString();
          if (!valueGroups.has(key)) {
            valueGroups.set(key, []);
          }
          valueGroups.get(key)!.push(source);
        });

        const consensusGroup = Array.from(valueGroups.entries()).reduce((prev, curr) =>
          curr[1].length > prev[1].length ? curr : prev
        );

        if (consensusGroup[1].length > conflict.sources.length / 2) {
          selectedSource = consensusGroup[1][0];
          reasoning = `${consensusGroup[1].length} of ${conflict.sources.length} sources agree on this value`;
          confidence = (consensusGroup[1].length / conflict.sources.length) * 100;
        }
        break;
    }

    if (!selectedSource) {
      // Fallback to highest credibility
      selectedSource = conflict.sources.reduce((prev, curr) =>
        curr.credibilityScore > prev.credibilityScore ? curr : prev
      );
      reasoning = "Fallback to highest credibility";
      confidence = selectedSource.credibilityScore;
    }

    // Apply resolution
    conflict.resolvedValue = selectedSource;
    conflict.resolutionStrategy = resolveStrategy;
    conflict.status = "resolved";
    conflict.resolvedAt = new Date();

    this.conflictHistory.push(conflict);
    console.log(`[Conflict Resolver] Resolved conflict: ${conflictId}`);

    return {
      strategy: resolveStrategy,
      selectedValue: selectedSource,
      reasoning,
      confidence,
    };
  }

  /**
   * Manually override a conflict resolution
   */
  overrideConflict(
    conflictId: string,
    selectedValue: string | number,
    notes?: string
  ): DataConflict | null {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    // Create override data
    const overrideData: ConflictData = {
      source: "user-override",
      value: selectedValue,
      confidence: "high",
      credibilityScore: 100,
      lastUpdated: new Date(),
      evidence: notes,
    };

    conflict.resolvedValue = overrideData;
    conflict.resolutionStrategy = "manual-override";
    conflict.status = "resolved";
    conflict.resolvedAt = new Date();
    conflict.resolvedBy = "admin";
    conflict.notes = notes;

    this.conflictHistory.push(conflict);
    console.log(`[Conflict Resolver] Manually resolved conflict: ${conflictId}`);

    return conflict;
  }

  /**
   * Escalate a conflict for manual review
   */
  escalateConflict(conflictId: string, reason?: string): DataConflict | null {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    conflict.status = "escalated";
    conflict.notes = reason || "Escalated for manual review";

    console.log(`[Conflict Resolver] Escalated conflict: ${conflictId}`);

    return conflict;
  }

  /**
   * Get unresolved conflicts
   */
  getUnresolvedConflicts(jurisdiction?: string): DataConflict[] {
    let conflicts = Array.from(this.conflicts.values()).filter((c) => c.status === "unresolved");

    if (jurisdiction) {
      conflicts = conflicts.filter((c) => c.jurisdiction === jurisdiction);
    }

    return conflicts.sort((a, b) => {
      // Sort by severity
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get escalated conflicts
   */
  getEscalatedConflicts(): DataConflict[] {
    return Array.from(this.conflicts.values())
      .filter((c) => c.status === "escalated")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Update credibility score for a source
   */
  updateCredibilityScore(source: ConflictSource, score: number): void {
    if (score < 0 || score > 100) {
      throw new Error("Credibility score must be between 0 and 100");
    }
    this.credibilityScores.set(source, score);
    console.log(`[Conflict Resolver] Updated credibility score for ${source}: ${score}`);
  }

  /**
   * Get credibility scores
   */
  getCredibilityScores(): Record<ConflictSource, number> {
    return Object.fromEntries(this.credibilityScores) as Record<ConflictSource, number>;
  }

  /**
   * Generate conflict report
   */
  generateReport(period: "daily" | "weekly" | "monthly"): ConflictReport {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "daily":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodConflicts = this.conflictHistory.filter(
      (c) => c.createdAt >= startDate && c.createdAt <= now
    );

    const conflictsByTopic: Record<string, number> = {};
    const conflictsBySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const resolutionStrategies: Record<string, number> = {};

    periodConflicts.forEach((conflict) => {
      // Count by topic
      conflictsByTopic[conflict.topic] = (conflictsByTopic[conflict.topic] || 0) + 1;

      // Count by severity
      conflictsBySeverity[conflict.severity]++;

      // Count by resolution strategy
      if (conflict.resolutionStrategy) {
        resolutionStrategies[conflict.resolutionStrategy] =
          (resolutionStrategies[conflict.resolutionStrategy] || 0) + 1;
      }
    });

    // Identify topics needing attention (high conflict count or unresolved)
    const topicsNeedingAttention = Object.entries(conflictsByTopic)
      .filter(([, count]) => count >= 3)
      .map(([topic]) => topic);

    return {
      period,
      startDate,
      endDate: now,
      totalConflicts: periodConflicts.length,
      resolvedConflicts: periodConflicts.filter((c) => c.status === "resolved").length,
      escalatedConflicts: periodConflicts.filter((c) => c.status === "escalated").length,
      conflictsByTopic,
      conflictsBySeverity,
      resolutionStrategies,
      topicsNeedingAttention,
    };
  }

  /**
   * Calculate conflict severity
   */
  private calculateSeverity(
    topic: string,
    sources: ConflictData[]
  ): "critical" | "high" | "medium" | "low" {
    // Critical topics
    if (
      topic.includes("safety") ||
      topic.includes("permit") ||
      topic.includes("inspection") ||
      topic.includes("code")
    ) {
      return "critical";
    }

    // High variance in values
    const numericValues = sources
      .map((s) => parseFloat(s.value.toString()))
      .filter((v) => !isNaN(v));
    if (numericValues.length > 1) {
      const max = Math.max(...numericValues);
      const min = Math.min(...numericValues);
      const variance = ((max - min) / min) * 100;
      if (variance > 50) return "high";
      if (variance > 20) return "medium";
    }

    return "low";
  }
}

// Singleton instance
export const scoutConflictResolver = new ScoutConflictResolver();
