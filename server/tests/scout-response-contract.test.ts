import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("scout response contract guards", () => {
  it("defines a dedicated server response contract module", () => {
    const source = read("server/scout/scoutResponseContract.ts");

    expect(source).toContain("export function finalizeScoutResponse");
    expect(source).toContain("missing_message");
    expect(source).toContain("DEFAULT_FALLBACK_MESSAGE");
    expect(source).toContain("sanitizeActions");
    expect(source).toContain("enforceTradeScoutIdentityBoundary");
    expect(source).toContain("identity_boundary_override");
  });

  it("locks Scout identity to TradeScout and blocks external reinterpretation leakage", () => {
    const brandGuard = read("server/scout/brandGuard.ts");
    const route = read("server/routes/scout.ts");

    expect(brandGuard).toContain("TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE");
    expect(brandGuard).toContain("enforceTradeScoutIdentityBoundary");
    expect(brandGuard).toContain(
      "I'm Scout. Tell me what you need done, and I'll route the next step."
    );
    expect(brandGuard).not.toContain("I'm Scout inside TradeScout");
    expect(brandGuard).toContain("scout\\.com");
    expect(brandGuard).toContain("247sports");
    expect(brandGuard).toContain("athletic\\s+recruiting");
    expect(brandGuard).toContain("assuming\\s+this\\s+context");
    expect(route).toContain("synthesized.message = TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE;");
    expect(route).not.toContain("trimResponseToScreenFit(TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE)");
  });

  it("routes /api/scout responses through the response contract", () => {
    const source = read("server/routes/scout.ts");

    expect(source).toContain("finalizeScoutResponse");
    expect(source).toContain("(res as any).json = (payload: unknown)");
    expect(source).toContain("Enforce canonical Scout response contract");
  });

  it("polishes bad local-help answers before they reach users", async () => {
    const { finalizeScoutResponse } = await import("../scout/scoutResponseContract");

    const result = finalizeScoutResponse(
      {
        message:
          "Start with 211 Louisiana for free referrals, and TCAP if you may need help with housing, utilities, or emergency assistance; this info comes from w...",
      },
      {
        requestMessage:
          "Find local help for this. Show the best options and what I should know before contacting anyone.",
      }
    ) as { message: string; metadata?: Record<string, unknown> };

    expect(result.message).toContain("I’m treating this as a local help need.");
    expect(result.message).toContain("Nothing is sent, posted, or shared until you approve it.");
    expect(result.message).not.toMatch(/211 Louisiana|TCAP|housing|utilities|w\.\.\./i);
    expect(result.metadata?.launchPolished).toBe(true);
  });

  it("rewrites unsupported action claims before they reach users", async () => {
    const { finalizeScoutResponse } = await import("../scout/scoutResponseContract");

    const result = finalizeScoutResponse(
      {
        message: "Great, I’ve booked a local contractor for you already.",
      },
      {
        requestMessage: "Need a plumber in my area.",
      }
    ) as { message: string };

    expect(result.message).toContain("I can help prepare that action");
    expect(result.message).toContain(
      "You stay in control: nothing is booked, ordered, paid, messaged, posted, quoted, or invoiced unless you approve it first."
    );
    expect(result.message).not.toContain("a local contractor for you already");
    expect(result.message).not.toMatch(
      /\bi(?:['’]ve\s+|\s+have\s+|\s+)(?:booked|ordered|paid|messaged|contacted|published|posted|sent|invoiced|quoted)\b/i
    );
  });

  it("blocks competitor-pattern drift around form traps, lead selling, and paid ranking", async () => {
    const { finalizeScoutResponse } = await import("../scout/scoutResponseContract");

    const samples = [
      "You must complete the full form before I can help, then your lead is sold to the highest bidder.",
      "These sponsored contractors rank first because they paid for premium provider placement.",
    ];

    for (const sample of samples) {
      const result = finalizeScoutResponse(
        {
          message: sample,
        },
        {
          requestMessage: "Need a roofer near me.",
        }
      ) as { message: string; metadata?: Record<string, unknown> };

      expect(result.message).toContain("You can keep going in chat or open a draft request");
      expect(result.message).toContain(
        "TradeScout does not sell leads or rank providers because they paid."
      );
      expect(result.message).toContain("unless you approve it first");
      expect(result.message).not.toMatch(
        /must complete|full form|lead is sold|highest bidder|sponsored|premium provider placement/i
      );
      expect(result.metadata?.launchPolishReason).toBe("competitive_pattern_guard");
    }
  });

  it("keeps assistance-resource answers when the user asked for assistance", async () => {
    const { finalizeScoutResponse } = await import("../scout/scoutResponseContract");

    const result = finalizeScoutResponse(
      {
        message:
          "Start with 211 Louisiana for free referrals, and TCAP if you may need help with housing or utilities.",
      },
      {
        requestMessage: "I need emergency housing and utility assistance near me.",
      }
    ) as { message: string };

    expect(result.message).toContain("211 Louisiana");
  });

  it("defines shared Scout request/decision/response types", () => {
    const source = read("shared/types/scout.ts");

    expect(source).toContain("NormalizedScoutRequest");
    expect(source).toContain("ScoutDecision");
    expect(source).toContain("ScoutResponseContract");
  });

  it("includes scaffold pipeline modules for ordered route split", () => {
    const normalizer = read("server/scout/scoutRequestNormalizer.ts");
    const decision = read("server/scout/scoutDecisionPipeline.ts");
    const synthesis = read("server/scout/scoutSynthesisPipeline.ts");
    const composer = read("server/scout/scoutActionComposer.ts");
    const route = read("server/routes/scout.ts");

    expect(normalizer).toContain("normalizeScoutRequest");
    expect(decision).toContain("runScoutDecisionPipeline");
    expect(synthesis).toContain("buildFallbackSynthesis");
    expect(composer).toContain("composeScoutActions");
    expect(route).toContain("normalizeScoutRequest");
    expect(route).toContain("runScoutDecisionPipeline");
  });

  it("uses decision pipeline for authoritative pre-synthesis routing", () => {
    const decision = read("server/scout/scoutDecisionPipeline.ts");
    const route = read("server/routes/scout.ts");
    const homeProjectRouting = read("server/scout/scoutHomeProjectRouting.ts");
    const communityBehaviorOwner = read("server/scout/scoutCommunityBehaviorOwner.ts");
    const marketplaceBehaviorOwner = read("server/scout/scoutMarketplaceBehaviorOwner.ts");
    const providerBehaviorOwner = read("server/scout/scoutProviderBehaviorOwner.ts");
    const supportBehaviorOwner = read("server/scout/scoutSupportBehaviorOwner.ts");

    expect(decision).toContain("auth_required");
    expect(decision).toContain("explicit_navigation");
    expect(decision).toContain("home_project_routing");
    expect(decision).toContain("server_behavior_handler");
    expect(route).toContain("decision_pipeline_behavior_handler");
    expect(route).toContain("decision_pipeline_explicit_navigation");
    expect(route).toContain("decision_pipeline_home_project_router");
    expect(route).not.toContain('sources: ["Auth preflight"]');
    expect(route).not.toContain("deterministic_home_project_router");
    expect(route).not.toContain('synthesized.intent === "auth_required"');
    expect(route).toContain('from "../scout/scoutHomeProjectRouting"');
    expect(route).not.toContain("function detectTradeTopic(");
    expect(route).not.toContain("function maybeHandleHomeProjectRouting(");
    expect(homeProjectRouting).toContain("export function maybeHandleHomeProjectRouting");
    expect(route).toContain('from "../scout/scoutCommunityBehaviorOwner"');
    expect(route).not.toContain("const mentionsCommunityQuestion =");
    expect(route).not.toContain("community suggestion logic failed");
    expect(route).not.toContain("welcome draft navigation failed");
    expect(communityBehaviorOwner).toContain("export function applyCommunityBehaviorOwnership");
    expect(communityBehaviorOwner).toContain('type: "PREFILL_INPUT"');
    expect(communityBehaviorOwner).toContain('target: "community_post"');
    expect(communityBehaviorOwner).toContain("title");
    expect(communityBehaviorOwner).toContain("body");
    expect(communityBehaviorOwner).toContain("countyCode");
    expect(communityBehaviorOwner).toContain("category");
    expect(communityBehaviorOwner).toContain("visibility");
    expect(communityBehaviorOwner).toContain("confidenceBand");
    expect(communityBehaviorOwner).toContain("confirmRequiredFields");
    expect(route).toContain("confidenceBand: routingConfidenceBand");
    expect(route).toContain('from "../scout/scoutMarketplaceBehaviorOwner"');
    expect(route).not.toContain("function buildExchangeListingDraft(");
    expect(route).not.toContain("Exchange listing navigation failed");
    expect(marketplaceBehaviorOwner).toContain("export function buildExchangeListingDraft");
    expect(marketplaceBehaviorOwner).toContain(
      "export function applyMarketplaceListingNavigationOwnership"
    );
    expect(marketplaceBehaviorOwner).toContain('type: "PREFILL_INPUT"');
    expect(marketplaceBehaviorOwner).toContain('target: "exchange_listing"');
    expect(marketplaceBehaviorOwner).toContain("title");
    expect(marketplaceBehaviorOwner).toContain("category");
    expect(marketplaceBehaviorOwner).toContain("location");
    expect(marketplaceBehaviorOwner).toContain("price");
    expect(marketplaceBehaviorOwner).toContain("description");
    expect(marketplaceBehaviorOwner).toContain("confidenceBand");
    expect(marketplaceBehaviorOwner).toContain("confirmRequiredFields");
    expect(route).toContain("confidenceBand: routingConfidenceBand");
    expect(route).toContain('from "../scout/scoutProviderBehaviorOwner"');
    expect(route).not.toContain("const shouldPairHireDIY =");
    expect(providerBehaviorOwner).toContain("export function applyProviderBehaviorOwnership");
    expect(providerBehaviorOwner).toContain('type: "PREFILL_INPUT"');
    expect(providerBehaviorOwner).toContain('target: "direct_connect_request"');
    expect(providerBehaviorOwner).toContain("jobType");
    expect(providerBehaviorOwner).toContain("location");
    expect(providerBehaviorOwner).toContain("scope");
    expect(providerBehaviorOwner).toContain("urgency");
    expect(providerBehaviorOwner).toContain("confidenceBand");
    expect(providerBehaviorOwner).toContain("confirmRequiredFields");
    expect(providerBehaviorOwner).toContain('type: "ASK_SCOUT"');
    expect(route).toContain("message,");
    expect(route).toContain("countyCode,");
    expect(route).toContain("stateCode,");
    expect(route).toContain("confidenceBand: routingConfidenceBand");
    expect(route).toContain('from "../scout/scoutSupportBehaviorOwner"');
    expect(route).not.toContain("const isCommunityVaultTopic =");
    expect(supportBehaviorOwner).toContain("export function applySupportBehaviorOwnership");
    expect(route).toContain("!isClearProviderServiceIntent(message)");
    expect(route).toContain("function isClearProviderServiceIntent(message: string): boolean");
    expect(route).toContain("ac\\s+repair");
    expect(route).toContain("const providerIntentCategory = forceProviderPath");
    expect(route).toContain('"provider_search"');
    expect(route).toContain("const routingConfidenceBand = forceProviderPath");
    expect(route).toContain('? "high"');
    expect(route).toContain("/^\\s*scout\\s*[?.!]*\\s*$/i");
    expect(route).toContain("/help\\s+me\\s+with\\s+scout/i");
    expect(route).toContain("/what\\s+do\\s+you\\s+need\\s+done/i");
    expect(route).toContain("scout_outcome_action_generated");
    expect(route).toContain("scout_outcome_action_clicked");
    expect(route).toContain("scout_outcome_action_submitted");
  });
});
