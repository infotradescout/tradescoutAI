import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyRequestSessionCookieScope: vi.fn(),
  createEmailVerificationToken: vi.fn(),
  createPasswordResetToken: vi.fn(),
  ensureProfileAccount: vi.fn(),
  ensureProfileAccountEntitlement: vi.fn(),
  getProfileAccountState: vi.fn(),
  hashPassword: vi.fn(),
  listProfileAccountEntitlements: vi.fn(),
  login: vi.fn(),
  poolQuery: vi.fn(),
  sessionSave: vi.fn(),
  storage: {
    createUser: vi.fn(),
    getSiteSettings: vi.fn(),
    getUserByEmail: vi.fn(),
  },
}));

vi.mock("../auth", () => ({
  applyRequestSessionCookieScope: mocks.applyRequestSessionCookieScope,
  hashPassword: mocks.hashPassword,
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../db", () => ({ pool: { query: mocks.poolQuery } }));
vi.mock("../services/emailService", () => ({
  emailService: {
    isConfigured: vi.fn(() => false),
    sendEmail: vi.fn(),
  },
}));
vi.mock("../services/emailVerificationService", () => ({
  emailVerificationService: { createToken: mocks.createEmailVerificationToken },
}));
vi.mock("../services/passwordResetService", () => ({
  passwordResetService: { createToken: mocks.createPasswordResetToken },
}));
vi.mock("../services/profileAccountService", () => ({
  applyProfileAccountVerificationBypass: vi.fn((account) => account),
  ensureProfileAccount: mocks.ensureProfileAccount,
  getProfileAccountState: mocks.getProfileAccountState,
}));
vi.mock("../services/profileAccountEntitlementService", () => ({
  applyProfileAccountEntitlementVerificationBypass: vi.fn((entitlements) => entitlements),
  ensureProfileAccountEntitlement: mocks.ensureProfileAccountEntitlement,
  listProfileAccountEntitlements: mocks.listProfileAccountEntitlements,
}));
vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../utils/postgresRateLimitStore", () => ({
  createPostgresRateLimitStore: vi.fn(),
}));
vi.mock("../utils/privilegedVerification", () => ({
  hasRequestPrivilegedVerificationBypass: vi.fn(() => false),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

import { registerProfileAccountRoutes } from "../routes/profile-accounts";

const validRegistration = {
  profileSlug: "jw-stone",
  businessName: "Example Stone Buyer",
  firstName: "Taylor",
  lastName: "Buyer",
  email: "buyer@example.com",
  phone: "404-555-0100",
  password: "Password1",
  acceptTerms: true,
  sourcePath: "/jw-stone",
  next: "/jw-stone?profileAccount=1",
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.login = mocks.login;
    req.session = { save: mocks.sessionSave };
    next();
  });
  registerProfileAccountRoutes(app);
  return app;
}

function expectNoRegistrationEffects() {
  expect(mocks.storage.getSiteSettings).not.toHaveBeenCalled();
  expect(mocks.getProfileAccountState).not.toHaveBeenCalled();
  expect(mocks.storage.getUserByEmail).not.toHaveBeenCalled();
  expect(mocks.hashPassword).not.toHaveBeenCalled();
  expect(mocks.storage.createUser).not.toHaveBeenCalled();
  expect(mocks.ensureProfileAccount).not.toHaveBeenCalled();
  expect(mocks.ensureProfileAccountEntitlement).not.toHaveBeenCalled();
  expect(mocks.createEmailVerificationToken).not.toHaveBeenCalled();
  expect(mocks.login).not.toHaveBeenCalled();
  expect(mocks.sessionSave).not.toHaveBeenCalled();
  expect(mocks.applyRequestSessionCookieScope).not.toHaveBeenCalled();
}

async function expectReservedRegistrationRejected(email: string) {
  const response = await request(buildApp())
    .post("/api/profile-accounts/register")
    .send({ ...validRegistration, email });

  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    message: "An account with this email already exists. Sign in to continue.",
    code: "AUTH_ACCOUNT_EXISTS",
  });
  expectNoRegistrationEffects();
}

describe("profile-account reserved email registration gate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["MASTER_ADMIN_EMAIL", "master-recovery@example.com"],
    ["SUPER_ADMIN_EMAIL_ALIASES", "super-recovery@example.com"],
    ["PRIVILEGED_ALIAS_EMAILS", "staff-recovery@example.com"],
  ])("rejects an anonymous address configured by %s before side effects", async (key, email) => {
    vi.stubEnv(key, email);

    await expectReservedRegistrationRejected(`  ${email.toUpperCase()}  `);
  });

  it.each(["contact@thetradescout.com", "info.tradescout@gmail.com"])(
    "rejects the former privileged default identity %s before side effects",
    async (email) => {
      await expectReservedRegistrationRejected(`  ${email.toUpperCase()}  `);
    }
  );
});
