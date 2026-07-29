import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Scout evolution wiring contracts", () => {
  it("keeps objective and watchdog context without competing result renderers", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain('import ObjectiveOnboardingFlow from "./ObjectiveOnboardingFlow"');
    expect(source).toContain(
      'import WatchdogInterventionBanner from "./WatchdogInterventionBanner"'
    );
    expect(source).toContain("<ObjectiveOnboardingFlow");
    expect(source).toContain("<WatchdogInterventionBanner");
    expect(source).not.toContain('import TrustAwareDecisionCard from "./TrustAwareDecisionCard"');
    expect(source).not.toContain('import ToneAwareMessage from "./ToneAwareMessage"');
    expect(source).not.toContain("<TrustAwareDecisionCard");
    expect(source).not.toContain("<ToneAwareMessage");
    expect(source).toContain("resultContract: {");
  });

  it("does not reclassify or restyle the server-owned answer on the client", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain('"/api/scout/onboarding/objective-bundle"');
    expect(source).toContain('"/api/scout/watchdog/evaluate"');
    expect(source).not.toContain('"/api/scout/tone/build"');
    expect(source).not.toContain("UnifiedScoutRouterClient.resolveIntent(");
  });

  it("exposes server endpoints for onboarding, watchdog, tone, and trust", () => {
    const source = read("server/routes/scout.ts");

    expect(source).toContain('router.post("/onboarding/objective-bundle"');
    expect(source).toContain('router.post("/watchdog/evaluate"');
    expect(source).toContain('router.post("/tone/build"');
    expect(source).toContain('router.post("/trust/enrich-routing"');
  });
});
