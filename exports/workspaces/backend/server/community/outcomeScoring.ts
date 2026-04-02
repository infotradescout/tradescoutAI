/**
 * Community Outcome Scoring
 * 
 * Weights Community posts/interactions based on outcome signals from Scout.
 * 
 * Success → subtle boost
 * Regret → decay
 * New → neutral (0.0)
 * 
 * This makes quality visible without exposing ranking logic.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export interface OutcomeScore {
  contextId: string;
  contextType: "community_post" | "trade_deal" | "contractor_profile";
  score: number; // -1.0 (regret) to +1.0 (success), 0.0 neutral
  sampleSize: number; // How many outcomes contributed
  lastUpdated: string;
}

// In-memory cache: Map<contextId, OutcomeScore>
const scoreCache = new Map<string, OutcomeScore>();
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Get outcome score for a specific context (post, deal, etc.)
 * Returns 0.0 for new/unknown contexts
 */
export async function getOutcomeScore(
  contextId: string,
  contextType: "community_post" | "trade_deal" | "contractor_profile" = "community_post"
): Promise<number> {
  const cacheKey = `${contextType}:${contextId}`;
  
  // Check cache
  if (Date.now() - lastCacheRefresh < CACHE_TTL_MS) {
    const cached = scoreCache.get(cacheKey);
    if (cached) return cached.score;
  }
  
  try {
    // Query outcome stats from database
    // This assumes we have outcome tracking for contexts
    const result = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN outcome = 'regret' THEN 1 END)::int as regret_count,
        COUNT(CASE WHEN outcome = 'success' THEN 1 END)::int as success_count,
        COUNT(*)::int as total_count
      FROM scout_outcomes
      WHERE context_id = ${contextId}
        AND context_type = ${contextType}
        AND created_at > NOW() - INTERVAL '90 days'
    `) as any;
    
    const row = result?.rows?.[0];
    if (!row || row.total_count === 0) {
      // New content: neutral score
      return 0.0;
    }
    
    const regretCount = Number(row.regret_count || 0);
    const successCount = Number(row.success_count || 0);
    const totalCount = Number(row.total_count || 0);
    
    // Simple scoring: (success - regret) / total
    // Normalized to [-1, 1] range
    let score = 0.0;
    if (totalCount > 0) {
      score = (successCount - regretCount) / totalCount;
    }
    
    // Apply dampening for low sample sizes
    // With < 3 outcomes, reduce confidence in score
    const dampening = Math.min(1.0, totalCount / 3);
    score = score * dampening;
    
    // Cache result
    scoreCache.set(cacheKey, {
      contextId,
      contextType,
      score,
      sampleSize: totalCount,
      lastUpdated: new Date().toISOString(),
    });
    
    return score;
  } catch (error) {
    console.error(`[Outcome Score] Failed to get score for ${cacheKey}:`, error);
    return 0.0; // Fail safe: neutral
  }
}

/**
 * Get outcome scores for multiple contexts in batch
 * More efficient than individual calls
 */
export async function getOutcomeScores(
  contexts: Array<{ id: string; type: "community_post" | "trade_deal" | "contractor_profile" }>
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  
  if (contexts.length === 0) return scores;
  
  // Refresh cache if stale
  const needsRefresh = Date.now() - lastCacheRefresh > CACHE_TTL_MS;
  
  try {
    // Build WHERE clause for all contexts
    const conditions = contexts.map(
      c => sql`(context_id = ${c.id} AND context_type = ${c.type})`
    );
    
    const result = await db.execute(sql`
      SELECT
        context_id,
        context_type,
        COUNT(CASE WHEN outcome = 'regret' THEN 1 END)::int as regret_count,
        COUNT(CASE WHEN outcome = 'success' THEN 1 END)::int as success_count,
        COUNT(*)::int as total_count
      FROM scout_outcomes
      WHERE (${sql.join(conditions, sql` OR `)})
        AND created_at > NOW() - INTERVAL '90 days'
      GROUP BY context_id, context_type
    `) as any;
    
    const resultMap = new Map<string, any>();
    for (const row of result?.rows || []) {
      const key = `${row.context_type}:${row.context_id}`;
      resultMap.set(key, row);
    }
    
    // Calculate scores for all contexts
    for (const ctx of contexts) {
      const key = `${ctx.type}:${ctx.id}`;
      const row = resultMap.get(key);
      
      if (!row || row.total_count === 0) {
        scores.set(ctx.id, 0.0);
        continue;
      }
      
      const regretCount = Number(row.regret_count || 0);
      const successCount = Number(row.success_count || 0);
      const totalCount = Number(row.total_count || 0);
      
      let score = 0.0;
      if (totalCount > 0) {
        score = (successCount - regretCount) / totalCount;
      }
      
      const dampening = Math.min(1.0, totalCount / 3);
      score = score * dampening;
      
      scores.set(ctx.id, score);
      
      // Update cache
      if (needsRefresh) {
        scoreCache.set(key, {
          contextId: ctx.id,
          contextType: ctx.type,
          score,
          sampleSize: totalCount,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
    
    if (needsRefresh) {
      lastCacheRefresh = Date.now();
    }
    
  } catch (error) {
    console.error("[Outcome Scores] Batch query failed:", error);
    // Fail safe: return neutral scores
    for (const ctx of contexts) {
      scores.set(ctx.id, 0.0);
    }
  }
  
  return scores;
}

/**
 * Apply outcome weighting to a list of posts
 * Modifies posts in place by adding outcomeScore field
 */
export async function applyOutcomeWeighting(
  posts: Array<{ id: string; [key: string]: any }>
): Promise<void> {
  if (posts.length === 0) return;
  
  const contexts = posts.map(p => ({ id: p.id, type: "community_post" as const }));
  const scores = await getOutcomeScores(contexts);
  
  for (const post of posts) {
    const score = scores.get(post.id) || 0.0;
    (post as any).outcomeScore = score;
    
    // Add subtle authority label based on score
    if (score > 0.3) {
      (post as any).authorityLabel = "Trusted connection path in this community";
    } else if (score < -0.3) {
      (post as any).authorityLabel = "This pattern has led to regret in similar situations";
    } else if (score > 0.1) {
      (post as any).authorityLabel = "Positive engagement in your area";
    }
  }
}

/**
 * Sort posts by outcome score (descending)
 * Used for "recommended" sorting
 */
export function sortByOutcomeScore(posts: Array<{ outcomeScore?: number; [key: string]: any }>): void {
  posts.sort((a, b) => {
    const scoreA = a.outcomeScore || 0;
    const scoreB = b.outcomeScore || 0;
    return scoreB - scoreA; // Descending: higher scores first
  });
}
