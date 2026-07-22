/**
 * Business Profile v1 Types
 * PHASE 3d-C: Published Presence Surface
 *
 * Published profiles are derived from profileDraft at publish time.
 * Once published, they become the canonical source of truth for public display.
 */

import type { PublicBusinessListingCard } from "./publicBusinessListing";

export interface BusinessProfileSeoMeta {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface BusinessProfileCta {
  label?: string | null;
  kind?: "message" | "direct_connect" | "quote" | "booking" | "marketplace" | null;
}

export interface BusinessProfileCtaConfig {
  primary?: BusinessProfileCta | null;
  secondary?: BusinessProfileCta | null;
}

export interface BusinessProfileSections {
  about?: boolean;
  rolesAndBadges?: boolean;
  stats?: boolean;
  services?: boolean;
  marketplaceListings?: boolean;
  reviews?: boolean;
  communityActivity?: boolean;
  contactCard?: boolean;
}

export interface BusinessProfileTheme {
  preset?: string | null;
  customColors?: {
    primary?: string | null;
    secondary?: string | null;
    background?: string | null;
    text?: string | null;
  } | null;
}

export interface BusinessProfileBookingSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label?: string | null;
  active?: boolean;
}

export interface BusinessProfilePricingRow {
  id: string;
  name: string;
  priceLabel: string;
  description?: string | null;
}

export interface BusinessProfileBookingConfig {
  enabled?: boolean;
  paidBookings?: boolean;
  bookingPriceUsd?: number;
  calendarVisibility?: "public" | "private";
  timezone?: string | null;
  slots?: BusinessProfileBookingSlot[];
  pricingTableEnabled?: boolean;
  pricingRows?: BusinessProfilePricingRow[];
}

export interface BusinessProfileContentBlock {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  slug: string; // Unique URL identifier (from businessName || userName)
  name: string; // Business name or user display name
  headline?: string | null; // Headline/tagline (60–80 chars) — PHASE 3e-A.1
  description?: string | null; // About text (optional)
  services?: string[] | null; // List of services (3–5 bullets, 40–80 chars each) — PHASE 3e-A.1
  countyFips: string; // Primary county FIPS code
  countyName?: string | null; // Primary county name
  city?: string | null; // City name (optional)
  address?: string | null; // Street/business address (optional)
  zipCode?: string | null; // Postal code (optional)
  stateCode: string; // State abbreviation (e.g., "TX")
  serviceAreas: string[]; // Array of county FIPS codes
  website?: string | null; // External website (optional)
  seoMeta?: BusinessProfileSeoMeta | null;
  ctaConfig?: BusinessProfileCtaConfig | null;
  contentBlocks?: BusinessProfileContentBlock[] | null;
  profileSections?: BusinessProfileSections | null;
  theme?: BusinessProfileTheme | null;
  bookingConfig?: BusinessProfileBookingConfig | null;
  /** Public-safe, active Exchange items shown on the business profile. */
  marketplaceListings?: PublicBusinessListingCard[];
  visibility?: "public" | "private";
  customDomain?: string | null;
  customDomainVerification?: {
    state: "unverified" | "pending" | "verified" | "failed";
    /** Exact public profile this ownership proof is allowed to publish to. */
    profileId?: string | null;
    token?: string | null;
    verifiedAt?: string | null;
    lastCheckedAt?: string | null;
    error?: string | null;
  } | null;
  verificationStatus?: string | null;
  addressVerified?: boolean;
  cvsScore?: number | string | null;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  publishedAt: string; // ISO timestamp (when first published)
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
  address?: string | null;
  zipCode?: string | null;
  stateCode: string;
  serviceAreas?: string[];
  website?: string | null;
  seoMeta?: BusinessProfileSeoMeta | null;
  ctaConfig?: BusinessProfileCtaConfig | null;
  contentBlocks?: BusinessProfileContentBlock[] | null;
  profileSections?: BusinessProfileSections | null;
  theme?: BusinessProfileTheme | null;
  bookingConfig?: BusinessProfileBookingConfig | null;
  visibility?: "public" | "private";
}

/**
 * Payload for updating an existing business profile
 */
export interface UpdateProfilePayload {
  name?: string;
  headline?: string | null; // PHASE 3e-A.1
  description?: string | null;
  services?: string[] | null; // PHASE 3e-A.1
  countyFips?: string;
  countyName?: string | null;
  city?: string | null;
  stateCode?: string;
  address?: string | null;
  zipCode?: string | null;
  serviceAreas?: string[];
  website?: string | null;
  seoMeta?: BusinessProfileSeoMeta | null;
  ctaConfig?: BusinessProfileCtaConfig | null;
  contentBlocks?: BusinessProfileContentBlock[] | null;
  profileSections?: BusinessProfileSections | null;
  theme?: BusinessProfileTheme | null;
  bookingConfig?: BusinessProfileBookingConfig | null;
  visibility?: "public" | "private";
}

/**
 * Response from profile publish endpoint
 */
export interface PublishProfileResponse {
  success: boolean;
  profile: BusinessProfile;
  slug: string;
}
