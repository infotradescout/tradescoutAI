import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Scout evolution wiring contracts", () => {
  it("wires ObjectiveOnboardingFlow and WatchdogInterventionBanner into ScoutOS", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain('import ObjectiveOnboardingFlow from "./ObjectiveOnboardingFlow"');
    expect(source).toContain(
      'import WatchdogInterventionBanner from "./WatchdogInterventionBanner"'
    );
    expect(source).toContain("<ObjectiveOnboardingFlow");
    expect(source).toContain("<WatchdogInterventionBanner");
  });

  it("calls new Scout evolution endpoints from ScoutOS", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain('"/api/scout/onboarding/objective-bundle"');
    expect(source).toContain('"/api/scout/watchdog/evaluate"');
  });

  it("exposes server endpoints for onboarding, watchdog, tone, and trust", () => {
    const source = read("server/routes/scout.ts");

    expect(source).toContain('router.post("/onboarding/objective-bundle"');
    expect(source).toContain('router.post("/watchdog/evaluate"');
    expect(source).toContain('router.post("/tone/build"');
    expect(source).toContain('router.post("/trust/enrich-routing"');
  });
});
