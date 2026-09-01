import request from "supertest";
import { createApp } from "../../app";
import { db } from "../../db";
import { storage } from "../../storage";
import { hashPassword } from "../../auth";
import { users } from "../../../shared/schema";
import { CURRENT_PROFILE_VERSION } from "../../../shared/profile";

type Role =
  | "homeowner"
  | "contractor"
  | "accelerator_member"
  | "community_moderator"
  | "moderator"
  | "ops_admin"
  | "super_admin";

export type TestLoginResult = {
  agent: ReturnType<typeof request.agent>;
  user: any;
  email: string;
  password: string;
};

let sharedIntegrationApp: Promise<Awaited<ReturnType<typeof createApp>>["app"]> | null = null;

async function getTestApp() {
  if (process.env.RUN_INTEGRATION_TESTS !== "true") {
    return (await createApp()).app;
  }

  // Integration suites create many independent cookie agents. They can share
  // one Express app while keeping their cookie jars isolated, avoiding dozens
  // of duplicate PostgreSQL session stores and Passport registrations.
  sharedIntegrationApp ??= createApp().then(({ app }) => app);
  return sharedIntegrationApp;
}

async function createFixtureUser(values: Record<string, any>) {
  const email = String(values.email || "").toLowerCase();
  const isSyntheticIntegrationUser =
    process.env.RUN_INTEGRATION_TESTS === "true" && email.endsWith("@tradescout.test");

  if (!isSyntheticIntegrationUser) {
    return storage.createUser(values as any);
  }

  // These privileged-path fixtures test authorization, not the production
  // super-admin relationship provisioning. Running those historical writes for
  // synthetic users makes the shared integration database slower on every run.
  const [user] = await db
    .insert(users)
    .values(values as any)
    .returning();
  return user;
}

export async function createAuthedAgent(
  overrides: Partial<{
    role: Role | null;
    addressVerified: boolean;
    emailVerified: boolean;
    profileVersion: number;
    onboardingCompleted: boolean;
    firstName: string;
    lastName: string;
    phone: string;
    stateCode: string;
    countyFips: string;
    email: string;
  }> = {}
): Promise<TestLoginResult> {
  const app = await getTestApp();
  const agent = request.agent(app);

  const email = overrides.email ?? `test+${crypto.randomUUID()}@tradescout.test`;
  const password = `P@ssw0rd-${crypto.randomUUID()}`;

  const passwordHash = await hashPassword(password);

  const user = await createFixtureUser({
    email,
    password: passwordHash,
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? "User",
    phone: overrides.phone ?? "5555550100",
    stateCode: overrides.stateCode ?? "FL",
    countyFips: overrides.countyFips ?? "12033",
    role: (overrides.role ?? "homeowner") as any,
    emailVerified: overrides.emailVerified ?? true,
    addressVerified: overrides.addressVerified ?? true,
    onboardingCompleted: overrides.onboardingCompleted ?? true,
    profileVersion: overrides.profileVersion ?? CURRENT_PROFILE_VERSION,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  // Login to establish session cookie (tradescout.sid)
  const loginRes = await agent
    .post("/api/auth/login")
    .send({ email, password })
    .set("Content-Type", "application/json");

  if (loginRes.status !== 200) {
    throw new Error(
      `Test login failed: status=${loginRes.status} body=${JSON.stringify(loginRes.body)}`
    );
  }

  return { agent, user, email, password };
}

export async function createUserOnly(
  overrides: Partial<{
    role: Role | null;
    addressVerified: boolean;
    emailVerified: boolean;
    profileVersion: number;
    onboardingCompleted: boolean;
    firstName: string;
    lastName: string;
    phone: string;
    stateCode: string;
    countyFips: string;
  }> = {}
) {
  const email = `user+${crypto.randomUUID()}@tradescout.test`;

  const user = await createFixtureUser({
    email,
    password: null,
    firstName: overrides.firstName ?? "Recipient",
    lastName: overrides.lastName ?? "User",
    phone: overrides.phone ?? "5555550100",
    stateCode: overrides.stateCode ?? "FL",
    countyFips: overrides.countyFips ?? "12033",
    role: (overrides.role ?? "contractor") as any,
    emailVerified: overrides.emailVerified ?? true,
    addressVerified: overrides.addressVerified ?? true,
    onboardingCompleted: overrides.onboardingCompleted ?? true,
    profileVersion: overrides.profileVersion ?? CURRENT_PROFILE_VERSION,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  return user;
}
