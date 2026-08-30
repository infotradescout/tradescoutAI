export const READINESS_STATES = Object.freeze([
  "disabled",
  "internal_only",
  "closed_beta",
  "public_beta",
  "production",
  "retired",
]);

export const PR_DISPOSITIONS = Object.freeze(["extract", "rebuild", "close", "hold"]);

export const PR_RECOVERY_DISPOSITIONS = Object.freeze([
  { number: 409, status: "closed", disposition: "close", owner: "admin-os", reason: "Superseded by the current-main read-only Ecosystem Truth recovery in draft PR #546, including explicit closed-beta protection for realtor and car-sales." },
  { number: 396, status: "closed", disposition: "close", owner: "identity", reason: "Superseded by current-main profile-native identity work in 046c0e41 and 4a5f41e1; the stale branch must not be replayed." },
  { number: 318, status: "closed", disposition: "close", owner: "stone-core", reason: "Superseded by current-main Profile Accounts, Stone Core container inventory, and BidRock private-offer/order authority; the stale JW-specific credential system must not be replayed." },
  { number: 316, status: "closed", disposition: "close", owner: "public-profiles", reason: "Superseded by the current-main profile-specific manifest, icon, mapped-domain, and iOS install-identity recovery in draft PR #547." },
  { number: 305, status: "closed", disposition: "close", owner: "public-profiles", reason: "Superseded by the current-main Dean identity, Direct Connect, and profile-owned booking recovery in draft PR #548; stale and unverified regulated claims were not replayed." },
  { number: 265, status: "closed", disposition: "close", owner: "release-control", reason: "The broad remediation branch predates hundreds of main commits and is not a coherent release." },
  { number: 255, status: "closed", disposition: "close", owner: "stone-core", reason: "Old JW mobile polish must not overwrite the current catalog and visual architecture." },
  { number: 254, status: "closed", disposition: "close", owner: "trust-cvs", reason: "The still-needed guarded recommendation binding, journaled migration 0113, rollback controls, and negative contracts were already extracted into current main by commit 64892ea5; replaying the stale branch would discard newer migrations and profile work." },
  { number: 223, status: "closed", disposition: "close", owner: "release-control", reason: "pnpm lock and historical evidence are obsolete in the npm-authoritative repository." },
  { number: 222, status: "closed", disposition: "close", owner: "direct-connect", reason: "Superseded by universal Express Direct Connect in 84aab242 and later hardening; the stale snapshot must not be replayed." },
  { number: 221, status: "closed", disposition: "close", owner: "stone-core", reason: "The branch includes hundreds of bundled stone images and conflicts with server-side media storage." },
  { number: 219, status: "closed", disposition: "close", owner: "public-profiles", reason: "Superseded by the current-main canonical repository/pure-policy authority recovery in draft PR #549, including exact revocation, per-profile release, and account-custody guards without replaying the stale duplicate resolver or routes." },
  { number: 218, status: "closed", disposition: "close", owner: "release-control", reason: "pnpm lock is not authoritative for this npm repository." },
  { number: 215, status: "closed", disposition: "close", owner: "direct-connect", reason: "Superseded by the current-main operations queue and replay-safe create recovery in draft PR #545; the stale 99-file branch must not be replayed." },
  { number: 214, status: "open", disposition: "extract", owner: "exchange", reason: "Retain valid profile-catalog and About contracts only after current route and inventory reconciliation." },
  { number: 213, status: "open", disposition: "extract", owner: "discovery", reason: "Compare indexability fixes with current organic-growth work and retain only missing contracts." },
  { number: 211, status: "closed", disposition: "close", owner: "public-profiles", reason: "The narrow ISSA presentation change is stale and must not overwrite the current profile theme." },
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
  family("direct-connect", /^\/(?:direct-connect(?:\/|$)|request-quote|quote$|quote-calculator$|tasks$|messages$|chat$|connections$|helper-dashboard$)/, {
    owner: "direct-connect", audience: "requester-and-provider", roles: ["authenticated"],
    canonicalObject: "work_request", job: "Start and progress protected work", readiness: "production",
  }),
  family("public-profiles", /^\/(?:p|u|helpers)(?:\/|$)|^\/business\/(?!requests$)[^/]+(?:\/edit)?$|^\/contractors(?:\/((?!board$|top$)[^/]+))?$|^\/commercial\/p\//, {
    owner: "public-profiles", audience: "public", roles: ["anonymous", "profile_manager"],
    canonicalObject: "public_profile", job: "Find and manage a truthful profile", readiness: "production",
  }),
  family("discovery", /^\/(?:search|advanced-search|find-local-businesses|directory\/businesses|discover-people|best\/|trade\/|city\/|county\/|county-directory|county-hub|maps$|leaderboard$|recommendations$|saved-contractors$|contractors\/(?:board|top)$)/, {
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
  family("home", /^\/(?:homes|homescout|homescout-listings|homeowner-dashboard|property-listing|foundation|hoa|hoa-dashboard|hoa-management)(?:\/|$)/, {
    owner: "homeid-homescout", audience: "property-owner-and-buyer", roles: ["anonymous", "authenticated"],
    canonicalObject: "home", job: "Manage or discover a home", readiness: "closed_beta",
  }),
  family("business-operations", /^\/(?:business-dashboard|business-listing|business-verification|businesses\/apply|business\/requests|claim-my-business|contractor-board|commercial-directory|offer-services|provider-setup|crm|lead-management|project-tracker|application-tracker|accounting|finances|payment-history|wallet)(?:\/|$)/, {
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
  family("professional-verticals", /^\/(?:car-sales(?:man)?|realtor)(?:-|\/|$)/, {
    owner: "professional-verticals", audience: "professional-and-customer", roles: ["anonymous", "authenticated", "realtor", "car_salesman"],
    canonicalObject: "business", job: "Operate professional real-estate and vehicle-sales work", readiness: "closed_beta",
  }),
  family("legacy-role-verticals", /^\/membership-portal(?:\/|$)/, {
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

export const API_ROUTE_FAMILIES = Object.freeze([
  family("admin-api", /^\/api\/(?:admin(?:\/|$)|admin-control|prompt-admin|seed-database|system|debug|error-reports|bug-report|bug-reports)/, {
    owner: "admin-os", audience: "administrator", roles: ["ops_admin", "super_admin"],
    canonicalObject: "user_identity", job: "Operate, audit, and recover TradeScout", readiness: "internal_only",
  }),
  family("identity-api", /^\/api\/(?:auth|user|users|profile-accounts|onboarding|invitations|identity-verification|address-verification|business-claim|claims|profile)(?:\/|$)/, {
    owner: "identity", audience: "account-holder", roles: ["anonymous", "authenticated"],
    canonicalObject: "user_identity", job: "Create, recover, and authorize one identity", readiness: "production",
  }),
  family("direct-connect-api", /^\/api\/(?:direct-connect|work-requests|tasks|jobs|conversations|messages|notifications|decision-cards|quotes|profile-booking|providers?|workers|employment)(?:\/|$)/, {
    owner: "direct-connect", audience: "requester-provider-and-operator", roles: ["authenticated", "ops_admin"],
    canonicalObject: "work_request", job: "Create, route, progress, and recover protected work", readiness: "production",
  }),
  family("profile-discovery-api", /^\/api\/(?:profiles|p|u|business-profile|business-contact|tradepartner-profiles|tradepartner-landing|contractors?|contractor-signup|saved-contractors|nationwide|commercial-directory|public|public-config|leaderboard|recommendations|recommendation-generator|preferred-source|pricing|stats|trending|market-signals|map|heatmap|geographic-coverage|counties|regions|states|trades|aggregates)(?:\/|$)/, {
    owner: "public-profiles-discovery", audience: "public-and-profile-manager", roles: ["anonymous", "authenticated", "profile_manager"],
    canonicalObject: "public_profile", job: "Publish, find, and manage truthful profiles", readiness: "public_beta",
  }),
  family("community-api", /^\/api\/(?:community|community-builder|community-causes|community-vault|social|moderation|groups|reviews|badges|local-impact|objectives|stories|events|xp)(?:\/|$)/, {
    owner: "community", audience: "community-member-and-moderator", roles: ["anonymous", "authenticated", "moderator"],
    canonicalObject: "persona", job: "Read and participate in the local community", readiness: "public_beta",
  }),
  family("exchange-api", /^\/api\/(?:marketplace|exchange|handmade|metals|daily-deals|deals|deal-engagements|vehicles|saved-searches|saved-ads)(?:\/|$)/, {
    owner: "exchange", audience: "buyer-and-seller", roles: ["anonymous", "authenticated"],
    canonicalObject: "listing", job: "Publish, discover, and progress a listing", readiness: "public_beta",
  }),
  family("stone-api", /^\/api\/(?:bidrock|jw-stone|hardrock)(?:\/|$)/, {
    owner: "stone-core", audience: "verified-stone-business", roles: ["anonymous", "verified_business", "ops_admin"],
    canonicalObject: "inventory_item", job: "Manage stone inventory and private offers", readiness: "closed_beta",
  }),
  family("home-api", /^\/api\/(?:homes|homeid|homescout|hoa|property-programs|foundation|inspection|solar)(?:\/|$)/, {
    owner: "homeid-homescout", audience: "property-owner-buyer-and-provider", roles: ["anonymous", "authenticated"],
    canonicalObject: "home", job: "Create, manage, and discover property records", readiness: "closed_beta",
  }),
  family("business-operations-api", /^\/api\/(?:accounting|crm|documents|invoices|payments|create-payment-intent|wallet|material-lists|procurement|grunt|businesses|partners|staff)(?:\/|$)/, {
    owner: "business-platform", audience: "business-member-and-operator", roles: ["business_owner", "business_employee", "ops_admin"],
    canonicalObject: "business", job: "Operate business records, money, and fulfillment", readiness: "closed_beta",
  }),
  family("offers-orders-api", /^\/api\/(?:profile-offers|profile-offer-purchases)(?:\/|$)/, {
    owner: "offers-orders", audience: "buyer-seller-and-operator", roles: ["anonymous", "authenticated", "ops_admin"],
    canonicalObject: "offer", job: "Publish, purchase, and fulfill an offer", readiness: "closed_beta",
  }),
  family("growth-api", /^\/api\/(?:affiliate|ads|boosts|contractor-promos|promo|promos|partnerships|partner-interest|referrals|growth-pack|accelerator|tradepartner-campaigns|tradepartner-rsvp|scoutfitters)(?:\/|$)/, {
    owner: "growth", audience: "public-business-and-staff", roles: ["anonymous", "authenticated", "staff"],
    canonicalObject: "business", job: "Attribute and operate bounded growth programs", readiness: "closed_beta",
  }),
  family("scout-api", /^\/api\/(?:scout|scout-analytics|scout-enhanced-v4|scout-heatmap|scout-v2|scout-v2-learning|assistant|ai|agent)(?:\/|$)/, {
    owner: "scout", audience: "public-account-holder-and-staff", roles: ["anonymous", "authenticated", "staff"],
    canonicalObject: "work_request", job: "Translate a need into the correct TradeScout action", readiness: "public_beta",
  }),
  family("platform-support-api", /^\/api\/(?:health|version|cors-test|email|platform-support|plugin|tutorials|legal|dashboard|task-categories|calculator|pro|zero-base-fee)(?:\/|$)/, {
    owner: "platform-operations", audience: "public-account-holder-and-staff", roles: ["anonymous", "authenticated", "staff"],
    canonicalObject: "user_identity", job: "Support platform health and bounded utilities", readiness: "internal_only",
  }),
  family("analytics-api", /^\/api\/(?:analytics)(?:\/|$)/, {
    owner: "analytics", audience: "staff-and-operator", roles: ["staff", "ops_admin", "super_admin"],
    canonicalObject: "business", job: "Measure platform and product outcomes", readiness: "internal_only",
  }),
  family("object-storage-api", /^\/api\/(?:objects)(?:\/|$)/, {
    owner: "public-media-storage", audience: "authorized-uploader", roles: ["authenticated", "profile_manager", "staff"],
    canonicalObject: "inventory_item", job: "Store and retrieve authorized media objects", readiness: "production",
  }),
  family("professional-verticals-api", /^\/api\/(?:car-salesman|realtor)(?:\/|$)/, {
    owner: "professional-verticals", audience: "professional-and-customer", roles: ["authenticated", "realtor", "car_salesman"],
    canonicalObject: "business", job: "Operate professional real-estate and vehicle-sales work", readiness: "closed_beta",
  }),
  family("legacy-api", /^\/api\/(?:leads|disputes|vaults|scoutcoin)(?:\/|$)/, {
    owner: "legacy-quarantine", audience: "none", roles: [],
    canonicalObject: "persona", job: "No public job; pending reconciliation", readiness: "disabled",
  }),
]);

export function resolveApiRoute(pathname) {
  return API_ROUTE_FAMILIES.find((entry) => entry.match.test(pathname)) ?? null;
}
