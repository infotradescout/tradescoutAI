/**
 * Business Profile v1 Types
 * PHASE 3d-C: Published Presence Surface
 * 
 * Published profiles are derived from profileDraft at publish time.
 * Once published, they become the canonical source of truth for public display.
 */

export interface BusinessProfile {
  id: string;
  userId: string;
  slug: string;                    // Unique URL identifier (from businessName || userName)
  name: string;                    // Business name or user display name
  headline?: string | null;        // Headline/tagline (60–80 chars) — PHASE 3e-A.1
  description?: string | null;     // About text (optional)
  services?: string[] | null;      // List of services (3–5 bullets, 40–80 chars each) — PHASE 3e-A.1
  countyFips: string;              // Primary county FIPS code
  countyName?: string | null;      // Primary county name
  city?: string | null;            // City name (optional)
  stateCode: string;               // State abbreviation (e.g., "TX")
  serviceAreas: string[];          // Array of county FIPS codes
  website?: string | null;         // External website (optional)
  createdAt: string;               // ISO timestamp
  updatedAt: string;               // ISO timestamp
  publishedAt: string;             // ISO timestamp (when first published)
}

/**
 * Payload for creating/updating a business profile
 */
export interface PublishProfilePayload {
  name: string;
  description?: string | null;
  countyFips: string;
  countyName?: string | null;
  city?: string | null;
  stateCode: string;
  serviceAreas?: string[];
  website?: string | null;
}

/**
 * Payload for updating an existing business profile
 */
export interface UpdateProfilePayload {
  name?: string;
  headline?: string | null;        // PHASE 3e-A.1
  description?: string | null;
  services?: string[] | null;      // PHASE 3e-A.1
  city?: string | null;
  serviceAreas?: string[];
  website?: string | null;
}

/**
 * Response from profile publish endpoint
 */
export interface PublishProfileResponse {
  success: boolean;
  profile: BusinessProfile;
  slug: string;
}
