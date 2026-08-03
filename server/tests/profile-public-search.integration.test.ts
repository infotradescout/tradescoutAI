import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { profiles, users } from "@shared/schema";
import { db } from "../db";
import { ProfileRepository } from "../repositories/profileRepository";
import { createUserOnly } from "./helpers/testAuth";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

vi.setConfig({ testTimeout: 30_000 });

describeWithDb("public profile search integration (no mocks)", () => {
  it("executes the trust predicate when verification status is a PostgreSQL enum", async () => {
    const user = await createUserOnly({ role: "homeowner" });
    const userId = String(user.id);
    const unique = crypto.randomUUID();
    let profileId = "";

    try {
      await db
        .update(users)
        .set({
          preferences: { profileVisibility: "public" },
          verificationStatus: "pending",
        } as any)
        .where(eq(users.id, userId));

      const [profile] = await db
        .insert(profiles)
        .values({
          ownerUserId: userId,
          businessId: null,
          roleContext: "homeowner",
          slug: `enum-search-${unique}`,
          displayName: `Enum Search ${unique}`,
          headline: "Public search enum regression fixture",
          status: "published",
        })
        .returning({ id: profiles.id });

      profileId = String(profile?.id || "");
      expect(profileId).not.toBe("");

      const repository = new ProfileRepository();
      const results = await repository.searchProfilesPublic({ query: unique, limit: 8 });

      expect(results).toEqual([
        expect.objectContaining({
          id: profileId,
          slug: `enum-search-${unique}`,
          displayName: `Enum Search ${unique}`,
        }),
      ]);
    } finally {
      if (profileId) {
        await db.delete(profiles).where(eq(profiles.id, profileId));
      }
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});
