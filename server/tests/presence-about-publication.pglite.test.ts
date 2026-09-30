import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import {
  users, userProfiles, businesses, profiles, notifications, notificationPreferences,
  realtorProfiles, carSalesmanProfiles,
} from "@shared/schema";

const fixture = vi.hoisted(() => ({
  database: null as import("@electric-sql/pglite").PGlite | null,
  publicProfile: vi.fn(),
  publicBusiness: vi.fn(),
}));
vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.database = new PGlite();
  return { db: drizzle(fixture.database), pool: undefined };
});
vi.mock("../storage", () => ({ storage: {
  getProfileBySlugPublic: fixture.publicProfile,
  getBusinessPublicById: fixture.publicBusiness,
} }));
import { db } from "../db";
import { ProfileRepository } from "../repositories/profileRepository";
import { OutcomeOnboardingRepository } from "../repositories/outcomeOnboardingRepository";
import { completeOutcomeOnboarding } from "../services/onboardingService";
import { businessVerificationProfileId, submitOwnedBusinessVerification, reviewBusinessVerification } from "../services/businessVerificationTargetBridge";
import { buildPublicProfileHtml } from "../publicProfileHtml";
import { mutateExactProfileVisibilityAtomically } from "../services/profileVisibilityMutation";
import { refreshOwnedPresencePlan, reviewOwnedPresencePlan } from "../services/presencePlanService";
import { getOwnedPresenceFactReview, submitOwnedPresenceFactDecision } from "../services/presenceFactReview";
import {
  applyOwnedPresenceAboutIntent, authorizeOwnedPresenceAboutIntent,
  getOwnedPresenceAboutPreview, withdrawOwnedPresenceAboutIntent,
} from "../services/presenceAboutIntent";

// Actual lifecycle services, Drizzle SQL, canonical public-profile repository,
// and public HTML builder run against fresh in-memory PostgreSQL. Base unrelated
// tables project schema columns/defaults; presence tables, constraints, indexes,
// and the revision trigger come from the real ordered migrations. PGlite is not
// proof of native multi-process locks, deployed migrations, HTTP or browser UX.
const query = async <T = Record<string, any>>(text: string, params: any[] = []) =>
  (await fixture.database!.query<T>(text, params)).rows;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const repository = new ProfileRepository();
const ownedStorage = {
  getUser: async (id: string) => (await db.select().from(users).where(eq(users.id, id)).limit(1))[0],
  getBusinessByIdForOwner: async (owner: string, id: string) => {
    const row = (await db.select().from(businesses).where(eq(businesses.id, id)).limit(1))[0];
    return row?.ownerUserId === owner ? row : undefined;
  },
  getProfileByIdForOwner: repository.getProfileByIdForOwner.bind(repository),
};
const templateHtml = '<!doctype html><html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>';
const approvedText = "Services include Carpentry & trim.";
const onboardingWebsite = "https://synthetic-carpentry-fixture.com/services?fixture=private";
const initialBlocks = [
  { type: "siteTemplate", data: { id: "default" } },
  { type: "links", data: { items: [{ label: "Existing business site", url: "https://evidence.example/" }] } },
];

beforeAll(async () => {
  await fixture.database!.exec(`CREATE TYPE profile_business_type AS ENUM (${userProfiles.businessType.enumValues!.map(value => `'${value.replaceAll("'", "''")}'`).join(", ")})`);
  const dialect = new PgDialect();
  const types: Record<string, string> = {
    boolean: "boolean", number: "integer", json: "jsonb", date: "timestamp", array: "text[]",
  };
  for (const table of [users, userProfiles, businesses, profiles, notifications, notificationPreferences, realtorProfiles, carSalesmanProfiles]) {
    const config = getTableConfig(table);
    const columns = config.columns
      .filter((column) => table !== profiles || column.name !== "content_blocks_revision")
      .map((column) => {
        let defaultSql = "";
        if (column.default instanceof SQL) defaultSql = dialect.sqlToQuery(column.default).sql;
        else if (typeof column.default === "string") defaultSql = `'${column.default.replaceAll("'", "''")}'`;
        else if (typeof column.default === "boolean" || typeof column.default === "number") defaultSql = String(column.default);
        const sqlType = table === userProfiles && column === userProfiles.businessType ? "profile_business_type" : types[column.dataType] || "text";
        return `${quote(column.name)} ${sqlType}${column.primary ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}${defaultSql ? ` DEFAULT ${defaultSql}` : ""}`;
      });
    await fixture.database!.exec(`CREATE TABLE ${quote(config.name)} (${columns.join(", ")})`);
  }
  for (const filename of [
    "0142_business_presence_plans.sql", "0143_business_presence_customer_tasks.sql",
    "0144_business_presence_task_delete_archive.sql", "0145_business_presence_fact_decisions.sql",
    "0146_business_presence_about_intent.sql", "0147_profile_content_blocks_revision.sql",
    "0148_business_presence_about_publication.sql",
    "0149_profile_publication_dependency_revision.sql",
  ]) await fixture.database!.exec(await readFile(new URL(`../../migrations/${filename}`, import.meta.url), "utf8"));
  fixture.publicProfile.mockImplementation((slug: string) => repository.getProfileBySlugPublic(slug));
  fixture.publicBusiness.mockImplementation(async (id: string) =>
    (await db.select().from(businesses).where(eq(businesses.id, id)).limit(1))[0]);
});

beforeEach(async () => {
  await fixture.database!.exec("TRUNCATE users, user_profiles, businesses, profiles, notifications, notification_preferences RESTART IDENTITY CASCADE");
});
afterAll(async () => { await fixture.database?.close(); });

async function seed(released = true, blocks: any[] = initialBlocks) {
  const suffix = randomUUID().replaceAll("-", "");
  const ownerId = `owner_${suffix}`;
  const foreignId = `foreign_${suffix}`;
  const businessId = `business_${suffix}`;
  const profileId = `profile_${suffix}`;
  const slug = `synthetic-carpentry-${suffix}`;
  const source = "https://evidence.example/services?fixture=private";
  const outcome = {
    kind: "business_profile", businessId, profileId,
    provenance: {
      evidence: { name: "Synthetic carpentry", links: [source], services: [], photoUrls: [] },
      enrichment: {
        source: "selective_intelligence_profile_enrichment", analyzer: "synthetic",
        output: { description: { text: approvedText, sourceUrls: [source] } },
      },
    },
  };
  await db.insert(users).values([
    { id: ownerId, email: `${suffix}@example.invalid`, verifiedBadge: true, preferences: { onboardingOutcome: outcome } },
    { id: foreignId, email: `${suffix}-foreign@example.invalid`, preferences: { onboardingOutcome: outcome } },
  ]);
  await db.insert(businesses).values({
    id: businessId, name: "Synthetic carpentry", slug, ownerUserId: ownerId,
    roleContext: "business_owner", status: "active", publicDiscoveryEnabled: true,
  });
  await db.insert(profiles).values({
    id: profileId, slug, ownerUserId: ownerId, businessId, roleContext: "business_owner",
    displayName: "Synthetic carpentry", status: "published", publiclyReleased: released,
    contentBlocks: structuredClone(blocks),
  });
  return { ownerId, foreignId, businessId, profileId, slug };
}
type Subject = Awaited<ReturnType<typeof seed>>;

async function onboardFromLink(): Promise<Subject> {
  const suffix = randomUUID().replaceAll("-", "");
  const ownerId = `owner_${suffix}`;
  const foreignId = `foreign_${suffix}`;
  await db.insert(users).values([
    { id: ownerId, email: `${suffix}@example.invalid`, verifiedBadge: false, verificationStatus: "pending", emailVerified: true, addressVerified: true, preferences: {} },
    { id: foreignId, email: `${suffix}-foreign@example.invalid`, preferences: {} },
  ]);
  const outcomes = new OutcomeOnboardingRepository();
  const analyzer = { id: "synthetic_cited_services", analyze: vi.fn(async (input: { links: string[] }) => ({
    services: [{ name: "Carpentry & trim", sourceUrls: [input.links[0]] }],
    description: { text: "This unsupported model prose must not be persisted.", sourceUrls: [input.links[0]] },
    about: { text: "This unsupported About must not be persisted.", sourceUrls: [input.links[0]] },
  })) };
  const result = await completeOutcomeOnboarding({
    ...ownedStorage,
    updateUser: async (id, changes) => (await db.update(users).set(changes).where(eq(users.id, id)).returning())[0],
    completeOutcomeBusinessProfile: outcomes.completeBusinessProfile.bind(outcomes),
    preflightOutcomeBusinessProfile: outcomes.preflightBusinessProfile.bind(outcomes),
  }, {
    userId: ownerId, kind: "business_profile", goal: "Build my public business profile from this link.",
    business: { links: [onboardingWebsite] },
  }, { businessProfileAnalyzer: analyzer });
  expect(analyzer.analyze).toHaveBeenCalledTimes(1);
  if (result.kind !== "business_profile") throw new Error("Expected the real onboarding business outcome");
  const owner = (await ownedStorage.getUser(ownerId))!;
  const output = (owner.preferences as any).onboardingOutcome.provenance.enrichment.output;
  expect(output.description.text).toBe(approvedText);
  expect(output.description.sourceUrls).toEqual([onboardingWebsite]);
  expect(output.about).toBeUndefined();
  expect(JSON.stringify(output)).not.toContain("unsupported model prose");
  return { ownerId, foreignId, businessId: result.profile.businessId, profileId: result.profile.id, slug: result.profile.slug };
}

async function approveFact(subject: Subject) {
  const plan = await refreshOwnedPresencePlan(ownedStorage, subject.ownerId);
  const sitePath = (plan.plan as any).sitePath.allowed.includes("hosted_new") ? "hosted_new" : "preserve_migrate";
  await reviewOwnedPresencePlan(ownedStorage, {
    ownerUserId: subject.ownerId, expectedDigest: plan.evidenceDigest, expectedPlanHash: plan.planHash,
    expectedRevision: plan.revision, sitePath,
  });
  const review = await getOwnedPresenceFactReview(ownedStorage, subject.ownerId);
  const fact = review.facts.find((item) => item.factKey === "description")!;
  expect(fact.value).toBe(approvedText);
  await submitOwnedPresenceFactDecision(ownedStorage, {
    ownerUserId: subject.ownerId, expectedPlanId: review.planId, expectedProfileId: subject.profileId,
    expectedRevision: review.revision, expectedDigest: review.evidenceDigest,
    expectedPlanHash: review.planHash, factKey: "description", valueDigest: fact.valueDigest,
    decision: "approve", idempotencyKey: randomUUID(),
  });
}

async function consent(subject: Subject, replacementAcknowledged = false, publicationAcknowledged = true) {
  const preview = await getOwnedPresenceAboutPreview(ownedStorage, subject.ownerId);
  expect(preview.eligible).toBe(true);
  const request = {
    ownerUserId: subject.ownerId, expectedPlanId: preview.plan.id, expectedProfileId: subject.profileId,
    expectedRevision: preview.plan.revision, expectedDigest: preview.plan.evidenceDigest,
    expectedPlanHash: preview.plan.planHash, factKey: preview.fact!.key, decisionId: preview.fact!.decisionId,
    valueDigest: preview.fact!.valueDigest, contentBlocksDigest: preview.target!.contentBlocksDigest,
    aboutBlockDigest: preview.target!.aboutBlockDigest, aboutBlockId: preview.target!.aboutBlockId,
    previewDigest: preview.previewDigest!, targetMode: preview.target!.targetMode,
    contentBlocksRevision: preview.target!.contentBlocksRevision,
    publicationAcknowledged, replacementAcknowledged, idempotencyKey: randomUUID(),
  };
  return { preview, request, intent: await authorizeOwnedPresenceAboutIntent(ownedStorage, request) };
}
const apply = (subject: Subject, intentId: string, idempotencyKey = randomUUID()) =>
  applyOwnedPresenceAboutIntent(ownedStorage, { ownerUserId: subject.ownerId, intentId, idempotencyKey });
const readProfile = async (subject: Subject) =>
  (await db.select().from(profiles).where(eq(profiles.id, subject.profileId)).limit(1))[0];
const render = (subject: Subject, html = templateHtml) => buildPublicProfileHtml({
  slug: subject.slug, origin: "https://www.thetradescout.com", templateHtml: html,
});
const release = (subject: Subject, profileVisibility: "public" | "private") =>
  mutateExactProfileVisibilityAtomically({
    ownerUserId: subject.ownerId, requestedProfileId: subject.profileId,
    allowLegacyActiveProfileFallback: false, profileVisibility,
  }, { connect: async () => ({ query: async (text, params) => {
    const result = await fixture.database!.query(text, params as any[] | undefined);
    return { rows: result.rows, rowCount: result.rows.length };
  } }) });

async function verifyNewBusinessThroughCanonicalReview(subject: Subject) {
  const verificationProfileId = businessVerificationProfileId({ userId: subject.ownerId, businessId: subject.businessId!, publicProfileId: subject.profileId });
  const [verification] = await db.select().from(userProfiles).where(eq(userProfiles.id, verificationProfileId));
  expect(verification).toMatchObject({ userId: subject.ownerId, userIntent: "business", businessType: null, verificationStatus: "pending", verifiedBadge: false });
  expect(verificationProfileId).not.toBe(subject.profileId);
  expect((await ownedStorage.getUser(subject.ownerId))?.verifiedBadge).toBe(false);
  expect((await release(subject, "public")).ok).toBe(false);
  const input = { publicProfileId: subject.profileId, taxIdLast4: "4321", taxDocumentObjectKey: `private/${subject.ownerId}/${randomUUID()}`, businessRegistrationDocObjectKey: `private/${subject.ownerId}/${randomUUID()}` };
  await db.transaction((tx) => submitOwnedBusinessVerification(tx, { userId: subject.ownerId, input }));
  expect((await ownedStorage.getUser(subject.ownerId))?.verificationStatus).toBe("pending");
  expect((await release(subject, "public")).ok).toBe(false);
  const reviewerId = `synthetic_admin_${randomUUID().replaceAll("-", "")}`;
  await db.insert(users).values({ id: reviewerId, email: `${reviewerId}@example.invalid`, role: "super_admin", roles: ["super_admin"] });
  await db.transaction((tx) => reviewBusinessVerification(tx, { verificationProfileId, reviewerId, decision: { field: "tax_id", decision: "approved" } }));
  expect((await ownedStorage.getUser(subject.ownerId))?.verificationStatus).toBe("pending");
  await db.transaction((tx) => reviewBusinessVerification(tx, { verificationProfileId, reviewerId, decision: { field: "business_registration", decision: "approved" } }));
  expect((await ownedStorage.getUser(subject.ownerId))?.verificationStatus).toBe("approved");
  expect((await ownedStorage.getUser(subject.ownerId))?.verifiedBadge).toBe(false);
}

describe("explicit About publication against actual PostgreSQL services and public renderer", () => {
  it("holds a new link-only profile private, then inserts one approved About after release and fresh creation consent", async () => {
    const subject = await onboardFromLink();
    const originalBlocks = (await readProfile(subject)).contentBlocks!;
    expect(originalBlocks.filter((block) => block.type === "about")).toHaveLength(0);
    expect(JSON.stringify(originalBlocks)).not.toContain(approvedText);
    await approveFact(subject);
    expect(await render(subject)).toBeNull();
    expect((await readProfile(subject)).contentBlocks).toEqual(originalBlocks);
    expect((await getOwnedPresenceAboutPreview(ownedStorage, subject.ownerId)).eligible).toBe(false);
    // Account email/address flags are synthetic prerequisites. Business trust
    // starts pending and requires real canonical submission and admin review.
    await verifyNewBusinessThroughCanonicalReview(subject);
    // Fact approval, document submission and About consent cannot release it.
    expect((await release(subject, "public")).ok).toBe(true);
    const before = await render(subject);
    expect(before).not.toContain('data-seo-profile-about="true"');
    await expect(consent(subject, false, false)).rejects.toMatchObject({ code: "PRESENCE_ABOUT_PUBLICATION_ACK_REQUIRED" });
    const { preview, intent } = await consent(subject);
    expect(preview.plan.sitePath).toBe("preserve_migrate");
    expect(preview.target?.targetMode).toBe("create");
    expect(preview.fact?.key).toBe("description");
    expect(preview.target?.currentText).toBe("");
    expect(preview.replacementRequired).toBe(false);
    expect((await readProfile(subject)).contentBlocks).toEqual(originalBlocks);
    const result = await apply(subject, intent.id);
    const stored = await readProfile(subject);
    expect(result.status).toBe("applied");
    expect(result.publicationApplied).toBe(true);
    expect(stored.contentBlocksRevision).toBe(preview.target!.contentBlocksRevision + 1);
    expect(stored.contentBlocks).toEqual([...originalBlocks, { type: "about", data: { body: approvedText } }]);
    expect(stored.contentBlocks!.filter((block) => block.type === "about")).toHaveLength(1);
    const business = (await db.select().from(businesses).where(eq(businesses.id, subject.businessId)).limit(1))[0];
    expect((business.profileData as any).website).toBe(onboardingWebsite);
    expect((business.profileData as any).publicWebsiteEnabled).toBe(false);
    expect(await query("SELECT event_kind FROM business_presence_about_intent_events ORDER BY event_sequence")).toEqual([
      { event_kind: "authorize" }, { event_kind: "apply" },
    ]);
    const html = (await render(subject))!;
    expect(html).toContain('<section data-seo-profile-about="true"><h2>About</h2><p>Services include Carpentry &amp; trim.</p></section>');
    expect(html.match(/data-seo-profile-about="true"/g)).toHaveLength(1);
    expect((await render(subject, html))!.match(/data-seo-profile-about="true"/g)).toHaveLength(1);
    expect(html).not.toContain("fixture=private");
    const replay = await apply(subject, intent.id);
    expect(replay).toEqual(result);
    expect((await readProfile(subject)).contentBlocksRevision).toBe(stored.contentBlocksRevision);
    expect(await query("SELECT count(*)::integer AS count FROM business_presence_about_intent_events WHERE event_kind='apply'")).toEqual([{ count: 1 }]);
    await expect(withdrawOwnedPresenceAboutIntent(subject.ownerId, intent.id, randomUUID())).rejects.toMatchObject({ code: "PRESENCE_ABOUT_INTENT_APPLIED" });
    expect((await release(subject, "private")).ok).toBe(true);
    expect(await render(subject)).toBeNull();
  });

  it("rejects legacy consent and an edit-then-restore snapshot without adding an About block", async () => {
    const subject = await seed(); await approveFact(subject);
    const first = await consent(subject);
    await query("UPDATE business_presence_about_intent_events SET publication_acknowledged=false, target_mode=NULL, content_blocks_revision=NULL, profile_target_identity=NULL WHERE id=$1", [first.intent.id]);
    await expect(apply(subject, first.intent.id)).rejects.toMatchObject({ code: "PRESENCE_ABOUT_FRESH_CONSENT_REQUIRED" });
    const fresh = await consent(subject);
    await db.update(profiles).set({ contentBlocks: [...initialBlocks, { type: "hero", data: { text: "Changed temporarily" } }] }).where(eq(profiles.id, subject.profileId));
    await db.update(profiles).set({ contentBlocks: structuredClone(initialBlocks) }).where(eq(profiles.id, subject.profileId));
    expect((await readProfile(subject)).contentBlocksRevision).toBe(3);
    await expect(apply(subject, fresh.intent.id)).rejects.toMatchObject({ code: "PRESENCE_ABOUT_INTENT_STALE" });
    expect((await readProfile(subject)).contentBlocks).toEqual(initialBlocks);
    expect(await query("SELECT id FROM business_presence_about_intent_events WHERE event_kind='apply'")).toEqual([]);
  });

  it.each(["withdrawn", "expired"])("rejects %s consent without a public content write", async (state) => {
    const subject = await seed(); await approveFact(subject); const { intent } = await consent(subject);
    if (state === "withdrawn") await withdrawOwnedPresenceAboutIntent(subject.ownerId, intent.id, randomUUID());
    else await query("UPDATE business_presence_about_intent_events SET created_at=clock_timestamp()-interval '31 days', expires_at=clock_timestamp()-interval '1 day' WHERE id=$1", [intent.id]);
    await expect(apply(subject, intent.id)).rejects.toMatchObject({ code: state === "withdrawn" ? "PRESENCE_ABOUT_INTENT_WITHDRAWN" : "PRESENCE_ABOUT_INTENT_EXPIRED" });
    expect((await readProfile(subject)).contentBlocks).toEqual(initialBlocks);
    expect((await render(subject))!).not.toContain('data-seo-profile-about="true"');
  });

  it("rejects a withdrawn fact approval after publication consent", async () => {
    const subject = await seed(); await approveFact(subject); const { intent } = await consent(subject);
    const review = await getOwnedPresenceFactReview(ownedStorage, subject.ownerId);
    const fact = review.facts.find((item) => item.factKey === "description")!;
    await submitOwnedPresenceFactDecision(ownedStorage, {
      ownerUserId: subject.ownerId, expectedPlanId: review.planId, expectedProfileId: subject.profileId,
      expectedRevision: review.revision, expectedDigest: review.evidenceDigest,
      expectedPlanHash: review.planHash, factKey: "description", valueDigest: fact.valueDigest,
      decision: "withdraw", idempotencyKey: randomUUID(),
    });
    await expect(apply(subject, intent.id)).rejects.toMatchObject({ code: "PRESENCE_ABOUT_INTENT_STALE" });
    expect((await readProfile(subject)).contentBlocks).toEqual(initialBlocks);
  });

  it.each(["owner", "template", "scopedHidden", "ownerHidden", "release"])("rejects changed %s authority or presentation after consent", async (change) => {
    const subject = await seed(); await approveFact(subject); const { intent } = await consent(subject);
    if (change === "owner") await db.update(profiles).set({ ownerUserId: subject.foreignId }).where(eq(profiles.id, subject.profileId));
    if (change === "template") await db.update(profiles).set({ contentBlocks: [{ type: "siteTemplate", data: { id: "videographer" } }] }).where(eq(profiles.id, subject.profileId));
    if (change === "scopedHidden") await db.update(profiles).set({ contentBlocks: [...initialBlocks, { type: "profileSections", data: { sections: { about: false } } }] }).where(eq(profiles.id, subject.profileId));
    if (change === "ownerHidden") {
      const owner = (await ownedStorage.getUser(subject.ownerId))!;
      await db.update(users).set({ preferences: { ...owner.preferences, profileSections: { about: false } } }).where(eq(users.id, subject.ownerId));
    }
    if (change === "release") await db.update(profiles).set({ publiclyReleased: false }).where(eq(profiles.id, subject.profileId));
    await expect(apply(subject, intent.id)).rejects.toMatchObject({ code: change === "owner" ? "PRESENCE_OWNERSHIP_MISMATCH" : "PRESENCE_ABOUT_INTENT_STALE" });
    expect((await readProfile(subject)).contentBlocks!.filter((block) => block.type === "about")).toHaveLength(0);
    expect(await query("SELECT id FROM business_presence_about_intent_events WHERE event_kind='apply'")).toEqual([]);
  });

  it.each(["businessDiscovery", "businessOwner", "ownerHidden", "verification", "release", "slug"])("rejects %s changed then restored after consent", async (change) => {
    const subject = await seed(); await approveFact(subject); const { intent, preview } = await consent(subject);
    if (change === "businessDiscovery") {
      await db.update(businesses).set({ publicDiscoveryEnabled: false }).where(eq(businesses.id, subject.businessId));
      await db.update(businesses).set({ publicDiscoveryEnabled: true }).where(eq(businesses.id, subject.businessId));
    }
    if (change === "businessOwner") {
      await db.update(businesses).set({ ownerUserId: subject.foreignId }).where(eq(businesses.id, subject.businessId));
      await db.update(businesses).set({ ownerUserId: subject.ownerId }).where(eq(businesses.id, subject.businessId));
    }
    if (change === "ownerHidden") {
      const original = (await ownedStorage.getUser(subject.ownerId))!.preferences!;
      await db.update(users).set({ preferences: { ...original, profileSections: { about: false } } }).where(eq(users.id, subject.ownerId));
      await db.update(users).set({ preferences: original }).where(eq(users.id, subject.ownerId));
    }
    if (change === "verification") {
      await db.update(users).set({ verifiedBadge: false }).where(eq(users.id, subject.ownerId));
      await db.update(users).set({ verifiedBadge: true }).where(eq(users.id, subject.ownerId));
    }
    if (change === "release") {
      expect((await release(subject, "private")).ok).toBe(true);
      expect((await release(subject, "public")).ok).toBe(true);
    }
    if (change === "slug") {
      await db.update(profiles).set({ slug: `${subject.slug}-temporary` }).where(eq(profiles.id, subject.profileId));
      await db.update(profiles).set({ slug: subject.slug }).where(eq(profiles.id, subject.profileId));
    }
    expect((await readProfile(subject)).contentBlocksRevision).toBeGreaterThan(preview.target!.contentBlocksRevision);
    await expect(apply(subject, intent.id)).rejects.toMatchObject({ code: "PRESENCE_ABOUT_INTENT_STALE" });
    expect((await readProfile(subject)).contentBlocks).toEqual(initialBlocks);
  });

  it("keeps consent current after an unrelated preference update", async () => {
    const subject = await seed(); await approveFact(subject); const { intent, preview } = await consent(subject);
    const original = (await ownedStorage.getUser(subject.ownerId))!.preferences!;
    await db.update(users).set({ preferences: { ...original, fixtureUnrelatedPreference: "changed" } }).where(eq(users.id, subject.ownerId));
    expect((await readProfile(subject)).contentBlocksRevision).toBe(preview.target!.contentBlocksRevision);
    expect((await apply(subject, intent.id)).status).toBe("applied");
  });

  it("requires replacement acknowledgement and preserves unrelated blocks on replacement", async () => {
    const oldAbout = { type: "about", data: { description: "Existing owner About.", title: "Our story" } };
    const subject = await seed(true, [...initialBlocks, oldAbout]); await approveFact(subject);
    await expect(consent(subject)).rejects.toMatchObject({ code: "PRESENCE_ABOUT_REPLACEMENT_ACK_REQUIRED" });
    const { intent } = await consent(subject, true);
    await apply(subject, intent.id);
    expect((await readProfile(subject)).contentBlocks).toEqual([
      ...initialBlocks, { ...oldAbout, data: { ...oldAbout.data, description: approvedText } },
    ]);
  });

  it("renders only a visible default-theme About and escapes unsafe markup and contact text", async () => {
    const subject = await seed(true, [...initialBlocks, { type: "about", data: { body: "Repairs <img src=x onerror=alert(1)> & trim. Call 555-123-4567." } }]);
    const html = (await render(subject))!;
    expect(html).toContain('data-seo-profile-about="true"');
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain("555-123-4567");
    await db.update(profiles).set({ contentBlocks: [...(await readProfile(subject)).contentBlocks!, { type: "profileSections", data: { sections: { about: false } } }] }).where(eq(profiles.id, subject.profileId));
    expect(await render(subject)).not.toContain('data-seo-profile-about="true"');
    await db.update(profiles).set({ contentBlocks: [{ type: "siteTemplate", data: { id: "videographer" } }, { type: "about", data: { body: approvedText } }] }).where(eq(profiles.id, subject.profileId));
    expect(await render(subject)).not.toContain('data-seo-profile-about="true"');
  });
});
