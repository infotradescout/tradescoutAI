/** Opt-in native lifecycle proof against a fresh named loopback database only. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { derivePresencePlan } from "../services/presencePlan";
import { reviewOwnedPresencePlan } from "../services/presencePlanService";
import { mutateExactProfileVisibilityAtomically } from "../services/profileVisibilityMutation";
import {
  getOwnedPresenceFactReview,
  submitOwnedPresenceFactDecision,
} from "../services/presenceFactReview";
import {
  applyOwnedPresenceAboutIntent,
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
  "approved description publishes one About only after release and fresh consent, with race-safe retries",
  { timeout: 60_000 },
  async () => {
    const pool = new Pool({ connectionString: confirmedUrl(), max: 3 });
    const query = (text: string, values?: unknown[]) => pool.query(text, values);
    const waitForBlockedSessions = async (blockerPid: number, count: number, queryFragment = "") => {
      const deadline = Date.now() + 5_000;
      do {
        const blocked = await query(
          `SELECT pid, wait_event, query FROM pg_stat_activity
           WHERE datname = current_database() AND usename = current_user
             AND state = 'active' AND wait_event_type = 'Lock'
             AND $1::int = ANY(pg_blocking_pids(pid))
             AND strpos(query, $2) > 0`,
          [blockerPid, queryFragment]
        );
        if (blocked.rows.length >= count) return blocked.rows;
        await new Promise(resolve => setTimeout(resolve, 25));
      } while (Date.now() < deadline);
      assert.fail(`Expected ${count} observed lock waiter(s) behind backend ${blockerPid}`);
    };
    const suffix = randomUUID().replaceAll("-", "");
    const ownerId = `about_owner_${suffix}`;
    const foreignId = `about_foreign_${suffix}`;
    const businessId = `about_business_${suffix}`;
    const profileId = `about_profile_${suffix}`;
    const source = "https://synthetic-native-carpentry-fixture.com/services?private=secret";
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
          output: { description: { text: "Approved proposed About.", sourceUrls: [source] } },
        },
      },
    };
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: outcome,
      externalWebsiteUrl: source,
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
        "INSERT INTO users (id, email, preferences, onboarding_completed, role, roles, verification_status) VALUES ($1, $2, $3::jsonb, true, 'business_owner', ARRAY['business_owner']::text[], 'approved')",
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
        "INSERT INTO businesses (id, name, slug, owner_user_id, role_context, status, claim_status, public_discovery_enabled, profile_data) VALUES ($1, 'Synthetic business', $2, $3, 'business_owner', 'active', 'claimed', true, $4::jsonb)",
        [businessId, `about-business-${suffix}`, ownerId, JSON.stringify({ website: source })]
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
      const choosePreserveMigration = () =>
        reviewOwnedPresencePlan(storage, {
          ownerUserId: ownerId,
          expectedDigest: plan.evidenceDigest,
          expectedPlanHash: plan.planHash,
          expectedRevision: 1,
          sitePath: "preserve_migrate",
        });
      await choosePreserveMigration();
      await choosePreserveMigration();
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
      const about = review.facts.find((item) => item.factKey === "description");
      assert.ok(about);
      await submitOwnedPresenceFactDecision(storage, {
        ownerUserId: ownerId,
        expectedPlanId: planId,
        expectedProfileId: profileId,
        expectedRevision: review.revision,
        expectedDigest: review.evidenceDigest,
        expectedPlanHash: review.planHash,
        factKey: "description",
        valueDigest: about.valueDigest,
        decision: "approve",
        idempotencyKey: randomUUID(),
      });
      const privatePreview = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(privatePreview.eligible, false);
      assert.equal(privatePreview.reason, "ABOUT_HIDDEN");
      const release = await mutateExactProfileVisibilityAtomically({
        ownerUserId: ownerId, requestedProfileId: profileId,
        allowLegacyActiveProfileFallback: false, profileVisibility: "public",
      }, pool);
      assert.equal(release.ok, true, "exact-profile release is separate from About consent");
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
        factKey: firstPreview.fact.key,
        valueDigest: firstPreview.fact.valueDigest,
        contentBlocksDigest: firstPreview.target.contentBlocksDigest,
        aboutBlockDigest: firstPreview.target.aboutBlockDigest,
        aboutBlockId: firstPreview.target.aboutBlockId,
        previewDigest: firstPreview.previewDigest,
        targetMode: firstPreview.target.targetMode,
        contentBlocksRevision: firstPreview.target.contentBlocksRevision,
        publicationAcknowledged: true,
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
        "UPDATE business_presence_plans SET site_path='preserve_migrate', site_path_review_epoch=site_path_review_epoch+1 WHERE id=$1",
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
        contentBlocksRevision: secondPreview.target.contentBlocksRevision,
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

      const restoredPreview = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.ok(restoredPreview.target && restoredPreview.previewDigest);
      const restoredRequest = {
        ...resumedRequest,
        contentBlocksRevision: restoredPreview.target.contentBlocksRevision,
        previewDigest: restoredPreview.previewDigest,
        idempotencyKey: randomUUID(),
      };
      const renewed = await authorizeOwnedPresenceAboutIntent(storage, restoredRequest);
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
        ...restoredRequest,
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
        factKey: "description",
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

      // First imported About: all evidence is synthetic and no remote URL is fetched.
      const reviewAgain = await getOwnedPresenceFactReview(storage, ownerId);
      await submitOwnedPresenceFactDecision(storage, {
        ownerUserId: ownerId,
        expectedPlanId: planId,
        expectedProfileId: profileId,
        expectedRevision: reviewAgain.revision,
        expectedDigest: reviewAgain.evidenceDigest,
        expectedPlanHash: reviewAgain.planHash,
        factKey: "description",
        valueDigest: about.valueDigest,
        decision: "approve",
        idempotencyKey: randomUUID(),
      });
      const emptyAboutBlocks = [
        originalBlocks[0],
        { type: "hero", data: { title: "Synthetic owner title", imageUrl: "https://images.example/owner.jpg" } },
        { type: "gallery", data: { images: [{ url: "https://images.example/gallery.jpg", caption: "Keep" }] } },
        { type: "services", data: { items: ["Owner service"] } },
        { type: "custom", data: { nested: { preserve: true } } },
      ];
      const hideForNewProfile = await mutateExactProfileVisibilityAtomically({
        ownerUserId: ownerId, requestedProfileId: profileId,
        allowLegacyActiveProfileFallback: false, profileVisibility: "private",
      }, pool);
      assert.equal(hideForNewProfile.ok, true);
      await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [profileId, JSON.stringify(emptyAboutBlocks)]);
      const hiddenCreationPreview = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(hiddenCreationPreview.eligible, false);
      assert.equal(hiddenCreationPreview.reason, "ABOUT_HIDDEN");
      const releaseNewProfile = await mutateExactProfileVisibilityAtomically({
        ownerUserId: ownerId, requestedProfileId: profileId,
        allowLegacyActiveProfileFallback: false, profileVisibility: "public",
      }, pool);
      assert.equal(releaseNewProfile.ok, true);
      const freshRequest = async () => {
        const preview = await getOwnedPresenceAboutPreview(storage, ownerId);
        assert.ok(preview.eligible && preview.target && preview.fact && preview.previewDigest);
        return {
          ownerUserId: ownerId,
          expectedPlanId: preview.plan.id,
          expectedProfileId: preview.plan.profileId,
          expectedRevision: preview.plan.revision,
          expectedDigest: preview.plan.evidenceDigest,
          expectedPlanHash: preview.plan.planHash,
          decisionId: preview.fact.decisionId,
          factKey: preview.fact.key,
          valueDigest: preview.fact.valueDigest,
          contentBlocksDigest: preview.target.contentBlocksDigest,
          aboutBlockDigest: preview.target.aboutBlockDigest,
          aboutBlockId: preview.target.aboutBlockId,
          previewDigest: preview.previewDigest,
          targetMode: preview.target.targetMode,
          contentBlocksRevision: preview.target.contentBlocksRevision,
          publicationAcknowledged: true,
          replacementAcknowledged: Boolean(preview.target.currentText),
          idempotencyKey: randomUUID(),
        };
      };
      const createRequest = await freshRequest();
      assert.equal(createRequest.targetMode, "create");
      assert.equal(createRequest.replacementAcknowledged, false);
      await assert.rejects(
        () => authorizeOwnedPresenceAboutIntent(storage, { ...createRequest, publicationAcknowledged: false }),
        (error: any) => error?.code === "PRESENCE_ABOUT_PUBLICATION_ACK_REQUIRED"
      );
      await assert.rejects(
        () => authorizeOwnedPresenceAboutIntent(storage, { ...createRequest, targetMode: "replace" }),
        (error: any) => error?.code === "PRESENCE_ABOUT_PREVIEW_STALE"
      );
      const createConsent = await authorizeOwnedPresenceAboutIntent(storage, createRequest);
      assert.deepEqual(
        (await query("SELECT content_blocks FROM profiles WHERE id=$1", [profileId])).rows[0].content_blocks,
        emptyAboutBlocks, "preview and consent must not publish or create any About block"
      );
      await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [profileId, JSON.stringify([...emptyAboutBlocks, { type: "custom", data: { body: "Intervening edit" } }])]);
      await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [profileId, JSON.stringify(emptyAboutBlocks)]);
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: createConsent.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_STALE",
        "an edit-and-restore cannot revive old publication consent"
      );
      const legacy = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
      await query("UPDATE business_presence_about_intent_events SET publication_acknowledged=false,target_mode=NULL,content_blocks_revision=NULL,profile_target_identity=NULL WHERE id=$1", [legacy.id]);
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: legacy.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_FRESH_CONSENT_REQUIRED"
      );
      const assertRestoredTargetStaysStale = async (changes: Array<[string, unknown[]]>) => {
        const intent = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
        for (const [statement, values] of changes) await query(statement, values);
        await assert.rejects(
          () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: intent.id, idempotencyKey: randomUUID() }),
          (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_STALE"
        );
      };
      await assertRestoredTargetStaysStale([
        ["UPDATE profiles SET slug=$2 WHERE id=$1", [profileId, `temporarily-changed-${suffix}`]],
        ["UPDATE profiles SET slug=$2 WHERE id=$1", [profileId, `about-profile-${suffix}`]],
      ]);
      await assertRestoredTargetStaysStale([
        ["UPDATE profiles SET owner_user_id=$2 WHERE id=$1", [profileId, foreignId]],
        ["UPDATE profiles SET owner_user_id=$2 WHERE id=$1", [profileId, ownerId]],
      ]);
      await assertRestoredTargetStaysStale([
        ["UPDATE businesses SET public_discovery_enabled=false WHERE id=$1", [businessId]],
        ["UPDATE businesses SET public_discovery_enabled=true WHERE id=$1", [businessId]],
      ]);
      await assertRestoredTargetStaysStale([
        ["UPDATE businesses SET owner_user_id=$2 WHERE id=$1", [businessId, foreignId]],
        ["UPDATE businesses SET owner_user_id=$2 WHERE id=$1", [businessId, ownerId]],
      ]);
      await assertRestoredTargetStaysStale([
        ["UPDATE users SET preferences=jsonb_set(preferences,'{profileSections}','{\"about\":false}'::jsonb) WHERE id=$1", [ownerId]],
        ["UPDATE users SET preferences=preferences-'profileSections' WHERE id=$1", [ownerId]],
      ]);
      const releaseIntent = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
      assert.equal((await mutateExactProfileVisibilityAtomically({
        ownerUserId: ownerId, requestedProfileId: profileId,
        allowLegacyActiveProfileFallback: false, profileVisibility: "private",
      }, pool)).ok, true);
      assert.equal((await mutateExactProfileVisibilityAtomically({
        ownerUserId: ownerId, requestedProfileId: profileId,
        allowLegacyActiveProfileFallback: false, profileVisibility: "public",
      }, pool)).ok, true);
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: releaseIntent.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_STALE"
      );
      const pathIntent = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
      for (const sitePath of ["keep_external", "preserve_migrate"] as const) {
        await reviewOwnedPresencePlan(storage, {
          ownerUserId: ownerId, expectedDigest: plan.evidenceDigest,
          expectedPlanHash: plan.planHash, expectedRevision: 1, sitePath,
        });
      }
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: pathIntent.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_STALE"
      );
      const factIntent = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
      for (const decision of ["withdraw", "approve"] as const) {
        const currentReview = await getOwnedPresenceFactReview(storage, ownerId);
        await submitOwnedPresenceFactDecision(storage, {
          ownerUserId: ownerId, expectedPlanId: planId, expectedProfileId: profileId,
          expectedRevision: currentReview.revision, expectedDigest: currentReview.evidenceDigest,
          expectedPlanHash: currentReview.planHash, factKey: "description",
          valueDigest: about.valueDigest, decision, idempotencyKey: randomUUID(),
        });
      }
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: factIntent.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_STALE"
      );
      const expireCreate = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
      await query("UPDATE business_presence_about_intent_events SET created_at=clock_timestamp()-interval '31 days',expires_at=clock_timestamp()-interval '1 day' WHERE id=$1", [expireCreate.id]);
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: expireCreate.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_EXPIRED"
      );
      const expiryAfterLock = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
      const blocker = await pool.connect();
      let waitingApply: Promise<void> | undefined;
      try {
        await blocker.query("BEGIN");
        const blockerPid = Number((await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
        await blocker.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [ownerId]);
        await query("UPDATE business_presence_about_intent_events SET expires_at=clock_timestamp()+interval '10 seconds' WHERE id=$1", [expiryAfterLock.id]);
        waitingApply = assert.rejects(
          () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: expiryAfterLock.id, idempotencyKey: randomUUID() }),
          (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_EXPIRED",
          "expiry is checked after waiting for the publication row locks"
        );
        await waitForBlockedSessions(blockerPid, 1, "users");
        await query("UPDATE business_presence_about_intent_events SET expires_at=clock_timestamp() WHERE id=$1", [expiryAfterLock.id]);
        await blocker.query("COMMIT");
        await waitingApply;
        assert.deepEqual((await query("SELECT content_blocks FROM profiles WHERE id=$1", [profileId])).rows[0].content_blocks, emptyAboutBlocks);
        assert.equal((await query("SELECT count(*)::int AS total FROM business_presence_about_intent_events WHERE authorization_id=$1 AND event_kind='apply'", [expiryAfterLock.id])).rows[0].total, 0);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        await waitingApply?.catch(() => undefined);
      }
      const withdrawCreate = await authorizeOwnedPresenceAboutIntent(storage, await freshRequest());
      await withdrawOwnedPresenceAboutIntent(ownerId, withdrawCreate.id, randomUUID());
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: withdrawCreate.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_WITHDRAWN"
      );
      const finalCreateRequest = await freshRequest();
      const finalCreate = await authorizeOwnedPresenceAboutIntent(storage, finalCreateRequest);
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: foreignId, intentId: finalCreate.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_OWNERSHIP_MISMATCH"
      );
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: createConsent.id, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_STALE",
        "a superseded consent cannot publish"
      );
      const applyKey = randomUUID();
      const applyRequest = { ownerUserId: ownerId, intentId: finalCreate.id, idempotencyKey: applyKey };
      const planBlocker = await pool.connect();
      let overlappingResults: Promise<[
        Awaited<ReturnType<typeof getOwnedPresenceAboutPreview>>,
        Awaited<ReturnType<typeof applyOwnedPresenceAboutIntent>>,
        Awaited<ReturnType<typeof applyOwnedPresenceAboutIntent>>,
      ]>;
      try {
        await planBlocker.query("BEGIN");
        const blockerPid = Number((await planBlocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
        await planBlocker.query("SELECT id FROM business_presence_plans WHERE id=$1 FOR UPDATE", [planId]);
        const firstApply = applyOwnedPresenceAboutIntent(storage, applyRequest);
        const [blockedApply] = await waitForBlockedSessions(blockerPid, 1, "business_presence_plans");
        overlappingResults = Promise.all([
          getOwnedPresenceAboutPreview(storage, ownerId), firstApply,
          applyOwnedPresenceAboutIntent(storage, applyRequest),
        ]);
        const waiters = await waitForBlockedSessions(Number(blockedApply.pid), 2);
        assert.ok(waiters.some(row => row.wait_event === "advisory"), "retry waits behind the first apply's owner/business advisory lock");
        assert.ok(waiters.some(row => row.query.includes("users")), "preview waits behind the first apply's owner row lock before taking profile/plan locks");
        await planBlocker.query("COMMIT");
      } finally {
        await planBlocker.query("ROLLBACK");
        planBlocker.release();
      }
      const [overlappingPreview, ...appliedPair] = await overlappingResults!;
      assert.equal(overlappingPreview.eligible, true, "preview and apply finish without lock inversion");
      assert.deepEqual(appliedPair[0], appliedPair[1], "concurrent retries return one exact receipt");
      assert.equal(appliedPair[0].status, "applied");
      assert.equal(appliedPair[0].publicationApplied, true);
      assert.equal(appliedPair[0].receipt?.contentBlocksRevision, finalCreateRequest.contentBlocksRevision + 1);
      const publishedBlocks = [...emptyAboutBlocks, { type: "about", data: { body: "Approved proposed About." } }];
      assert.deepEqual(
        (await query("SELECT content_blocks FROM profiles WHERE id=$1", [profileId])).rows[0].content_blocks,
        publishedBlocks, "one About is appended and all existing blocks survive exactly"
      );
      assert.equal((await query("SELECT count(*)::int AS total FROM business_presence_about_intent_events WHERE authorization_id=$1 AND event_kind='apply'", [finalCreate.id])).rows[0].total, 1);
      assert.deepEqual(await applyOwnedPresenceAboutIntent(storage, { ...applyRequest, idempotencyKey: randomUUID() }), appliedPair[0]);
      await assert.rejects(
        () => applyOwnedPresenceAboutIntent(storage, { ...applyRequest, idempotencyKey: finalCreateRequest.idempotencyKey }),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_REPLAY_CONFLICT"
      );
      const afterPublication = await getOwnedPresenceAboutPreview(storage, ownerId);
      assert.equal(afterPublication.intent?.status, "applied");
      assert.equal(afterPublication.intent?.publicationApplied, true);
      assert.equal(afterPublication.target?.targetMode, "replace");
      assert.equal(afterPublication.target?.currentText, "Approved proposed About.");
      await assert.rejects(
        () => withdrawOwnedPresenceAboutIntent(ownerId, finalCreate.id, randomUUID()),
        (error: any) => error?.code === "PRESENCE_ABOUT_INTENT_APPLIED"
      );
      // Subsequent owner edits are preserved; retries report the historical effect.
      const ownerEdit = publishedBlocks.map((block) => block.type === "about" ? { type: "about", data: { body: "Owner changed the published text." } } : block);
      await query("UPDATE profiles SET content_blocks=$2::jsonb WHERE id=$1", [profileId, JSON.stringify(ownerEdit)]);
      assert.deepEqual(await applyOwnedPresenceAboutIntent(storage, applyRequest), appliedPair[0]);
      assert.deepEqual((await query("SELECT content_blocks FROM profiles WHERE id=$1", [profileId])).rows[0].content_blocks, ownerEdit);
      const replacementRequest = await freshRequest();
      assert.equal(replacementRequest.targetMode, "replace");
      const replacement = await authorizeOwnedPresenceAboutIntent(storage, replacementRequest);
      await applyOwnedPresenceAboutIntent(storage, { ownerUserId: ownerId, intentId: replacement.id, idempotencyKey: randomUUID() });
      assert.deepEqual((await query("SELECT content_blocks FROM profiles WHERE id=$1", [profileId])).rows[0].content_blocks, publishedBlocks);
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
