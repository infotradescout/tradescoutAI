import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("unified scout routing endpoint contracts", () => {
  it("exposes routing endpoints under /api/scout/routing", () => {
    const source = read("server/routes/scout.ts");

    expect(source).toContain('router.post("/routing/resolve-intent"');
    expect(source).toContain('router.post("/routing/validate-action"');
    expect(source).toContain('router.post("/routing/discover-features"');
    expect(source).toContain('router.post("/routing/generate-fallback"');
  });

  it("applies unified validation before guarded action execution", () => {
    const source = read("server/routes/scout.ts");

    expect(source).toContain("UnifiedScoutRouter.validateAction(action, routingContext)");
    expect(source).toContain(
      "const statusCode = routingValidation.metadata?.requiresAuth ? 401 : 403;"
    );
  });

  it("exposes evolution endpoints for onboarding/watchdog/tone/trust integration", () => {
    const source = read("server/routes/scout.ts");

    expect(source).toContain('router.post("/onboarding/objective-bundle"');
    expect(source).toContain('router.post("/watchdog/evaluate"');
    expect(source).toContain('router.post("/tone/build"');
    expect(source).toContain('router.post("/trust/enrich-routing"');
  });
});
