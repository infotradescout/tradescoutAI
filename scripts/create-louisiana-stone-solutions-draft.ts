/**
 * One-time managed-partner draft intake. Does not publish or create login credentials.
 * Run with the existing TradeScout environment and --import tsx.
 * Default is a database rollback rehearsal; --apply commits the new draft.
 * Existing profile, business, or steward records are never overwritten.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { publicObjectEtag } from "../shared/postgresPublicMediaS3Client.mjs";
import { businesses, profiles, users } from "../shared/schema";
import {
  LOUISIANA_STONE_SOLUTIONS_BUSINESS_NAME as name,
  LOUISIANA_STONE_SOLUTIONS_PROFILE_SLUG as slug,
  LOUISIANA_STONE_SOLUTIONS_PROFILE_DRAFT_PAYLOAD as draft,
  LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION as presentation,
  LOUISIANA_STONE_SOLUTIONS_MEDIA as media,
} from "../shared/louisianaStoneSolutionsProfile";
import { db, pool } from "../server/db";

const apply = process.argv.includes("--apply");
assert.ok(
  process.argv.includes("--postgres-public-media"),
  "Confirm the live service uses postgres-public-media before running this intake"
);
const intakeId = "8f64032b-5976-4e8a-8b45-0a812a99c558";
const actorId = "8499ade7-af90-4d42-8dc1-fdbe60518c83";
const stewardEmail = `${slug}@profile-steward.invalid`;
const provider = "admin_provisioned_profile_steward";
const source = "admin_provisioned_business_profile";
const sourceUrl = "https://www.facebook.com/profile.php?id=100091128907591";
const sections = {
  about: true,
  rolesAndBadges: false,
  stats: false,
  services: true,
  marketplaceListings: false,
  reviews: false,
  communityActivity: false,
  contactCard: true,
};

const assets = [
  { file: "kitchen-cover.jpg", url: media.kitchen, hash: "a8af176a1642" },
  { file: "logo.jpg", url: media.logo, hash: "ba7034eb0e0d" },
].map((asset) => {
  const body = readFileSync(path.resolve("artifacts/profile-sources", slug, asset.file));
  const hash = createHash("sha256").update(body).digest("hex");
  assert.ok(hash.startsWith(asset.hash), `Unexpected source image: ${asset.file}`);
  assert.ok(body.length < 1024 * 1024, "Source image exceeds the bounded upload size");
  return { ...asset, hash, body, key: asset.url.slice(1) };
});

async function ensureSourceImages(tx: any) {
  // The live Render environment was inspected: DATABASE_URL is configured and
  // R2/AWS variables are absent. Use its canonical postgres-public-media store.
  // Immutable inserts participate in the same transaction as the draft records.
  for (const asset of assets) {
    await tx.execute(sql`
      insert into public_media_objects
        (object_key, body, content_type, etag, cache_control, metadata, created_at, updated_at)
      values (${asset.key}, ${asset.body}, 'image/jpeg', ${publicObjectEtag(asset.body)},
        'public, max-age=31536000, immutable',
        ${JSON.stringify({ sha256: asset.hash, source: sourceUrl })}::jsonb, now(), now())
      on conflict (object_key) do nothing
    `);
    const stored = await tx.execute(sql`
      select etag, octet_length(body) as bytes from public_media_objects
      where object_key = ${asset.key} for share
    `);
    assert.equal(stored.rows[0]?.etag, publicObjectEtag(asset.body), "Existing media hash differs");
    assert.equal(stored.rows[0]?.bytes, asset.body.length, "Existing media length differs");
  }
}

let result: Record<string, unknown> | undefined;
const rehearsalComplete = new Error("DRAFT_REHEARSAL_ROLLBACK");
try {
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${slug}))`);
    const intakeResult = await tx.execute(sql`
      select id, stage, contact_mode, control_mode, exposure_mode, created_by_user_id
      from managed_partner_intakes where id = ${intakeId}::uuid and slug = ${slug}
      for update
    `);
    const intake = intakeResult.rows[0];
    assert.ok(intake, "The operator-created intake must exist in this database");
    assert.equal(intake.created_by_user_id, actorId, "Intake custody changed");
    assert.equal(intake.stage, "profile_build", "Intake stage changed; re-inspect before acting");
    assert.equal(intake.contact_mode, "pending_owner_contact");
    assert.equal(intake.control_mode, "admin_stewarded_pending_claim");
    assert.equal(intake.exposure_mode, "direct_only");
    const [actor] = await tx.select({ role: users.role }).from(users).where(eq(users.id, actorId));
    assert.equal(actor?.role, "super_admin", "Intake operator is not the authorized administrator");
    const [oldProfile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.slug, slug));
    const [oldBusiness] = await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, slug));
    const [oldSteward] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, stewardEmail));
    assert.ok(
      !oldProfile && !oldBusiness && !oldSteward,
      "An existing record needs review; nothing was overwritten"
    );
    const [steward] = await tx
      .insert(users)
      .values({
        email: stewardEmail,
        firstName: "TradeScout",
        lastName: "Profile Steward",
        role: "content_creator",
        roles: ["content_creator"],
        activeRole: "content_creator",
        provider,
        emailVerified: false,
        addressVerified: false,
        verifiedBadge: false,
        verificationStatus: "pending",
        onboardingCompleted: false,
        preferences: {
          profileVisibility: "private",
          emailNotifications: false,
          smsNotifications: false,
          marketingEmails: false,
          profileSections: sections,
          internalProfileSteward: { profileSlug: slug, source, createdByUserId: actorId },
        },
      })
      .returning({ id: users.id });
    const [business] = await tx
      .insert(businesses)
      .values({
        name,
        slug,
        type: "other",
        ownerUserId: steward.id,
        roleContext: "business_owner",
        status: "active",
        claimStatus: "unclaimed",
        publicDiscoveryEnabled: false,
        sources: [source, sourceUrl],
        profileData: {
          description: presentation.aboutBody,
          category: "Countertops and remodeling",
          services: presentation.services.map((service) => service.title),
          city: "Baton Rouge",
          stateCode: "LA",
          zipCode: "70810",
          publicContactEnabled: false,
          publicLocationEnabled: false,
          publicWebsiteEnabled: false,
          brandColors: presentation.brand,
        },
      })
      .returning({ id: businesses.id });
    const [profile] = await tx
      .insert(profiles)
      .values({
        ownerUserId: steward.id,
        businessId: business.id,
        roleContext: draft.roleContext,
        slug,
        displayName: name,
        headline: draft.headline,
        contentBlocks: draft.contentBlocks,
        ctaConfig: draft.ctaConfig,
        seoMeta: draft.seoMeta,
        status: "draft",
      })
      .returning({ id: profiles.id, status: profiles.status });
    await tx
      .update(users)
      .set({ activeBusinessId: business.id, activeProfileId: profile.id })
      .where(and(eq(users.id, steward.id), eq(users.provider, provider)));
    await tx.execute(sql`
      update managed_partner_intakes set
        stage = 'routing_review',
        source_urls = (select jsonb_agg(distinct value) from jsonb_array_elements(
          coalesce(source_urls, '[]'::jsonb) || ${JSON.stringify([sourceUrl])}::jsonb
        )),
        latest_action = 'Draft profile created with original business imagery and six source-backed services. Contact routing and publication remain pending.',
        updated_at = now()
      where id = ${intakeId}::uuid and stage = 'profile_build'
    `);
    assert.equal(profile.status, "draft");
    await ensureSourceImages(tx);
    result = {
      mode: apply ? "created" : "rehearsal_rolled_back",
      intakeId,
      profileId: profile.id,
      businessId: business.id,
      status: profile.status,
      preview: `https://www.thetradescout.com/u/${slug}`,
      editor: `https://www.thetradescout.com/u/${slug}/edit`,
      publicDiscovery: false,
      ownerClaim: "unclaimed",
      contactRouting: "pending",
      assets: assets.map(({ url, hash, body }) => ({ url, hash, bytes: body.length })),
    };
    if (!apply) throw rehearsalComplete;
  });
} catch (error: any) {
  if (error !== rehearsalComplete) {
    console.error(JSON.stringify({ error: error.name, message: error.message, code: error.code }));
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
if (result && !process.exitCode) console.log(JSON.stringify(result, null, 2));
