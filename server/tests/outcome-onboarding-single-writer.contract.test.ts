import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { onboardingRouter } from "../routes/onboarding";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("single onboarding completion authority", () => {
  it("retires every legacy completion writer before its old handler can run", () => {
    const routes = read("server/routes.ts");
    const onboardingRoutes = read("server/routes/onboarding.ts");
    const mount = routes.indexOf("app.use(onboardingRouter)");

    expect(onboardingRoutes).toContain('code: "OUTCOME_ONBOARDING_REQUIRED"');
    expect(mount).toBeGreaterThan(-1);
    for (const endpoint of [
      "/api/auth/complete-onboarding",
      "/api/user/complete-onboarding",
      "/api/auth/setup-profile",
      "/api/auth/skip-onboarding",
    ]) {
      expect(onboardingRoutes).toContain(`"${endpoint}"`);
      expect(routes.indexOf(`"${endpoint}"`, mount)).toBeGreaterThan(mount);
    }
    expect(routes.indexOf('app.patch("/api/auth/user"', mount)).toBeGreaterThan(mount);
  });

  it("leaves no production client caller for a retired completion endpoint", () => {
    const scoutOnboarding = read("client/src/scout/useScoutOnboarding.ts");
    const profileSetup = read("client/src/pages/profile-setup.tsx");
    const combined = `${scoutOnboarding}\n${profileSetup}`;

    expect(combined).not.toContain("/api/auth/complete-onboarding");
    expect(combined).not.toContain("/api/user/complete-onboarding");
    expect(combined).not.toContain("/api/auth/setup-profile");
  });

  it.each([
    "/api/auth/complete-onboarding",
    "/api/user/complete-onboarding",
    "/api/auth/setup-profile",
    "/api/auth/skip-onboarding",
  ])("returns 410 before a retired authenticated handler can mutate: %s", async (endpoint) => {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: "user-1" };
      next();
    });
    app.use(onboardingRouter);

    const response = await request(app).post(endpoint).send({ onboardingCompleted: true });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({
      code: "OUTCOME_ONBOARDING_REQUIRED",
      message: "Complete the universal outcome onboarding flow.",
      next: "/onboarding",
    });
  });

  it("retires the PATCH compatibility writer before it can mutate", async () => {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: "user-1" };
      next();
    });
    app.use(onboardingRouter);

    const response = await request(app).patch("/api/auth/user").send({ onboardingCompleted: true });

    expect(response.status).toBe(410);
    expect(response.body.code).toBe("OUTCOME_ONBOARDING_REQUIRED");
  });
});
