import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("tutorial route extraction", () => {
  it("keeps tutorial behavior in its own registered route module", () => {
    const rootRoutes = read("server/routes.ts");
    const tutorialRoutes = read("server/routes/tutorials.ts");

    expect(rootRoutes).toContain('import { registerTutorialRoutes } from "./routes/tutorials";');
    expect(rootRoutes).toContain("registerTutorialRoutes(app);");
    expect(rootRoutes).not.toContain('app.get("/api/tutorials/user-progress"');
    expect(rootRoutes).not.toContain('app.post("/api/tutorials/:tutorialId/start"');

    for (const route of [
      "/api/tutorials/user-progress",
      "/api/tutorials/recommended",
      "/api/tutorials/:tutorialId",
      "/api/tutorials/:tutorialId/start",
      "/api/tutorials/:tutorialId/progress",
      "/api/tutorials/:tutorialId/complete",
      "/api/tutorials/:tutorialId/skip",
      "/api/tutorials/check/:featureId",
    ]) {
      expect(tutorialRoutes).toContain(route);
    }

    expect(tutorialRoutes).toContain("tutorialStorage.recordTutorialAnalytics");
    expect(tutorialRoutes).toContain("tutorialStorage.createOrUpdateTutorialProgress");
    expect(tutorialRoutes).toContain("tutorialStorage.markTutorialCompleted");
    expect(tutorialRoutes).toContain("tutorialStorage.markTutorialSkipped");
  });
});
