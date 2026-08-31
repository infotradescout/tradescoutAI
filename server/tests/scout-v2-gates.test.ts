import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import scoutV2Router from "../routes/scout-v2";

describe("scout-v2 auth gates", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).isAuthenticated = () => false;
      next();
    });
    app.use("/api/scout-v2", scoutV2Router);

    const res = await request(app).get("/api/scout-v2/status");

    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).isAuthenticated = () => true;
      (req as any).user = { role: "member" };
      (req as any).requestAuthorityContext = { ok: true, isImpersonating: false };
      next();
    });
    app.use("/api/scout-v2", scoutV2Router);

    const res = await request(app).get("/api/scout-v2/status");

    expect(res.status).toBe(403);
    expect(String(res.body?.message || res.body?.error || "")).toContain("Admin access required");
  });
});
