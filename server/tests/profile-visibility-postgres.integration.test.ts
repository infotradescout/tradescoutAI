import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { profiles, users } from "@shared/schema";
import { db, pool } from "../db";
import {
  mutateExactProfileVisibilityAtomically,
  PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL,
} from "../services/profileVisibilityMutation";
import { createAuthedAgent } from "./helpers/testAuth";

const describeWithDb =
  process.env.TEST_DATABASE_URL && process.env.RUN_INTEGRATION_TESTS === "true"
    ? describe
    : describe.skip;

describeWithDb("profile visibility on disposable PostgreSQL", () => {
  it("rejects an account with no Profile without changing its preferences", async () => {
    const { agent, user } = await createAuthedAgent({ role: "homeowner" });
    const [before] = await db.select().from(users).where(eq(users.id, user.id));

    const response = await agent.patch("/api/users/profile-visibility").send({
      profileVisibility: "public",
      proceedUnverified: true,
    });

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe("profileId is required");
    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after.preferences).toEqual(before.preferences);
    expect(await db.select().from(profiles).where(eq(profiles.ownerUserId, user.id))).toEqual([]);
  });

  it("publishes and unpublishes an exact owned Profile with derived exposure", async () => {
    const { agent, user } = await createAuthedAgent({ role: "homeowner" });
    const [profile] = await db
      .insert(profiles)
      .values({
        ownerUserId: user.id,
        roleContext: "homeowner",
        slug: `visibility-pg-${crypto.randomUUID()}`,
        displayName: "Synthetic visibility fixture",
        headline: "Local homeowner profile with meaningful content",
        status: "draft",
        publiclyReleased: false,
      })
      .returning();

    const publish = await agent.patch("/api/users/profile-visibility").send({
      profileId: profile.id,
      profileVisibility: "public",
      proceedUnverified: true,
    });
    expect(publish.status).toBe(200);
    expect(publish.body).toMatchObject({ profileId: profile.id, profileStatus: "published" });
    const [published] = await db.select().from(profiles).where(eq(profiles.id, profile.id));
    expect(published).toMatchObject({ status: "published", publiclyReleased: true });
    const publicList = await agent.get("/api/profiles");
    expect(publicList.status).toBe(200);
    expect(publicList.body.find((item: { id: string }) => item.id === profile.id)?.publicExposure).toMatchObject({
      mode: "public",
    });

    const unpublish = await agent.patch("/api/users/profile-visibility").send({
      profileId: profile.id,
      profileVisibility: "private",
    });
    expect(unpublish.status).toBe(200);
    expect(unpublish.body).toMatchObject({ profileId: profile.id, profileStatus: "draft" });
    const [draft] = await db.select().from(profiles).where(eq(profiles.id, profile.id));
    expect(draft).toMatchObject({ status: "draft", publiclyReleased: false });
    const privateList = await agent.get("/api/profiles");
    expect(privateList.status).toBe(200);
    expect(privateList.body.find((item: { id: string }) => item.id === profile.id)?.publicExposure).toMatchObject({
      mode: "private",
    });
  });

  it("rolls back the real Profile write if the following preferences write fails", async () => {
    const { user } = await createAuthedAgent({ role: "homeowner" });
    const [profile] = await db
      .insert(profiles)
      .values({
        ownerUserId: user.id,
        roleContext: "homeowner",
        slug: `visibility-rollback-${crypto.randomUUID()}`,
        displayName: "Synthetic rollback fixture",
        headline: "A complete test profile",
        status: "draft",
        publiclyReleased: false,
      })
      .returning();
    const [before] = await db.select().from(users).where(eq(users.id, user.id));

    await expect(
      mutateExactProfileVisibilityAtomically(
        {
          ownerUserId: user.id,
          requestedProfileId: profile.id,
          allowLegacyActiveProfileFallback: false,
          profileVisibility: "public",
          proceedUnverified: true,
        },
        {
          connect: async () => {
            const client = await pool.connect();
            return {
              query: async (sql: string, values?: unknown[]) => {
                if (sql === PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL) {
                  throw new Error("synthetic preferences write failure");
                }
                return client.query(sql, values as any[]);
              },
              release: () => client.release(),
            };
          },
        }
      )
    ).rejects.toThrow("synthetic preferences write failure");

    const [afterProfile] = await db.select().from(profiles).where(eq(profiles.id, profile.id));
    const [afterOwner] = await db.select().from(users).where(eq(users.id, user.id));
    expect(afterProfile).toMatchObject({ status: "draft", publiclyReleased: false });
    expect(afterOwner.preferences).toEqual(before.preferences);
  });
});
