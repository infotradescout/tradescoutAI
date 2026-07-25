/**
 * Phase C indexability contract fixtures — encoded from Phase B live crawl (2026-07-25).
 * Used by contract tests that fail closed until Phase E remediation lands.
 * Source: artifacts/evidence/phase-b-lite/phase-b-lite-live.latest.md
 */

/** Live samples: 200 + noindex,nofollow but still listed in sitemap-directory-businesses-0.xml */
export const PHASE_C_STALE_BUSINESS_SITEMAP_SAMPLES = [
  "2h-v-construction-services-llc-2",
  "360-reflective-renovations-llc",
  "3pa-coastal-renovation",
] as const;

/** Live sample: 404 + X-Robots-Tag noindex but still in sitemap-homescout-listings.xml */
export const PHASE_C_DEAD_HOMESCOUT_LISTING_ID = "999d5c07-5779-4b74-86ed-bb2e47f7f5db";

/** Live samples: corrupted city slugs indexed and sitemap-listed */
export const PHASE_C_CORRUPTED_CITY_SLUG_SAMPLES = [
  "-agnolia-prings",
  "-airhope",
  "-araland",
] as const;

/** Live samples: Googlebot SSR index,follow with substantiveListings=false */
export const PHASE_C_EMPTY_DIRECTORY_SHELL_SAMPLES = [
  "/trade/electrical",
  "/trade/electrical/fl/bay",
  "/county/al/baldwin",
  "/city/al/-agnolia-prings",
  "/best/electrical/fl/bay",
] as const;

/** Live samples: near-duplicate landing variants indexable but not in core sitemap */
export const PHASE_C_NEAR_DUPE_LANDING_VARIANTS = [
  "/landing/homeowner-hvac",
  "/landing/supplier-addition-contractor",
] as const;

/** Deliberately unsupported slug — must not be indexable 200 in Phase C contract */
export const PHASE_C_UNSUPPORTED_LANDING_SLUG = "phase-c-unsupported-slug-contract-audit";

/** Account/auth/scout paths — must be noindex and absent from sitemap */
export const PHASE_C_PRIVATE_APP_SHELL_PATHS = [
  "/dashboard",
  "/account",
  "/auth/login",
  "/scout",
] as const;

/** Published /u profile live samples — correct indexable baseline */
export const PHASE_C_PUBLISHED_U_PROFILE_SAMPLES = [
  "issa-build",
  "jrs-auto-glass",
  "la-plumbing-solutions",
] as const;
