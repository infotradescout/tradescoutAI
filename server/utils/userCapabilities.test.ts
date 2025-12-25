/**
 * Unit tests for User Capabilities System
 * 
 * Validates that capability inference works correctly across:
 * - Single-role users
 * - Multi-role users
 * - Users with no explicit profile
 * - Message-driven capability unlocking
 * - Context-driven capability unlocking
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  inferCapabilities,
  extractMessageSignals,
  createCapabilityChecker,
  buildCapabilitySignals,
  type CapabilitySignals,
  type Capability,
  UserRole,
} from "./userCapabilities";

describe("extractMessageSignals", () => {
  it("should detect invoice-related keywords", () => {
    const signals = extractMessageSignals("I need to invoice my client for $500");
    expect(signals.mentionsInvoice).toBe(true);
  });

  it("should detect payment keywords", () => {
    const signals = extractMessageSignals("Client paid me yesterday");
    expect(signals.mentionsPaid).toBe(true);
  });

  it("should detect job-related keywords", () => {
    const signals = extractMessageSignals("I bid on a roofing job");
    expect(signals.mentionsJob).toBe(true);
  });

  it("should detect HOA keywords", () => {
    const signals = extractMessageSignals("Our HOA board is voting on new rules");
    expect(signals.mentionsHOA).toBe(true);
    expect(signals.mentionsBoard).toBe(true);
    expect(signals.mentionsVoting).toBe(true);
  });

  it("should detect marketplace keywords", () => {
    const signals = extractMessageSignals("I want to list my pressure washer for sale");
    expect(signals.mentionsMarketplace).toBe(true);
  });

  it("should detect community keywords", () => {
    const signals = extractMessageSignals("Is this normal in my area?");
    expect(signals.mentionsCommunity).toBe(true);
  });

  it("should handle case-insensitive matching", () => {
    const signals = extractMessageSignals("INVOICE THIS CLIENT IMMEDIATELY");
    expect(signals.mentionsInvoice).toBe(true);
    expect(signals.mentionsBilling).toBe(true);
  });

  it("should handle empty message", () => {
    const signals = extractMessageSignals("");
    expect(Object.values(signals).some((v) => v === true)).toBe(false);
  });
});

describe("inferCapabilities - Single Role", () => {
  it("homeowner should have find_contractors", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["homeowner"] },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("find_contractors")).toBe(true);
    expect(caps.has("send_invoices")).toBe(false);
  });

  it("contractor should have send_invoices and bid_on_jobs", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["contractor"] },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("send_invoices")).toBe(true);
    expect(caps.has("bid_on_jobs")).toBe(true);
    expect(caps.has("mark_paid")).toBe(true);
  });

  it("hoa_board should have manage_hoa_projects", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["hoa_board"] },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("manage_hoa_projects")).toBe(true);
    expect(caps.has("review_bids")).toBe(true);
  });

  it("business_owner should have post_deals and marketplace items", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["business_owner"] },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("post_marketplace_item")).toBe(true);
    expect(caps.has("send_invoices")).toBe(true);
  });

  it("community_organizer should have moderate_groups", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["community_organizer"] },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("moderate_groups")).toBe(true);
  });

  it("admin should have multiple elevated capabilities", () => {
    const signals: CapabilitySignals = {
      behaviorHistory: { isAdmin: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("moderate_groups")).toBe(true);
    expect(caps.has("manage_properties")).toBe(true);
  });
});

describe("inferCapabilities - Multi-Role", () => {
  it("homeowner + hoa_board should have both sets", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["homeowner", "hoa_board"] },
    };
    const caps = inferCapabilities(signals);

    // Homeowner
    expect(caps.has("find_contractors")).toBe(true);

    // HOA
    expect(caps.has("manage_hoa_projects")).toBe(true);
    expect(caps.has("review_bids")).toBe(true);

    // Both
    expect(caps.has("post_in_community")).toBe(true);
  });

  it("contractor + hoa_board should unlock both workflows", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["contractor", "hoa_board"] },
    };
    const caps = inferCapabilities(signals);

    // Contractor
    expect(caps.has("send_invoices")).toBe(true);
    expect(caps.has("bid_on_jobs")).toBe(true);

    // HOA
    expect(caps.has("manage_hoa_projects")).toBe(true);
    expect(caps.has("review_bids")).toBe(true);
  });

  it("homeowner + contractor should enable all project flows", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["homeowner", "contractor"] },
    };
    const caps = inferCapabilities(signals);

    expect(caps.has("find_contractors")).toBe(true);
    expect(caps.has("bid_on_jobs")).toBe(true);
    expect(caps.has("send_invoices")).toBe(true);
    expect(caps.has("track_projects")).toBe(true);
  });
});

describe("inferCapabilities - Message-Driven", () => {
  it("mentioning invoice should unlock invoicing even without contractor role", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["homeowner"] },
      messageSignals: { mentionsInvoice: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("send_invoices")).toBe(true);
  });

  it("mentioning HOA should unlock HOA capabilities without hoa_board role", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["homeowner"] },
      messageSignals: {
        mentionsHOA: true,
        mentionsBoard: true,
        mentionsVoting: true,
      },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("manage_hoa_projects")).toBe(true);
    expect(caps.has("review_bids")).toBe(true);
  });

  it("mentioning marketplace should unlock post_deals", () => {
    const signals: CapabilitySignals = {
      messageSignals: { mentionsMarketplace: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("post_marketplace_item")).toBe(true);
    expect(caps.has("post_deals")).toBe(true);
  });

  it("mentioning job/bid should unlock bidding", () => {
    const signals: CapabilitySignals = {
      messageSignals: { mentionsJob: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("bid_on_jobs")).toBe(true);
  });

  it("mentioning crew should unlock crew management", () => {
    const signals: CapabilitySignals = {
      messageSignals: { mentionsCrew: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("manage_crews")).toBe(true);
  });
});

describe("inferCapabilities - Context-Driven", () => {
  it("being on /invoice page should enable invoicing", () => {
    const signals: CapabilitySignals = {
      context: { currentPage: "/invoice" },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("send_invoices")).toBe(true);
  });

  it("being on /hoa page should enable HOA management", () => {
    const signals: CapabilitySignals = {
      context: { currentPage: "/hoa" },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("manage_hoa_projects")).toBe(true);
  });

  it("being on /marketplace should enable marketplace", () => {
    const signals: CapabilitySignals = {
      context: { currentPage: "/marketplace" },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("post_marketplace_item")).toBe(true);
    expect(caps.has("post_deals")).toBe(true);
  });

  it("interacting with job object should enable bidding", () => {
    const signals: CapabilitySignals = {
      context: { parentObjectType: "job" },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("find_contractors")).toBe(true);
    expect(caps.has("bid_on_jobs")).toBe(true);
  });
});

describe("inferCapabilities - Behavior-Driven", () => {
  it("having created invoice should enable invoicing", () => {
    const signals: CapabilitySignals = {
      behaviorHistory: { hasCreatedInvoice: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("send_invoices")).toBe(true);
    expect(caps.has("mark_paid")).toBe(true);
  });

  it("having posted job should enable bidding", () => {
    const signals: CapabilitySignals = {
      behaviorHistory: { hasPostedJob: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("bid_on_jobs")).toBe(true);
  });

  it("having posted marketplace listing should unlock marketplace", () => {
    const signals: CapabilitySignals = {
      behaviorHistory: { hasPostedMarketplaceListing: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("post_marketplace_item")).toBe(true);
    expect(caps.has("post_deals")).toBe(true);
  });

  it("having joined group should enable group moderation (with frequency)", () => {
    const signals: CapabilitySignals = {
      behaviorHistory: {
        hasJoinedGroup: true,
        isFrequentUser: true,
      },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("moderate_groups")).toBe(true);
  });

  it("having accessed finances should enable subscriptions", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["contractor"] },
      behaviorHistory: { hasAccessedFinances: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("manage_subscriptions")).toBe(true);
  });
});

describe("inferCapabilities - No Profile (Cold Start)", () => {
  it("should still allow post_in_community", () => {
    const signals: CapabilitySignals = {};
    const caps = inferCapabilities(signals);
    expect(caps.has("post_in_community")).toBe(true);
  });

  it("should allow apply_for_jobs", () => {
    const signals: CapabilitySignals = {};
    const caps = inferCapabilities(signals);
    expect(caps.has("apply_for_jobs")).toBe(true);
  });

  it("should unlock invoicing if they mention it", () => {
    const signals: CapabilitySignals = {
      messageSignals: { mentionsInvoice: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("send_invoices")).toBe(true);
  });

  it("should unlock HOA if they mention it", () => {
    const signals: CapabilitySignals = {
      messageSignals: { mentionsHOA: true },
    };
    const caps = inferCapabilities(signals);
    expect(caps.has("manage_hoa_projects")).toBe(true);
  });
});

describe("CapabilityChecker", () => {
  it("should provide readable API for checks", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["contractor"] },
    };
    const checker = createCapabilityChecker(signals);

    expect(checker.canSendInvoices()).toBe(true);
    expect(checker.canMarkPaid()).toBe(true);
    expect(checker.canManageHOA()).toBe(false);
  });

  it("should support hasAny()", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["contractor"] },
    };
    const checker = createCapabilityChecker(signals);

    expect(
      checker.hasAny(
        "send_invoices",
        "manage_hoa_projects",
        "post_deals"
      )
    ).toBe(true);
  });

  it("should support hasAll()", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["contractor"] },
    };
    const checker = createCapabilityChecker(signals);

    expect(
      checker.hasAll("send_invoices", "mark_paid", "track_projects")
    ).toBe(true);

    expect(
      checker.hasAll("send_invoices", "manage_hoa_projects")
    ).toBe(false);
  });

  it("should provide getAll() for debugging", () => {
    const signals: CapabilitySignals = {
      profile: { roles: ["contractor"] },
    };
    const checker = createCapabilityChecker(signals);
    const all = checker.getAll();

    expect(Array.isArray(all)).toBe(true);
    expect(all.length > 0).toBe(true);
    expect(all.includes("send_invoices")).toBe(true);
  });
});

describe("buildCapabilitySignals", () => {
  it("should build signals from user data and message", () => {
    const signals = buildCapabilitySignals({
      user: {
        roles: ["contractor"],
        tradeTags: ["plumbing", "hvac"],
      },
      message: "I need to invoice my client",
      currentPage: "/dashboard",
      recentActions: ["created_invoice", "posted_job"],
    });

    expect(signals.profile?.roles).toEqual(["contractor"]);
    expect(signals.profile?.tradeTags).toEqual(["plumbing", "hvac"]);
    expect(signals.messageSignals?.mentionsInvoice).toBe(true);
    expect(signals.behaviorHistory?.hasCreatedInvoice).toBe(true);
    expect(signals.behaviorHistory?.hasPostedJob).toBe(true);
  });

  it("should mark frequent user based on recent actions", () => {
    const signals = buildCapabilitySignals({
      recentActions: Array(15).fill("some_action"),
    });

    expect(signals.behaviorHistory?.isFrequentUser).toBe(true);
  });

  it("should infer management tools from actions", () => {
    const signals = buildCapabilitySignals({
      recentActions: ["manage_projects", "manage_team"],
    });

    expect(signals.behaviorHistory?.hasManagementTools).toBe(true);
  });
});

describe("Real-World Scenarios", () => {
  it("Scenario: New homeowner, no profile, asks about roof", () => {
    const signals = buildCapabilitySignals({
      message: "I need a new roof. How do I find a good roofer?",
    });
    const checker = createCapabilityChecker(signals);

    expect(checker.canFindContractors()).toBe(true);
    expect(checker.canCompareContractors()).toBe(true);
    expect(checker.canPostInCommunity()).toBe(true);

    // But not contractor capabilities
    expect(checker.canSendInvoices()).toBe(false);
  });

  it("Scenario: Contractor, no explicit profile, asks about invoicing", () => {
    const signals = buildCapabilitySignals({
      message: "I completed a job, need to invoice the homeowner for $2,500",
      recentActions: ["created_job", "completed_work"],
    });
    const checker = createCapabilityChecker(signals);

    expect(checker.canSendInvoices()).toBe(true);
    expect(checker.canMarkPaid()).toBe(true);
    expect(checker.canBidOnJobs()).toBe(true);
  });

  it("Scenario: Homeowner + HOA board member, asks about voting", () => {
    const signals = buildCapabilitySignals({
      user: {
        roles: ["homeowner", "hoa_board"],
      },
      message: "Our board is voting on a new roof for the complex",
    });
    const checker = createCapabilityChecker(signals);

    expect(checker.canFindContractors()).toBe(true);
    expect(checker.canManageHOA()).toBe(true);
    expect(checker.canReviewBids()).toBe(true);
  });

  it("Scenario: Restaurant owner, no explicit role, posts on marketplace", () => {
    const signals = buildCapabilitySignals({
      user: {
        tradeTags: ["restaurant"],
      },
      message: "We're running a special this weekend",
      recentActions: ["posted_deal"],
    });
    const checker = createCapabilityChecker(signals);

    expect(checker.canPostDeals()).toBe(true);
    expect(checker.canPostMarketplaceItem()).toBe(true);
    expect(checker.canRunPromotions()).toBe(true);
  });

  it("Scenario: Multi-contractor with crew management", () => {
    const signals = buildCapabilitySignals({
      user: {
        roles: ["contractor"],
        tradeTags: ["landscaping"],
      },
      message: "I need to schedule my crew for next week",
    });
    const checker = createCapabilityChecker(signals);

    expect(checker.canScheduleWork()).toBe(true);
    expect(checker.canManageCrew()).toBe(true);
    expect(checker.canSendInvoices()).toBe(true);
    expect(checker.canTrackProjects()).toBe(true);
  });
});
