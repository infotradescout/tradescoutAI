import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import scoutPlatformDiscoveryRouter from "../routes/scout-platform-discovery";

describe("scout-platform-discovery", () => {
  it("returns 400 when /search query is missing", async () => {
    const app = express();
    app.use("/api/scout-platform-discovery", scoutPlatformDiscoveryRouter);

    const res = await request(app).get("/api/scout-platform-discovery/search");

    expect(res.status).toBe(400);
    expect(String(res.body?.error || "")).toContain("Query parameter is required");
  });

  it("returns 200 and structured response for valid /search", async () => {
    const app = express();
    app.use("/api/scout-platform-discovery", scoutPlatformDiscoveryRouter);

    const res = await request(app)
      .get("/api/scout-platform-discovery/search")
      .query({ query: "community" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("query", "community");
    expect(res.body).toHaveProperty("matches_found");
    expect(Array.isArray(res.body.features)).toBe(true);
  });

  it("returns 404 for unknown feature id", async () => {
    const app = express();
    app.use("/api/scout-platform-discovery", scoutPlatformDiscoveryRouter);

    const res = await request(app).get("/api/scout-platform-discovery/feature/not-a-real-feature");

    expect(res.status).toBe(404);
    expect(String(res.body?.error || "")).toContain("Feature not found");
  });
});
