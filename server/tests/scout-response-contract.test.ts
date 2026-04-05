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
    expect(route).toContain('from "../scout/scoutMarketplaceBehaviorOwner"');
    expect(route).not.toContain("function buildExchangeListingDraft(");
    expect(route).not.toContain("Exchange listing navigation failed");
    expect(marketplaceBehaviorOwner).toContain("export function buildExchangeListingDraft");
    expect(marketplaceBehaviorOwner).toContain(
      "export function applyMarketplaceListingNavigationOwnership"
    );
    expect(route).toContain('from "../scout/scoutProviderBehaviorOwner"');
    expect(route).not.toContain("const shouldPairHireDIY =");
    expect(providerBehaviorOwner).toContain("export function applyProviderBehaviorOwnership");
    expect(providerBehaviorOwner).toContain('type: "PREFILL_INPUT"');
    expect(providerBehaviorOwner).toContain('target: "direct_connect_request"');
    expect(providerBehaviorOwner).toContain("jobType");
    expect(providerBehaviorOwner).toContain("location");
    expect(providerBehaviorOwner).toContain("scope");
    expect(providerBehaviorOwner).toContain("urgency");
    expect(route).toContain("message,");
    expect(route).toContain("countyCode,");
    expect(route).toContain("stateCode,");
    expect(route).toContain('from "../scout/scoutSupportBehaviorOwner"');
    expect(route).not.toContain("const isCommunityVaultTopic =");
    expect(supportBehaviorOwner).toContain("export function applySupportBehaviorOwnership");
    expect(route).toContain(
      "if (isIntroQuestion(message) && !hasExplicitExternalScoutReference(message))"
    );
    expect(route).toContain("/^\\s*scout\\s*[?.!]*\\s*$/i");
    expect(route).toContain("/help\\s+me\\s+with\\s+scout/i");
    expect(route).toContain("/what\\s+do\\s+you\\s+need\\s+done/i");
  });
});
