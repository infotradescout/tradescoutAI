/**
 * Phase D2: Scout Confidence Scoring Engine
 * 
 * Calculates 0.0-1.0 confidence score for contact recommendations
 * Based on 5 weighted components:
 * - expertise_match: 30% (target's skills vs need)
 * - location_match: 25% (geographic/scope alignment)
 * - trust_signal: 25% (verification, reviews, network)
 * - past_success: 15% (prior outcomes with this pair)
 * - availability_match: 5% (recent activity)
 * 
 * Authority Gates (based on confidence):
 * - 0.85-1.0: auto_allow (minimal friction)
 * - 0.70-0.84: manual_confirm (user must click)
 * - 0.50-0.69: caution (show risk flags, alternatives)
 * - <0.50: blocked (don't show, offer alternatives)
 */

import { db } from './db';
import { users, marketplaceConversations } from '../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export type Intent = 'hire' | 'advise' | 'collaborate' | 'reconnect';
export type AuthorityGate = 'auto_allow' | 'manual_confirm' | 'caution' | 'blocked';

export interface ConfidenceComponents {
  expertise_match: number; // 0.0-1.0
  location_match: number; // 0.0-1.0
  trust_signal: number; // 0.0-1.0
  past_success: number; // 0.0-1.0
  availability_match: number; // 0.0-1.0
}

export interface ConfidenceScore {
  overall: number; // 0.0-1.0 (weighted average)
  components: ConfidenceComponents;
  authorityGate: AuthorityGate;
  riskFlags: string[];
}

export interface ScoutRecommendation {
  recommendationId: string;
  targetUserId: string;
  targetUserName: string;
  targetRole: string;
  targetLocation?: string;
  suggestedIntent: Intent;
  reasoning: string;
  confidence: ConfidenceScore;
  decisionContext?: string;
  createdAt: Date;
}

/**
 * Calculate expertise match component (30% weight)
 * Compares target's skills/role with user's need
 */
async function calculateExpertiseMatch(
  userId: string,
  targetUserId: string,
  intent: Intent,
  decisionContext?: string
): Promise<number> {
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) return 0;

  // Perfect match scenarios
  if (intent === 'hire' && target.role === 'contractor') {
    // Check if decision context mentions target's trade
    // Future: Match against contractor.specialties
    return 0.9;
  }

  if (intent === 'advise' && target.role === 'hoa_board_member') {
    return 0.85;
  }

  if (intent === 'collaborate' && target.role === 'contractor') {
    return 0.8;
  }

  // Fallback: moderate match
  return 0.5;
}

/**
 * Calculate location match component (25% weight)
 * Geographic proximity and service area overlap
 */
async function calculateLocationMatch(
  userId: string,
  targetUserId: string
): Promise<number> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));

  if (!user || !target) return 0;

  // Same county = perfect match
  if (user.countyFips && target.countyFips && user.countyFips === target.countyFips) {
    return 1.0;
  }

  // Same state = good match
  if (user.state && target.state && user.state === target.state) {
    return 0.7;
  }

  // Different state = poor match
  return 0.2;
}

/**
 * Calculate trust signal component (25% weight)
 * Verification status, reviews, network connections
 */
async function calculateTrustSignal(
  userId: string,
  targetUserId: string
): Promise<number> {
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) return 0;

  let score = 0;

  // Address verified (+0.5)
  if (target.addressVerified) {
    score += 0.5;
  }

  // Active account (+0.2)
  if (target.isActive) {
    score += 0.2;
  }

  // Future: Add review score, network connections, badges
  // if (target.reviewScore > 4.5) score += 0.3;

  return Math.min(score, 1.0);
}

/**
 * Calculate past success component (15% weight)
 * Prior outcomes with this specific pair
 */
async function calculatePastSuccess(
  userId: string,
  targetUserId: string
): Promise<number> {
  // Check if they've had prior successful conversations
  const priorConvs = await db
    .select()
    .from(marketplaceConversations)
    .where(
      and(
        eq(marketplaceConversations.buyerId, userId),
        eq(marketplaceConversations.sellerId, targetUserId)
      )
    )
    .limit(5);

  if (priorConvs.length === 0) return 0.3; // No history = neutral

  // Future: Check if conversations led to successful outcomes
  // For now: having prior contact is moderate positive signal
  if (priorConvs.length >= 2) return 0.8;
  if (priorConvs.length === 1) return 0.6;

  return 0.3;
}

/**
 * Calculate availability match component (5% weight)
 * Recent activity, response rate
 */
async function calculateAvailabilityMatch(
  userId: string,
  targetUserId: string
): Promise<number> {
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) return 0;

  // Check if user was recently active (within 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (target.updatedAt && target.updatedAt > sevenDaysAgo) {
    return 0.9;
  }

  // Check if within 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (target.updatedAt && target.updatedAt > thirtyDaysAgo) {
    return 0.5;
  }

  // Inactive = low availability
  return 0.2;
}

/**
 * Calculate overall confidence score (weighted average)
 */
export async function calculateConfidenceScore(
  userId: string,
  targetUserId: string,
  intent: Intent,
  decisionContext?: string
): Promise<ConfidenceScore> {
  // Calculate all components
  const expertise_match = await calculateExpertiseMatch(userId, targetUserId, intent, decisionContext);
  const location_match = await calculateLocationMatch(userId, targetUserId);
  const trust_signal = await calculateTrustSignal(userId, targetUserId);
  const past_success = await calculatePastSuccess(userId, targetUserId);
  const availability_match = await calculateAvailabilityMatch(userId, targetUserId);

  // Weighted average
  const overall = 
    (expertise_match * 0.30) +
    (location_match * 0.25) +
    (trust_signal * 0.25) +
    (past_success * 0.15) +
    (availability_match * 0.05);

  // Determine authority gate based on overall score
  let authorityGate: AuthorityGate;
  if (overall >= 0.85) authorityGate = 'auto_allow';
  else if (overall >= 0.70) authorityGate = 'manual_confirm';
  else if (overall >= 0.50) authorityGate = 'caution';
  else authorityGate = 'blocked';

  // Generate risk flags for caution/blocked states
  const riskFlags: string[] = [];
  if (location_match < 0.5) {
    riskFlags.push('Different geographic area may affect availability');
  }
  if (trust_signal < 0.5) {
    riskFlags.push('Limited verification or network signals');
  }
  if (expertise_match < 0.6) {
    riskFlags.push('Skills may not perfectly match your need');
  }
  if (availability_match < 0.4) {
    riskFlags.push('User has been inactive recently');
  }

  return {
    overall: Math.round(overall * 100) / 100, // Round to 2 decimals
    components: {
      expertise_match,
      location_match,
      trust_signal,
      past_success,
      availability_match,
    },
    authorityGate,
    riskFlags,
  };
}

/**
 * Generate Scout recommendation for a given user and context
 */
export async function generateScoutRecommendation(
  userId: string,
  targetUserId: string,
  intent: Intent,
  reasoning: string,
  decisionContext?: string
): Promise<ScoutRecommendation> {
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) {
    throw new Error('Target user not found');
  }

  const confidence = await calculateConfidenceScore(userId, targetUserId, intent, decisionContext);

  return {
    recommendationId: `scout_rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    targetUserId: target.id,
    targetUserName: `${target.firstName} ${target.lastName}`.trim() || 'User',
    targetRole: target.role || 'user',
    targetLocation: target.countyFips ? `${target.countyFips}, ${target.state}` : target.state || undefined,
    suggestedIntent: intent,
    reasoning,
    confidence,
    decisionContext,
    createdAt: new Date(),
  };
}

/**
 * Rate limiting: Max 3 recommendations per day, 10 per week
 */
export function checkRecommendationRateLimit(
  userId: string,
  recentRecommendations: ScoutRecommendation[]
): { allowed: boolean; reason?: string } {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const dailyCount = recentRecommendations.filter(r => r.createdAt > oneDayAgo).length;
  const weeklyCount = recentRecommendations.filter(r => r.createdAt > oneWeekAgo).length;

  if (dailyCount >= 3) {
    return { allowed: false, reason: 'Daily recommendation limit reached (3 per day)' };
  }

  if (weeklyCount >= 10) {
    return { allowed: false, reason: 'Weekly recommendation limit reached (10 per week)' };
  }

  return { allowed: true };
}
