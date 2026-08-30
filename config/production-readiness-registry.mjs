export const READINESS_STATES = Object.freeze([
  "disabled",
  "internal_only",
  "closed_beta",
  "public_beta",
  "production",
  "retired",
]);

export const PR_DISPOSITIONS = Object.freeze(["extract", "rebuild", "close", "hold"]);

export const OPEN_PR_DISPOSITIONS = Object.freeze([
  { number: 409, disposition: "extract", owner: "admin-os", reason: "Reapply the read-only truth workspace to current Admin OS contracts." },
  { number: 396, disposition: "rebuild", owner: "identity", reason: "Profile account entry is required, but 51 stale commits cannot define the one-identity model." },
  { number: 318, disposition: "hold", owner: "stone-core", reason: "Private offers remain bounded until the shared identity and canonical offer models are settled." },
  { number: 316, disposition: "extract", owner: "public-profiles", reason: "Preserve profile-specific install identity without replaying stale profile and server files." },
  { number: 305, disposition: "rebuild", owner: "public-profiles", reason: "Reconcile Dean's current profile and booking job against the latest profile framework." },
  { number: 265, disposition: "close", owner: "release-control", reason: "The broad remediation branch predates hundreds of main commits and is not a coherent release." },
  { number: 255, disposition: "close", owner: "stone-core", reason: "Old JW mobile polish must not overwrite the current catalog and visual architecture." },
  { number: 254, disposition: "extract", owner: "trust-cvs", reason: "Reconcile only the still-needed recommendation binding against current migrations and profile authority." },
  { number: 223, disposition: "close", owner: "release-control", reason: "pnpm lock and historical evidence are obsolete in the npm-authoritative repository." },
  { number: 222, disposition: "rebuild", owner: "direct-connect", reason: "Recover valid notification and profile entry behavior through the current Direct Connect spine." },
  { number: 221, disposition: "close", owner: "stone-core", reason: "The branch includes hundreds of bundled stone images and conflicts with server-side media storage." },
  { number: 219, disposition: "extract", owner: "public-profiles", reason: "Reconcile public profile authority services without replaying stale route and profile implementations." },
  { number: 218, disposition: "close", owner: "release-control", reason: "pnpm lock is not authoritative for this npm repository." },
  { number: 215, disposition: "rebuild", owner: "direct-connect", reason: "Direct Connect recovery is critical but must be rebuilt from the current schema, routes, and admin surfaces." },
  { number: 214, disposition: "extract", owner: "exchange", reason: "Retain valid profile-catalog and About contracts only after current route and inventory reconciliation." },
  { number: 213, disposition: "extract", owner: "discovery", reason: "Compare indexability fixes with current organic-growth work and retain only missing contracts." },
  { number: 211, disposition: "close", owner: "public-profiles", reason: "The narrow ISSA presentation change is stale and must not overwrite the current profile theme." },
]);

export const CANONICAL_OBJECTS = Object.freeze({
  user_identity: { owner: "identity", source: "shared/schema.ts", authority: "server" },
  persona: { owner: "identity", source: "shared/schema.ts", authority: "server" },
  business: { owner: "business-platform", source: "shared/schema.ts", authority: "server" },
  public_profile: { owner: "public-profiles", source: "shared/schema.ts", authority: "server" },
  work_request: { owner: "direct-connect", source: "shared/schema.ts", authority: "server" },
  assignment: { owner: "direct-connect", source: "shared/schema.ts", authority: "server" },
  response: { owner: "direct-connect", source: "shared/schema.ts", authority: "server" },
  conversation: { owner: "messaging", source: "shared/schema.ts", authority: "server" },
  contact_release_gate: { owner: "direct-connect", source: "shared/schema.ts", authority: "server" },
  notification: { owner: "notifications", source: "shared/schema.ts", authority: "server" },
  outcome: { owner: "direct-connect", source: "shared/schema.ts", authority: "server" },
  home: { owner: "homeid", source: "shared/schema.ts", authority: "server" },
  inventory_item: { owner: "inventory", source: "shared/schema.ts", authority: "server" },
  listing: { owner: "exchange", source: "shared/schema.ts", authority: "server" },
  offer: { owner: "offers", source: "shared/schema.ts", authority: "server" },
  order: { owner: "orders", source: "shared/schema.ts", authority: "server" },
  payment: { owner: "payments", source: "shared/schema.ts", authority: "server" },
  trust_record: { owner: "trust-cvs", source: "shared/schema.ts", authority: "server" },
});

const family = (id, match, metadata) => Object.freeze({ id, match, ...metadata });

export const CLIENT_ROUTE_FAMILIES = Object.freeze([
  family("admin", /^\/admin(?:\/|$)|^\/administrative-dashboard$/, {
    owner: "admin-os", audience: "administrator", roles: ["ops_admin", "super_admin"],
    canonicalObject: "user_identity", job: "Operate and recover TradeScout", readiness: "internal_only",
  }),
  family("auth", /^\/(?:auth\/|login|logout|signup|register|create-account|verify-email|reset-password|check-email|onboarding|pre-scout-setup|invite|unauthorized)/, {
    owner: "identity", audience: "account-holder", roles: ["anonymous", "authenticated"],
    canonicalObject: "user_identity", job: "Create, recover, and enter one identity", readiness: "production",
  }),
  family("direct-connect", /^\/(?:direct-connect(?:\/|$)|request-quote|quote$|quote-calculator$|tasks$|messages$|chat$|connections$)/, {
    owner: "direct-connect", audience: "requester-and-provider", roles: ["authenticated"],
    canonicalObject: "work_request", job: "Start and progress protected work", readiness: "production",
  }),
  family("public-profiles", /^\/(?:p|u)(?:\/|$)|^\/business\/(?!requests$)[^/]+(?:\/edit)?$|^\/contractors(?:\/((?!board$|top$)[^/]+))?$|^\/commercial\/p\//, {
    owner: "public-profiles", audience: "public", roles: ["anonymous", "profile_manager"],
    canonicalObject: "public_profile", job: "Find and manage a truthful profile", readiness: "production",
  }),
  family("discovery", /^\/(?:search|advanced-search|find-local-businesses|directory\/businesses|discover-people|best\/|trade\/|city\/|county\/|county-directory|county-hub|maps$|leaderboard$|recommendations$|saved-contractors$)/, {
    owner: "discovery", audience: "public", roles: ["anonymous", "authenticated"],
    canonicalObject: "public_profile", job: "Find a relevant local provider or business", readiness: "public_beta",
  }),
  family("community", /^\/(?:community(?:\/|$)|community-feed(?:\/|$)|community-builder(?:\/|$)|community-moderation$|group(?:\/|$)|groups(?:\/|$))/, {
    owner: "community", audience: "community-member", roles: ["anonymous", "authenticated", "moderator"],
    canonicalObject: "persona", job: "Read and participate in the local community", readiness: "public_beta",
  }),
  family("exchange", /^\/(?:exchange|marketplace|vehicle-marketplace|vehicles|real-estate-marketplace|worker-marketplace|handmade-marketplace|handmade|trade-deals|daily-deals)(?:\/|$)/, {
    owner: "exchange", audience: "buyer-and-seller", roles: ["anonymous", "authenticated"],
    canonicalObject: "listing", job: "Discover or manage a listing", readiness: "public_beta",
  }),
  family("stone", /^\/(?:bidrock|hardrock)(?:\/|$)/, {
    owner: "stone-core", audience: "verified-business", roles: ["anonymous", "verified_business"],
    canonicalObject: "inventory_item", job: "Discover and make private stone offers", readiness: "closed_beta",
  }),
  family("home", /^\/(?:homes|homescout|homescout-listings|homeowner-dashboard|property-listing|foundation)(?:\/|$)/, {
    owner: "homeid-homescout", audience: "property-owner-and-buyer", roles: ["anonymous", "authenticated"],
    canonicalObject: "home", job: "Manage or discover a home", readiness: "closed_beta",
  }),
  family("business-operations", /^\/(?:business-dashboard|business-listing|business-verification|businesses\/apply|business\/requests|claim-my-business|offer-services|provider-setup|crm|lead-management|project-tracker|application-tracker|accounting|finances|payment-history|wallet)(?:\/|$)/, {
    owner: "business-platform", audience: "business-member", roles: ["business_owner", "business_employee"],
    canonicalObject: "business", job: "Operate the correct business", readiness: "closed_beta",
  }),
  family("procurement", /^\/(?:utilities\/supply-run|grunt|supplier\/procurement)(?:\/|$)/, {
    owner: "procurement", audience: "buyer-supplier-and-operator", roles: ["authenticated", "ops_admin"],
    canonicalObject: "order", job: "Request, quote, and track material supply", readiness: "closed_beta",
  }),
  family("account", /^\/(?:profile|profile-purchases|profile-settings|profile-setup|settings|dashboard|dashboard-settings|my-tradescout|notifications|identity-verification|license-verification|insurance-verification|address-verification|background-check|verification)(?:\/|$)/, {
    owner: "identity", audience: "account-holder", roles: ["authenticated"],
    canonicalObject: "user_identity", job: "Manage identity, authority, and account state", readiness: "production",
  }),
  family("scout", /^\/(?:scout|_scout-lite|home$)(?:\/|$)/, {
    owner: "scout", audience: "public-and-account-holder", roles: ["anonymous", "authenticated"],
    canonicalObject: "work_request", job: "Move from a need to the correct TradeScout action", readiness: "public_beta",
  }),
  family("public-information", /^\/(?:about|contact|help|how-it-works|for-businesses|pricing|privacy|privacy-request|terms|trust-model|zero-base-fee|documentation|resource-center|install|giveaway-rules|direct-connect-info|scout-info)(?:\/|$)/, {
    owner: "platform-information", audience: "public", roles: ["anonymous", "authenticated"],
    canonicalObject: "public_profile", job: "Understand TradeScout and its protections", readiness: "production",
  }),
  family("campaigns", /^\/(?:landing|lp|promo|promotions|affiliate|marketing|contractor-promos|contractor-signup|trade-up-for-trade-schools|pensacola|tangipahoa|compare|coffee-company)(?:\/|$)/, {
    owner: "growth", audience: "public", roles: ["anonymous", "authenticated"],
    canonicalObject: "public_profile", job: "Enter a specific TradeScout campaign", readiness: "public_beta",
  }),
  family("staff-tools", /^\/(?:analytics|datasets|api-integrations|compliance|training-center|event-management|story-generator|social-integration|ad-creator|saved-ads|boosts|referral-dashboard|staff-dashboard)(?:\/|$)/, {
    owner: "admin-os", audience: "staff", roles: ["staff", "ops_admin", "super_admin"],
    canonicalObject: "business", job: "Operate internal platform tools", readiness: "internal_only",
  }),
  family("legacy-role-verticals", /^\/(?:car-sales(?:man)?|realtor|helper|hoa)(?:-|\/|$)|^\/(?:helpers|membership-portal|contractor-board|contractors\/board|contractors\/top|commercial-directory)(?:\/|$)/, {
    owner: "legacy-quarantine", audience: "none", roles: [],
    canonicalObject: "persona", job: "No public job; pending reconciliation", readiness: "disabled",
  }),
  family("misc-product-beta", /^\/(?:collections|products|services|legal|share|r|notes|roles|trade$|tradepartners|checkout|payment-success|schedule-consultation)(?:\/|$)/, {
    owner: "product-platform", audience: "public-and-account-holder", roles: ["anonymous", "authenticated"],
    canonicalObject: "business", job: "Use a bounded product capability", readiness: "closed_beta",
  }),
  family("platform-shell", /^\/$|^\/:rest\*$|^\/(?:help-demo|test-page)\/:rest\*$/, {
    owner: "platform-routing", audience: "public", roles: ["anonymous", "authenticated"],
    canonicalObject: "user_identity", job: "Enter the canonical shell or truthful not-found state", readiness: "production",
  }),
]);

export function resolveClientRoute(pathname) {
  return CLIENT_ROUTE_FAMILIES.find((entry) => entry.match.test(pathname)) ?? null;
}
