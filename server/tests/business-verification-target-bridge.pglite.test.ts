import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { businesses, profiles, userProfiles, users } from "@shared/schema";
import { profileVerificationSubmissionSchema } from "../services/businessVerificationWorkflow";
import { PROFILE_VISIBILITY_RELEASE_SQL } from "../services/profileVisibilityMutation";
import {
  businessVerificationProfileId,
  ensureBusinessVerificationProfile,
  resolveOwnedPublicVerificationProfile,
  reviewBusinessVerification,
  submitOwnedBusinessVerification,
  updateUserWithBusinessVerificationAuthority,
} from "../services/businessVerificationTargetBridge";

// Actual Drizzle persistence and canonical workflow functions; no external DB.
// PGlite does not prove native multi-process lock contention.
const database = new PGlite();
const db = drizzle(database);
beforeAll(async () => {
  await database.exec(`CREATE TYPE profile_business_type AS ENUM (${userProfiles.businessType.enumValues!.map(value => `'${value.replaceAll("'", "''")}'`).join(", ")})`);
  await database.exec(`CREATE TYPE profile_status AS ENUM (${profiles.status.enumValues!.map(value => `'${value.replaceAll("'", "''")}'`).join(", ")})`);
  const dialect = new PgDialect();
  const types: Record<string, string> = {
    boolean: "boolean",
    number: "integer",
    json: "jsonb",
    date: "timestamp",
    array: "text[]",
  };
  for (const table of [users, businesses, profiles, userProfiles]) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      let defaultSql = "";
      if (column.default instanceof SQL) defaultSql = dialect.sqlToQuery(column.default).sql;
      else if (typeof column.default === "string")
        defaultSql = `'${column.default.replaceAll("'", "''")}'`;
      else if (typeof column.default === "boolean" || typeof column.default === "number")
        defaultSql = String(column.default);
      const sqlType = table === userProfiles && column === userProfiles.businessType
        ? "profile_business_type"
        : table === profiles && column === profiles.status
          ? "profile_status"
          : types[column.dataType] || "text";
      return `"${column.name}" ${sqlType}${column.primary ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}${defaultSql ? ` DEFAULT ${defaultSql}` : ""}`;
    });
    await database.exec(`CREATE TABLE "${config.name}" (${columns.join(", ")})`);
  }
});
beforeEach(async () => {
  await database.exec("TRUNCATE users, businesses, profiles, user_profiles");
});
afterAll(async () => {
  await database.close();
});

async function seed(ownerChanges: Record<string, unknown> = {}) {
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: `${userId}@example.invalid`,
    verifiedBadge: false,
    verificationStatus: "pending",
    emailVerified: true,
    addressVerified: true,
    preferences: {},
    ...ownerChanges,
  } as any);
  return addBusiness(userId);
}
async function addBusiness(userId: string) {
  const businessId = randomUUID();
  const publicProfileId = randomUUID();
  const [business] = await db
    .insert(businesses)
    .values({
      id: businessId,
      ownerUserId: userId,
      name: "Synthetic verification business",
      slug: businessId,
      roleContext: "business_owner",
      status: "active",
    })
    .returning();
  const [profile] = await db
    .insert(profiles)
    .values({
      id: publicProfileId,
      businessId,
      ownerUserId: userId,
      slug: publicProfileId,
      displayName: business.name,
      roleContext: "business_owner",
      publiclyReleased: false,
    })
    .returning();
  const verification = await db.transaction((tx) =>
    ensureBusinessVerificationProfile(tx, { userId, business, profile })
  );
  return {
    userId,
    businessId,
    publicProfileId,
    business,
    profile,
    verificationProfileId: verification.id,
  };
}
type Subject = Awaited<ReturnType<typeof seed>>;
const owner = async (subject: Subject) =>
  (await db.select().from(users).where(eq(users.id, subject.userId)))[0];
const verification = async (subject: Subject) =>
  (
    await db.select().from(userProfiles).where(eq(userProfiles.id, subject.verificationProfileId))
  )[0];
const registrationKey = (subject: Subject) => `private/${subject.userId}/${randomUUID()}`;
async function submit(subject: Subject) {
  return db.transaction((tx) =>
    submitOwnedBusinessVerification(tx, {
      userId: subject.userId,
      input: profileVerificationSubmissionSchema.parse({
        publicProfileId: subject.publicProfileId,
        taxIdLast4: "6789",
        businessRegistrationDocObjectKey: registrationKey(subject),
      }),
    })
  );
}
async function review(
  subject: Subject,
  field: "tax_id" | "business_registration",
  decision: "approved" | "rejected" = "approved"
) {
  return db.transaction((tx) =>
    reviewBusinessVerification(tx, {
      verificationProfileId: subject.verificationProfileId,
      reviewerId: "authenticated-admin-fixture",
      decision: {
        field,
        decision,
        ...(decision === "rejected"
          ? { rejectionReason: "The document does not match this business identity." }
          : {}),
      },
    })
  );
}
async function approve(subject: Subject) {
  await submit(subject);
  await review(subject, "tax_id");
  return review(subject, "business_registration");
}

describe("existing verification workflow public-target bridge", () => {
  it("releases the exact owner profile using its real status enum without changing content", async () => {
    const subject = await seed();
    const content = [{ id: "about-preserved", type: "about", data: { text: "Owner-approved text" } }];
    await db.update(profiles).set({ contentBlocks: content }).where(eq(profiles.id, subject.publicProfileId));
    const forbidden = await database.query(PROFILE_VISIBILITY_RELEASE_SQL, [subject.publicProfileId, "other-owner", true]);
    expect(forbidden.rows).toHaveLength(0);
    const published = await database.query(PROFILE_VISIBILITY_RELEASE_SQL, [subject.publicProfileId, subject.userId, true]);
    expect(published.rows).toEqual([{ status: "published", publicly_released: true }]);
    const privateResult = await database.query(PROFILE_VISIBILITY_RELEASE_SQL, [subject.publicProfileId, subject.userId, false]);
    expect(privateResult.rows).toEqual([{ status: "draft", publicly_released: false }]);
    const [current] = await db.select().from(profiles).where(eq(profiles.id, subject.publicProfileId));
    expect(current.contentBlocks).toEqual(content);
    expect(current.ownerUserId).toBe(subject.userId);
  });

  it("initializes one distinct pending private verification identity across retries", async () => {
    const subject = await seed();
    const retry = await db.transaction((tx) => ensureBusinessVerificationProfile(tx, subject));
    expect(retry.id).toBe(subject.verificationProfileId);
    expect(retry.id).not.toBe(subject.publicProfileId);
    expect(retry.id).not.toBe(subject.businessId);
    expect(businessVerificationProfileId(subject)).toBe(retry.id);
    expect(await db.select().from(userProfiles)).toHaveLength(1);
    expect(retry).toMatchObject({
      userIntent: "business",
      businessType: null,
      verificationStatus: "pending",
      verifiedBadge: false,
      profileVisibility: "private",
      tax_id_verified: false,
      business_registration_verified: false,
    });
    expect(retry.verificationRequirements).toMatchObject({
      email: true,
      address: true,
      tax_id: true,
      business_registration: true,
    });
    expect((await owner(subject)).verificationStatus).toBe("pending");
  });

  it("keeps selectors distinct and rejects client authority metadata", () => {
    expect(
      profileVerificationSubmissionSchema.safeParse({
        publicProfileId: "public",
        businessProfileId: "verification",
        taxIdLast4: "6789",
      }).success
    ).toBe(false);
    expect(
      profileVerificationSubmissionSchema.safeParse({
        publicProfileId: "public",
        taxIdLast4: "6789",
        releaseAuthorityGranted: true,
      }).success
    ).toBe(false);
    expect(
      profileVerificationSubmissionSchema.safeParse({
        publicProfileId: "public",
        taxIdLast4: "6789",
        businessVerificationTarget: {},
      }).success
    ).toBe(false);
  });

  it("resolves an exact currently owned public target independently of active target", async () => {
    const first = await seed();
    const second = await addBusiness(first.userId);
    const foreign = await seed();
    await db
      .update(users)
      .set({ activeProfileId: first.publicProfileId, activeBusinessId: first.businessId })
      .where(eq(users.id, first.userId));
    expect((await resolveOwnedPublicVerificationProfile(db, second))?.id).toBe(
      second.verificationProfileId
    );
    expect(
      await resolveOwnedPublicVerificationProfile(db, {
        userId: first.userId,
        publicProfileId: foreign.publicProfileId,
      })
    ).toBeNull();
    expect(
      await resolveOwnedPublicVerificationProfile(db, {
        userId: first.userId,
        publicProfileId: first.verificationProfileId,
      })
    ).toBeNull();
    expect(
      await resolveOwnedPublicVerificationProfile(db, {
        userId: first.userId,
        publicProfileId: first.businessId,
      })
    ).toBeNull();
    await expect(
      db.transaction((tx) =>
        submitOwnedBusinessVerification(tx, {
          userId: first.userId,
          input: { publicProfileId: foreign.publicProfileId, taxIdLast4: "6789" },
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it("promotes only after actual submission and all required authorized document reviews", async () => {
    const subject = await seed();
    await expect(review(subject, "tax_id")).rejects.toMatchObject({ status: 400 });
    await submit(subject);
    expect((await owner(subject)).verificationStatus).toBe("pending");
    await review(subject, "tax_id");
    expect((await owner(subject)).verificationStatus).toBe("pending");
    await review(subject, "business_registration");
    expect((await owner(subject)).verificationStatus).toBe("approved");
    expect((await owner(subject)).verifiedBadge).toBe(false);
    expect((await verification(subject)).verificationSubmissions).toMatchObject({
      releaseAuthorityGranted: true,
      fieldReview: {
        tax_id: { reviewedBy: "authenticated-admin-fixture", status: "approved" },
        business_registration: { reviewedBy: "authenticated-admin-fixture", status: "approved" },
      },
    });
  });

  it("does not promote document-approved business before required email and address", async () => {
    const subject = await seed({ emailVerified: false, addressVerified: false });
    await approve(subject);
    expect((await owner(subject)).verificationStatus).toBe("pending");
    expect((await verification(subject)).verificationSubmissions).not.toHaveProperty(
      "releaseAuthorityGranted",
      true
    );
    await db.transaction((tx) =>
      updateUserWithBusinessVerificationAuthority(tx, {
        userId: subject.userId,
        updates: { emailVerified: true },
      })
    );
    expect((await owner(subject)).verificationStatus).toBe("pending");
    await db.transaction((tx) =>
      updateUserWithBusinessVerificationAuthority(tx, {
        userId: subject.userId,
        updates: { addressVerified: true },
      })
    );
    expect((await owner(subject)).verificationStatus).toBe("approved");
    // Canonical identity completion reuses the earlier review, with no new admin action.
    expect((await verification(subject)).verificationSubmissions).toHaveProperty(
      "releaseAuthorityGranted",
      true
    );
  });

  it("keeps suspended account authority after fully satisfied document review", async () => {
    const subject = await seed({ verificationStatus: "suspended" });
    await approve(subject);
    expect((await owner(subject)).verificationStatus).toBe("suspended");
    expect((await verification(subject)).verificationSubmissions).not.toHaveProperty(
      "releaseAuthorityGranted",
      true
    );
  });

  it("preserves unrelated approved account authority on review, rejection, and resubmission", async () => {
    const subject = await seed({ verificationStatus: "approved" });
    await approve(subject);
    expect((await verification(subject)).verificationSubmissions).not.toHaveProperty(
      "releaseAuthorityGranted",
      true
    );
    await review(subject, "business_registration", "rejected");
    await submit(subject);
    expect((await owner(subject)).verificationStatus).toBe("approved");
  });

  it("revokes bridge-owned authority on resubmission even after account preferences are erased", async () => {
    const subject = await seed();
    await approve(subject);
    await db.update(users).set({ preferences: {} }).where(eq(users.id, subject.userId));
    await submit(subject);
    expect((await owner(subject)).verificationStatus).toBe("pending");
    expect((await verification(subject)).verificationSubmissions).toHaveProperty(
      "releaseAuthorityGranted",
      false
    );
  });

  it("hands off bridge provenance to the canonical independent admin verification writer", async () => {
    const subject = await seed();
    await approve(subject);
    expect((await verification(subject)).verificationSubmissions).toHaveProperty(
      "releaseAuthorityGranted",
      true
    );
    // Same core writer called by /api/admin/user-controls/verify/:userId.
    await db.transaction((tx) =>
      updateUserWithBusinessVerificationAuthority(tx, {
        userId: subject.userId,
        updates: { verificationStatus: "approved", addressVerified: true },
      })
    );
    expect((await verification(subject)).verificationSubmissions).toHaveProperty(
      "releaseAuthorityGranted",
      false
    );
    await submit(subject);
    await review(subject, "business_registration", "rejected");
    expect((await owner(subject)).verificationStatus).toBe("approved");
  });

  it("revokes only bridge-owned release authority when canonical identity verification is withdrawn", async () => {
    const subject = await seed();
    await approve(subject);
    await db.transaction((tx) =>
      updateUserWithBusinessVerificationAuthority(tx, {
        userId: subject.userId,
        updates: { addressVerified: false },
      })
    );
    expect((await owner(subject)).verificationStatus).toBe("pending");
    expect((await verification(subject)).verificationSubmissions).toHaveProperty(
      "releaseAuthorityGranted",
      false
    );
  });

  it("moves private grant source between owned businesses and revokes only the current source", async () => {
    const first = await seed();
    const second = await addBusiness(first.userId);
    await approve(first);
    await approve(second);
    expect((await verification(first)).verificationSubmissions).toHaveProperty(
      "releaseAuthorityGranted",
      false
    );
    expect((await verification(second)).verificationSubmissions).toHaveProperty(
      "releaseAuthorityGranted",
      true
    );
    await submit(first);
    expect((await owner(first)).verificationStatus).toBe("approved");
    await review(second, "business_registration", "rejected");
    expect((await owner(second)).verificationStatus).toBe("rejected");
  });

  it("rejects submissions and review after current business ownership changes", async () => {
    const subject = await seed();
    const foreign = await seed();
    await submit(subject);
    await db
      .update(businesses)
      .set({ ownerUserId: foreign.userId })
      .where(eq(businesses.id, subject.businessId));
    expect(await resolveOwnedPublicVerificationProfile(db, subject)).toBeNull();
    await expect(submit(subject)).rejects.toMatchObject({ status: 404 });
    await expect(review(subject, "tax_id")).rejects.toMatchObject({ status: 404 });
    expect((await owner(subject)).verificationStatus).toBe("pending");
  });
});
