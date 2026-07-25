/**
 * Phase C indexability contract fixtures — encoded from Phase B live crawls (2026-07-25).
 * Used by contract tests that fail closed until Phase E remediation lands.
 * Sources:
 * - crawl-1: artifacts/evidence/phase-b-lite/phase-b-lite-live.latest.md
 * - crawl-2: artifacts/evidence/phase-b-lite-live-crawl-report.md (run a5d47ad6)
 */

/** Live samples: 200 + noindex,nofollow but still listed in sitemap-directory-businesses-0.xml */
export const PHASE_C_STALE_BUSINESS_SITEMAP_SAMPLES = [
  "2h-v-construction-services-llc-2",
  "360-reflective-renovations-llc",
  "3pa-coastal-renovation",
] as const;

/** crawl-2: ~87.5% of sampled /business/* noindex while all 146 remain sitemap-listed */
export const PHASE_C_STALE_BUSINESS_NOINDEX_SAMPLE_RATE = 0.875;

/** crawl-2: minority of /business/* remain index,follow (not stale) — must stay sitemap-eligible when crawlable */
export const PHASE_C_INDEXABLE_BUSINESS_SAMPLES = ["a-b-septic-tank-services"] as const;

/** Live sample: 404 + X-Robots-Tag noindex but still in sitemap-homescout-listings.xml (crawl-1) */
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

/** crawl-2: robots.txt Disallow paths that still return 200 + index,follow SPA shell before CSR */
export const PHASE_C_ROBOTS_META_CONFLICT_PATHS = ["/scout", "/auth", "/dashboard"] as const;

/** crawl-2: admin profile indexed + sitemap-listed — must exclude from sitemap + indexability */
export const PHASE_C_ADMIN_PROFILE_SITEMAP_LEAK = "super-admin";

/** crawl-2: no X-Robots-Tag on sampled public URLs (meta-driven indexing signals) */
export const PHASE_C_LIVE_X_ROBOTS_TAG_ABSENT_ON_PUBLIC = true;

/** Published /u profile live samples — correct indexable baseline */
export const PHASE_C_PUBLISHED_U_PROFILE_SAMPLES = [
  "issa-build",
  "jrs-auto-glass",
  "la-plumbing-solutions",
] as const;
