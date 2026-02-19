import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

if (!hasTestDb) {
  // Avoid noisy 500 logs from booting the app with a disabled DB proxy.
  describe.skip("Auth: Register + Session + Verify Email", () => {
    it("skipped (requires TEST_DATABASE_URL)", () => {});
  });
} else {
  let app: any;

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;
  });

  describe("Auth: Register + Session + Verify Email", () => {
    it("registers, establishes session, and verifies email", async () => {
      const agent = request.agent(app);

      const email = `test+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;

      const registerRes = await agent
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email,
          password,
          firstName: "Test",
          lastName: "User",
          phone: "(555) 123-4567",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });

      expect(registerRes.status).toBe(200);
      expect(registerRes.body).toHaveProperty("user");
      expect(registerRes.body.user.email).toBe(email);

      const userRes = await agent.get("/api/auth/user");
      expect(userRes.status).toBe(200);
      if (userRes.body.authenticated === true) {
        expect(userRes.body.user.email).toBe(email);
      } else {
        const loginRes = await agent
          .post("/api/auth/login")
          .set("Content-Type", "application/json")
          .send({ email, password });
        expect(loginRes.status).toBe(200);

        const userResAfterLogin = await agent.get("/api/auth/user");
        expect(userResAfterLogin.status).toBe(200);
        expect(userResAfterLogin.body.authenticated).toBe(true);
        expect(userResAfterLogin.body.user.email).toBe(email);
      }

      const token = registerRes.body.verificationToken;
      const verificationRequired = registerRes.body.emailVerificationRequired === true;

      if (verificationRequired && typeof token === "string" && token.length > 10) {
        const verifyRes = await agent
          .post("/api/auth/verify-email")
          .set("Content-Type", "application/json")
          .send({ token });
        expect(verifyRes.status).toBe(200);

        const userResAfter = await agent.get("/api/auth/user");
        expect(userResAfter.status).toBe(200);
        expect(userResAfter.body.authenticated).toBe(true);
        expect(userResAfter.body.user.emailVerified).toBe(true);
      }
    });
  });
}
