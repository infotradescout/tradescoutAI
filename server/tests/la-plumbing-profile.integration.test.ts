import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, or, sql } from "drizzle-orm";
import {
  adminAuditLog,
  businesses,
  businessVerifications,
  profiles,
  trustLedgerEvents,
  trustSnapshots,
  userProfiles,
  users,
} from "@shared/schema";
import { LA_PLUMBING_PROFILE_SLUG } from "@shared/localServiceProfile";
import { db, pool } from "../db";
import { getActiveCvsBoostPoints, getActiveCvsBoosts } from "../services/cvsBoostPolicy";
import { provisionLaPlumbingProfile } from "../services/laPlumbingProfileProvisioning";
import { TRUST_SNAPSHOTS_VERSION } from "../services/trustSnapshotsJob";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "true";
const ownerEmail = Buffer.from("dHJhY3lAbGFwbHVtYmluZ3NvbHV0aW9ucy5jb20=", "base64").toString(
  "utf8"
);

async function cleanupLaPlumbingFixture(): Promise<void> {
  const [business] = await db
    .select({ ownerUserId: businesses.ownerUserId })
    .from(businesses)
    .where(eq(businesses.slug, LA_PLUMBING_PROFILE_SLUG))
    .limit(1);
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${ownerEmail.toLowerCase()}`)
    .limit(1);
  const ownerIds = Array.from(
    new Set([business?.ownerUserId, owner?.id].filter((id): id is string => Boolean(id)))
  );

  if (ownerIds.length > 0) {
    for (const ownerId of ownerIds) {
      await db
        .update(users)
        .set({ activeBusinessId: null, activeProfileId: null } as any)
        .where(eq(users.id, ownerId));
    }
  }
  await db.delete(profiles).where(eq(profiles.slug, LA_PLUMBING_PROFILE_SLUG));
  await db.delete(businesses).where(eq(businesses.slug, LA_PLUMBING_PROFILE_SLUG));
  await db
    .delete(trustLedgerEvents)
    .where(
      or(
        and(
          eq(trustLedgerEvents.entityType, "business_profile"),
          eq(trustLedgerEvents.entityId, LA_PLUMBING_PROFILE_SLUG)
        ),
        ...ownerIds.map((ownerId) =>
          and(eq(trustLedgerEvents.entityType, "user_cvs"), eq(trustLedgerEvents.entityId, ownerId))
        )
      )
    );

  for (const ownerId of ownerIds) {
    await db.delete(adminAuditLog).where(eq(adminAuditLog.targetUserId, ownerId));
    await db.delete(businessVerifications).where(eq(businessVerifications.providerUserId, ownerId));
    await db.delete(trustSnapshots).where(eq(trustSnapshots.userId, ownerId));
    await db.delete(userProfiles).where(eq(userProfiles.userId, ownerId));
    await db.execute(sql`
      DELETE FROM affiliate_traffic_events
      WHERE share_link_id IN (
        SELECT links.id
        FROM affiliate_share_links links
        JOIN affiliate_accounts accounts ON accounts.id = links.affiliate_id
        WHERE accounts.affiliate_id = ${ownerId}
      )
    `);
    await db.execute(sql`
      DELETE FROM affiliate_referrals
      WHERE affiliate_id IN (
        SELECT id FROM affiliate_accounts WHERE affiliate_id = ${ownerId}
      )
    `);
    await db.execute(sql`
      DELETE FROM affiliate_payouts
      WHERE affiliate_id IN (
        SELECT id FROM affiliate_accounts WHERE affiliate_id = ${ownerId}
      )
    `);
    await db.execute(sql`
      DELETE FROM trade_deal_clicks
      WHERE affiliate_account_id IN (
        SELECT id FROM affiliate_accounts WHERE affiliate_id = ${ownerId}
      )
    `);
    await db.execute(sql`
      DELETE FROM trade_deal_earnings
      WHERE affiliate_account_id IN (
        SELECT id FROM affiliate_accounts WHERE affiliate_id = ${ownerId}
      )
    `);
    await db.execute(sql`
      DELETE FROM affiliate_share_links
      WHERE affiliate_id IN (
        SELECT id FROM affiliate_accounts WHERE affiliate_id = ${ownerId}
      )
    `);
    await db.execute(sql`DELETE FROM affiliate_accounts WHERE affiliate_id = ${ownerId}`);
    await db.delete(users).where(eq(users.id, ownerId));
  }
}

(runIntegration ? describe : describe.skip)("LA Plumbing profile provisioning integration", () => {
  beforeAll(cleanupLaPlumbingFixture);

  afterAll(async () => {
    await cleanupLaPlumbingFixture();
    await pool.end();
  });

  it("creates a verified profile at CVS 70 with a 50 performance baseline and 20 boosts", async () => {
    const priorNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await provisionLaPlumbingProfile();
      await provisionLaPlumbingProfile();
    } finally {
      process.env.NODE_ENV = priorNodeEnv;
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, LA_PLUMBING_PROFILE_SLUG))
      .limit(1);
    expect(business?.claimStatus).toBe("claimed");
    expect(business?.publicDiscoveryEnabled).toBe(true);
    expect(business?.ownerUserId).toBeTruthy();
    expect((business?.profileData as any)?.importExtras).toMatchObject({
      former_business_name: "Pristine Plumbing",
      former_business_name_normalized: "pristine plumbing",
      former_business_name_source: "operator_provided",
      former_business_name_visibility: "internal_only",
    });

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.slug, LA_PLUMBING_PROFILE_SLUG))
      .limit(1);
    expect(profile?.status).toBe("published");
    expect(profile?.ownerUserId).toBe(business?.ownerUserId);

    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, String(business?.ownerUserId)))
      .limit(1);
    expect(owner?.verificationStatus).toBe("approved");
    expect(owner?.verifiedBadge).toBe(true);
    expect(owner?.roles).not.toContain("community_builder");
    expect(owner?.badges).not.toContain("Community Builder Badge");
    expect(owner?.preferences?.badges?.show).toBe(true);
    expect(owner?.preferences?.profileSections?.communityActivity).toBe(true);

    const [snapshot] = await db
      .select()
      .from(trustSnapshots)
      .where(eq(trustSnapshots.userId, String(business?.ownerUserId)))
      .limit(1);
    expect(Number(snapshot?.version)).toBe(TRUST_SNAPSHOTS_VERSION);
    expect(Number(snapshot?.cvsScore)).toBe(70);
    expect(snapshot?.riskFlags).toContain("cvs_policy_boost_active");
    expect(await getActiveCvsBoostPoints(String(business?.ownerUserId))).toBe(20);
    expect(await getActiveCvsBoosts(String(business?.ownerUserId))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyKey: "verified_profile_launch",
          label: "Verified profile launch",
          points: 10,
        }),
        expect.objectContaining({
          policyKey: "operator_firsthand_attestation",
          label: "Firsthand operator attestation",
          points: 5,
        }),
        expect.objectContaining({
          policyKey: "verified_portfolio_evidence",
          label: "Verified portfolio evidence",
          points: 5,
        }),
      ])
    );
    expect(Number(owner?.trustScore)).toBe(70);

    const grants = await db
      .select()
      .from(trustLedgerEvents)
      .where(
        and(
          eq(trustLedgerEvents.entityType, "user_cvs"),
          eq(trustLedgerEvents.entityId, String(business?.ownerUserId)),
          eq(trustLedgerEvents.eventType, "cvs_boost_granted")
        )
      );
    expect(grants).toHaveLength(3);
  });
});
