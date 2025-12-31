/**
 * Phase D2: Scout Recommendation Routes
 * 
 * Generates and manages contact recommendations with confidence scoring
 * 
 * Endpoints:
 * - POST /api/scout/recommendations - Generate recommendation
 * - GET /api/scout/recommendations/pending - Get active recommendations
 * - POST /api/scout/recommendations/:id/action - Accept/dismiss recommendation
 * - POST /api/scout/feedback/outcome - Record conversation outcome
 */

import type { Express } from "express";
import { db } from "../../src/db/drizzle-mock";
import { eq, and, desc, gt, sql } from "drizzle-orm";
import { isAuthenticated, requireOnboardingComplete } from "../auth";
import { 
  calculateConfidenceScore, 
  generateScoutRecommendation,
  checkRecommendationRateLimit,
  type Intent,
  type ScoutRecommendation 
} from "../utils/scoutConfidenceScoring";

// In-memory recommendation storage (replace with DB table in production)
const activeRecommendations = new Map<string, ScoutRecommendation>();
const userRecommendationHistory = new Map<string, ScoutRecommendation[]>();

export function registerScoutRecommendations(app: Express) {

  /**
   * POST /api/scout/recommendations
   * Generate Scout recommendation for contact
   * 
   * Body: {
   *   targetUserId: string,
   *   contextType: 'post' | 'task' | 'project' | 'question',
   *   contextId: string,
   *   suggestedIntent?: Intent (optional, Scout will determine)
   * }
   */
  app.post("/api/scout/recommendations", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { targetUserId, contextType, contextId, suggestedIntent } = req.body;

      if (!targetUserId || !contextType || !contextId) {
        return res.status(400).json({ 
          message: "targetUserId, contextType, and contextId required" 
        });
      }

      // Check rate limits (3/day, 10/week)
      const userHistory = userRecommendationHistory.get(userId) || [];
      const rateLimitCheck = checkRecommendationRateLimit(userId, userHistory);
      
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({ 
          message: rateLimitCheck.reason,
          reasonCode: 'RATE_LIMIT_EXCEEDED'
        });
      }

      // Determine intent based on context
      let intent: Intent = suggestedIntent || 'hire';
      if (contextType === 'task') intent = 'hire';
      else if (contextType === 'question') intent = 'advise';
      else if (contextType === 'project') intent = 'collaborate';

      // Generate recommendation with confidence scoring
      const recommendation = await generateScoutRecommendation(
        userId,
        targetUserId,
        intent,
        `Based on ${contextType}: ${contextId}`,
        `Contact recommended for ${contextType} context`
      );

      // Store recommendation
      activeRecommendations.set(recommendation.recommendationId, recommendation);
      
      // Track in user history
      if (!userRecommendationHistory.has(userId)) {
        userRecommendationHistory.set(userId, []);
      }
      userRecommendationHistory.get(userId)!.push(recommendation);

      // Return recommendation with confidence tier
      res.status(201).json({
        recommendationId: recommendation.recommendationId,
        targetUserId: recommendation.targetUserId,
        targetUserName: recommendation.targetUserName,
        targetRole: recommendation.targetRole,
        targetLocation: recommendation.targetLocation,
        suggestedIntent: recommendation.suggestedIntent,
        reasoning: recommendation.reasoning,
        confidenceScore: recommendation.confidence.overall,
        confidenceTier: recommendation.confidence.authorityGate,
        confidenceComponents: recommendation.confidence.components,
        riskFlags: recommendation.confidence.riskFlags,
        decisionScope: recommendation.decisionContext,
        createdAt: recommendation.createdAt,
      });
    } catch (error: any) {
      console.error("Scout recommendation error:", error);
      res.status(500).json({ message: "Failed to generate recommendation" });
    }
  });

  /**
   * GET /api/scout/recommendations/pending
   * Get active recommendations for user
   */
  app.get("/api/scout/recommendations/pending", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userHistory = userRecommendationHistory.get(userId) || [];
      
      // Filter recommendations from last 7 days that haven't been acted on
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const pending = userHistory
        .filter(rec => rec.createdAt > sevenDaysAgo)
        .filter(rec => rec.confidence.authorityGate !== 'blocked') // Don't show blocked
        .slice(0, 5); // Limit to 5 most recent

      res.json({ recommendations: pending });
    } catch (error: any) {
      console.error("Get pending recommendations error:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  /**
   * POST /api/scout/recommendations/:id/action
   * Accept or dismiss a recommendation
   * 
   * Body: {
   *   action: 'accept' | 'dismiss' | 'view_alternatives'
   * }
   */
  app.post("/api/scout/recommendations/:id/action", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { id } = req.params;
      const { action } = req.body;

      if (!action || !['accept', 'dismiss', 'view_alternatives'].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      const recommendation = activeRecommendations.get(id);
      if (!recommendation) {
        return res.status(404).json({ message: "Recommendation not found or expired" });
      }

      // Log action for learning
      console.log(`[SCOUT D2] Recommendation ${id}: ${action} by ${userId}`);

      if (action === 'accept') {
        // User will proceed to create conversation via POST /api/social/conversations/start
        // with authorityGate='scout_recommendation' and sourceScoutRecommendationId=id
        res.json({ 
          message: "Proceed to contact",
          recommendationId: id,
          nextStep: 'create_conversation'
        });
      } else if (action === 'dismiss') {
        // Remove from active recommendations
        activeRecommendations.delete(id);
        res.json({ message: "Recommendation dismissed" });
      } else if (action === 'view_alternatives') {
        // Return alternatives (future: generate similar recommendations)
        res.json({ 
          message: "Alternatives not yet implemented",
          suggestion: "Try refining your decision or ask Scout for guidance"
        });
      }
    } catch (error: any) {
      console.error("Recommendation action error:", error);
      res.status(500).json({ message: "Failed to process action" });
    }
  });

  /**
   * POST /api/scout/feedback/outcome
   * Record conversation outcome for confidence learning
   * 
   * Body: {
   *   conversationId: string,
   *   outcome: 'successful' | 'failed' | 'no_response' | 'blocked',
   *   notes?: string
   * }
   */
  app.post("/api/scout/feedback/outcome", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { conversationId, outcome, notes } = req.body;

      if (!conversationId || !outcome || !['successful', 'failed', 'no_response', 'blocked'].includes(outcome)) {
        return res.status(400).json({ message: "Invalid outcome data" });
      }

      // Future: Update confidence weights based on outcome
      // For now: just log
      console.log(`[SCOUT LEARNING] Conversation ${conversationId}: ${outcome}`);
      if (notes) {
        console.log(`  Notes: ${notes}`);
      }

      res.json({ message: "Feedback recorded", learningEnabled: false });
    } catch (error: any) {
      console.error("Feedback outcome error:", error);
      res.status(500).json({ message: "Failed to record feedback" });
    }
  });
}
