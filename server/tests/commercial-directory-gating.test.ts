import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app";

// ─────────────────────────────────────────────────────────────────────────────
// Commercial directory gating tests
//
// Behaviour as of commit a9f6482b ("Open commercial browse flow before
// verification"):
//   • The project board (GET /api/commercial-directory/projects) is open to
//     ALL authenticated users — no contractor status required.
//   • Bid submission (POST /api/commercial-directory/projects/:id/bids) still
//     requires verified contractor status and returns 403 for everyone else.
// ─────────────────────────────────────────────────────────────────────────────

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const INTEGRATION_TIMEOUT_MS = 15000;

vi.setConfig({ testTimeout: INTEGRATION_TIMEOUT_MS });

if (!hasTestDb) {
  describe.skip("Commercial directory gating", () => {
    it("skipped (requires TEST_DATABASE_URL)", () => {});
  });
} else {
  let app: any;

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;
  });

  describe("Commercial directory gating", () => {
    it("allows any authenticated user to browse the project board", async () => {
      const agent = request.agent(app);
      const email = `test+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;

      const registerRes = await agent
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email,
          password,
          firstName: "Browse",
          lastName: "Check",
          phone: "(555) 000-0001",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });
      expect(registerRes.status).toBe(200);

      // Board is open — non-contractors should get 200 (possibly empty array)
      const boardRes = await agent.get("/api/commercial-directory/projects");
      expect(boardRes.status).toBe(200);
      expect(Array.isArray(boardRes.body)).toBe(true);
    });

    it("blocks non-contractor users from submitting bids", async () => {
      const agent = request.agent(app);
      const email = `test+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;

      const registerRes = await agent
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email,
          password,
          firstName: "Bid",
          lastName: "Gate",
          phone: "(555) 000-0002",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });
      expect(registerRes.status).toBe(200);

      const bidRes = await agent
        .post("/api/commercial-directory/projects/fake-project-id/bids")
        .set("Content-Type", "application/json")
        .send({
          amount: 10000,
          timelineDays: 30,
          proposal:
            "Execution plan with staffing, schedule, and controls to satisfy bid requirements.",
        });
      expect(bidRes.status).toBe(403);
      expect(String(bidRes.body?.message || "")).toContain("Only verified contractors");
    });
  });
}
