import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  requireOnboardingComplete: (_req: any, _res: any, next: any) => next(),
}));

import { registerScoutRecommendations } from "../routes/scout-recommendations";

describe("scout-recommendations retired policy", () => {
  it("returns 410 for recommendations endpoint", async () => {
    const app = express();
    app.use(express.json());
    registerScoutRecommendations(app);

    const res = await request(app).post("/api/scout/recommendations").send({ intent: "help" });

    expect(res.status).toBe(410);
    expect(String(res.body?.code || "")).toBe("SCOUT_RECOMMENDATIONS_RETIRED");
  });

  it("returns 410 with empty recommendations for pending endpoint", async () => {
    const app = express();
    app.use(express.json());
    registerScoutRecommendations(app);

    const res = await request(app).get("/api/scout/recommendations/pending");

    expect(res.status).toBe(410);
    expect(Array.isArray(res.body?.recommendations)).toBe(true);
    expect(res.body.recommendations).toHaveLength(0);
  });

  it("keeps feedback endpoint available for telemetry compatibility", async () => {
    const app = express();
    app.use(express.json());
    registerScoutRecommendations(app);

    const res = await request(app).post("/api/scout/feedback/outcome").send({
      outcome: "success",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("learningEnabled", false);
    expect(String(res.body?.message || "").toLowerCase()).toContain("feedback");
  });
});
