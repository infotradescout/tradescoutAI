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
  });
});
