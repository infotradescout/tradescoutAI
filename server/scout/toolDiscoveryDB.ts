/**
 * Scout Tool Discovery — DB-Backed Institutional Intelligence
 * 
 * This module handles persistence, convergence detection, and blueprint emission
 * using the database as the source of truth.
 * 
 * CRITICAL RULES:
 * 1. Count UNIQUE USERS only (no spam from power users)
 * 2. Rolling time window (evidence must be recent)
 * 3. Cooldown per fingerprint (no re-emit spam)
 * 4. Evidence required (≥1 snippet)
 * 5. No fabricated data
 */

import { db } from "../db";
import { 
  toolProposals, 
  toolProposalEvidence, 
  toolProposalDecisions,
  type InsertToolProposal,
  type InsertToolProposalEvidence,
  type InsertToolProposalDecision,
  type ToolProposal,
  type ToolProposalEvidence as Evidence
} from "../../shared/schema";
import { eq, and, gte, desc, sql, count, countDistinct } from "drizzle-orm";
import type { Primitive } from "./governor";

// ============================================================================
// CONVERGENCE CONFIGURATION
// ============================================================================

const CONVERGENCE_CONFIG = {
  minUniqueUsers: 3,              // Require at least 3 different users
  rollingWindowDays: 14,          // Evidence must be within 14 days
  cooldownDays: 7,                // Don't re-emit same fingerprint for 7 days
  minEvidenceSnippets: 1,         // Require at least 1 piece of evidence
} as const;

// ============================================================================
// PATTERN TRACKING
// ============================================================================

export interface PatternInstance {
  userId: string;
  sessionId: string;
  userMessage: string;
  inferredGoal: string;
  missingCapability: string;
  workaroundUsed: string;
  primitivesUsed: Primitive[];
  situation: {
    goal: string;
    constraints: string[];
    risks: string[];
    unknowns: string[];
  };
  fingerprint: string;
}

/**
 * Track a pattern instance and check for convergence
 */
export async function trackPattern(pattern: PatternInstance): Promise<boolean> {
  try {
    // 1. Get or create proposal by fingerprint
    let proposal = await db.query.toolProposals.findFirst({
      where: eq(toolProposals.fingerprint, pattern.fingerprint),
    });

    if (!proposal) {
      // Create new proposal
      const [newProposal] = await db.insert(toolProposals).values({
        fingerprint: pattern.fingerprint,
        title: inferToolName(pattern.inferredGoal, pattern.missingCapability),
        problemStatement: inferProblemStatement(pattern),
        status: 'proposed',
        riskScore: calculateRiskScore(pattern.situation.risks),
        impactScore: 0, // Will be calculated after convergence
        uniqueUserCount: 0,
        totalEventCount: 0,
      }).returning();
      
      proposal = newProposal;
    }

    if (!proposal) {
      throw new Error("Failed to create proposal");
    }

    // 2. Add evidence
    await db.insert(toolProposalEvidence).values({
      proposalId: proposal.id,
      userId: parseInt(pattern.userId) || null,
      sourceType: 'conversation',
      sourceRef: pattern.sessionId,
      snippet: redactSnippet(pattern.userMessage),
      metadata: {
        goal: pattern.situation.goal,
        workaround: pattern.workaroundUsed,
        primitives: pattern.primitivesUsed,
        risks: pattern.situation.risks,
      },
    });

    // 3. Update counts
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - CONVERGENCE_CONFIG.rollingWindowDays);

    const evidenceStats = await db.select({
      uniqueUsers: countDistinct(toolProposalEvidence.userId),
      totalEvents: count(),
    })
    .from(toolProposalEvidence)
    .where(
      and(
        eq(toolProposalEvidence.proposalId, proposal.id),
        gte(toolProposalEvidence.createdAt, windowStart)
      )
    );

    const stats = evidenceStats[0];
    const uniqueUserCount = stats?.uniqueUsers || 0;
    const totalEventCount = stats?.totalEvents || 0;

    await db.update(toolProposals)
      .set({ 
        uniqueUserCount,
        totalEventCount,
        updatedAt: new Date(),
      })
      .where(eq(toolProposals.id, proposal.id));

    // 4. Check convergence
    return await checkConvergence(proposal.fingerprint);

  } catch (error) {
    console.error("[Tool Discovery] Error tracking pattern:", error);
    return false;
  }
}

/**
 * Check if a fingerprint has reached convergence threshold
 */
export async function checkConvergence(fingerprint: string): Promise<boolean> {
  try {
    const proposal = await db.query.toolProposals.findFirst({
      where: eq(toolProposals.fingerprint, fingerprint),
      with: {
        evidence: true,
      },
    });

    if (!proposal) {
      return false;
    }

    // Don't re-emit if already approved/rejected
    if (proposal.status !== 'proposed' && proposal.status !== 'deferred') {
      return false;
    }

    // INSTITUTIONAL MEMORY: If approved, don't re-propose
    if (proposal.approvedAt) {
      return false; // Already institutionalized
    }

    // Cooldown: don't re-emit if updated recently
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - CONVERGENCE_CONFIG.cooldownDays);
    
    if (proposal.updatedAt > cooldownDate && proposal.status === 'proposed') {
      return false; // Already emitted recently
    }

    // Check convergence criteria
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - CONVERGENCE_CONFIG.rollingWindowDays);

    const evidenceStats = await db.select({
      uniqueUsers: countDistinct(toolProposalEvidence.userId),
      totalEvents: count(),
    })
    .from(toolProposalEvidence)
    .where(
      and(
        eq(toolProposalEvidence.proposalId, proposal.id),
        gte(toolProposalEvidence.createdAt, windowStart)
      )
    );

    const stats = evidenceStats[0];
    const uniqueUserCount = stats?.uniqueUsers || 0;
    const totalEventCount = stats?.totalEvents || 0;

    // CRITICAL: Unique users is the primary gate
    const hasConverged = 
      uniqueUserCount >= CONVERGENCE_CONFIG.minUniqueUsers &&
      totalEventCount >= CONVERGENCE_CONFIG.minEvidenceSnippets;

    if (hasConverged) {
      // Calculate impact score
      const impactScore = calculateImpactScore(uniqueUserCount, totalEventCount, proposal.riskScore);
      
      await db.update(toolProposals)
        .set({ 
          impactScore,
          updatedAt: new Date(),
        })
        .where(eq(toolProposals.id, proposal.id));

      console.log(`[Tool Discovery] 🎯 Convergence reached for "${proposal.title}"`);
      console.log(`  - Unique users: ${uniqueUserCount}`);
      console.log(`  - Total events: ${totalEventCount}`);
      console.log(`  - Risk score: ${proposal.riskScore}`);
      console.log(`  - Impact score: ${impactScore}`);
    }

    return hasConverged;

  } catch (error) {
    console.error("[Tool Discovery] Error checking convergence:", error);
    return false;
  }
}

// ============================================================================
// REGRET TRACKING
// ============================================================================

export interface RegretEvent {
  userId: string;
  originalDecision: string;
  originalTimestamp: string;
  regretStatement: string;
  consequences: string[];
  missingInfo: string[];
  preventionPattern: string;
}

export async function trackRegret(regret: RegretEvent): Promise<void> {
  try {
    // Find related proposal by prevention pattern
    const proposal = await db.query.toolProposals.findFirst({
      where: eq(toolProposals.fingerprint, regret.preventionPattern),
    });

    if (proposal) {
      // Add regret as evidence
      await db.insert(toolProposalEvidence).values({
        proposalId: proposal.id,
        userId: parseInt(regret.userId) || null,
        sourceType: 'regret',
        sourceRef: regret.originalTimestamp,
        snippet: redactSnippet(regret.regretStatement),
        metadata: {
          originalDecision: regret.originalDecision,
          consequences: regret.consequences,
          missingInfo: regret.missingInfo,
        },
      });

      // Boost risk score for regret events
      await db.update(toolProposals)
        .set({
          riskScore: sql`LEAST(${toolProposals.riskScore} + 2, 10)`,
          updatedAt: new Date(),
        })
        .where(eq(toolProposals.id, proposal.id));

      // Re-check convergence (regret events accelerate convergence)
      await checkConvergence(proposal.fingerprint);
    }

  } catch (error) {
    console.error("[Tool Discovery] Error tracking regret:", error);
  }
}

// ============================================================================
// ADMIN QUERIES
// ============================================================================

export async function getProposedBlueprints(): Promise<ToolProposal[]> {
  return await db.query.toolProposals.findMany({
    where: eq(toolProposals.status, 'proposed'),
    with: {
      evidence: {
        limit: 10,
        orderBy: desc(toolProposalEvidence.createdAt),
      },
    },
    orderBy: [
      desc(toolProposals.riskScore),
      desc(toolProposals.impactScore),
    ],
  });
}

export async function getProposalById(id: number) {
  return await db.query.toolProposals.findFirst({
    where: eq(toolProposals.id, id),
    with: {
      evidence: {
        orderBy: desc(toolProposalEvidence.createdAt),
      },
      decisions: {
        orderBy: desc(toolProposalDecisions.createdAt),
      },
    },
  });
}

export async function approveBlueprint(
  proposalId: number,
  adminUserId: number,
  notes?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Record decision
    await tx.insert(toolProposalDecisions).values({
      proposalId,
      decidedByUserId: adminUserId,
      decision: 'approved',
      notes,
    });

    // Update proposal status and mark as institutionalized
    await tx.update(toolProposals)
      .set({ 
        status: 'approved',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(toolProposals.id, proposalId));
  });
}

export async function rejectBlueprint(
  proposalId: number,
  adminUserId: number,
  reason?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Record decision
    await tx.insert(toolProposalDecisions).values({
      proposalId,
      decidedByUserId: adminUserId,
      decision: 'rejected',
      notes: reason,
    });

    // Update proposal status
    await tx.update(toolProposals)
      .set({ 
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(toolProposals.id, proposalId));
  });
}

export async function deferBlueprint(
  proposalId: number,
  adminUserId: number,
  notes?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Record decision
    await tx.insert(toolProposalDecisions).values({
      proposalId,
      decidedByUserId: adminUserId,
      decision: 'deferred',
      notes,
    });

    // Update proposal status
    await tx.update(toolProposals)
      .set({ 
        status: 'deferred',
        updatedAt: new Date(),
      })
      .where(eq(toolProposals.id, proposalId));
  });
}

export async function mergeBlueprints(
  proposalId: number,
  mergeIntoId: number,
  adminUserId: number,
  notes?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Record decision
    await tx.insert(toolProposalDecisions).values({
      proposalId,
      decidedByUserId: adminUserId,
      decision: 'merged',
      mergedIntoId: mergeIntoId,
      notes,
    });

    // Update proposal status
    await tx.update(toolProposals)
      .set({ 
        status: 'merged',
        updatedAt: new Date(),
      })
      .where(eq(toolProposals.id, proposalId));

    // Transfer evidence to merged proposal
    await tx.update(toolProposalEvidence)
      .set({ proposalId: mergeIntoId })
      .where(eq(toolProposalEvidence.proposalId, proposalId));
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function inferToolName(goal: string, missingCapability: string): string {
  // Extract meaningful name from capability string
  const capMatch = missingCapability.match(/Missing tool: (.+)/);
  if (capMatch) {
    return capMatch[1]
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Fallback: use first few words of goal
  return goal
    .split(' ')
    .slice(0, 4)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function inferProblemStatement(pattern: PatternInstance): string {
  return `Users need to ${pattern.inferredGoal.toLowerCase()} but Scout lacks a dedicated tool. Currently using ad-hoc workaround: ${pattern.workaroundUsed}`;
}

function calculateRiskScore(risks: string[]): number {
  // Score from 0-10 based on risk types
  let score = 0;
  
  for (const risk of risks) {
    if (risk.includes('financial')) score += 3;
    if (risk.includes('irreversible')) score += 3;
    if (risk.includes('safety')) score += 4;
    if (risk.includes('legal')) score += 3;
    if (risk.includes('trust')) score += 2;
  }
  
  return Math.min(score, 10);
}

function calculateImpactScore(uniqueUsers: number, totalEvents: number, riskScore: number): number {
  // Score from 0-10 based on reach and risk
  const reachScore = Math.min(uniqueUsers * 2, 6); // Max 6 points for reach
  const riskImpact = Math.min(riskScore * 0.4, 4); // Max 4 points from risk
  
  return Math.min(Math.round(reachScore + riskImpact), 10);
}

function redactSnippet(text: string): string {
  // Redact PII and keep first 200 chars
  const truncated = text.slice(0, 200);
  
  // Redact patterns that look like PII
  return truncated
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN-REDACTED]')
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE-REDACTED]')
    .replace(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g, '[EMAIL-REDACTED]')
    .replace(/\b\d{16}\b/g, '[CARD-REDACTED]');
}
