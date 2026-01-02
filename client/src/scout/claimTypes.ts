/**
 * Claim Types & Schemas for Scout Onboarding Inference
 * Phase 3d-A: Scout Post-Signup Onboarding with Claim Inference
 * 
 * Contract:
 * - Claims are intent-level (what user wants to do), not identity labels
 * - Inference produces structured suggestions from free-form userIntent text
 * - User confirms via checkbox UI before any claims are written
 * - Confirmed claims drive explicit routing via routeFromClaims()
 */

/**
 * ClaimType union - all allowed claim types for inference
 */
export type ClaimType =
  // CORE - Primary intent categories
  | 'exploring'
  | 'find_help'
  | 'offer_services'
  | 'represent_business'
  | 'buy_sell_locally'
  | 'community_participation'
  // WORK_CONTEXT - Specific project/work types
  | 'home_project'
  | 'commercial_project'
  | 'property_management'
  | 'emergency_service'
  | 'design_planning'
  | 'inspection_evaluation'
  | 'maintenance_recurring'
  // VERTICAL - Industry/business categories
  | 'construction_trades'
  | 'food_business'
  | 'hospitality'
  | 'real_estate'
  | 'automotive'
  | 'nonprofit'
  | 'technology_startup'
  // PARTICIPATION - Community engagement types
  | 'wants_recommendations'
  | 'gives_recommendations'
  | 'posts_deals'
  | 'organizes_events'
  | 'builds_community'
  // FUTURE_INTENT - Growth/visibility goals
  | 'seeking_leads'
  | 'seeking_visibility'
  | 'seeking_partnerships'
  | 'seeking_tools';

/**
 * Single claim suggestion from inference
 */
export interface ClaimSuggestion {
  claimType: ClaimType;
  confidence: number; // 0.0–1.0
  evidence: string;   // Short reason tied to user's text
}

/**
 * Output from Scout inference prompt
 */
export interface ClaimInferenceOutput {
  suggestions: ClaimSuggestion[]; // 1–5 max
  summary: string;                // One sentence describing what user likely wants
  followups: string[];            // 0–2 clarifying questions (only if confidence <0.70)
}

/**
 * Single checkbox option in confirmation UI
 */
export interface ClaimConfirmationOption {
  id: string;              // Stable UI id, e.g., "opt_offer_services"
  claimType: ClaimType;
  label: string;           // User-facing text
  description?: string;    // Optional short subtext
  confidence: number;      // Bubbled up from inference
  defaultChecked: boolean; // true for top 1–2 high confidence options
}

/**
 * Confirmation card rendered by Scout (2nd message in onboarding flow)
 */
export interface ClaimConfirmationCard {
  kind: 'claim_confirmation';
  title: string;           // e.g., "Quick confirmation"
  preface: string;         // e.g., "Based on what you wrote, it sounds like…"
  options: ClaimConfirmationOption[];
  secondaryAction?: {
    label: string;         // e.g., "Edit what I wrote"
    action: 'edit_intent';
  };
  skipAction: {
    label: string;         // e.g., "Skip for now"
    action: 'skip';
  };
}

/**
 * Payload for writing confirmed claims (after user confirmation)
 */
export interface ConfirmedClaimsPayload {
  userId: string;
  countyFips?: string | null;
  confirmedClaimTypes: ClaimType[];
  source: 'scout_inferred';
  metadata: {
    confidenceByClaim: Record<string, number>;
    evidenceByClaim: Record<string, string>;
    textSource: 'provisional_userIntent';
    rawUserIntentText: string;
  };
}

/**
 * Routing decision result from confirmed claims
 */
export interface RoutingDecision {
  path: string;
  reason: string;
}

/**
 * Route from confirmed claims to destination
 * Uses existing routes only - no placeholders
 */
export function routeFromClaims(claims: ClaimType[]): RoutingDecision {
  const has = (c: ClaimType) => claims.includes(c);

  // Empty or exploring only → community feed (neutral)
  if (!claims.length || (claims.length === 1 && has('exploring'))) {
    return { path: '/community', reason: 'exploring_only' };
  }

  // Business + services → business profile first
  if (has('represent_business') && has('offer_services')) {
    return { path: '/business-listing', reason: 'business_plus_services' };
  }

  // Conflicting: both hire and offer → Scout follow-up
  if (has('offer_services') && has('find_help')) {
    return { path: '/scout?onboarding=true&step=pick_focus', reason: 'both_hire_and_offer' };
  }

  // Primary routes
  if (has('offer_services')) {
    return { path: '/contractor-dashboard', reason: 'offer_services' };
  }

  if (has('find_help')) {
    return { path: '/direct-connect', reason: 'find_help' };
  }

  if (has('represent_business')) {
    return { path: '/business-listing', reason: 'represent_business' };
  }

  if (has('posts_deals')) {
    return { path: '/business-listing', reason: 'posts_deals' };
  }

  if (has('community_participation') || has('wants_recommendations') || has('gives_recommendations')) {
    return { path: '/community', reason: 'community' };
  }

  // Fallback to neutral
  return { path: '/community', reason: 'fallback_neutral' };
}

/**
 * User-facing labels for claim types (for UI display)
 */
export const CLAIM_LABELS: Record<ClaimType, string> = {
  // CORE
  exploring: 'Just exploring',
  find_help: 'Find contractors or services',
  offer_services: 'Offer my services',
  represent_business: 'Promote my business',
  buy_sell_locally: 'Buy or sell locally',
  community_participation: 'Participate in community',
  // WORK_CONTEXT
  home_project: 'Working on a home project',
  commercial_project: 'Working on a commercial project',
  property_management: 'Managing properties',
  emergency_service: 'Need emergency service',
  design_planning: 'Design or planning work',
  inspection_evaluation: 'Inspection or appraisal',
  maintenance_recurring: 'Ongoing maintenance',
  // VERTICAL
  construction_trades: 'Construction trades',
  food_business: 'Food or restaurant business',
  hospitality: 'Hospitality or events',
  real_estate: 'Real estate',
  automotive: 'Automotive',
  nonprofit: 'Non-profit organization',
  technology_startup: 'Tech startup',
  // PARTICIPATION
  wants_recommendations: 'Looking for recommendations',
  gives_recommendations: 'Give recommendations',
  posts_deals: 'Post deals or promotions',
  organizes_events: 'Organize events',
  builds_community: 'Build community',
  // FUTURE_INTENT
  seeking_leads: 'Find new customers',
  seeking_visibility: 'Increase visibility',
  seeking_partnerships: 'Find partnerships',
  seeking_tools: 'Access business tools',
};
