/**
 * C2-1 Verification Requirements Map
 *
 * Canonical source for which user actions require verification.
 * This is READ-ONLY output from C1 audit + codebase analysis.
 * Used to implement C2-2, C2-3, C2-4, C2-5.
 *
 * STRUCTURE:
 * - action: user intent (e.g., POST_JOB, MESSAGE_USER)
 * - requires: array of verification types needed
 * - risk: low | medium | high (controls explanation & alternate path)
 * - jurisdiction: sensitivity to state/county (e.g., contractor licensing varies)
 * - blocking: current behavior (true = hard blocks, false = no check today)
 * - C2_approach: how C2 will handle this
 */

const DIRECT_CONNECT_UNVERIFIED_BYPASS_ENABLED = [
  process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED,
  process.env.DIRECT_CONNECT_DEMO_MODE,
  process.env.TRADE_SCOUT_DEMO_MODE,
]
  .map((value) =>
    String(value || "")
      .trim()
      .toLowerCase()
  )
  .some((value) => ["1", "true", "yes", "on", "enabled"].includes(value));

export const ACTION_VERIFICATION_REQUIREMENTS = {
  // ============================================================
  // MESSAGING & DIRECT CONTACT
  // ============================================================
  MESSAGE_USER: {
    action: "MESSAGE_USER",
    name: "Send direct message",
    description: "Initiate private conversation with another user",
    requires: {
      sender: ["address"], // initiator must be verified
      recipient: ["address"], // recipient must be verified
    },
    risk: "medium",
    jurisdiction: "local",
    blocking: true,
    why: "Prevents spam, ensures both parties are real community members",
    current_gate: "users.addressVerified (both sender & recipient)",
    C2_approach:
      "ASYMMETRIC: sender gets explainAndOfferVerification(); recipient is checked but not gated",
    alternate_path: "Use Scout-mediated contact (Scout relays messages until both verified)",
  },

  REQUEST_CONTRACTOR_QUOTE: {
    action: "REQUEST_CONTRACTOR_QUOTE",
    name: "Request quote from contractor",
    description: "Submit job request to contractor for estimate",
    requires: {
      homeowner: DIRECT_CONNECT_UNVERIFIED_BYPASS_ENABLED ? [] : ["address"],
      contractor: [],
    },
    risk: "medium",
    jurisdiction: "local",
    blocking: false,
    why: DIRECT_CONNECT_UNVERIFIED_BYPASS_ENABLED
      ? "Demo mode: allow all users to submit/respond to jobs regardless of verification"
      : "Contractors need to verify homeowners to ensure legitimate leads",
    current_gate: DIRECT_CONNECT_UNVERIFIED_BYPASS_ENABLED
      ? "None (relaxed for demo/pilot)"
      : "Implied through message flow + addressVerified",
    C2_approach: DIRECT_CONNECT_UNVERIFIED_BYPASS_ENABLED
      ? "TEMPORARY: no verification required for demo/pilot"
      : "EXPLICIT: offer verification when homeowner first clicks REQUEST_QUOTE",
    alternate_path: DIRECT_CONNECT_UNVERIFIED_BYPASS_ENABLED
      ? "N/A"
      : "Use Scout to search contractors instead (no direct contact needed)",
  },

  // ============================================================
  // CONTRACTOR PROFESSIONAL VERIFICATION
  // ============================================================
  APPLY_AS_CONTRACTOR: {
    action: "APPLY_AS_CONTRACTOR",
    name: "Apply to contractor board",
    description: "Register as verified contractor for job listings",
    requires: ["license", "insurance", "identity"],
    risk: "high",
    jurisdiction: "state", // Licensing varies by state & trade
    blocking: true,
    why: "Contractors need state license to legally offer services; insurance protects homeowners",
    current_gate: "verificationStatus: pending → under_review → approved",
    C2_approach:
      'EXPLAIN & OFFER: "Most contractors upload license + insurance during signup (10 min). Skip for now and apply later."',
    alternate_path: "Browse as homeowner first, apply later when ready",
    sla: "2-3 business days for admin review",
  },

  ACCEPT_CONTRACTOR_PAYMENT: {
    action: "ACCEPT_CONTRACTOR_PAYMENT",
    name: "Accept payment for completed work",
    description: "Receive payment from homeowner (escrow, card, check)",
    requires: ["identity", "tax_id", "bank_account"],
    risk: "high",
    jurisdiction: "federal", // Tax ID is federal requirement
    blocking: true,
    why: "IRS requires identity verification for income reporting; bank account must match tax ID",
    current_gate: "None implemented yet (C2 finding)",
    C2_approach:
      "Trigger when contractor first tries to mark invoice PAID; offer during contract finalization",
    alternate_path: "Homeowner can mail check (both skip bank verification)",
  },

  // ============================================================
  // COMMUNITY FEATURES
  // ============================================================
  POST_COMMUNITY_CONTENT: {
    action: "POST_COMMUNITY_CONTENT",
    name: "Post to community board",
    description: "Create discussion, ask question, share story",
    requires: [], // NONE required
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "No verification needed; community is open to all participants",
    current_gate: "None",
    C2_approach: "No change; keep open",
    alternate_path: "N/A",
  },

  POST_JOB_REQUEST: {
    action: "POST_JOB_REQUEST",
    name: "Post job request",
    description: 'Submit work needed (e.g., "looking for roofer")',
    requires: [], // NONE required today; C2 opportunity
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "No verification needed to request work; contractors will vet themselves",
    current_gate: "None",
    C2_approach: "Consider verification CTA later (high-value job = more trust needed)",
    alternate_path: "N/A",
  },

  // ============================================================
  // MARKETPLACE FEATURES
  // ============================================================
  POST_MARKETPLACE_LISTING: {
    action: "POST_MARKETPLACE_LISTING",
    name: "List item for sale",
    description: "Post item to marketplace (buy/sell)",
    requires: [], // NONE required
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "Marketplace is open; fraud detection via feedback, not upfront gates",
    current_gate: "None",
    C2_approach: "No change; keep open",
    alternate_path: "N/A",
  },

  ACCEPT_MARKETPLACE_PAYMENT: {
    action: "ACCEPT_MARKETPLACE_PAYMENT",
    name: "Accept payment for listing",
    description: "Receive payment from buyer",
    requires: [], // NONE today; depends on payment method
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "Payment processor handles verification (Stripe, PayPal, etc)",
    current_gate: "None (delegated to payment processor)",
    C2_approach: "No change; payment processor is gatekeeper",
    alternate_path: "N/A",
  },

  // ============================================================
  // GROUP FEATURES
  // ============================================================
  JOIN_GROUP: {
    action: "JOIN_GROUP",
    name: "Join community group",
    description: "Become member of neighborhood group, HOA, etc",
    requires: [], // NONE required
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "Groups are open; group admin can set their own membership rules",
    current_gate: "None",
    C2_approach: "No change; keep open",
    alternate_path: "N/A",
  },

  // ============================================================
  // SCOUT FEATURES
  // ============================================================
  SCOUT_INTERACTION: {
    action: "SCOUT_INTERACTION",
    name: "Chat with Scout",
    description: "Ask Scout for recommendations, info, help",
    requires: [], // NONE required
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "Scout is AI-mediated; no trust risk; Scout output is contextual to geography + snapshot only",
    current_gate: "None",
    C2_approach: "No change; Scout is always available (even to guests)",
    alternate_path: "N/A",
  },

  ACCEPT_SCOUT_RECOMMENDATION: {
    action: "ACCEPT_SCOUT_RECOMMENDATION",
    name: "Accept Scout recommendation",
    description: 'Click "yes" to Scout suggestion (contractor, deal, etc)',
    requires: [], // NONE upfront; depends on what Scout recommends
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "Scout recommendations respect verification state; Scout will suggest verified contractors when available",
    current_gate: "None",
    C2_approach: "No change; Scout uses confidence + snapshot to shape recommendations",
    alternate_path: "N/A (Scout always gives options)",
  },

  // ============================================================
  // PROFILE & BUSINESS FEATURES
  // ============================================================
  PUBLISH_PUBLIC_PROFILE: {
    action: "PUBLISH_PUBLIC_PROFILE",
    name: "Publish profile to public directory",
    description: "Make profile visible in contractor board, business directory",
    requires: ["address"], // CURRENTLY: addressVerified blocks visibility
    risk: "medium",
    jurisdiction: "local",
    blocking: true,
    why: "Public listing implies verified identity; shows in search results",
    current_gate: "users.addressVerified (soft gate: unverified profiles hidden from lists)",
    C2_approach:
      'SOFT GATE: offer verification when user first tries to publish; show as "optional but recommended"',
    alternate_path: "Keep profile unlisted (still accessible via direct link)",
  },

  BECOME_MARKETPLACE_VENDOR: {
    action: "BECOME_MARKETPLACE_VENDOR",
    name: "Register as marketplace vendor",
    description: "Enable marketplace selling features (bulk listing, analytics)",
    requires: [], // NONE required
    risk: "low",
    jurisdiction: "none",
    blocking: false,
    why: "Marketplace seller verification is dynamic (fraud detection via feedback)",
    current_gate: "None",
    C2_approach: 'Optional verification CTA: "Verify your address to build buyer trust"',
    alternate_path: "Sell as guest (with limit on listing count)",
  },

  // ============================================================
  // ADMIN / SPECIAL
  // ============================================================
  ACCESS_CONTRACTOR_VERIFICATION_ADMIN: {
    action: "ACCESS_CONTRACTOR_VERIFICATION_ADMIN",
    name: "View contractor verification queue (admin)",
    description: "Admin access to approve/reject contractor applications",
    requires: ["admin_role"], // NOT user verification; role-based
    risk: "high",
    jurisdiction: "none",
    blocking: true,
    why: "Admin function requires explicit role assignment",
    current_gate: 'user.role === "admin"',
    C2_approach: "No change; admin access is role-based, not verification-based",
    alternate_path: "N/A",
  },
};

// ============================================================
// SUMMARY TABLE (for C2-1 review)
// ============================================================
export const VERIFICATION_SUMMARY = {
  total_actions: Object.keys(ACTION_VERIFICATION_REQUIREMENTS).length,

  blocking_today: Object.entries(ACTION_VERIFICATION_REQUIREMENTS)
    .filter(([_, req]) => req.blocking)
    .map(([key, req]) => ({ key, action: req.action, risk: req.risk })),

  high_risk: Object.entries(ACTION_VERIFICATION_REQUIREMENTS)
    .filter(([_, req]) => req.risk === "high")
    .map(([key, req]) => ({ key, action: req.action, blocking: req.blocking })),

  asymmetric_candidates: [
    "MESSAGE_USER", // sender + recipient have different requirements
    "REQUEST_CONTRACTOR_QUOTE", // homeowner + contractor have different requirements
    "APPLY_AS_CONTRACTOR", // contractor self-identifies
  ],

  soft_gates_today: [
    "PUBLISH_PUBLIC_PROFILE", // addressVerified hides from lists but doesn't block
  ],

  no_verification_needed: [
    "POST_COMMUNITY_CONTENT",
    "POST_JOB_REQUEST",
    "POST_MARKETPLACE_LISTING",
    "JOIN_GROUP",
    "SCOUT_INTERACTION",
    "ACCEPT_SCOUT_RECOMMENDATION",
  ],
};

// ============================================================
// JURISDICTION NOTES (for C2-1 context)
// ============================================================
export const JURISDICTION_NOTES = {
  CONTRACTOR_LICENSING: {
    description: "Contractor licensing varies significantly by state",
    examples: [
      "California: Contractors License Board (CSLB) license required",
      "Texas: Licensing less strict; many trades unregulated",
      "Florida: Similar to CA; trade-specific licensing",
      "Federal: None (licensing is state/local)",
    ],
    implication: "C2 must explain licensing requirement at state level, not federal",
  },

  INSURANCE_REQUIREMENTS: {
    description: "Insurance minimums vary by state and trade",
    examples: [
      "General Liability: typically $1M-$2M",
      "Workers Comp: state-mandated if employees",
      "Professional Liability: varies by trade",
    ],
    implication: "C2 can offer generic explanation; state-specific logic optional for v1",
  },

  TAX_ID_FEDERAL: {
    description: "Tax ID (SSN or EIN) is federal requirement for payment",
    examples: [
      "IRS Form W-9 required before contractor payment",
      "Contractor must report income on tax return",
    ],
    implication: "C2 should explain tax requirement when contractor tries to accept payment",
  },

  ADDRESS_VERIFICATION_LOCAL: {
    description: "Address verification is local/community trust signal",
    examples: [
      "Used to filter messaging partners",
      "Used to boost visibility in community lists",
      "Used to qualify for local deals",
    ],
    implication: 'C2 should explain "helps you get connected locally"',
  },
};
