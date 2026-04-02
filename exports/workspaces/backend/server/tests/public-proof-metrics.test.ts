import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

if (!hasTestDb) {
  describe.skip("GET /api/public/proof-metrics", () => {
    it("skipped (requires TEST_DATABASE_URL)", () => {});
  });
} else {
  let app: any;

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;
  });

  describe("GET /api/public/proof-metrics", () => {
    it("returns counts-only payload with cache headers", async () => {
      const res = await request(app).get("/api/public/proof-metrics");

      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBeTruthy();

      expect(res.body).toHaveProperty("generatedAt");
      expect(res.body).toHaveProperty("cacheSeconds");
      expect(res.body).toHaveProperty("countiesIndexed");
      expect(res.body).toHaveProperty("decisionsLast7Days");
      expect(res.body).toHaveProperty("verifiedClaimsLast30Days");

      expect(typeof res.body.countiesIndexed).toBe("number");
      expect(typeof res.body.decisionsLast7Days).toBe("number");
      expect(typeof res.body.verifiedClaimsLast30Days).toBe("number");

      // PII guard: counts only
      expect(res.body).not.toHaveProperty("users");
      expect(res.body).not.toHaveProperty("emails");
      expect(res.body).not.toHaveProperty("names");
    });
  });
}
