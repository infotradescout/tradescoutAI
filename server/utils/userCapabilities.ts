/**
 * User Capabilities System
 * 
 * Infers what a user can do based on:
 * - Profile data (roles, tags) — optional hints
 * - Observed behavior (actions, tools used) — strong signals
 * - Current context (page, message, intent) — immediate signals
 * 
 * No role ever blocks functionality.
 * Capabilities are inferred from signal aggregation.
 * 
 * Philosophy:
 * "Watch what they're doing and help. Roles just improve the guess."
 */

/**
 * Core user roles (stable, multi-select)
 * These describe how a user participates in the community.
 */
export type UserRole =
  | "homeowner"
  | "contractor"
  | "business_owner"
  | "property_manager"
  | "hoa_board"
  | "realtor"
  | "investor"
  | "community_organizer"
  | "admin";

/**
 * Trade/domain tags (extensible, multi-select)
 * These describe what work the user actually does.
 * Add new tags freely without breaking anything.
 */
export const TRADE_TAGS = [
  // Core trades
  "plumbing",
  "electrical",
  "hvac",
  "roofing",
  "general_contractor",
  "handyman",
  "landscaping",
  "concrete",
  "foundation",
  "painting",
  "flooring",
  "drywall",
  "demolition",
  "excavation",
  "pest_control",
  "pool_service",
  "solar",
  "security_systems",
  "fire_suppression",
  "low_voltage",
  "networking",
  "av_installation",
  "signage",
  "window_door",
  "glass",
  "insulation",
  "waterproofing",
  "restoration",
  "mitigation",
  "cleaning",
  "janitorial",
  "pressure_washing",
  "snow_removal",
  // Specialized trades
  "welding",
  "metal_fab",
  "custom_carpentry",
  "cabinetry",
  "millwork",
  "masonry",
  "brick_stone",
  "tiling",
  "countertops",
  "kitchen_bath",
  "remodeling",
  "new_construction",
  "commercial_buildout",
  "tenant_improvement",
  // Food & beverage
  "restaurant",
  "food_truck",
  "bar",
  "cafe",
  "bakery",
  "brewery",
  "catering",
  // Services & events
  "event_services",
  "photography",
  "videography",
  "dj",
  "marketing",
  "sign_maker",
  "printing",
  // Logistics & supply
  "logistics",
  "delivery",
  "materials_supplier",
] as const;

export type TradeTag = (typeof TRADE_TAGS)[number];

/**
 * Capabilities (derived, never stored)
 * These answer: "What should Scout let this user do right now?"
 */
export type Capability =
  | "find_contractors"
  | "bid_on_jobs"
  | "send_invoices"
  | "mark_paid"
  | "track_projects"
  | "post_deals"
  | "manage_hoa_projects"
  | "review_bids"
  | "post_in_community"
  | "moderate_groups"
  | "manage_properties"
  | "schedule_work"
  | "manage_crews"
  | "compare_contractors"
  | "post_recommendations"
  | "run_promotions"
  | "accept_payments"
  | "manage_subscriptions"
  | "create_community_vault"
  | "post_marketplace_item"
  | "apply_for_jobs";

/**
 * Signals that trigger capability inference
 * Gathered from profile, behavior history, current context, and message content
 */
export interface CapabilitySignals {
  // Profile (optional, static)
  profile?: {
    roles?: UserRole[];
    tradeTags?: TradeTag[];
  };

  // Behavior history (always available from session/logs)
  behaviorHistory?: {
    hasCreatedInvoice?: boolean;
    hasPostedJob?: boolean;
    hasPostedMarketplaceListing?: boolean;
    hasAppliedForJob?: boolean;
    hasManagementTools?: boolean;
    hasAccessedFinances?: boolean;
    hasJoinedGroup?: boolean;
    hasAskedAboutHOA?: boolean;
    isFrequentUser?: boolean;
    isAdmin?: boolean;
  };

  // Current context (always available from request)
  context?: {
    currentPage?: string;
    currentAction?: string;
    parentObjectType?: "job" | "invoice" | "hoa" | "community" | "marketplace" | "group";
    parentObjectId?: string;
  };

  // Message content analysis (from Scout message)
  messageSignals?: {
    mentionsInvoice?: boolean;
    mentionsPaid?: boolean;
    mentionsJob?: boolean;
    mentionsHOA?: boolean;
    mentionsBoard?: boolean;
    mentionsVoting?: boolean;
    mentionsGroup?: boolean;
    mentionsCommunity?: boolean;
    mentionsMarketplace?: boolean;
    mentionsBusiness?: boolean;
    mentionsPayment?: boolean;
    mentionsBilling?: boolean;
    mentionsCrew?: boolean;
    mentionsSchedule?: boolean;
  };
}

/**
 * Detect keywords and signals in message text
 * This runs on every Scout message to extract behavioral signals
 */
export function extractMessageSignals(message: string): CapabilitySignals["messageSignals"] {
  if (!message || typeof message !== "string") {
    return {};
  }

  const lower = message.toLowerCase();

  return {
    mentionsInvoice: /invoice|bill|charge|amount.*owed|receipt/.test(lower),
    mentionsPaid: /paid|payment|received|collected|cleared|settled/.test(lower),
    mentionsJob: /job|project|work|task|bid|estimate|quote|contract|repair|install/.test(lower),
    mentionsHOA: /hoa|homeowners?.*association|condo.*board|association.*board|board meeting/.test(lower),
    mentionsBoard: /board|governance|policy|bylaws|rules|decision/.test(lower),
    mentionsVoting: /vote|voting|vote on|decision|approve|approval/.test(lower),
    mentionsGroup: /group|groups|club|clubs|meetup|community group|neighborhood group/.test(lower),
    mentionsCommunity: /community|neighbors?|local|county|area|region/.test(lower),
    mentionsMarketplace: /sell|selling|sold|sale|buy|buying|list|listing|exchange|swap/.test(lower),
    mentionsBusiness: /business|company|enterprise|contractor|pro|professional|work/.test(lower),
    mentionsPayment: /payment|pay|charge|invoice|bill|collect/.test(lower),
    mentionsBilling: /bill|invoice|accounting|finance|receipt|ledger|balance/.test(lower),
    mentionsCrew: /crew|team|staff|workers?|employees?|subcontractor/.test(lower),
    mentionsSchedule: /schedule|calendar|when|timing|availability|book|appointment/.test(lower),
  };
}

/**
 * CORE FUNCTION: Infer capabilities from signal aggregation
 * 
 * This is where Scout's intelligence lives.
 * No role ever blocks functionality.
 * Multiple signals can unlock the same capability.
 */
export function inferCapabilities(signals: CapabilitySignals): Set<Capability> {
  const caps = new Set<Capability>();

  // Convenience accessors
  const profile = signals.profile || {};
  const history = signals.behaviorHistory || {};
  const context = signals.context || {};
  const msg = signals.messageSignals || {};
  const roles = profile.roles || [];
  const tags = profile.tradeTags || [];

  // ===== BASELINE (Everyone) =====
  caps.add("post_in_community");

  // ===== FIND CONTRACTORS (Homeowners, people asking about work) =====
  if (
    roles.includes("homeowner") ||
    roles.includes("property_manager") ||
    roles.includes("investor") ||
    msg.mentionsJob ||
    context.currentPage?.includes("contractors") ||
    context.parentObjectType === "job"
  ) {
    caps.add("find_contractors");
    caps.add("compare_contractors");
  }

  // ===== INVOICING & BILLING (Contractors, business owners, anyone who mentions invoices) =====
  if (
    roles.includes("contractor") ||
    roles.includes("business_owner") ||
    history.hasCreatedInvoice ||
    msg.mentionsInvoice ||
    msg.mentionsPaid ||
    msg.mentionsBilling ||
    context.currentPage?.includes("invoice") ||
    context.currentPage?.includes("finance") ||
    context.parentObjectType === "invoice"
  ) {
    caps.add("send_invoices");
    caps.add("mark_paid");
    caps.add("track_projects");
    if (history.hasAccessedFinances) {
      caps.add("manage_subscriptions");
    }
  }

  // ===== BIDDING & JOBS (Contractors, anyone asking about bids or estimating) =====
  if (
    roles.includes("contractor") ||
    roles.includes("business_owner") ||
    msg.mentionsJob ||
    context.parentObjectType === "job" ||
    history.hasPostedJob
  ) {
    caps.add("bid_on_jobs");
    caps.add("send_invoices");
    caps.add("track_projects");
  }

  // ===== CREW & SCHEDULE MANAGEMENT (Multi-person operations) =====
  if (
    tags.some((t) => ["general_contractor", "landscaping", "cleaning"].includes(t)) ||
    msg.mentionsCrew ||
    msg.mentionsSchedule ||
    history.hasManagementTools
  ) {
    caps.add("manage_crews");
    caps.add("schedule_work");
  }

  // ===== MARKETPLACE & DEALS (Business owners, anyone selling/posting items) =====
  if (
    roles.includes("business_owner") ||
    tags.some((t) =>
      [
        "restaurant",
        "food_truck",
        "bar",
        "cafe",
        "bakery",
        "brewery",
        "catering",
      ].includes(t)
    ) ||
    history.hasPostedMarketplaceListing ||
    msg.mentionsMarketplace ||
    context.currentPage?.includes("marketplace") ||
    context.currentPage?.includes("exchange")
  ) {
    caps.add("post_marketplace_item");
    caps.add("post_deals");
    if (tags.some((t) => ["restaurant", "bar", "cafe", "food_truck"].includes(t))) {
      caps.add("run_promotions");
    }
  }

  // ===== HOA & GOVERNANCE (HOA board members, property managers, community organizers) =====
  if (
    roles.includes("hoa_board") ||
    roles.includes("property_manager") ||
    roles.includes("community_organizer") ||
    msg.mentionsHOA ||
    msg.mentionsBoard ||
    msg.mentionsVoting ||
    context.currentPage?.includes("hoa") ||
    context.parentObjectType === "hoa" ||
    history.hasAskedAboutHOA
  ) {
    caps.add("manage_hoa_projects");
    caps.add("review_bids");
    caps.add("manage_properties");
  }

  // ===== COMMUNITY GROUPS (Anyone mentioning groups, organizers) =====
  if (
    roles.includes("community_organizer") ||
    msg.mentionsGroup ||
    msg.mentionsVoting ||
    history.hasJoinedGroup ||
    context.currentPage?.includes("community/groups")
  ) {
    caps.add("moderate_groups");
    if (roles.includes("community_organizer") || history.isFrequentUser) {
      caps.add("create_community_vault");
    }
  }

  // ===== RECOMMENDATIONS & REVIEWS (Power users, frequent participants) =====
  if (
    history.isFrequentUser ||
    roles.some((r) => ["realtor", "contractor", "property_manager"].includes(r))
  ) {
    caps.add("post_recommendations");
  }

  // ===== JOB APPLICATIONS (Anyone, not gated) =====
  caps.add("apply_for_jobs");

  // ===== PAYMENTS (Business owners, contractors) =====
  if (
    roles.includes("contractor") ||
    roles.includes("business_owner") ||
    history.hasAccessedFinances
  ) {
    caps.add("accept_payments");
  }

  // ===== ADMIN (Explicit admin flag) =====
  if (history.isAdmin) {
    caps.add("post_recommendations");
    caps.add("moderate_groups");
    caps.add("manage_properties");
  }

  return caps;
}

/**
 * Convenience functions for readability in Scout code
 * These check if a capability exists without the ceremony of calling inferCapabilities every time
 */
export class CapabilityChecker {
  constructor(private capabilities: Set<Capability>) {}

  can(capability: Capability): boolean {
    return this.capabilities.has(capability);
  }

  canSendInvoices(): boolean {
    return this.can("send_invoices");
  }

  canMarkPaid(): boolean {
    return this.can("mark_paid");
  }

  canTrackProjects(): boolean {
    return this.can("track_projects");
  }

  canBidOnJobs(): boolean {
    return this.can("bid_on_jobs");
  }

  canFindContractors(): boolean {
    return this.can("find_contractors");
  }

  canCompareContractors(): boolean {
    return this.can("compare_contractors");
  }

  canManageHOA(): boolean {
    return this.can("manage_hoa_projects");
  }

  canReviewBids(): boolean {
    return this.can("review_bids");
  }

  canManageProperties(): boolean {
    return this.can("manage_properties");
  }

  canPostMarketplaceItem(): boolean {
    return this.can("post_marketplace_item");
  }

  canPostDeals(): boolean {
    return this.can("post_deals");
  }

  canManageCrew(): boolean {
    return this.can("manage_crews");
  }

  canScheduleWork(): boolean {
    return this.can("schedule_work");
  }

  canModerateGroups(): boolean {
    return this.can("moderate_groups");
  }

  canCreateCommunityVault(): boolean {
    return this.can("create_community_vault");
  }

  canPostInCommunity(): boolean {
    return this.can("post_in_community");
  }

  canApplyForJobs(): boolean {
    return this.can("apply_for_jobs");
  }

  canAcceptPayments(): boolean {
    return this.can("accept_payments");
  }

  canPostRecommendations(): boolean {
    return this.can("post_recommendations");
  }

  canRunPromotions(): boolean {
    return this.can("run_promotions");
  }

  // Batch check: do they have ANY of these capabilities?
  hasAny(...caps: Capability[]): boolean {
    return caps.some((c) => this.can(c));
  }

  // Batch check: do they have ALL of these capabilities?
  hasAll(...caps: Capability[]): boolean {
    return caps.every((c) => this.can(c));
  }

  // Get all capabilities as array (for debugging or UI)
  getAll(): Capability[] {
    return Array.from(this.capabilities).sort();
  }
}

/**
 * Factory function: create a capability checker from signals
 * This is the main entry point for Scout logic
 */
export function createCapabilityChecker(signals: CapabilitySignals): CapabilityChecker {
  const capabilities = inferCapabilities(signals);
  return new CapabilityChecker(capabilities);
}

/**
 * Helper: Create capability signals from a request-like object
 * Useful for Scout API integration
 */
export function buildCapabilitySignals(data: {
  user?: { roles?: UserRole[]; tradeTags?: TradeTag[] };
  message?: string;
  currentPage?: string;
  currentAction?: string;
  parentObjectType?: "job" | "invoice" | "hoa" | "community" | "marketplace" | "group";
  recentActions?: string[];
}): CapabilitySignals {
  const messageSignals = data.message ? extractMessageSignals(data.message) : {};

  // Infer behavior history from recent actions
  const behaviorHistory: CapabilitySignals["behaviorHistory"] = {
    hasCreatedInvoice: data.recentActions?.includes("created_invoice"),
    hasPostedJob: data.recentActions?.includes("posted_job"),
    hasPostedMarketplaceListing: data.recentActions?.includes("posted_listing"),
    hasAppliedForJob: data.recentActions?.includes("applied_for_job"),
    hasManagementTools: data.recentActions?.some((a) => a.includes("manage")),
    hasAccessedFinances: data.recentActions?.some((a) => a.includes("finance")),
    hasJoinedGroup: data.recentActions?.includes("joined_group"),
    hasAskedAboutHOA: data.recentActions?.some((a) => a.includes("hoa")),
    isFrequentUser: (data.recentActions?.length || 0) > 10,
  };

  return {
    profile: {
      roles: data.user?.roles,
      tradeTags: data.user?.tradeTags,
    },
    behaviorHistory,
    context: {
      currentPage: data.currentPage,
      currentAction: data.currentAction,
      parentObjectType: data.parentObjectType,
    },
    messageSignals,
  };
}
