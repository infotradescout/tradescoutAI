import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { buildMealScoutSharingLink, ecosystemPublicLinkKey, isMealScoutPublicProfileDestination, parseMealScoutSharingLink, projectApprovedEcosystemPublicLink,
  readEcosystemPublicLinkPointer, readProfileEcosystemPublicLinks, upsertProfileEcosystemPublicLinks } from "../shared/ecosystemPublicLink";
import { createEcosystemPublicLinkReceiver, readMealScoutPublicLinkEnvelope } from "../server/services/ecosystemPublicLinkReceiver";
import { registerEcosystemPublicLinkReceiverRoutes } from "../server/routes/ecosystem-public-links";

const pointer = Object.freeze({ app: "mealscout" as const, tenantId: "a".repeat(32), sourceId: "meal-one" });
const profile = () => ({ id: "ts-profile", slug: "county-kitchen", businessId: "ts-business", publiclyReleased: true,
  updatedAt: "2026-09-30T00:00:00Z", contentBlocks: upsertProfileEcosystemPublicLinks([{ type: "about", data: { text: "Native county business" } }], [pointer]) });
const envelope = () => ({ ...pointer, publication: "published", exportApproval: "approved", publicLabel: "Cedar Kitchen",
  canonicalUrl: "https://www.mealscout.us/restaurant/cedar-kitchen--meal-one", sourceRevision: "1".repeat(40),
  publicationRevision: `g${"b".repeat(32)}_p1_a2`, approvedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 800).toISOString() });

test("qualified pointer is not an account grant; strict publisher sharing links and existing blocks round trip", () => {
  assert.deepEqual(parseMealScoutSharingLink(buildMealScoutSharingLink(pointer)), pointer);
  for (const url of [buildMealScoutSharingLink(pointer) + "?token=private", buildMealScoutSharingLink(pointer).replace("mealscout.onrender.com", "mealscout.onrender.com.evil.invalid"),
    buildMealScoutSharingLink(pointer).replace("https://", "https://private@"), buildMealScoutSharingLink(pointer).replace("meal-one", "%2e%2e")]) assert.equal(parseMealScoutSharingLink(url), null);
  assert.equal(readEcosystemPublicLinkPointer({ ...pointer, ownerId: "private-owner" }), null);
  const native = [{ type: "about", data: { text: "Native history" } }, { type: "profileBooking", data: { privateNativeField: "kept-native" } }];
  const blocks = upsertProfileEcosystemPublicLinks(native, [pointer]);
  assert.deepEqual(blocks.slice(0, 2), native);
  assert.deepEqual(readProfileEcosystemPublicLinks(blocks), [pointer]);
  assert.deepEqual(upsertProfileEcosystemPublicLinks(blocks, []), native);
  assert.throws(() => upsertProfileEcosystemPublicLinks(native, [pointer, pointer]));
  assert.throws(() => upsertProfileEcosystemPublicLinks(Array(200).fill(native[0]), [pointer]));
  assert.deepEqual(readProfileEcosystemPublicLinks([...blocks, blocks[2]]), []);
});

test("only exact source-approved public whitelist is usable; private fields/canonical attacks fail closed", () => {
  const e = envelope();
  const result = projectApprovedEcosystemPublicLink(e, pointer, Date.now());
  assert.equal(result?.reference, ecosystemPublicLinkKey(pointer));
  assert.equal(result?.access, "public_link_only");
  for (const change of [{ ownerId: "PRIVATE_OWNER_CANARY" }, { phone: "PRIVATE_PHONE_CANARY" }, { exportApproval: "unapproved" }, { publication: "draft" },
    { tenantId: "c".repeat(32) }, { sourceId: "other" }, { app: "sway" }, { publicLabel: "<script>" },
    { canonicalUrl: "https://www.mealscout.us.evil.invalid/restaurant/cedar--meal-one" },
    { canonicalUrl: "https://www.mealscout.us/restaurant/cedar--other--meal-one?token=private" },
    { expiresAt: new Date(Date.now() - 1).toISOString() }, { expiresAt: new Date(Date.now() + 10000).toISOString() },
    { sourceRevision: "not-a-release" }, { publicationRevision: "client-approval" }]) {
    assert.equal(projectApprovedEcosystemPublicLink({ ...e, ...change }, pointer, Date.now()), null);
  }
  assert.doesNotMatch(JSON.stringify(result), /owner|phone|cookie|payment|email|grant|session/i);
});

test("five native food destinations preserve exact canonical binding and reject route/URL tricks", () => {
  const now = Date.now();
  for (const prefix of ["restaurant", "truck", "bar", "caterer", "private-chef"]) {
    const canonicalUrl = `https://www.mealscout.us/${prefix}/cedar-kitchen--meal-one`;
    const e = { ...envelope(), canonicalUrl };
    assert.equal(isMealScoutPublicProfileDestination(canonicalUrl, pointer.sourceId), true, prefix);
    assert.equal(projectApprovedEcosystemPublicLink(e, pointer, now)?.canonicalUrl, canonicalUrl);
    for (const bad of [canonicalUrl + "?q=1", canonicalUrl + "#hash", canonicalUrl + "/",
      canonicalUrl.replace("www.mealscout.us", "www.mealscout.us.evil.invalid"),
      canonicalUrl.replace("www.mealscout.us", "mealscout.us"), canonicalUrl.replace("https://", "http://"),
      canonicalUrl.replace("https://", "https://private@"), canonicalUrl.replace("cedar-kitchen", "%63edar-kitchen"),
      canonicalUrl.replace(`/${prefix}/`, `/${prefix}//`), canonicalUrl.replace(`/${prefix}/`, `/restaurant/../${prefix}/`),
      canonicalUrl.replace("meal-one", "other--meal-one--other"), canonicalUrl.replace("cedar-kitchen", "x".repeat(121)),
      canonicalUrl.replace("cedar-kitchen", "_cedar"), canonicalUrl.replace(`/${prefix}/`, "/private_chef/")]) {
      assert.equal(isMealScoutPublicProfileDestination(bad, pointer.sourceId), false, bad);
      assert.equal(projectApprovedEcosystemPublicLink({ ...e, canonicalUrl: bad }, pointer, now), null);
    }
    for (const change of [{ exportApproval: "unapproved" }, { publication: "draft" }, { ownerId: "PRIVATE_CANARY" },
      { tenantId: "c".repeat(32) }, { sourceId: "other" }, { expiresAt: new Date(now).toISOString() }]) {
      assert.equal(projectApprovedEcosystemPublicLink({ ...e, ...change }, pointer, now), null, prefix);
    }
  }
  for (const prefix of ["host", "host_venue", "supplier", "location", "event", "trucks", "food-truck", "private_chef"]) {
    assert.equal(isMealScoutPublicProfileDestination(`https://www.mealscout.us/${prefix}/cedar--meal-one`, pointer.sourceId), false, prefix);
  }
  const ambiguous = "https://www.mealscout.us/truck/cedar--other--meal-one";
  assert.equal(isMealScoutPublicProfileDestination(ambiguous, "meal-one"), true);
  assert.equal(isMealScoutPublicProfileDestination(ambiguous, "other--meal-one"), false);
});

test("feature-off and missing/private/unregistered native profile perform zero publisher calls", async () => {
  let nativeReads = 0, sourceReads = 0;
  const off = createEcosystemPublicLinkReceiver({ enabled: () => false,
    getPublicProfile: async () => { nativeReads++; return profile(); }, readEnvelope: async () => { sourceReads++; return envelope(); } });
  assert.equal((await off("county-kitchen", pointer)).state, "unavailable");
  assert.equal(nativeReads, 0); assert.equal(sourceReads, 0);
  for (const p of [null, { ...profile(), slug: "other" }, { ...profile(), contentBlocks: [] }]) {
    const read = createEcosystemPublicLinkReceiver({ enabled: () => true, getPublicProfile: async () => p,
      readEnvelope: async () => { sourceReads++; return envelope(); } });
    assert.equal((await read("county-kitchen", pointer)).state, "unavailable");
  }
  assert.equal(sourceReads, 0);
});

test("native profile withdraw, identity/content movement during publisher read rejects result", async () => {
  for (const changed of [null, { ...profile(), id: "other-profile" }, { ...profile(), updatedAt: "2026-09-30T00:00:01Z" },
    { ...profile(), contentBlocks: [] }, { ...profile(), businessId: "other-business" }, { ...profile(), publiclyReleased: false }]) {
    let count = 0;
    const read = createEcosystemPublicLinkReceiver({ enabled: () => true, getPublicProfile: async () => ++count === 1 ? profile() : changed, readEnvelope: async () => envelope() });
    assert.equal((await read("county-kitchen", pointer)).state, "unavailable");
  }
});

test("request pointer and native profile snapshot cannot be rebound by async reader mutation", async () => {
  const mutable = { ...pointer }; const p = profile();
  const read = createEcosystemPublicLinkReceiver({ enabled: () => true, getPublicProfile: async () => p,
    readEnvelope: async bound => { mutable.tenantId = "c".repeat(32); assert.ok(Object.isFrozen(bound));
      p.contentBlocks = upsertProfileEcosystemPublicLinks([], [{ ...pointer, tenantId: "c".repeat(32) }]); return envelope(); } });
  assert.equal((await read("county-kitchen", mutable)).state, "unavailable");
});

test("whole receiver deadline, late callback, clock rollback and expiry during native recheck fail closed", async () => {
  let released = false;
  const read = createEcosystemPublicLinkReceiver({ enabled: () => true, timeoutMs: 20, getPublicProfile: async () => profile(),
    readEnvelope: async (_, signal) => { await new Promise<void>(resolve => setTimeout(resolve, 40)); released = signal.aborted; return envelope(); } });
  assert.equal((await read("county-kitchen", pointer)).state, "unavailable");
  await new Promise(resolve => setTimeout(resolve, 45)); assert.equal(released, true);
  const times = [Date.now(), Date.now() - 100];
  const backwards = createEcosystemPublicLinkReceiver({ enabled: () => true, now: () => times.shift() ?? times[0] ?? 0,
    getPublicProfile: async () => profile(), readEnvelope: async () => envelope() });
  assert.equal((await backwards("county-kitchen", pointer)).state, "unavailable");
  let count = 0; const e = { ...envelope(), expiresAt: new Date(Date.now() + 10).toISOString() };
  const expires = createEcosystemPublicLinkReceiver({ enabled: () => true, getPublicProfile: async () => {
    if (++count === 2) await new Promise(resolve => setTimeout(resolve, 20)); return profile(); }, readEnvelope: async () => e });
  assert.equal((await expires("county-kitchen", pointer)).state, "unavailable");
});

test("fixed-origin HTTP transport omits credentials, rejects redirects/media/oversized streams", async () => {
  let requests = 0;
  const request = (async (url: any, init: any) => {
    requests++; assert.equal(url, buildMealScoutSharingLink(pointer)); assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.deepEqual(init.headers, { Accept: "application/json" });
    return Response.json(envelope());
  }) as typeof fetch;
  assert.equal((await readMealScoutPublicLinkEnvelope(pointer, new AbortController().signal, request) as any).publicLabel, "Cedar Kitchen");
  assert.equal(requests, 1);
  for (const response of [new Response("<html>private</html>", { headers: { "content-type": "text/html" } }),
    new Response("PRIVATE".repeat(1000), { headers: { "content-type": "application/json" } }),
    new Response("{}", { headers: { "content-type": "application/json", "content-length": "10000" } }),
    new Response(null, { status: 302, headers: { location: "https://evil.invalid/private" } })]) {
    assert.equal(await readMealScoutPublicLinkEnvelope(pointer, new AbortController().signal, (async () => response) as typeof fetch), null);
  }
});

test("actual registered native API is scoped to configured public identity and never a generic source proxy", async () => {
  const app = express(), router = express.Router(); let visible = true, sourceReads = 0, sourceAvailable = true;
  registerEcosystemPublicLinkReceiverRoutes(router, { enabled: () => true, getPublicProfile: async slug => visible && slug === "county-kitchen" ? profile() : null,
    readEnvelope: async () => { sourceReads++; return sourceAvailable ? envelope() : null; } });
  app.use(router);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const path = `/api/u/county-kitchen/ecosystem-links/mealscout/${pointer.tenantId}/${pointer.sourceId}`;
  try {
    const response = await fetch(base + path); assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).reference.access, "public_link_only");
    for (const invalid of [path.replace("county-kitchen", "other"), path.replace(pointer.tenantId, "c".repeat(32)), path + "?approved=true",
      path.replace("mealscout", "sway")]) assert.equal((await fetch(base + invalid)).status, 404);
    assert.equal(sourceReads, 1);
    visible = false; assert.equal((await fetch(base + path)).status, 404); assert.equal(sourceReads, 1);
    visible = true; sourceAvailable = false; assert.equal((await fetch(base + path)).status, 404);
  } finally { await new Promise<void>(r => server.close(() => r())); }
});
