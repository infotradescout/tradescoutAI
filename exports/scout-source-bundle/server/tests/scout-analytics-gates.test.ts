import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import scoutAnalyticsRouter from "../routes/scout-analytics";

describe("scout-analytics auth gates", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).isAuthenticated = () => false;
      next();
    });
    app.use("/api/scout-analytics", scoutAnalyticsRouter);

    const res = await request(app).get("/api/scout-analytics/authority-diagnostics");

    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).isAuthenticated = () => true;
      (req as any).user = { role: "member" };
      next();
    });
    app.use("/api/scout-analytics", scoutAnalyticsRouter);

    const res = await request(app).get("/api/scout-analytics/authority-diagnostics");

    expect(res.status).toBe(403);
    expect(String(res.body?.message || "")).toContain("Admin access required");
  });
});
