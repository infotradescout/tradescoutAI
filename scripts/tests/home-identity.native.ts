import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import express from "express";
import { and, eq, getTableName } from "drizzle-orm";
import { chromium, expect } from "@playwright/test";

const url = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(process.env.NODE_ENV, "test");
assert(["localhost", "127.0.0.1"].includes(url.hostname));
assert(/test/.test(url.pathname));
assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
const { db, pool } = await import("../../server/db");
const { users, states, counties, userHomes, userHomeRecords } = await import("../../shared/schema");
const { loadHomeIdentity, saveHomeIdentity } = await import("../../server/services/homeIdentityService");
const { createHomeIdentityRouter } = await import("../../server/routes/home-identity");
const out = path.resolve(process.env.HOME_IDENTITY_PROOF_DIR!);
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const homeId = "073b355c-1aa3-4658-a776-ebedaa6aaefc", owner = randomUUID(), otherOwner = randomUUID(), otherHomeId = randomUUID();
const report: any = { head, passed: false, scope: "Actual property-edit service/router plus built UI and native PostgreSQL. Test-only authentication and unrelated read fixtures. No live records or external writes.", checks: [], browser: [], pageErrors: [] };
let server: ReturnType<express.Express["listen"]> | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let activePage: import("@playwright/test").Page | undefined;
const write = () => fs.writeFileSync(path.join(out, "home-identity-native.json"), JSON.stringify(report, null, 2));
async function check(name: string, action: () => Promise<void>) { await action(); report.checks.push(name); console.log("HOME_IDENTITY_CHECK " + name); write(); }
try {
  await db.insert(states).values([{ id: "FL", code: "FL", name: "Florida" }, { id: "LA", code: "LA", name: "Louisiana" }]).onConflictDoNothing();
  await db.insert(counties).values([{ fips: "12033", stateCode: "FL", name: "Test Florida County" }, { fips: "22105", stateCode: "LA", name: "Test Louisiana Parish" }]).onConflictDoNothing();
  await db.insert(users).values([{ id: owner, email: `${owner}@example.invalid`, firstName: "Property", lastName: "Owner" }, { id: otherOwner, email: `${otherOwner}@example.invalid`, firstName: "Other", lastName: "Owner" }]);
  await db.insert(userHomes).values([{ id: homeId, ownerUserId: owner, nickname: "Editable property", propertyType: "single_family", address1: "Original test address", city: "Test city", stateCode: "FL", countyFips: "12033", zipCode: "32501", yearBuilt: 2001 }, { id: otherHomeId, ownerUserId: otherOwner, nickname: "Other private property" }]);
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { const actor = req.get("x-home-proof-actor"); if ([owner, otherOwner].includes(actor)) req.user = { id: actor }; next(); });
  const authenticated: express.RequestHandler = (req: any, res, next) => { if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; } next(); };
  app.use(createHomeIdentityRouter({ authenticate: authenticated }));
  app.get("/api/auth/user", (req: any, res) => res.json(req.user ? { authenticated: true, user: { id: req.user.id, email: "fixture@example.invalid", firstName: "Property", lastName: "Owner", role: "homeowner", userIntent: "person", stateCode: "FL", countyFips: "12033", countyName: "Test Florida County", state: "FL", onboardingCompleted: true, profileVersion: 1, locationCommitted: true, emailVerified: true, addressVerified: true } } : { authenticated: false }));
  app.get("/api/states", async (_req, res) => res.json(await db.select({ code: states.code, name: states.name }).from(states)));
  app.get("/api/counties", async (req, res) => res.json(await db.select({ fips: counties.fips, name: counties.name }).from(counties).where(eq(counties.stateCode, String(req.query.state)))));
  app.get("/api/homes", authenticated, async (req: any, res) => res.json({ homes: await db.select().from(userHomes).where(eq(userHomes.ownerUserId, req.user.id)) }));
  app.get("/api/homes/:homeId", authenticated, async (req: any, res) => {
    try { const result = await loadHomeIdentity(req.user.id, req.params.homeId); res.json({ home: result.identity, records: await db.select().from(userHomeRecords).where(eq(userHomeRecords.homeId, req.params.homeId)), documents: [], appliances: [] }); }
    catch { res.status(404).json({ message: "Home not found" }); }
  });
  app.get("/api/homes/:id/projects", authenticated, (_req, res) => res.json({ projects: [] }));
  app.get("/api/homes/:id/maintenance-schedules", authenticated, (_req, res) => res.json({ schedules: [] }));
  app.get("/api/homeid/:id/persistence", authenticated, (_req, res) => res.json({ persistence: { propertyDetails: [], components: [], evidence: [], requestPackets: [] } }));
  app.get("/api/social/conversations/requests/incoming", (_req, res) => res.json({ requests: [] }));
  app.use("/api", (_req, res) => res.status(404).json({ message: "Unconfigured fixture" }));
  app.use(express.static(path.resolve("dist/public")));
  app.get("*", (_req, res) => res.sendFile(path.resolve("dist/public/index.html")));
  server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const api = async (method: string, actor = owner, body?: unknown, id = homeId) => {
    const response = await fetch(`${base}/api/homes/${id}/identity`, { method, headers: { "Content-Type": "application/json", ...(actor ? { "x-home-proof-actor": actor } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const current = async () => (await api("GET")).body;
  await check("anonymous and non-owner reads/writes cannot access the property", async () => {
    assert.equal((await api("GET", "")).status, 401); assert.equal((await api("PATCH", "", {})).status, 401);
    for (const method of ["GET", "PATCH"]) { const response = await api(method, otherOwner, method === "PATCH" ? {} : undefined); assert.equal(response.status, 404); assert(!JSON.stringify(response.body).includes("Original test address")); }
  });
  await check("canonical fields persist and receive an atomic history entry", async () => {
    const before = await current();
    const response = await api("PATCH", owner, { revision: before.revision, changes: { nickname: "Saved property", address2: "Unit 2", yearBuilt: 2002 } });
    assert.equal(response.status, 200); assert.notEqual(response.body.revision, before.revision);
    const reloaded = await current(); assert.equal(reloaded.identity.nickname, "Saved property"); assert.equal(reloaded.identity.address2, "Unit 2"); assert.equal(reloaded.identity.yearBuilt, 2002);
    const rows = await db.select().from(userHomeRecords).where(eq(userHomeRecords.homeId, homeId));
    assert.equal(rows.length, 1); assert.equal(rows[0].title, "Property details updated"); assert(!rows[0].details.includes("Unit 2"));
    assert.equal((await db.select().from(userHomes).where(eq(userHomes.id, homeId)))[0].ownerUserId, owner);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });
  await check("invalid input, mass assignment, and mismatched locations leave the record unchanged", async () => {
    const before = await current();
    for (const changes of [{ ownerUserId: otherOwner, nickname: "Attack" }, { stateCode: "LA", countyFips: "12033" }, { stateCode: null }, { zipCode: "invalid" }, { yearBuilt: 1200 }]) {
      const result = await api("PATCH", owner, { revision: before.revision, changes }); assert.equal(result.status, 400); assert.equal((await current()).revision, before.revision);
    }
  });
  await check("stale and simultaneous saves cannot silently overwrite newer details", async () => {
    const before = await current();
    const results = await Promise.all(["First concurrent edit", "Second concurrent edit"].map((nickname) => api("PATCH", owner, { revision: before.revision, changes: { nickname } })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const winner = results.find((result) => result.status === 200)!;
    assert.equal((await current()).identity.nickname, winner.body.identity.nickname);
    assert.equal((await api("PATCH", owner, { revision: before.revision, changes: { nickname: "Stale" } })).status, 409);
  });
  await check("a failed history write rolls the property update back", async () => {
    const before = await current(); const table = getTableName(userHomeRecords);
    await pool.query(`CREATE FUNCTION home_identity_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic history failure'; END $$; CREATE TRIGGER home_identity_test_fail BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION home_identity_test_fail();`);
    try { assert.equal((await api("PATCH", owner, { revision: before.revision, changes: { nickname: "Must roll back" } })).status, 500); assert.deepEqual(await current(), before); }
    finally { await pool.query(`DROP TRIGGER home_identity_test_fail ON "${table}"; DROP FUNCTION home_identity_test_fail();`); }
  });
  await check("no-op saves keep the revision/history stable and do not alter other properties", async () => {
    const before = await current(); const count = (await db.select().from(userHomeRecords).where(eq(userHomeRecords.homeId, homeId))).length;
    assert.equal((await api("PATCH", owner, { revision: before.revision, changes: { nickname: before.identity.nickname } })).status, 200);
    assert.equal((await current()).revision, before.revision); assert.equal((await db.select().from(userHomeRecords).where(eq(userHomeRecords.homeId, homeId))).length, count);
    assert.equal((await loadHomeIdentity(otherOwner, otherHomeId)).identity.nickname, "Other private property");
  });

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  for (const [device, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]] as const) {
    const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-home-proof-actor": owner }, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("ts:start-guide-seen-v1", "1"));
    let failNextSave = false;
    await context.route("**/*", (route) => {
      const req = route.request(), target = new URL(req.url());
      if (target.origin !== base) return route.abort();
      if (!['GET', 'HEAD'].includes(req.method()) && !(req.method() === "PATCH" && target.pathname === `/api/homes/${homeId}/identity`)) return route.abort();
      if (failNextSave && req.method() === "PATCH") { failNextSave = false; return route.fulfill({ status: 503, json: { message: "Simulated interruption" } }); }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => report.pageErrors.push({ device, message: error.message }));
    await page.goto(`${base}/homes?homeId=${homeId}`);
    await page.getByRole("button", { name: "Edit property", exact: true }).click();
    const dialog = page.getByTestId("home-identity-dialog");
    await expect(dialog.getByLabel("Property name", { exact: true })).toBeVisible();
    await dialog.getByLabel("Property name", { exact: true }).fill("Discard this draft");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog.getByText("Discard your unsaved changes?", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(dialog.getByLabel("Property name", { exact: true })).toHaveValue("Discard this draft");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.getByRole("button", { name: "Discard changes", exact: true }).click();
    assert.notEqual((await current()).identity.nickname, "Discard this draft");
    await page.getByRole("button", { name: "Edit property", exact: true }).click();
    await dialog.getByLabel("Property name", { exact: true }).fill(`${device} saved property`);
    await dialog.getByLabel("Year built", { exact: true }).fill("1500");
    await dialog.getByRole("button", { name: "Save property details", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Check the highlighted fields");
    await dialog.getByLabel("Year built", { exact: true }).fill("2003");
    await dialog.getByLabel("Street address", { exact: true }).fill(`${device} test street`);
    await dialog.getByLabel("State", { exact: true }).selectOption(device === "desktop" ? "LA" : "FL");
    await expect(dialog.getByLabel("County or parish", { exact: true })).toHaveValue("");
    await dialog.getByLabel("County or parish", { exact: true }).selectOption(device === "desktop" ? "22105" : "12033");
    await dialog.getByLabel("ZIP code", { exact: true }).fill(device === "desktop" ? "70401" : "32501");
    failNextSave = true;
    await dialog.getByRole("button", { name: "Save property details", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Your changes are still here");
    await expect(dialog.getByLabel("Street address", { exact: true })).toHaveValue(`${device} test street`);
    await dialog.getByRole("button", { name: "Save property details", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: `${device} saved property`, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: `${device} saved property`, exact: true })).toBeVisible();
    const persisted = await loadHomeIdentity(owner, homeId); assert.equal(persisted.identity.address1, `${device} test street`); assert.equal(persisted.identity.yearBuilt, 2003);
    await page.getByRole("button", { name: "Edit property", exact: true }).click();
    await dialog.getByLabel("Property name", { exact: true }).fill("Local conflict draft");
    const latest = await current(); await saveHomeIdentity(owner, homeId, { revision: latest.revision, changes: { nickname: `${device} other-session edit` } });
    await dialog.getByRole("button", { name: "Save property details", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("changed in another session");
    await dialog.getByLabel("Property name", { exact: true }).fill("Keep my draft while reviewing");
    await expect(dialog.getByRole("button", { name: "Discard draft and load latest", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Discard draft and load latest", exact: true }).click();
    await expect(dialog.getByLabel("Property name", { exact: true })).toHaveValue(`${device} other-session edit`);
    const box = await dialog.boundingBox(); assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
    await page.screenshot({ path: path.join(out, `home-identity-${device}.png`), fullPage: false });
    report.browser.push({ device, passed: true, checks: ["cancel preserves draft until discarded", "invalid input does not save", "state change clears old county", "interrupted save retains draft", "retry commits actual fields", "reload reads PostgreSQL", "conflict preserves draft", "explicit latest-data recovery", "dialog stays inside viewport"] });
    write(); await context.close(); activePage = undefined;
  }
  assert.deepEqual(report.pageErrors, []); report.passed = true;
} catch (error: any) {
  report.error = String(error.stack || error); process.exitCode = 1;
  if (activePage) { report.failureText = await activePage.locator("body").innerText().catch(() => ""); await activePage.screenshot({ path: path.join(out, "home-identity-failure.png") }).catch(() => {}); }
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
  await pool.end(); write(); console.log("HOME_IDENTITY_NATIVE " + JSON.stringify(report));
}
