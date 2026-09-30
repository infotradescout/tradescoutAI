/** Opt-in PostgreSQL proof in one freshly created, named disposable database. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { Pool } from "pg";
import { ProfileRepository, type ProfileJsonPatches } from "../repositories/profileRepository";
import type { ProfileTargetIdentity } from "@shared/profileTargetIdentity";

const DATABASE_NAME = "tradescout_presence_test_profile_revision_20260929_a1";
const DATABASE_ROLE = "presence_revision_20260929_a1";

function confirmedUrl() {
  assert.equal(process.env.NODE_ENV, "test");
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  assert.equal(process.env.DATABASE_URL, url);
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "127.0.0.1");
  assert.equal(parsed.port, "5439");
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), DATABASE_NAME);
  assert.equal(decodeURIComponent(parsed.username), DATABASE_ROLE);
  assert.equal(parsed.search, "", "connection-target overrides are prohibited");
  assert.equal(process.env.PRESENCE_REVISION_DB_CONFIRM, DATABASE_NAME);
  return url;
}

test("profile content revision backfills, versions JSONB changes, and rejects stale owner saves", { timeout: 60_000 }, async () => {
  const pool = new Pool({ connectionString: confirmedUrl(), max: 2 });
  const query = (text: string, values?: unknown[]) => pool.query(text, values);
  let createdTable = false;
  try {
    const identity = await query("SELECT current_database() AS name, current_user AS role");
    assert.equal(identity.rows[0].name, DATABASE_NAME);
    assert.equal(identity.rows[0].role, DATABASE_ROLE);
    const before = await query("SELECT to_regclass('public.profiles')::text AS name");
    assert.equal(before.rows[0].name, null, "the disposable target must be fresh");

    // Only the columns selected or updated by ProfileRepository are needed here.
    await query(`
      CREATE TABLE profiles (
        id varchar PRIMARY KEY,
        owner_user_id varchar NOT NULL,
        business_id varchar,
        role_context varchar NOT NULL,
        slug varchar NOT NULL UNIQUE,
        display_name varchar NOT NULL,
        headline varchar,
        content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
        cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        status varchar NOT NULL DEFAULT 'draft',
        publicly_released boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    createdTable = true;
    const ownerId = "synthetic_revision_owner";
    const foreignId = "synthetic_revision_foreign";
    const profileId = "synthetic_revision_profile";
    const original = [{ type: "about" as const, data: { text: "Original" } }];
    const changed = [{ type: "about" as const, data: { text: "Changed" } }];
    const direct = [{ type: "about" as const, data: { text: "Direct writer" } }];
    await query(
      "INSERT INTO profiles (id, owner_user_id, role_context, slug, display_name, content_blocks) VALUES ($1,$2,'business_owner',$3,'Synthetic profile',$4::jsonb)",
      [profileId, ownerId, profileId, JSON.stringify(original)]
    );

    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0147_profile_content_blocks_revision.sql"),
      "utf8"
    );
    await query(migration);
    const revision = async () =>
      Number((await query("SELECT content_blocks_revision FROM profiles WHERE id=$1", [profileId])).rows[0].content_blocks_revision);
    assert.equal(await revision(), 1, "preexisting profile backfills to revision one");

    await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [
      profileId,
      '[{"data":{"text":"Original"},"type":"about"}]',
    ]);
    assert.equal(await revision(), 1, "JSONB-equivalent whole-array save is a no-op");
    await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [
      profileId,
      JSON.stringify(changed),
    ]);
    assert.equal(await revision(), 2);
    await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [
      profileId,
      JSON.stringify(original),
    ]);
    assert.equal(await revision(), 3, "A to B to A cannot resurrect the old revision");
    await query("UPDATE profiles SET content_blocks_revision=999 WHERE id=$1", [profileId]);
    assert.equal(await revision(), 3, "callers cannot override the database-owned revision");

    const repository = new ProfileRepository();
    let loadedIdentity: ProfileTargetIdentity = {
      ownerUserId: ownerId,
      businessId: null,
      roleContext: "business_owner",
      slug: profileId,
      status: "draft",
      publiclyReleased: false,
      customDomain: "",
    };
    const saveOwner = (
      userId: string,
      id: string,
      updates: Parameters<ProfileRepository["updateProfileForOwnerWithContentBlocksRevision"]>[2],
      expectedRevision: number,
      patches?: ProfileJsonPatches,
      expectedIdentity: ProfileTargetIdentity = loadedIdentity
    ) => repository.updateProfileForOwnerWithContentBlocksRevision(
      userId, id, updates, expectedRevision, expectedIdentity, patches
    );
    const saved = await saveOwner(
      ownerId,
      profileId,
      { contentBlocks: changed },
      3
    );
    assert.equal(saved?.contentBlocksRevision, 4, "the trigger increments once, not twice");
    assert.equal(
      await saveOwner(
        ownerId,
        profileId,
        { contentBlocks: original },
        3
      ),
      undefined,
      "stale owner save loses the atomic comparison"
    );
    assert.equal(
      await saveOwner(
        foreignId,
        profileId,
        { contentBlocks: original },
        4
      ),
      undefined,
      "foreign owner cannot write"
    );
    assert.equal(
      await saveOwner(
        ownerId,
        "missing-profile",
        { contentBlocks: original },
        4
      ),
      undefined,
      "missing profile cannot write"
    );
    assert.equal(await revision(), 4);

    await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [
      profileId,
      JSON.stringify(direct),
    ]);
    assert.equal(await revision(), 5, "a direct writer also advances the revision");
    assert.equal(
      await saveOwner(
        ownerId,
        profileId,
        { contentBlocks: original },
        4
      ),
      undefined,
      "owner save loaded before the direct writer is rejected"
    );
    const current = await repository.getProfileByIdForOwner(ownerId, profileId);
    assert.deepEqual(current?.contentBlocks, direct);
    assert.equal(current?.contentBlocksRevision, 5);

    const concurrent = await Promise.all([
      saveOwner(
        ownerId,
        profileId,
        { contentBlocks: original },
        5
      ),
      saveOwner(
        ownerId,
        profileId,
        { contentBlocks: changed },
        5
      ),
    ]);
    assert.equal(concurrent.filter(Boolean).length, 1, "exactly one concurrent owner save wins");
    assert.equal(concurrent.filter((row) => row === undefined).length, 1);
    const finalProfile = await repository.getProfileByIdForOwner(ownerId, profileId);
    assert.equal(finalProfile?.contentBlocksRevision, 6, "the concurrent pair increments once");
    assert.deepEqual(finalProfile?.contentBlocks, concurrent[0] ? original : changed);

    await query(
      "UPDATE profiles SET seo_meta=$2::jsonb, cta_config=$3::jsonb WHERE id=$1",
      [
        profileId,
        JSON.stringify({ title: "Before", description: "Sibling", customDomain: "profile.example.test" }),
        JSON.stringify({
          primary: { label: "Call", kind: "call", value: "555-0100" },
          secondary: { label: "Email", kind: "email", value: "first@example.test" },
        }),
      ]
    );
    assert.equal(await revision(), 7, "a custom-domain identity change advances the revision");
    loadedIdentity = { ...loadedIdentity, customDomain: "profile.example.test" };
    const metadataOnly = await saveOwner(
      ownerId,
      profileId,
      { headline: "Metadata edit" },
      7,
      { seoMetaPatch: { title: "After" }, ctaConfigPatch: { primary: null } }
    );
    assert.equal(metadataOnly?.contentBlocksRevision, 7);
    assert.deepEqual(metadataOnly?.seoMeta, {
      title: "After",
      description: "Sibling",
      customDomain: "profile.example.test",
    });
    assert.deepEqual(metadataOnly?.ctaConfig, {
      secondary: { label: "Email", kind: "email", value: "first@example.test" },
    });

    // Simulates a sibling-key write after the HTTP route's pre-read, before CAS.
    await query(
      "UPDATE profiles SET seo_meta=jsonb_set(seo_meta, '{description}', '\"Latest sibling\"'::jsonb), cta_config=jsonb_set(cta_config, '{secondary,value}', '\"latest@example.test\"'::jsonb) WHERE id=$1",
      [profileId]
    );
    assert.equal(await revision(), 7, "sibling metadata keys do not advance the revision");
    const patchedAndChanged = await saveOwner(
      ownerId,
      profileId,
      { contentBlocks: direct },
      7,
      { seoMetaPatch: { title: "Latest title" }, ctaConfigPatch: { primary: null } }
    );
    assert.equal(patchedAndChanged?.contentBlocksRevision, 8, "patch and changed array increment once");
    assert.deepEqual(patchedAndChanged?.contentBlocks, direct);
    assert.deepEqual(patchedAndChanged?.seoMeta, {
      title: "Latest title",
      description: "Latest sibling",
      customDomain: "profile.example.test",
    });
    assert.deepEqual(patchedAndChanged?.ctaConfig, {
      secondary: { label: "Email", kind: "email", value: "latest@example.test" },
    });

    const baselineIdentity = { ...loadedIdentity };
    const targetMutations = [
      {
        name: "business relink",
        apply: "UPDATE profiles SET business_id='business-b' WHERE id=$1",
        restore: "UPDATE profiles SET business_id=NULL WHERE id=$1",
      },
      {
        name: "role change",
        apply: "UPDATE profiles SET role_context='contractor' WHERE id=$1",
        restore: "UPDATE profiles SET role_context='business_owner' WHERE id=$1",
      },
      {
        name: "slug change",
        apply: "UPDATE profiles SET slug='changed-slug' WHERE id=$1",
        restore: "UPDATE profiles SET slug='synthetic_revision_profile' WHERE id=$1",
      },
      {
        name: "status change",
        apply: "UPDATE profiles SET status='published' WHERE id=$1",
        restore: "UPDATE profiles SET status='draft' WHERE id=$1",
      },
      {
        name: "public release change",
        apply: "UPDATE profiles SET publicly_released=true WHERE id=$1",
        restore: "UPDATE profiles SET publicly_released=false WHERE id=$1",
      },
      {
        name: "custom domain change",
        apply: "UPDATE profiles SET seo_meta=jsonb_set(seo_meta, '{customDomain}', '\"changed.example.test\"'::jsonb) WHERE id=$1",
        restore: "UPDATE profiles SET seo_meta=jsonb_set(seo_meta, '{customDomain}', '\"profile.example.test\"'::jsonb) WHERE id=$1",
      },
    ];
    for (const mutation of targetMutations) {
      const staleRevision = await revision();
      await query(mutation.apply, [profileId]);
      assert.equal(await revision(), staleRevision + 1, `${mutation.name} advances the shared revision`);
      assert.equal(
        await saveOwner(ownerId, profileId, { headline: "Must not save" }, staleRevision, undefined, baselineIdentity),
        undefined,
        `${mutation.name} invalidates the client-loaded target identity`
      );
      await query(mutation.restore, [profileId]);
      assert.equal(await revision(), staleRevision + 2, `${mutation.name} restoration advances it again`);
      assert.equal(
        await saveOwner(ownerId, profileId, { contentBlocks: original }, staleRevision, undefined, baselineIdentity),
        undefined,
        `${mutation.name} restoration cannot revive the stale snapshot`
      );
    }

    const beforeOwnerChange = await revision();
    await query("UPDATE profiles SET owner_user_id=$2 WHERE id=$1", [profileId, foreignId]);
    assert.equal(await revision(), beforeOwnerChange + 1);
    assert.equal(
      await repository.updateProfileByIdWithContentBlocksRevision(
        profileId, { headline: "Must not save" }, beforeOwnerChange, baselineIdentity
      ),
      undefined,
      "staff CAS cannot write after reassignment to another owner"
    );
    await query("UPDATE profiles SET owner_user_id=$2 WHERE id=$1", [profileId, ownerId]);
    assert.equal(await revision(), beforeOwnerChange + 2);
    assert.equal(await saveOwner(ownerId, profileId, { contentBlocks: original }, beforeOwnerChange), undefined);

    const currentTargetRevision = await revision();
    await query(
      "UPDATE profiles SET seo_meta=jsonb_set(seo_meta, '{customDomain}', '\"  PROFILE.EXAMPLE.TEST  \"'::jsonb) WHERE id=$1",
      [profileId]
    );
    const normalizedDomain = await saveOwner(
      ownerId, profileId, { headline: "Domain comparison normalized" }, currentTargetRevision
    );
    assert.equal(normalizedDomain?.contentBlocksRevision, currentTargetRevision);
    await query(
      "UPDATE profiles SET seo_meta=jsonb_set(seo_meta, '{customDomain}', '\"profile.example.test\"'::jsonb) WHERE id=$1",
      [profileId]
    );

    const explicitRelink = await saveOwner(
      ownerId,
      profileId,
      { businessId: "business-b", roleContext: "contractor" as any },
      currentTargetRevision,
      undefined,
      baselineIdentity
    );
    assert.equal(explicitRelink?.businessId, "business-b");
    assert.equal(explicitRelink?.roleContext, "contractor");
    assert.equal(explicitRelink?.contentBlocksRevision, currentTargetRevision + 1);
    assert.equal(
      await saveOwner(ownerId, profileId, { headline: "Old target" }, currentTargetRevision, undefined, baselineIdentity),
      undefined
    );
    const staffRelink = await repository.updateProfileByIdWithContentBlocksRevision(
      profileId,
      { businessId: null, roleContext: "business_owner" as any },
      currentTargetRevision + 1,
      { ...baselineIdentity, businessId: "business-b", roleContext: "contractor" }
    );
    assert.equal(staffRelink?.businessId, null);
    assert.equal(staffRelink?.roleContext, "business_owner");
  } finally {
    if (createdTable) {
      await query("DROP TABLE IF EXISTS profiles");
      await query("DROP FUNCTION IF EXISTS assign_profile_content_blocks_revision()");
    }
    await pool.end();
  }
});
