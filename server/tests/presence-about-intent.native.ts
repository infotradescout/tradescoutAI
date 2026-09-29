/** Opt-in native lifecycle proof against a fresh named loopback database only. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { derivePresencePlan } from "../services/presencePlan";
import { reviewOwnedPresencePlan } from "../services/presencePlanService";
import {
  getOwnedPresenceFactReview,
  submitOwnedPresenceFactDecision,
} from "../services/presenceFactReview";
import {
  authorizeOwnedPresenceAboutIntent,
  getOwnedPresenceAboutPreview,
  withdrawOwnedPresenceAboutIntent,
} from "../services/presenceAboutIntent";

const DATABASE_NAME = "tradescout_presence_test_about_20260929_a1";
const DATABASE_ROLE = "presence_about_20260929_a1";

function confirmedUrl() {
  assert.equal(process.env.NODE_ENV, "test");
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  assert.equal(process.env.DATABASE_URL, url);
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "127.0.0.1");
  assert.equal(parsed.port, "5439");
  const name = decodeURIComponent(parsed.pathname.slice(1));
  assert.equal(name, DATABASE_NAME);
  assert.equal(process.env.PRESENCE_ABOUT_DB_CONFIRM, DATABASE_NAME);
  assert.equal(decodeURIComponent(parsed.username), DATABASE_ROLE);
  assert.equal(parsed.search, "", "connection-target overrides are prohibited");
  return url;
}

test(
  "About intent remains private, current, revocable, and correctly ordered",
  { timeout: 60_000 },
  async () => {
    const pool = new Pool({ connectionString: confirmedUrl(), max: 3 });
    const query = (text: string, values?: unknown[]) => pool.query(text, values);
    const suffix = randomUUID().replaceAll("-", "");
    const ownerId = `about_owner_${suffix}`;
    const foreignId = `about_foreign_${suffix}`;
    const businessId = `about_business_${suffix}`;
    const profileId = `about_profile_${suffix}`;
    const source = "https://evidence.example/services?private=secret";
    const originalBlocks = [
      { type: "siteTemplate", data: { id: "default" } },
      { type: "about", data: { body: "Owner's existing About" } },
    ];
    const outcome = {
      kind: "business_profile",
      businessId,
      profileId,
      provenance: {
        evidence: { name: "Synthetic business", links: [source], services: [], photoUrls: [] },
        enrichment: {
          source: "selective_intelligence_profile_enrichment",
          analyzer: "synthetic",
          output: { about: { text: "Approved proposed About.", sourceUrls: [source] } },
        },
      },
    };
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: outcome,
      externalWebsiteUrl: null,
    });
    const storage = {
      getUser: async (id: string) =>
        (await query("SELECT id, preferences FROM users WHERE id = $1", [id])).rows[0] ?? null,
      getBusinessByIdForOwner: async (id: string, target: string) =>
        (
          await query(
            'SELECT id, owner_user_id AS "ownerUserId", profile_data AS "profileData" FROM businesses WHERE id = $1 AND owner_user_id = $2',
            [target, id]
          )
        ).rows[0] ?? null,
      getProfileByIdForOwner: async (id: string, target: string) =>
        (
          await query(
            'SELECT id, owner_user_id AS "ownerUserId", business_id AS "businessId" FROM profiles WHERE id = $1 AND owner_user_id = $2',
            [target, id]
          )
        ).rows[0] ?? null,
    };
    try {
      const dbIdentity = await query("SELECT current_database() AS name, current_user AS role");
      assert.equal(dbIdentity.rows[0].name, process.env.PRESENCE_ABOUT_DB_CONFIRM);
      assert.match(dbIdentity.rows[0].role, /^presence_about_20260929_/);
      for (const relation of [
        "business_presence_plans",
        "business_presence_fact_decisions",
        "business_presence_about_intent_events",
      ]) {
        const row = await query("SELECT to_regclass($1)::text AS name", [`public.${relation}`]);
        assert.equal(row.rows[0].name, relation);
      }
      await query(
        "INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
        [ownerId, `${suffix}@example.invalid`, JSON.stringify({ onboardingOutcome: outcome })]
      );
      await query(
        "INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
        [
          foreignId,
          `${suffix}-foreign@example.invalid`,
          JSON.stringify({ onboardingOutcome: outcome }),
        ]
      );
      await query(
        "INSERT INTO businesses (id, name, slug, owner_user_id, role_context) VALUES ($1, 'Synthetic business', $2, $3, 'business_owner')",
        [businessId, `about-business-${suffix}`, ownerId]
      );
      await query(
        "INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name, status, content_blocks) VALUES ($1,$2,$3,'business_owner',$4,'Synthetic profile','published',$5::jsonb)",
        [profileId, ownerId, businessId, `about-profile-${suffix}`, JSON.stringify(originalBlocks)]
      );
      const created = await query(
        "INSERT INTO business_presence_plans (owner_user_id,business_id,profile_id,revision,evidence_digest,plan_hash,plan) VALUES ($1,$2,$3,1,$4,$5,$6::jsonb) RETURNING id",
        [ownerId, businessId, profileId, plan.evidenceDigest, plan.planHash, JSON.stringify(plan)]
      );
      const planId = String(created.rows[0].id);
      const chooseHosted = () =>
        reviewOwnedPresencePlan(storage, {
          ownerUserId: ownerId,
          expectedDigest: plan.evidenceDigest,
          expectedPlanHash: plan.planHash,
          expectedRevision: 1,
          sitePath: "hosted_new",
        });
      await chooseHosted();
      await chooseHosted();
      assert.equal(
        (
          await query("SELECT site_path_review_epoch FROM business_presence_plans WHERE id=$1", [
            planId,
          ])
        ).rows[0].site_path_review_epoch,
        1,
        "first selection increments once and the same choice is idempotent"
      );
      const review = await getOwnedPresenceFactReview(storage, ownerId);
      const about = review.facts.find((item) => item.factKey === "about");
      assert.ok(about);
      await submitOwnedPresenceFactDecision(storage, {
        ownerUserId: ownerId,
        expectedPlanId: planId,
        expectedProfileId: profileId,
        expectedRevision: review.revision,
        expectedDigest: review.evidenceDigest,
        expectedPlanHash: review.planHash,
        factKey: "about",
        valueDigest: about.valueDigest,
        decision: "approve",
        idempotencyKey: randomUUID(),
      });
      const firstPreview = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(firstPreview.eligible, true);
      assert.equal(firstPreview.target?.currentText, "Owner's existing About");
      assert.equal(firstPreview.fact?.value, "Approved proposed About.");
      assert.equal(firstPreview.fact?.sourceVerificationLimited, true);
      assert.equal(firstPreview.replacementRequired, true);
      assert.equal(firstPreview.publicationApplied, false);
      assert.ok(firstPreview.fact && firstPreview.target && firstPreview.previewDigest);
      const firstRequest = {
        ownerUserId: ownerId,
        expectedPlanId: planId,
        expectedProfileId: profileId,
        expectedRevision: firstPreview.plan.revision,
        expectedDigest: firstPreview.plan.evidenceDigest,
        expectedPlanHash: firstPreview.plan.planHash,
        decisionId: firstPreview.fact.decisionId,
        valueDigest: firstPreview.fact.valueDigest,
        contentBlocksDigest: firstPreview.target.contentBlocksDigest,
        aboutBlockDigest: firstPreview.target.aboutBlockDigest,
        aboutBlockId: firstPreview.target.aboutBlockId,
        previewDigest: firstPreview.previewDigest,
        replacementAcknowledged: true,
        idempotencyKey: randomUUID(),
      };
      await assert.rejects(
        () =>
          authorizeOwnedPresenceAboutIntent(storage, {
            ...firstRequest,
            replacementAcknowledged: false,
          }),
        (error: any) => error?.code === "PRESENCE_ABOUT_REPLACEMENT_ACK_REQUIRED"
      );
      await assert.rejects(
        () => getOwnedPresenceAboutPreview(storage, foreignId),
        (error: any) => error?.code === "PRESENCE_OWNERSHIP_MISMATCH"
      );
      const first = await authorizeOwnedPresenceAboutIntent(storage, firstRequest);
      assert.equal(first.status, "active");
      assert.equal(first.publicationApplied, false);
      assert.equal((await authorizeOwnedPresenceAboutIntent(storage, firstRequest)).id, first.id);
      const separateKey = await authorizeOwnedPresenceAboutIntent(storage, {
        ...firstRequest,
        idempotencyKey: randomUUID(),
      });
      assert.notEqual(
        separateKey.id,
        first.id,
        "a fresh request key must never silently alias prior consent"
      );
      assert.equal(
        (await getOwnedPresenceAboutPreview(storage, ownerId)).intent?.id,
        separateKey.id
      );
      const persisted = await query(
        "SELECT * FROM business_presence_about_intent_events WHERE plan_id = $1",
        [planId]
      );
      assert.equal(persisted.rowCount, 2);
      assert.equal(JSON.stringify(persisted.rows).includes("Approved proposed About."), false);
      assert.equal(JSON.stringify(persisted.rows).includes(source), false);
      assert.deepEqual(
        (await query("SELECT content_blocks FROM profiles WHERE id=$1", [profileId])).rows[0]
          .content_blocks,
        originalBlocks
      );
      await assert.rejects(
        () => withdrawOwnedPresenceAboutIntent(foreignId, first.id, randomUUID()),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_NOT_FOUND"
      );

      await query(
        "UPDATE business_presence_plans SET site_path='keep_external', site_path_review_epoch=site_path_review_epoch+1 WHERE id=$1",
        [planId]
      );
      const externalPath = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(externalPath.eligible, false);
      assert.equal(externalPath.reason, "UNSUPPORTED_SITE_PATH");
      assert.equal(externalPath.intent?.status, "stale");
      await assert.rejects(
        () =>
          authorizeOwnedPresenceAboutIntent(storage, {
            ...firstRequest,
            idempotencyKey: randomUUID(),
          }),
        (error: any) => error?.code === "PRESENCE_ABOUT_UNAVAILABLE"
      );
      await query(
        "UPDATE business_presence_plans SET site_path='hosted_new', site_path_review_epoch=site_path_review_epoch+1 WHERE id=$1",
        [planId]
      );
      const resumedPreview = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(resumedPreview.plan.sitePathReviewEpoch, 3);
      assert.equal(
        resumedPreview.plan.sitePathSelectedAt?.getTime(),
        firstPreview.plan.sitePathSelectedAt?.getTime(),
        "the regression holds the selection timestamp at the same millisecond"
      );
      assert.equal(
        resumedPreview.intent?.status,
        "stale",
        "a same-millisecond A→B→A path choice must not reactivate old consent"
      );
      assert.ok(resumedPreview.previewDigest);
      const resumedRequest = {
        ...firstRequest,
        previewDigest: resumedPreview.previewDigest,
        idempotencyKey: randomUUID(),
      };
      const resumed = await authorizeOwnedPresenceAboutIntent(storage, resumedRequest);
      assert.notEqual(resumed.id, first.id);

      // A newer consent after a changed target must win even if transaction
      // timestamps are deliberately inverted to model clock/lock ordering.
      const changedBlocks = [
        originalBlocks[0],
        { type: "about", data: { body: "Owner's newer About" } },
      ];
      await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [
        profileId,
        JSON.stringify(changedBlocks),
      ]);
      assert.equal((await getOwnedPresenceAboutPreview(storage, ownerId)).intent?.status, "stale");
      await assert.rejects(
        () =>
          authorizeOwnedPresenceAboutIntent(storage, {
            ...firstRequest,
            idempotencyKey: randomUUID(),
          }),
        (error: any) => error?.code === "PRESENCE_ABOUT_PREVIEW_STALE"
      );
      const secondPreview = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.ok(secondPreview.fact && secondPreview.target && secondPreview.previewDigest);
      const secondRequest = {
        ...resumedRequest,
        contentBlocksDigest: secondPreview.target.contentBlocksDigest,
        aboutBlockDigest: secondPreview.target.aboutBlockDigest,
        aboutBlockId: secondPreview.target.aboutBlockId,
        previewDigest: secondPreview.previewDigest,
        idempotencyKey: randomUUID(),
      };
      const second = await authorizeOwnedPresenceAboutIntent(storage, secondRequest);
      await query(
        "UPDATE business_presence_about_intent_events SET created_at=clock_timestamp()-interval '1 second', expires_at=clock_timestamp()+interval '29 days' WHERE id=$1",
        [resumed.id]
      );
      await query(
        "UPDATE business_presence_about_intent_events SET created_at=clock_timestamp()-interval '2 seconds', expires_at=clock_timestamp()+interval '29 days' WHERE id=$1",
        [second.id]
      );
      assert.equal((await getOwnedPresenceAboutPreview(storage, ownerId)).intent?.id, second.id);
      await assert.rejects(
        () => withdrawOwnedPresenceAboutIntent(ownerId, resumed.id, randomUUID()),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_STALE"
      );
      const withdrawKey = randomUUID();
      const withdrawn = await withdrawOwnedPresenceAboutIntent(ownerId, second.id, withdrawKey);
      assert.equal(withdrawn.id, second.id);
      assert.equal(withdrawn.status, "withdrawn");
      assert.equal(
        (await withdrawOwnedPresenceAboutIntent(ownerId, second.id, withdrawKey)).id,
        second.id
      );
      const afterWithdraw = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(afterWithdraw.intent?.id, second.id);
      assert.equal(afterWithdraw.intent?.status, "withdrawn");
      await assert.rejects(
        () => authorizeOwnedPresenceAboutIntent(storage, secondRequest),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_REPLAY_CONFLICT"
      );
      await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [
        profileId,
        JSON.stringify(originalBlocks),
      ]);
      assert.equal((await getOwnedPresenceAboutPreview(storage, ownerId)).intent?.id, second.id);
      assert.equal(
        (await getOwnedPresenceAboutPreview(storage, ownerId)).intent?.status,
        "withdrawn"
      );

      const renewed = await authorizeOwnedPresenceAboutIntent(storage, {
        ...resumedRequest,
        idempotencyKey: randomUUID(),
      });
      assert.notEqual(renewed.id, first.id);
      await query(
        "UPDATE business_presence_about_intent_events SET created_at=clock_timestamp()-interval '31 days', expires_at=clock_timestamp()-interval '1 day' WHERE id=$1",
        [renewed.id]
      );
      assert.equal(
        (await getOwnedPresenceAboutPreview(storage, ownerId)).intent?.status,
        "expired"
      );
      const afterExpiry = await authorizeOwnedPresenceAboutIntent(storage, {
        ...resumedRequest,
        idempotencyKey: randomUUID(),
      });
      assert.notEqual(afterExpiry.id, renewed.id);
      const latestReview = await getOwnedPresenceFactReview(storage, ownerId);
      await submitOwnedPresenceFactDecision(storage, {
        ownerUserId: ownerId,
        expectedPlanId: planId,
        expectedProfileId: profileId,
        expectedRevision: latestReview.revision,
        expectedDigest: latestReview.evidenceDigest,
        expectedPlanHash: latestReview.planHash,
        factKey: "about",
        valueDigest: about.valueDigest,
        decision: "withdraw",
        idempotencyKey: randomUUID(),
      });
      const afterFactWithdrawal = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(afterFactWithdrawal.eligible, false);
      assert.equal(afterFactWithdrawal.reason, "NO_APPROVED_ABOUT");
      assert.equal(afterFactWithdrawal.intent?.status, "stale");
      assert.deepEqual(
        (await query("SELECT content_blocks FROM profiles WHERE id=$1", [profileId])).rows[0]
          .content_blocks,
        originalBlocks
      );
    } finally {
      await query("DELETE FROM business_presence_about_intent_events WHERE owner_user_id=$1", [
        ownerId,
      ]);
      await query("DELETE FROM business_presence_customer_tasks WHERE owner_user_id=$1", [ownerId]);
      await query("DELETE FROM business_presence_fact_decisions WHERE owner_user_id=$1", [ownerId]);
      await query("DELETE FROM business_presence_plans WHERE owner_user_id=$1", [ownerId]);
      await query("DELETE FROM profiles WHERE id=$1", [profileId]);
      await query("DELETE FROM businesses WHERE id=$1", [businessId]);
      await query("DELETE FROM users WHERE id IN ($1,$2)", [ownerId, foreignId]);
      await pool.end();
    }
  }
);
