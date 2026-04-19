import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("scout gemini fallback wiring contract", () => {
  it("exposes gemini fallback runtime state on admin system status", () => {
    // The admin status response is assembled in scoutAdminRoutes.ts and registered
    // into the router via registerScoutAdminRoutes in scout.ts
    const adminRoutes = read("server/scout/scoutAdminRoutes.ts");
    const route = read("server/routes/scout.ts");
    expect(adminRoutes).toContain("getGeminiFallbackRuntimeState");
    expect(adminRoutes).toContain("geminiFallback: getGeminiFallbackRuntimeState()");
    expect(adminRoutes).toContain("getLlmProviderFailoverRuntimeState");
    expect(adminRoutes).toContain("llmFailover: getLlmProviderFailoverRuntimeState()");
    // scout.ts must import and pass these functions into the admin routes module
    expect(route).toContain("getGeminiFallbackRuntimeState");
    expect(route).toContain("getLlmProviderFailoverRuntimeState");
  });

  it("records fallback reasons for degraded synthesis paths", () => {
    const source = read("server/routes/scout.ts");
    expect(source).toContain('recordFallback("schema_violation")');
    expect(source).toContain('recordFallback("json_parse_error")');
    expect(source).toContain('recordFallback(isRateLimited ? "synthesis_rate_limited"');
    expect(source).toContain("degradationReason?: ScoutDegradationReason");
    expect(source).toContain('degradationReason: "provider_unavailable"');
    expect(source).toContain('degradationReason: "schema_violation"');
  });

  it("keeps intro questions broad and avoids raw system-error copy", () => {
    const source = read("server/routes/scout.ts");
    expect(source).toContain("/what\\s+can\\s+you\\s+do(\\s+for\\s+me)?/i");
    expect(source).toContain("/how\\s+can\\s+you\\s+help(\\s+me)?/i");
    expect(source).not.toContain(
      "I encountered a system error. Please try rephrasing your question."
    );
    expect(source).toContain("buildContextualSynthesisFallbackMessage(knowledge.answer)");
  });

  it("routes homeowner project asks into planning before generic fallback", () => {
    // maybeHandleHomeProjectRouting is defined in scoutHomeProjectRouting.ts and
    // imported + called in scout.ts — the function definition lives in the module file
    const homeProjectRouting = read("server/scout/scoutHomeProjectRouting.ts");
    const route = read("server/routes/scout.ts");
    expect(homeProjectRouting).toContain("export function maybeHandleHomeProjectRouting");
    expect(homeProjectRouting).toContain('label: "Start or plan this project"');
    expect(homeProjectRouting).toContain('to: "/project-tracker"');
    expect(homeProjectRouting).toContain('intent: "home_project_decking"');
    // scout.ts imports and calls the function; uses decision_pipeline_home_project_router as sourceUsed
    expect(route).toContain('from "../scout/scoutHomeProjectRouting"');
    expect(route).toContain("maybeHandleHomeProjectRouting");
    expect(route).toContain("decision_pipeline_home_project_router");
  });
});
