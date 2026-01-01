/**
 * Scout Snapshot Integration Service
 * 
 * Bridges snapshot-based decisions with existing role-based code.
 * Allows gradual B2 rollout without rewriting all Scout decision points.
 * 
 * Usage:
 *   const snapshot = await snapshotService.getOrCompute(userId);
 *   if (snapshot.decisionConfidence === 'low') {
 *     // Multi-option response
 *   } else if (snapshot.primaryRole === 'contractor') {
 *     // Contractor-specific path
 *   }
 */

import { db } from '../db';
import { snapshots, users } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { Snapshot, SnapshotInferenceContext } from '../types/Snapshot';

/**
 * In-memory cache with TTL
 */
const snapshotCache = new Map<string, { snapshot: Snapshot; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Compute snapshot confidence from inference signals
 */
function computeConfidence(signals: Record<string, any>): 'low' | 'medium' | 'high' {
  let score = 0;
  
  // Strong signal: explicit roleIntent from signup
  if (signals.roleIntent) score += 0.4;
  
  // Verified badge is strong signal
  if (signals.verifiedBadges?.length > 0) score += 0.3;
  
  // Activity pattern signals
  if (signals.messagePatterns?.length > 0) score += 0.15;
  if (signals.recentActions?.length > 0) score += 0.1;
  if (signals.pageSequence?.length > 0) score += 0.05;
  
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

/**
 * Infer primary role from context
 */
function inferPrimaryRole(context?: SnapshotInferenceContext): 'homeowner' | 'contractor' | 'vendor' | 'admin' | 'unknown' {
  if (!context) return 'unknown';
  
  const roleIntent = context.profile?.roleIntent;
  if (roleIntent === 'contractor') return 'contractor';
  if (roleIntent === 'homeowner') return 'homeowner';
  
  const messagePattern = context.message?.toLowerCase() || '';
  const hasContractorSignal = /\b(offer|provide|work|service|contractor)\b/.test(messagePattern);
  const hasHomeownerSignal = /\b(find|hire|need|looking for)\b/.test(messagePattern);
  
  if (hasContractorSignal) return 'contractor';
  if (hasHomeownerSignal) return 'homeowner';
  
  return 'unknown';
}

/**
 * Create a new snapshot from context
 */
export async function inferSnapshot(userId: string, context?: SnapshotInferenceContext): Promise<Snapshot> {
  const primaryRole = inferPrimaryRole(context);
  const signals = {
    roleIntent: context?.profile?.roleIntent,
    messagePatterns: [],
    recentActions: context?.recentActivity?.map(a => a.type),
    pageSequence: context?.pageSequence,
    verifiedBadges: context?.profile?.verifiedBadges,
    businessProfile: context?.profile?.businessProfile,
  };
  
  const decisionConfidence = computeConfidence(signals);
  
  const snapshot: Snapshot = {
    userId,
    snapshotId: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    computedAt: new Date(),
    primaryRole: primaryRole as any,
    secondaryRoles: [],
    primaryRoleConfidence: decisionConfidence === 'high' ? 0.8 : decisionConfidence === 'medium' ? 0.5 : 0.3,
    secondaryRoleConfidences: {
      homeowner: 0.25,
      contractor: 0.25,
      vendor: 0.1,
      admin: 0.05,
    },
    decisionConfidence,
    signals: signals as any,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    confidenceDecayRate: 0.05,
    version: '1.0',
    tags: context?.profile?.roleIntent ? ['signup_intent'] : [],
  };
  
  return snapshot;
}

/**
 * Get or compute snapshot for user
 * Checks cache → DB → compute
 */
export async function getOrCompute(userId: string, context?: SnapshotInferenceContext): Promise<Snapshot> {
  // Check memory cache first
  const cached = snapshotCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }
  
  // Remove expired cache entry
  if (cached) {
    snapshotCache.delete(userId);
  }
  
  // Check DB for valid snapshot
  const dbSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.userId, userId),
    orderBy: desc(snapshots.computedAt),
  });
  
  if (dbSnapshot && new Date(dbSnapshot.validUntil) > new Date()) {
    // Cache it
    snapshotCache.set(userId, {
      snapshot: dbSnapshot as Snapshot,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return dbSnapshot as Snapshot;
  }
  
  // Compute new snapshot
  const newSnapshot = await inferSnapshot(userId, context);
  
  // Persist to DB
  try {
    await db.insert(snapshots).values(newSnapshot as any);
  } catch (error) {
    console.error('[Snapshot] Failed to persist:', error);
    // Continue without persisting (in-memory only)
  }
  
  // Cache it
  snapshotCache.set(userId, {
    snapshot: newSnapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  
  return newSnapshot;
}

/**
 * Bootstrap snapshot from A2 signup
 * Called immediately after user registration with roleIntent
 */
export async function bootstrapFromSignup(userId: string, roleIntent: 'homeowner' | 'contractor' | 'other'): Promise<Snapshot> {
  const context: SnapshotInferenceContext = {
    profile: {
      roleIntent: roleIntent === 'other' ? 'homeowner' : roleIntent,
    },
  };
  
  const snapshot = await inferSnapshot(userId, context);
  
  // Tag as first-session
  snapshot.tags = ['first_session', 'signup_intent'];
  
  // Short validity for first-session (1 day, to allow D2 refinement)
  snapshot.validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  // Set medium confidence for signup (enough to route but allow refinement)
  snapshot.decisionConfidence = 'medium';
  
  // Persist
  try {
    await db.insert(snapshots).values(snapshot as any);
  } catch (error) {
    console.error('[Snapshot] Failed to bootstrap:', error);
  }
  
  // Cache it
  snapshotCache.set(userId, {
    snapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  
  return snapshot;
}

/**
 * Clear cache for user
 * Call when user's profile is updated or high-signal event occurs
 */
export function invalidate(userId: string): void {
  snapshotCache.delete(userId);
}

/**
 * Backward compatibility wrapper
 * Maps snapshot to legacy role string for gradual B2 rollout
 * 
 * Use this to wrap existing role-based code:
 *   const role = mapSnapshotToRole(snapshot);
 *   // existing role-based logic still works
 */
export function mapSnapshotToRole(snapshot: Snapshot): string {
  // If confidence is high, use primary role
  if (snapshot.decisionConfidence === 'high') {
    return snapshot.primaryRole;
  }
  
  // If confidence is low, return 'user' to trigger multi-role UI
  if (snapshot.decisionConfidence === 'low') {
    return 'user';
  }
  
  // Medium confidence: return primary role but allow fallbacks
  return snapshot.primaryRole;
}

/**
 * Get action multiplier for confidence
 * Used in action shaping: low→1, medium→2, high→1
 */
export function getActionMultiplier(decisionConfidence: 'low' | 'medium' | 'high'): number {
  switch (decisionConfidence) {
    case 'low':
      return 1; // Show only 1 action + community fallback
    case 'medium':
      return 2; // Show up to 2 options
    case 'high':
      return 1; // Single decisive action
  }
}
