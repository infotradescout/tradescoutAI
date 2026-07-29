/**
 * Scout Memory Service - Phase 3
 *
 * This service provides Scout with persistent memory of:
 * 1. Tool execution results and findings
 * 2. User preferences and behavior patterns
 * 3. Conversation context and decisions made
 * 4. Learning points and insights from previous interactions
 *
 * This enables Scout to:
 * - Avoid repeating the same tool calls
 * - Recall previous findings across sessions
 * - Make proactive suggestions based on user patterns
 * - Learn and improve over time
 */

import { db } from "../db";
import { sql, eq, and, desc, inArray, notLike } from "drizzle-orm";
import { scoutMemory } from "../../shared/schema";
import {
  buildScoutReasoningMemoryContext,
  type ExplicitScoutMemoryUpdate,
  type ScoutReasoningMemoryContext,
} from "../scout/scoutWorkingMemory";

/**
 * Memory entry types
 */
export enum MemoryEntryType {
  TOOL_RESULT = "tool_result",
  USER_PREFERENCE = "user_preference",
  CONVERSATION_CONTEXT = "conversation_context",
  LEARNING_POINT = "learning_point",
  PROACTIVE_SUGGESTION = "proactive_suggestion",
}

/**
 * Memory entry interface
 */
export interface MemoryEntry {
  id?: string;
  user_id: string;
  type: MemoryEntryType;
  key: string; // Unique identifier for the memory (e.g., "contractor_search_harris_county")
  value: Record<string, any>;
  metadata?: {
    created_at?: string;
    updated_at?: string;
    relevance_score?: number;
    access_count?: number;
    last_accessed?: string;
  };
  ttl_seconds?: number; // Time to live - memory expires after this duration
}

/**
 * Tool result memory
 */
export interface ToolResultMemory {
  tool_name: string;
  parameters: Record<string, any>;
  result: any;
  execution_time_ms: number;
  success: boolean;
  timestamp: string;
  relevance_score: number; // 0-100, how relevant this result is to current context
}

/**
 * User preference memory
 */
export interface UserPreferenceMemory {
  preference_key: string;
  preference_value: any;
  confidence: "high" | "medium" | "low";
  based_on_interactions: number;
  last_updated: string;
}

/**
 * Conversation context memory
 */
export interface ConversationContextMemory {
  conversation_id: string;
  user_intent: string;
  tools_used: string[];
  findings: Record<string, any>;
  decisions_made: string[];
  next_suggested_actions: string[];
  timestamp: string;
}

/**
 * Learning point memory
 */
export interface LearningPointMemory {
  insight: string;
  category: string; // e.g., "tool_effectiveness", "user_behavior", "error_recovery"
  confidence: number; // 0-100
  applicable_scenarios: string[];
  timestamp: string;
}

/**
 * Scout Memory Service
 */
export class ScoutMemoryService {
  /**
   * Persist only an explicit, user-confirmed preference, decision, correction,
   * or remember request. These entries are durable and retain source provenance.
   */
  static async storeExplicitReasoningMemory(
    userId: string,
    update: ExplicitScoutMemoryUpdate
  ): Promise<void> {
    const now = new Date().toISOString();
    const type =
      update.kind === "preference" || update.kind === "explicit_note"
        ? MemoryEntryType.USER_PREFERENCE
        : MemoryEntryType.CONVERSATION_CONTEXT;
    const key = `explicit_${update.kind}_${update.sourceMessageHash.slice(0, 24)}`;
    const provenance = {
      source: "explicit_user_message",
      scope: "user",
      recorded_at: now,
      user_confirmed: true,
      source_message_hash: update.sourceMessageHash,
    };
    const value =
      type === MemoryEntryType.USER_PREFERENCE
        ? {
            memory_kind: update.kind,
            preference_key: key,
            preference_value: update.statement,
            confidence: "high",
            based_on_interactions: 1,
            last_updated: now,
            statement: update.statement,
            provenance,
          }
        : {
            memory_kind: update.kind,
            conversation_id: key,
            user_intent: update.kind,
            tools_used: [],
            findings: {},
            decisions_made: [update.statement],
            next_suggested_actions: [],
            statement: update.statement,
            timestamp: now,
            provenance,
          };

    await this.storeMemory(userId, type, key, value, undefined, {
      source: provenance.source,
      user_confirmed: true,
      source_message_hash: update.sourceMessageHash,
    });
  }

  /**
   * Retrieve bounded, provenance-backed preferences and conversation decisions
   * for synthesis. Response caches and other memory types are excluded.
   */
  static async getReasoningMemoryContext(
    userId: string,
    options: { maxEntries?: number; maxChars?: number } = {}
  ): Promise<ScoutReasoningMemoryContext> {
    try {
      const maxEntries = Math.max(1, options.maxEntries ?? 12);
      const rows = await db
        .select()
        .from(scoutMemory)
        .where(
          and(
            eq(scoutMemory.userId, userId),
            inArray(scoutMemory.type, [
              MemoryEntryType.USER_PREFERENCE,
              MemoryEntryType.CONVERSATION_CONTEXT,
            ]),
            notLike(scoutMemory.key, "response_cache_%")
          )
        )
        .orderBy(desc(scoutMemory.updatedAt), desc(scoutMemory.createdAt))
        .limit(Math.max(40, maxEntries * 3));

      return buildScoutReasoningMemoryContext(rows, {
        maxEntries,
        maxChars: options.maxChars,
      });
    } catch (error) {
      console.error("[Scout Memory] Error building reasoning context:", error);
      return buildScoutReasoningMemoryContext([], options);
    }
  }

  /**
   * Store a tool result in memory
   */
  static async storeToolResult(
    userId: string,
    toolName: string,
    parameters: Record<string, any>,
    result: any,
    executionTimeMs: number,
    success: boolean
  ): Promise<void> {
    const memoryKey = `${toolName}_${JSON.stringify(parameters).substring(0, 50)}`;

    const toolResultMemory: ToolResultMemory = {
      tool_name: toolName,
      parameters,
      result,
      execution_time_ms: executionTimeMs,
      success,
      timestamp: new Date().toISOString(),
      relevance_score: success ? 100 : 50,
    };

    await this.storeMemory(userId, MemoryEntryType.TOOL_RESULT, memoryKey, toolResultMemory);
  }

  /**
   * Retrieve tool result from memory
   */
  static async getToolResult(
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<ToolResultMemory | null> {
    const memoryKey = `${toolName}_${JSON.stringify(parameters).substring(0, 50)}`;
    const memory = await this.getMemory(userId, MemoryEntryType.TOOL_RESULT, memoryKey);

    if (memory) {
      // Update access count and last accessed time
      await this.updateMemoryMetadata(userId, memoryKey, {
        access_count: (memory.metadata?.access_count || 0) + 1,
        last_accessed: new Date().toISOString(),
      });
    }

    return memory?.value as ToolResultMemory | null;
  }

  /**
   * Store user preference
   */
  static async storeUserPreference(
    userId: string,
    preferenceKey: string,
    preferenceValue: any,
    confidence: "high" | "medium" | "low" = "medium"
  ): Promise<void> {
    const existingPref = await this.getMemory(
      userId,
      MemoryEntryType.USER_PREFERENCE,
      preferenceKey
    );

    const preferenceMemory: UserPreferenceMemory = {
      preference_key: preferenceKey,
      preference_value: preferenceValue,
      confidence,
      based_on_interactions: (existingPref?.metadata?.access_count || 0) + 1,
      last_updated: new Date().toISOString(),
    };

    await this.storeMemory(
      userId,
      MemoryEntryType.USER_PREFERENCE,
      preferenceKey,
      preferenceMemory
    );
  }

  /**
   * Get user preference
   */
  static async getUserPreference(
    userId: string,
    preferenceKey: string
  ): Promise<UserPreferenceMemory | null> {
    const memory = await this.getMemory(userId, MemoryEntryType.USER_PREFERENCE, preferenceKey);
    return memory?.value as UserPreferenceMemory | null;
  }

  /**
   * Store conversation context
   */
  static async storeConversationContext(
    userId: string,
    conversationId: string,
    intent: string,
    toolsUsed: string[],
    findings: Record<string, any>,
    decisionsMade: string[],
    nextSuggestedActions: string[]
  ): Promise<void> {
    const contextMemory: ConversationContextMemory = {
      conversation_id: conversationId,
      user_intent: intent,
      tools_used: toolsUsed,
      findings,
      decisions_made: decisionsMade,
      next_suggested_actions: nextSuggestedActions,
      timestamp: new Date().toISOString(),
    };

    await this.storeMemory(
      userId,
      MemoryEntryType.CONVERSATION_CONTEXT,
      conversationId,
      contextMemory,
      86400 // 24 hours TTL for conversation context
    );
  }

  /**
   * Get conversation context
   */
  static async getConversationContext(
    userId: string,
    conversationId: string
  ): Promise<ConversationContextMemory | null> {
    const memory = await this.getMemory(
      userId,
      MemoryEntryType.CONVERSATION_CONTEXT,
      conversationId
    );
    return memory?.value as ConversationContextMemory | null;
  }

  /**
   * Store learning point
   */
  static async storeLearningPoint(
    userId: string,
    insight: string,
    category: string,
    confidence: number,
    applicableScenarios: string[]
  ): Promise<void> {
    const learningMemory: LearningPointMemory = {
      insight,
      category,
      confidence,
      applicable_scenarios: applicableScenarios,
      timestamp: new Date().toISOString(),
    };

    const memoryKey = `learning_${category}_${Date.now()}`;
    await this.storeMemory(userId, MemoryEntryType.LEARNING_POINT, memoryKey, learningMemory);
  }

  /**
   * Get relevant learning points
   */
  static async getRelevantLearningPoints(
    userId: string,
    scenario: string
  ): Promise<LearningPointMemory[]> {
    try {
      // Fetch all learning points for this user, most recent first
      const rows = await db
        .select()
        .from(scoutMemory)
        .where(
          and(eq(scoutMemory.userId, userId), eq(scoutMemory.type, MemoryEntryType.LEARNING_POINT))
        )
        .orderBy(desc(scoutMemory.createdAt))
        .limit(100);

      const now = new Date();
      const results: LearningPointMemory[] = [];

      for (const row of rows) {
        // Skip expired entries
        if (row.ttlSeconds && row.createdAt) {
          const expiresAt = new Date(row.createdAt);
          expiresAt.setSeconds(expiresAt.getSeconds() + row.ttlSeconds);
          if (expiresAt < now) continue;
        }

        const point = row.value as LearningPointMemory;

        // Include if applicable_scenarios overlaps with the requested scenario
        const scenarios: string[] = Array.isArray(point.applicable_scenarios)
          ? point.applicable_scenarios
          : [];
        const isRelevant =
          scenarios.length === 0 ||
          scenarios.some((s) => s === scenario || scenario.includes(s) || s.includes(scenario));

        if (isRelevant) results.push(point);
      }

      return results;
    } catch (error) {
      console.error("[Scout Memory] Error fetching learning points:", error);
      return [];
    }
  }

  /**
   * Store proactive suggestion
   */
  static async storeProactiveSuggestion(
    userId: string,
    suggestion: string,
    basedOnContext: string,
    confidence: number
  ): Promise<void> {
    const suggestionMemory = {
      suggestion,
      based_on_context: basedOnContext,
      confidence,
      timestamp: new Date().toISOString(),
    };

    const memoryKey = `suggestion_${Date.now()}`;
    await this.storeMemory(
      userId,
      MemoryEntryType.PROACTIVE_SUGGESTION,
      memoryKey,
      suggestionMemory,
      3600 // 1 hour TTL for suggestions
    );
  }

  /**
   * Get recent proactive suggestions
   */
  static async getRecentSuggestions(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const rows = await db
        .select()
        .from(scoutMemory)
        .where(
          and(
            eq(scoutMemory.userId, userId),
            eq(scoutMemory.type, MemoryEntryType.PROACTIVE_SUGGESTION)
          )
        )
        .orderBy(desc(scoutMemory.createdAt))
        .limit(limit);

      const now = new Date();
      const results: any[] = [];

      for (const row of rows) {
        // Skip expired entries (suggestions default to 1 hour TTL)
        if (row.ttlSeconds && row.createdAt) {
          const expiresAt = new Date(row.createdAt);
          expiresAt.setSeconds(expiresAt.getSeconds() + row.ttlSeconds);
          if (expiresAt < now) continue;
        }
        results.push(row.value);
      }

      return results;
    } catch (error) {
      console.error("[Scout Memory] Error fetching recent suggestions:", error);
      return [];
    }
  }

  /**
   * Store a memory entry
   */
  private static async storeMemory(
    userId: string,
    type: MemoryEntryType,
    key: string,
    value: Record<string, any>,
    ttlSeconds?: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await db
        .insert(scoutMemory)
        .values({
          userId,
          type,
          key,
          value,
          ttlSeconds,
          metadata,
        })
        .onConflictDoUpdate({
          target: [scoutMemory.userId, scoutMemory.type, scoutMemory.key],
          set: {
            value,
            metadata,
            updatedAt: new Date(),
            ...(ttlSeconds && { ttlSeconds }),
          },
        });

      console.log(`[Scout Memory] Stored ${type} for user ${userId}: ${key}`);
    } catch (error) {
      console.error("[Scout Memory] Error storing memory:", error);
      throw error;
    }
  }

  /**
   * Retrieve a memory entry
   */
  private static async getMemory(
    userId: string,
    type: MemoryEntryType,
    key: string
  ): Promise<MemoryEntry | null> {
    try {
      const result = await db.query.scoutMemory.findFirst({
        where: and(
          eq(scoutMemory.userId, userId),
          eq(scoutMemory.type, type),
          eq(scoutMemory.key, key)
        ),
      });

      if (!result) {
        return null;
      }

      // Check if memory has expired
      if (result.ttlSeconds) {
        const expiresAt = new Date(result.createdAt!);
        expiresAt.setSeconds(expiresAt.getSeconds() + result.ttlSeconds);
        if (expiresAt < new Date()) {
          // Memory has expired, delete it
          await db
            .delete(scoutMemory)
            .where(
              and(
                eq(scoutMemory.userId, userId),
                eq(scoutMemory.type, type),
                eq(scoutMemory.key, key)
              )
            );
          return null;
        }
      }

      return {
        id: result.id,
        user_id: result.userId,
        type: result.type as MemoryEntryType,
        key: result.key,
        value: result.value as Record<string, any>,
        metadata: result.metadata as any,
        ttl_seconds: result.ttlSeconds || undefined,
      };
    } catch (error) {
      console.error("[Scout Memory] Error retrieving memory:", error);
      return null;
    }
  }

  /**
   * Update memory metadata
   */
  private static async updateMemoryMetadata(
    userId: string,
    key: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Get existing metadata first
      const existing = await db.query.scoutMemory.findFirst({
        where: and(eq(scoutMemory.userId, userId), eq(scoutMemory.key, key)),
      });

      if (!existing) {
        console.warn(`[Scout Memory] Cannot update metadata - memory not found: ${key}`);
        return;
      }

      const existingMetadata = (existing.metadata as Record<string, any>) || {};
      const updatedMetadata = { ...existingMetadata, ...metadata };

      await db
        .update(scoutMemory)
        .set({
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(and(eq(scoutMemory.userId, userId), eq(scoutMemory.key, key)));

      console.log(`[Scout Memory] Updated metadata for ${key}`);
    } catch (error) {
      console.error("[Scout Memory] Error updating metadata:", error);
    }
  }

  /**
   * Clear old memories (cleanup)
   */
  static async clearExpiredMemories(): Promise<void> {
    try {
      const result = await db
        .delete(scoutMemory)
        .where(
          sql`${scoutMemory.ttlSeconds} IS NOT NULL AND 
              ${scoutMemory.createdAt} < NOW() - (${scoutMemory.ttlSeconds} || ' seconds')::interval`
        )
        .returning({ id: scoutMemory.id });

      console.log(`[Scout Memory] Cleared ${result.length} expired memories`);
    } catch (error) {
      console.error("[Scout Memory] Error clearing expired memories:", error);
    }
  }

  /**
   * Get memory statistics for a user
   */
  static async getMemoryStats(userId: string): Promise<Record<string, any>> {
    try {
      const memories = await db.query.scoutMemory.findMany({
        where: eq(scoutMemory.userId, userId),
      });

      const stats = {
        user_id: userId,
        total_memories: memories.length,
        tool_results: memories.filter((m) => m.type === "tool_result").length,
        user_preferences: memories.filter((m) => m.type === "user_preference").length,
        conversation_contexts: memories.filter((m) => m.type === "conversation_context").length,
        learning_points: memories.filter((m) => m.type === "learning_point").length,
        proactive_suggestions: memories.filter((m) => m.type === "proactive_suggestion").length,
        last_updated:
          memories.length > 0
            ? new Date(
                Math.max(...memories.map((m) => new Date(m.updatedAt!).getTime()))
              ).toISOString()
            : new Date().toISOString(),
      };

      return stats;
    } catch (error) {
      console.error("[Scout Memory] Error gathering statistics:", error);
      return {
        user_id: userId,
        total_memories: 0,
        tool_results: 0,
        user_preferences: 0,
        conversation_contexts: 0,
        learning_points: 0,
        proactive_suggestions: 0,
        last_updated: new Date().toISOString(),
        error: String(error),
      };
    }
  }

  /**
   * Cache a Scout response (for query deduplication and fast retrieval)
   */
  static async cacheScoutResponse(
    userId: string,
    queryHash: string,
    response: Record<string, any>,
    ttlMinutes: number = 60
  ): Promise<void> {
    try {
      await this.storeMemory(
        userId,
        MemoryEntryType.CONVERSATION_CONTEXT,
        `response_cache_${queryHash}`,
        {
          response,
          cached_at: new Date().toISOString(),
          metadata: {
            relevance_score: 95,
            access_count: 0,
          },
        },
        ttlMinutes * 60
      );
    } catch (error) {
      console.warn("[Scout Memory] Failed to cache response:", error);
    }
  }

  /**
   * Retrieve a cached Scout response
   */
  static async getCachedResponse(
    userId: string,
    queryHash: string
  ): Promise<Record<string, any> | null> {
    try {
      const memory = await this.getMemory(
        userId,
        MemoryEntryType.CONVERSATION_CONTEXT,
        `response_cache_${queryHash}`
      );

      if (memory) {
        // Update access count
        const metadata = memory.metadata || {};
        metadata.access_count = (metadata.access_count || 0) + 1;
        metadata.last_accessed = new Date().toISOString();
        await this.updateMemoryMetadata(userId, `response_cache_${queryHash}`, metadata);

        return memory.value.response;
      }

      return null;
    } catch (error) {
      console.warn("[Scout Memory] Failed to retrieve cached response:", error);
      return null;
    }
  }

  /**
   * Track in-flight requests to prevent duplicate processing
   */
  private static inFlightRequests = new Map<string, Promise<any>>();

  /**
   * Get or create an in-flight request promise
   */
  static getOrCreateInFlightRequest(
    requestKey: string,
    executor: () => Promise<any>
  ): Promise<any> {
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const promise = executor().finally(() => {
      this.inFlightRequests.delete(requestKey);
    });

    this.inFlightRequests.set(requestKey, promise);
    return promise;
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(userId: string): Promise<Record<string, any>> {
    try {
      const memories = await db.query.scoutMemory.findMany({
        where: and(eq(scoutMemory.userId, userId), sql`${scoutMemory.key} LIKE 'response_cache_%'`),
      });

      const totalCached = memories.length;
      const totalAccesses = memories.reduce(
        (sum, m) => sum + ((m.metadata as any)?.access_count || 0),
        0
      );
      const totalSaved = totalAccesses * 0.01; // Rough estimate: $0.01 per API call

      return {
        cached_responses: totalCached,
        total_cache_hits: totalAccesses,
        estimated_savings: `$${totalSaved.toFixed(2)}`,
        in_flight_requests: this.inFlightRequests.size,
      };
    } catch (error) {
      console.warn("[Scout Memory] Failed to get cache stats:", error);
      return {
        cached_responses: 0,
        total_cache_hits: 0,
        estimated_savings: "$0.00",
        in_flight_requests: this.inFlightRequests.size,
      };
    }
  }
}

export default ScoutMemoryService;
