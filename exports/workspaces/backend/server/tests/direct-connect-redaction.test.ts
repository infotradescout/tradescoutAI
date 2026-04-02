import { describe, expect, it } from "vitest";
import { createAuthedAgent } from "./helpers/testAuth";

const hasTestDb =
  Boolean(process.env.TEST_DATABASE_URL) && process.env.RUN_INTEGRATION_TESTS === "true";

if (!hasTestDb) {
  describe.skip("Direct Connect request redaction", () => {
    it("skipped (requires TEST_DATABASE_URL)", () => {});
  });
} else {
  describe("Direct Connect request redaction", () => {
    it("redacts phone/email from title and description at create time", async () => {
      const { agent } = await createAuthedAgent({
        role: "homeowner",
        addressVerified: true,
      });

      const res = await agent
        .post("/api/direct-connect/requests")
        .set("Content-Type", "application/json")
        .send({
          title: "Need kitchen help, call 985-555-0199",
          description:
            "Reach me at owner@example.com. Need cabinet install and backsplash replacement.",
          category: "kitchen",
        });

      expect(res.status).toBe(201);
      expect(String(res.body?.title || "")).not.toContain("985-555-0199");
      expect(String(res.body?.title || "")).toContain("[hidden]");
      expect(String(res.body?.description || "")).not.toContain("owner@example.com");
      expect(String(res.body?.description || "")).toContain("[hidden]");
    });

    it("sanitizes payloads that contain only contact info", async () => {
      const { agent } = await createAuthedAgent({
        role: "homeowner",
        addressVerified: true,
      });

      const res = await agent
        .post("/api/direct-connect/requests")
        .set("Content-Type", "application/json")
        .send({
          title: "555-444-3333",
          description: "owner@example.com",
          category: "general",
        });

      expect(res.status).toBe(201);
      expect(String(res.body?.title || "")).toContain("[hidden]");
      expect(String(res.body?.description || "")).toContain("[hidden]");
    });
  });
}
