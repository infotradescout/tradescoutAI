import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { storage } from "../storage";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const authFlowTimeoutMs = 45_000;

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
    it(
      "registers, establishes session, and verifies email",
      async () => {
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

        const verificationResponseMessage =
          "If an account exists, a verification link has been sent.";
        const existingVerificationRes = await request(app)
          .post("/api/auth/request-email-verification")
          .set("Content-Type", "application/json")
          .send({ email, next: "/pre-scout-setup" });
        const missingVerificationRes = await request(app)
          .post("/api/auth/request-email-verification")
          .set("Content-Type", "application/json")
          .send({
            email: `missing+${crypto.randomUUID()}@tradescout.test`,
            next: "/pre-scout-setup",
          });
        expect(existingVerificationRes.status).toBe(200);
        expect(missingVerificationRes.status).toBe(200);
        expect(existingVerificationRes.body.message).toBe(verificationResponseMessage);
        expect(missingVerificationRes.body.message).toBe(verificationResponseMessage);

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

        const token =
          existingVerificationRes.body.verificationToken || registerRes.body.verificationToken;
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

          const verifiedVerificationRes = await request(app)
            .post("/api/auth/request-email-verification")
            .set("Content-Type", "application/json")
            .send({ email, next: "/pre-scout-setup" });
          expect(verifiedVerificationRes.status).toBe(200);
          expect(verifiedVerificationRes.body.message).toBe(verificationResponseMessage);
        }
      },
      authFlowTimeoutMs
    );

    it("returns AUTH_ACCOUNT_EXISTS on duplicate /api/auth/register", async () => {
      const email = `dup+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;

      const createRes = await request(app)
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email,
          password,
          firstName: "First",
          lastName: "User",
          phone: "(555) 000-1000",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });
      expect(createRes.status).toBe(200);

      const duplicateRes = await request(app)
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email,
          password,
          firstName: "Second",
          lastName: "User",
          phone: "(555) 000-1001",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body?.code).toBe("AUTH_ACCOUNT_EXISTS");
      expect(Array.isArray(duplicateRes.body?.availableAuthMethods)).toBe(true);
      expect(duplicateRes.body?.availableAuthMethods).toContain("password");
    });

    it("returns AUTH_ACCOUNT_EXISTS on duplicate /api/auth/register-multi", async () => {
      const email = `dup-multi+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;

      const createRes = await request(app)
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email,
          password,
          firstName: "Multi",
          lastName: "Owner",
          phone: "(555) 000-2000",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });
      expect(createRes.status).toBe(200);

      const duplicateRes = await request(app)
        .post("/api/auth/register-multi")
        .set("Content-Type", "application/json")
        .send({
          email,
          password: `P@ssw0rd-${crypto.randomUUID()}`,
          firstName: "Multi",
          lastName: "Owner",
          phone: "(555) 000-2001",
          acceptTerms: true,
          profiles: [{ userIntent: "person" }],
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body?.code).toBe("AUTH_ACCOUNT_EXISTS");
      expect(Array.isArray(duplicateRes.body?.availableAuthMethods)).toBe(true);
      expect(duplicateRes.body?.availableAuthMethods).toContain("password");
    });

    it("rejects unverified reserved aliases without creating a user or session", async () => {
      const previous = process.env.PRIVILEGED_ALIAS_EMAILS;

      try {
        for (const endpoint of ["/api/auth/register", "/api/auth/register-multi"] as const) {
          const email = `reserved+${crypto.randomUUID()}@tradescout.test`;
          process.env.PRIVILEGED_ALIAS_EMAILS = email;
          const agent = request.agent(app);
          const basePayload = {
            email,
            password: `P@ssw0rd-${crypto.randomUUID()}`,
            firstName: "Reserved",
            lastName: "Candidate",
            phone: "(555) 000-3000",
            acceptTerms: true,
          };

          const registerRes = await agent
            .post(endpoint)
            .set("Content-Type", "application/json")
            .send(
              endpoint.endsWith("register-multi")
                ? { ...basePayload, profiles: [{ userIntent: "person" }] }
                : { ...basePayload, userTypes: ["homeowner"] }
            );

          expect(registerRes.status).toBe(409);
          expect(registerRes.body?.code).toBe("AUTH_ACCOUNT_EXISTS");
          expect(await storage.getUserByEmail(email)).toBeFalsy();

          const authRes = await agent.get("/api/auth/user");
          expect(authRes.status).toBe(200);
          expect(authRes.body?.authenticated).toBe(false);
        }
      } finally {
        if (typeof previous === "undefined") {
          delete process.env.PRIVILEGED_ALIAS_EMAILS;
        } else {
          process.env.PRIVILEGED_ALIAS_EMAILS = previous;
        }
      }
    });

    it.each(["contact@thetradescout.com", "info.tradescout@gmail.com"])(
      "rejects reserved service identity %s with empty authority alias configuration",
      async (email) => {
        const envKeys = [
          "MASTER_ADMIN_EMAIL",
          "SUPER_ADMIN_EMAIL_ALIASES",
          "PRIVILEGED_ALIAS_EMAILS",
        ] as const;
        const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
        for (const key of envKeys) delete process.env[key];

        try {
          for (const endpoint of ["/api/auth/register", "/api/auth/register-multi"] as const) {
            const agent = request.agent(app);
            const basePayload = {
              email,
              password: `P@ssw0rd-${crypto.randomUUID()}`,
              firstName: "Service",
              lastName: "Identity",
              phone: "(555) 000-3001",
              acceptTerms: true,
            };
            const response = await agent
              .post(endpoint)
              .set("Content-Type", "application/json")
              .send(
                endpoint.endsWith("register-multi")
                  ? { ...basePayload, profiles: [{ userIntent: "person" }] }
                  : { ...basePayload, userTypes: ["homeowner"] }
              );

            expect(response.status).toBe(409);
            expect(response.body?.code).toBe("AUTH_ACCOUNT_EXISTS");
            const authResponse = await agent.get("/api/auth/user");
            expect(authResponse.body?.authenticated).toBe(false);
          }
        } finally {
          for (const key of envKeys) {
            const value = previous[key];
            if (typeof value === "undefined") delete process.env[key];
            else process.env[key] = value;
          }
        }
      }
    );
  });
}
