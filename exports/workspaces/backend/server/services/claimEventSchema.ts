/**
 * Claim Event Schema – Phase 3 Claim-First Intake
 *
 * GOVERNANCE:
 * - Write-only table for canonical claim intent records
 * - Insert-only semantics; no updates to claim itself
 * - Soft invalidation only (never delete)
 * - Ships dark: no reads, no aggregation, no UI visibility
 * - Idempotent writes: one claim per (user_id, claim_type, county_fips, source) scope
 *
 * INVARIANTS:
 * - user_id must exist in users table (FK enforced)
 * - county_fips must be 5-digit code, must exist in counties table
 * - claim_type must be one of 6 canonical types (enum-locked)
 * - source must be one of 4 sources (enum-locked)
 * - claim_timestamp cannot be in future, cannot precede user creation
 * - idempotency_key = hash(user_id + claim_type + county_fips + source)
 *
 * REPLAY SAFETY:
 * - Unique constraint on (user_id, claim_type, county_fips, source)
 * - INSERT ... ON CONFLICT DO NOTHING pattern
 * - If duplicate write detected, return existing claim id (no error)
 * - Timestamp immutable after insert
 *
 * SOFT INVALIDATION:
 * - invalidated_at: if set, claim is no longer active
 * - invalidation_reason: why it was invalidated (user_requested, admin_invalidated, etc.)
 * - Never delete; always UPDATE only
 */

// Canonical claim types – frozen, no runtime extensions
export enum ClaimType {
  WANTS_TO_HIRE = 'wantsToHire',
  PROVIDES_SERVICES = 'providesServices',
  REPRESENTS_BUSINESS = 'representsBusiness',
  POSTS_DEALS = 'postsDeals',
  COMMUNITY_BUILDER = 'communityBuilder',
  EXPLORING = 'exploring',
}

// Claim sources – where the claim originated
export enum ClaimSource {
  SIGNUP = 'signup',           // From onboarding flow
  DIRECT_CLAIM = 'direct_claim', // User claimed directly in app
  IMPORT = 'import',           // From backfill/import job
  ADMIN = 'admin',             // From admin OS
  SCOUT_INFERRED = 'scout_inferred', // Inferred by Scout AI
}

// Canonical claim event interface
export interface ClaimEvent {
  id: string;
  userId: string;
  claimType: ClaimType;
  countyFips: string;
  countyName: string;
  source: ClaimSource;
  claimTimestamp: Date;
  idempotencyKey: string;
  invalidatedAt: Date | null;
  invalidationReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// Write request contract
export interface WriteClaimEventRequest {
  userId: string;
  claimType: ClaimType;
  countyFips: string;
  countyName: string;
  source: ClaimSource;
  claimTimestamp: Date;
  metadata?: Record<string, unknown>;
}

// Write result contract
export interface WriteClaimEventResult {
  success: boolean;
  claimId?: string;
  isDuplicate?: boolean;
  error?: string;
  reason?: 'duplicate' | 'validation_error' | 'user_not_found' | 'county_not_found' | 'disabled' | 'internal_error';
}

// Invalidation request contract
export interface InvalidateClaimEventRequest {
  claimId: string;
  reason: string;
}

// Invalidation result contract
export interface InvalidateClaimEventResult {
  success: boolean;
  error?: string;
}

/**
 * SQL TABLE DEFINITION (for migration)
 *
 * CREATE TABLE claim_events (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 *   claim_type TEXT NOT NULL,
 *   county_fips TEXT NOT NULL,
 *   county_name TEXT NOT NULL,
 *   source TEXT NOT NULL,
 *   claim_timestamp TIMESTAMP NOT NULL,
 *   idempotency_key TEXT NOT NULL,
 *   invalidated_at TIMESTAMP,
 *   invalidation_reason TEXT,
 *   metadata TEXT, -- JSON string
 *   created_at TIMESTAMP NOT NULL DEFAULT NOW(),
 *   UNIQUE (user_id, claim_type, county_fips, source),
 *   CONSTRAINT valid_claim_type CHECK (claim_type IN ('wantsToHire', 'providesServices', 'representsBusiness', 'postsDeals', 'communityBuilder', 'exploring')),
 *   CONSTRAINT valid_source CHECK (source IN ('signup', 'direct_claim', 'import', 'admin')),
 *   CONSTRAINT valid_county_fips CHECK (county_fips ~ '^[0-9]{5}$'),
 *   CONSTRAINT claim_timestamp_not_future CHECK (claim_timestamp <= NOW()),
 *   CONSTRAINT invalidation_consistency CHECK ((invalidated_at IS NULL AND invalidation_reason IS NULL) OR (invalidated_at IS NOT NULL AND invalidation_reason IS NOT NULL))
 * );
 *
 * CREATE INDEX idx_claim_events_county_fips ON claim_events(county_fips);
 * CREATE INDEX idx_claim_events_user_id_created_at ON claim_events(user_id, created_at);
 * CREATE INDEX idx_claim_events_created_at ON claim_events(created_at);
 * CREATE INDEX idx_claim_events_invalidated_at ON claim_events(invalidated_at);
 * CREATE INDEX idx_claim_events_claim_type ON claim_events(claim_type);
 * CREATE INDEX idx_claim_events_source ON claim_events(source);
 */

// Helpers for enum validation
export function isValidClaimType(value: string): value is ClaimType {
  return Object.values(ClaimType).includes(value as ClaimType);
}

export function isValidClaimSource(value: string): value is ClaimSource {
  return Object.values(ClaimSource).includes(value as ClaimSource);
}

export function isValidCountyFips(fips: string): boolean {
  return /^[0-9]{5}$/.test(fips);
}

// Idempotency key generator
export function generateIdempotencyKey(userId: string, claimType: ClaimType, countyFips: string, source: ClaimSource): string {
  // Simple deterministic key; could use crypto.hash in production
  return `${userId}|${claimType}|${countyFips}|${source}`;
}

// Claim type descriptions for validation messages
export const CLAIM_TYPE_DESCRIPTIONS: Record<ClaimType, string> = {
  [ClaimType.WANTS_TO_HIRE]: 'Wants to hire contractors or services',
  [ClaimType.PROVIDES_SERVICES]: 'Provides services or products',
  [ClaimType.REPRESENTS_BUSINESS]: 'Represents a business',
  [ClaimType.POSTS_DEALS]: 'Posts deals or promotions',
  [ClaimType.COMMUNITY_BUILDER]: 'Wants to build community trust',
  [ClaimType.EXPLORING]: 'Exploring the platform',
};

// Claim source descriptions for validation messages
export const CLAIM_SOURCE_DESCRIPTIONS: Record<ClaimSource, string> = {
  [ClaimSource.SIGNUP]: 'From onboarding flow',
  [ClaimSource.DIRECT_CLAIM]: 'User claimed directly',
  [ClaimSource.IMPORT]: 'From backfill import',
  [ClaimSource.ADMIN]: 'From admin OS',
  [ClaimSource.SCOUT_INFERRED]: 'Inferred by Scout AI',
};
