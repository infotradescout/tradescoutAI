import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { profiles, type Profile } from "@shared/schema";

const harness = vi.hoisted(() => ({
  client: null as import("@electric-sql/pglite").PGlite | null,
}));
vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  harness.client = client;
  return { db: drizzle(client) };
});

import { db } from "../db";
import { ProfileRepository } from "../repositories/profileRepository";
import { profileContentBlocksSnapshotPredicate, reloadProfileContentSnapshot } from "../profileContentBlocksConcurrency";
import { profileTargetIdentityFromRow } from "../profileTargetIdentity";

const profileId = "synthetic-writer-profile";
const ownerId = "synthetic-writer-owner";
const original = [{ type: "hero" as const, data: { title: "Synthetic business" } }];
const approvedAbout = { type: "about" as const, data: { text: "Owner approved imported description" } };
const repository = new ProfileRepository();

async function load() {
  return (await repository.getProfileById(profileId))!;
}

async function save(snapshot: Profile, contentBlocks: Profile["contentBlocks"]) {
  return repository.updateProfileForOwnerWithContentBlocksRevision(
    ownerId, profileId, { contentBlocks }, snapshot.contentBlocksRevision, profileTargetIdentityFromRow(snapshot)
  );
}

describe("canonical profile content writers preserve applied About", () => {
  beforeAll(async () => {
    await harness.client!.exec(`
      CREATE TABLE users (
        id varchar PRIMARY KEY, verified_badge boolean DEFAULT true,
        verification_status varchar DEFAULT 'approved', preferences jsonb DEFAULT '{}'::jsonb
      );
      CREATE TABLE businesses (
        id varchar PRIMARY KEY, owner_user_id varchar NOT NULL, status varchar DEFAULT 'active',
        public_discovery_enabled boolean DEFAULT true, profile_data jsonb DEFAULT '{}'::jsonb
      );
      CREATE TABLE profiles (
        id varchar PRIMARY KEY, owner_user_id varchar NOT NULL, business_id varchar,
        role_context varchar NOT NULL, slug varchar NOT NULL UNIQUE, display_name varchar NOT NULL,
        headline varchar, content_blocks jsonb DEFAULT '[]'::jsonb,
        cta_config jsonb DEFAULT '{}'::jsonb, seo_meta jsonb DEFAULT '{}'::jsonb,
        status varchar NOT NULL DEFAULT 'published', publicly_released boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      );
    `);
    await harness.client!.exec(fs.readFileSync(
      path.join(process.cwd(), "migrations/0147_profile_content_blocks_revision.sql"), "utf8"
    ));
    await harness.client!.exec(fs.readFileSync(
      path.join(process.cwd(), "migrations/0149_profile_publication_dependency_revision.sql"), "utf8"
    ));
  });

  beforeEach(async () => {
    await harness.client!.exec("TRUNCATE profiles, businesses, users");
    await harness.client!.query("INSERT INTO users (id) VALUES ($1)", [ownerId]);
    await harness.client!.query("INSERT INTO businesses (id,owner_user_id) VALUES ('synthetic-business',$1)", [ownerId]);
    await harness.client!.query(
      "INSERT INTO profiles (id,owner_user_id,business_id,role_context,slug,display_name,content_blocks) VALUES ($1,$2,'synthetic-business','business_owner',$1,'Synthetic business',$3::jsonb)",
      [profileId, ownerId, JSON.stringify(original)]
    );
  });
  afterAll(async () => { await harness.client?.close(); });

  it("rejects an owner editor loaded before first About publication", async () => {
    const stale = await load();
    const published = await save(stale, [...original, approvedAbout]);
    expect(published?.contentBlocksRevision).toBe(2);
    expect(await save(stale, original)).toBeUndefined();
    expect((await load()).contentBlocks).toEqual([...original, approvedAbout]);
  });

  it("rejects a staff whole-array save loaded before first About publication", async () => {
    const stale = await load();
    await save(stale, [...original, approvedAbout]);
    expect(await repository.updateProfileByIdWithContentBlocksRevision(
      profileId, { contentBlocks: original }, stale.contentBlocksRevision, profileTargetIdentityFromRow(stale)
    )).toBeUndefined();
    expect((await load()).contentBlocks).toEqual([...original, approvedAbout]);
  });

  it("rejects a transactional provisioning writer using its stale snapshot", async () => {
    const stale = await load();
    await save(stale, [...original, approvedAbout]);
    const changed = await db.transaction(async (tx: typeof db) => tx.update(profiles)
      .set({ contentBlocks: original })
      .where(and(eq(profiles.id, profileId), profileContentBlocksSnapshotPredicate(stale)))
      .returning());
    expect(changed).toEqual([]);
    expect((await load()).contentBlocks).toEqual([...original, approvedAbout]);
  });

  it("rejects unguarded legacy owner and staff array saves even with matching content", async () => {
    await expect(repository.updateProfileForOwner(ownerId, profileId, { contentBlocks: original } as any))
      .rejects.toThrow("loaded revision and identity");
    await expect(repository.updateProfileById(profileId, { contentBlocks: original } as any))
      .rejects.toThrow("loaded revision and identity");
    expect((await load()).contentBlocksRevision).toBe(1);
  });

  it("keeps metadata-only owner and staff writers available without replacing About", async () => {
    await save(await load(), [...original, approvedAbout]);
    await repository.updateProfileForOwner(ownerId, profileId, { headline: "Updated headline" });
    await repository.updateProfileById(profileId, { displayName: "Updated display name" });
    expect(await load()).toMatchObject({
      headline: "Updated headline", displayName: "Updated display name",
      contentBlocks: [...original, approvedAbout], contentBlocksRevision: 2,
    });
  });

  it("does not resurrect a stale snapshot after edit and restore", async () => {
    const stale = await load();
    await save(stale, [...original, approvedAbout]);
    await save(await load(), original);
    expect((await load()).contentBlocksRevision).toBe(3);
    expect(await save(stale, [...original, approvedAbout])).toBeUndefined();
  });

  it.each([
    ["owner_user_id", "transferred-owner"], ["business_id", "other-business"],
    ["role_context", "contractor"], ["slug", "renamed-profile"], ["status", "draft"],
  ])("rejects a direct transactional content save after target %s changes", async (column, value) => {
    const stale = await load();
    await harness.client!.query(`UPDATE profiles SET ${column}=$1 WHERE id=$2`, [value, profileId]);
    const rows = await db.update(profiles).set({ contentBlocks: [...original, approvedAbout] })
      .where(and(eq(profiles.id, profileId), profileContentBlocksSnapshotPredicate(stale)))
      .returning();
    expect(rows).toEqual([]);
    expect((await load()).contentBlocks).toEqual(original);
  });

  it.each([
    { name: "owner", apply: "owner_user_id='transferred-owner'", restore: `owner_user_id='${ownerId}'` },
    { name: "business", apply: "business_id='other-business'", restore: "business_id='synthetic-business'" },
    { name: "role", apply: "role_context='contractor'", restore: "role_context='business_owner'" },
    { name: "slug", apply: "slug='renamed-profile'", restore: `slug='${profileId}'` },
    { name: "status", apply: "status='draft'", restore: "status='published'" },
    { name: "release", apply: "publicly_released=false", restore: "publicly_released=true" },
    { name: "domain", apply: `seo_meta='{"customDomain":"changed.example.invalid"}'::jsonb`, restore: "seo_meta='{}'::jsonb" },
  ])("does not revive an original snapshot after profile $name edit and restore", async ({ apply, restore }) => {
    const stale = await load();
    await harness.client!.query(`UPDATE profiles SET ${apply} WHERE id=$1`, [profileId]);
    await harness.client!.query(`UPDATE profiles SET ${restore} WHERE id=$1`, [profileId]);
    expect((await load()).contentBlocksRevision).toBe(stale.contentBlocksRevision + 2);
    expect(await save(stale, [...original, approvedAbout])).toBeUndefined();
  });

  it.each([
    { name: "business ownership", table: "businesses", id: "synthetic-business", apply: "owner_user_id='transferred-owner'", restore: `owner_user_id='${ownerId}'` },
    { name: "business status", table: "businesses", id: "synthetic-business", apply: "status='inactive'", restore: "status='active'" },
    { name: "business discovery", table: "businesses", id: "synthetic-business", apply: "public_discovery_enabled=false", restore: "public_discovery_enabled=true" },
    { name: "business trade partner template", table: "businesses", id: "synthetic-business", apply: `profile_data='{"tradePartner":true}'::jsonb`, restore: "profile_data='{}'::jsonb" },
    { name: "owner suspension", table: "users", id: ownerId, apply: "verification_status='suspended'", restore: "verification_status='approved'" },
    { name: "owner verification", table: "users", id: ownerId, apply: "verified_badge=false,verification_status='pending'", restore: "verified_badge=true,verification_status='approved'" },
    { name: "fallback About hidden", table: "users", id: ownerId, apply: `preferences='{"profileSections":{"about":false}}'::jsonb`, restore: "preferences='{}'::jsonb" },
  ])("does not revive an original snapshot after $name edit and restore", async ({ table, id, apply, restore }) => {
    const stale = await load();
    await harness.client!.query(`UPDATE ${table} SET ${apply} WHERE id=$1`, [id]);
    await harness.client!.query(`UPDATE ${table} SET ${restore} WHERE id=$1`, [id]);
    expect((await load()).contentBlocksRevision).toBe(stale.contentBlocksRevision + 2);
    expect(await save(stale, [...original, approvedAbout])).toBeUndefined();
  });

  it("does not invalidate consent for unrelated owner or business metadata", async () => {
    const snapshot = await load();
    await harness.client!.query(`UPDATE users SET preferences='{"metrics":{"visits":5},"profileSections":{"about":true}}'::jsonb WHERE id=$1`, [ownerId]);
    await harness.client!.exec(`UPDATE businesses SET profile_data='{"description":"Private business metadata"}'::jsonb WHERE id='synthetic-business'`);
    expect((await load()).contentBlocksRevision).toBe(snapshot.contentBlocksRevision);
    expect(await save(snapshot, [...original, approvedAbout])).toBeTruthy();
  });

  it("does not version a fallback About change when a profile-scoped setting owns it", async () => {
    await save(await load(), [...original, { type: "profileSections", data: { sections: { about: true } } }] as any);
    const snapshot = await load();
    await harness.client!.query(`UPDATE users SET preferences='{"profileSections":{"about":false}}'::jsonb WHERE id=$1`, [ownerId]);
    expect((await load()).contentBlocksRevision).toBe(snapshot.contentBlocksRevision);
    expect(await save(snapshot, [...snapshot.contentBlocks!, approvedAbout])).toBeTruthy();
  });

  it("continues rejecting caller-forged revisions after dependency triggers are installed", async () => {
    await harness.client!.query("UPDATE profiles SET content_blocks_revision=999 WHERE id=$1", [profileId]);
    expect((await load()).contentBlocksRevision).toBe(1);
    await harness.client!.exec("UPDATE businesses SET public_discovery_enabled=false WHERE id='synthetic-business'");
    expect((await load()).contentBlocksRevision).toBe(2);
  });

  it("does not version capitalization and whitespace changes to the same custom domain", async () => {
    await harness.client!.query(`UPDATE profiles SET seo_meta='{"customDomain":"example.invalid"}'::jsonb WHERE id=$1`, [profileId]);
    const snapshot = await load();
    await harness.client!.query(`UPDATE profiles SET seo_meta='{"customDomain":"  EXAMPLE.INVALID  "}'::jsonb WHERE id=$1`, [profileId]);
    expect((await load()).contentBlocksRevision).toBe(snapshot.contentBlocksRevision);
    expect(await save(snapshot, [...original, approvedAbout])).toBeTruthy();
  });

  it("recomputes from the complete latest row after the transaction versions its own dependency", async () => {
    const initial = await load();
    await save(initial, [...original, approvedAbout]);
    const saved = await db.transaction(async (tx: typeof db) => {
      await tx.execute(`UPDATE businesses SET public_discovery_enabled=false WHERE id='synthetic-business'`);
      const current = await reloadProfileContentSnapshot(tx, initial);
      expect(current.contentBlocks).toContainEqual(approvedAbout);
      expect(current.contentBlocksRevision).toBe(3);
      return tx.update(profiles).set({ contentBlocks: [...current.contentBlocks!, { type: "services", data: { title: "Latest services" } }] })
        .where(and(eq(profiles.id, profileId), profileContentBlocksSnapshotPredicate(current)))
        .returning();
    });
    expect(saved[0].contentBlocks).toContainEqual(approvedAbout);
  });

  it("does not adopt a refreshed target identity after a dependency update", async () => {
    const previous = await load();
    await harness.client!.query("UPDATE profiles SET owner_user_id='transferred-owner' WHERE id=$1", [profileId]);
    await expect(reloadProfileContentSnapshot(db, previous)).rejects.toThrow("target changed");
  });

  it("requires a valid loaded revision rather than using an unversioned direct writer", async () => {
    const snapshot = await load();
    for (const revision of [undefined, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => profileContentBlocksSnapshotPredicate({ ...snapshot, contentBlocksRevision: revision } as Profile))
        .toThrow("revision is required");
    }
  });
});
