import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

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
    it("blocks non-contractor users from open project board and bid submission", async () => {
      const agent = request.agent(app);
      const email = `test+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;

      const registerRes = await agent
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email,
          password,
          firstName: "Gate",
          lastName: "Check",
          phone: "(555) 000-0000",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });

      expect(registerRes.status).toBe(200);

      const boardRes = await agent.get("/api/commercial-directory/projects");
      expect(boardRes.status).toBe(403);
      expect(String(boardRes.body?.message || "")).toContain("requires verified contractor status");

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
