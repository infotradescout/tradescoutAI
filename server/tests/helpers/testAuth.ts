import request from "supertest";
import type { SuperAgentTest } from "supertest";
import { createApp } from "../../app";
import { storage } from "../../storage";
import { hashPassword } from "../../auth";
import { CURRENT_PROFILE_VERSION } from "../../../shared/profile";

type Role =
  | "homeowner"
  | "contractor"
  | "accelerator_member"
  | "community_moderator"
  | "moderator"
  | "ops_admin"
  | "super_admin"
  | "head_admin";

export type TestLoginResult = {
  agent: SuperAgentTest;
  user: any;
  email: string;
  password: string;
};

export async function createAuthedAgent(
  overrides: Partial<{
    role: Role | null;
    addressVerified: boolean;
    emailVerified: boolean;
    profileVersion: number;
    onboardingCompleted: boolean;
    firstName: string;
    lastName: string;
  }> = {}
): Promise<TestLoginResult> {
  const { app } = await createApp();
  const agent = request.agent(app);

  const email = `test+${crypto.randomUUID()}@tradescout.test`;
  const password = `P@ssw0rd-${crypto.randomUUID()}`;

  const passwordHash = await hashPassword(password);

  const user = await storage.createUser({
    email,
    password: passwordHash,
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? "User",
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
  }> = {}
) {
  const email = `user+${crypto.randomUUID()}@tradescout.test`;

  const user = await storage.createUser({
    email,
    password: null,
    firstName: overrides.firstName ?? "Recipient",
    lastName: overrides.lastName ?? "User",
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
