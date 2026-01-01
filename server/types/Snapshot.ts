/**
 * Scout Snapshot Model
 * 
 * Replaces hard-coded roles with dynamic, signal-inferred identity.
 * Snapshots decay over time and refresh on high-signal activity.
 * 
 * B1 Design: Define the model
 * B2 Implementation: Integrate into Scout decisions
 * D2 Usage: Guide first-time users via snapshot confidence
 */

export type SnapshotRole = 'homeowner' | 'contractor' | 'vendor' | 'admin';
export type DecisionConfidence = 'low' | 'medium' | 'high';

export interface SnapshotSignals {
  /** From A2 signup */
  roleIntent?: 'homeowner' | 'contractor' | 'other';
  
  /** Inferred from messages */
  messagePatterns?: string[];
  
  /** Inferred from user actions */
  recentActions?: string[];
  
  /** Page navigation sequence */
  pageSequence?: string[];
  
  /** User badges (verified, founder, etc) */
  verifiedBadges?: string[];
  
  /** Has business profile */
  businessProfile?: boolean;
  
  /** Activity level */
  activityFrequency?: 'inactive' | 'occasional' | 'active';
  
  /** Account age in days */
  accountAge?: number;
}

export interface Snapshot {
  // Identity
  userId: string;
  snapshotId: string;
  computedAt: Date;
  
  // Inferred role (replaces hard-coded user.role)
  primaryRole: SnapshotRole;
  secondaryRoles: SnapshotRole[];
  
  // Confidence in role inference
  primaryRoleConfidence: number; // 0.0 to 1.0
  secondaryRoleConfidences: Record<SnapshotRole, number>;
  
  // Scout decision confidence: how sure are we about recommendations for this user?
  decisionConfidence: DecisionConfidence;
  
  // Signals that contributed to inference
  signals: SnapshotSignals;
  
  // Lifecycle
  validUntil: Date;
  confidenceDecayRate: number; // per day (typically 0.05)
  
  // Versioning & rollout control
  version: string;
  experimental?: boolean;
  
  // Metadata
  tags?: string[]; // "first_session", "verified", "active", etc
}

/**
 * Snapshot inference context
 * Passed to inferSnapshot() to compute a new snapshot
 */
export interface SnapshotInferenceContext {
  message?: string;
  recentActivity?: Array<{
    type: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>;
  pageSequence?: string[];
  profile?: {
    roleIntent?: 'homeowner' | 'contractor' | 'other';
    verifiedBadges?: string[];
    businessProfile?: boolean;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Request to compute/refresh a snapshot
 */
export interface ComputeSnapshotRequest {
  userId: string;
  context?: SnapshotInferenceContext;
  forceRefresh?: boolean;
}

/**
 * Response when snapshot is computed
 */
export interface ComputeSnapshotResponse {
  snapshot: Snapshot;
  refreshed: boolean;
  reason?: 'expired' | 'low_confidence' | 'high_signal_activity' | 'forced';
}
