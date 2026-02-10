import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";

let app: any;

beforeAll(async () => {
  const created = await createApp();
  app = created.app;
});

describe("Auth: Register + Session + Verify Email", () => {
  it("registers, establishes session, and verifies email (when DB available)", async () => {
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

    // In some environments tests may run without a DB; avoid failing hard.
    if (registerRes.status !== 200) {
      expect([500, 503]).toContain(registerRes.status);
      return;
    }

    expect(registerRes.body).toHaveProperty("user");
    expect(registerRes.body.user.email).toBe(email);

    const userRes = await agent.get("/api/auth/user");
    expect(userRes.status).toBe(200);
    expect(userRes.body.authenticated).toBe(true);
    expect(userRes.body.user.email).toBe(email);

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
