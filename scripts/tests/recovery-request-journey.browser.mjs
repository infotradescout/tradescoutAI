import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import pg from "pg";
import bcrypt from "bcrypt";
import { assertDisposableTestDatabaseUrl } from "../lib/test-db-safety.mjs";

const baseURL = "http://127.0.0.1:5199";
const target = assertDisposableTestDatabaseUrl(process.env.TEST_DATABASE_URL);
assert.equal(target.loopback, true);
assert.equal(target.database, "tradescout_test_browser_20260907");
const out = path.resolve("test-results/recovery-request-journey");
await fs.mkdir(out, { recursive: true });
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await db.connect();
const identity = (await db.query("SELECT current_database() AS name, host(inet_server_addr()) AS host, inet_server_port() AS port")).rows[0];
assert.equal(identity.name, target.database);
assert.ok(["127.0.0.1", "::1"].includes(identity.host));
assert.equal(identity.port, Number(new URL(process.env.TEST_DATABASE_URL).port || 5432));
await db.query("SET statement_timeout = '15s'; SET lock_timeout = '3s'");
const fixtureBinding = randomUUID();
try {
  await db.query("BEGIN");
  await db.query("INSERT INTO states(id,name,code) VALUES ('LA','Louisiana','LA') ON CONFLICT (code) DO NOTHING");
  await db.query("INSERT INTO counties(name,fips,state_code) VALUES ('Ascension Parish','22005','LA') ON CONFLICT (fips) DO NOTHING");
  const county = (await db.query("SELECT id FROM counties WHERE fips='22005'")).rows[0];
  const password = await bcrypt.hash("Recovery2026!TestOnly", 4);
  for (const [id,email,role,firstName] of [
    ["recovery-requester-20260907","recovery-requester@example.test","homeowner","Recovery"],
    ["recovery-recipient-20260907","recovery-recipient@example.test","business_owner","Recipient"],
  ]) {
    await db.query(`INSERT INTO users(id,email,password_hash,first_name,last_name,phone,role,roles,active_role,
      state_code,county_fips,county_id,county_name,city,email_verified,address_verified,verification_status,
      onboarding_completed,profile_version,preferences)
      VALUES($1,$2,$3,$4,'Fixture','+12025550198',$5::text::user_role,ARRAY[$5::text],$5::text,
      'LA','22005',$6,'Ascension Parish','Gonzales',true,true,'approved',true,1,$7)
      ON CONFLICT(id) DO UPDATE SET password_hash=EXCLUDED.password_hash,
      preferences=coalesce(users.preferences,'{}'::jsonb) || EXCLUDED.preferences`,
      [id,email,password,firstName,role,county.id,JSON.stringify({emailNotifications:false,smsNotifications:false,marketingEmails:false,recoveryBrowserRun:fixtureBinding})]);
  }
  await db.query(`INSERT INTO businesses(id,name,slug,type,owner_user_id,role_context,profile_data,claim_status,public_discovery_enabled,status,sources)
    VALUES('recovery-recipient-business-20260907','Recovery County Repair','recovery-county-repair','contractor',
    'recovery-recipient-20260907','business_owner',$1,'claimed',true,'active','["local_disposable_fixture"]') ON CONFLICT(id) DO NOTHING`,
    [JSON.stringify({category:"home-services",services:["Faucet repair","Plumbing repair"],city:"Gonzales",stateCode:"LA"})]);
  await db.query("INSERT INTO business_counties(business_id,county_id) VALUES('recovery-recipient-business-20260907',$1) ON CONFLICT DO NOTHING",[county.id]);
  await db.query("COMMIT");
} catch(error) { await db.query("ROLLBACK"); await db.end(); throw error; }
const browser = await chromium.launch({ headless: true }).catch(async (error) => {
  await db.end();
  throw error;
});
const report = { passed: false, database: target.database, baseURL, requests: [], serverFailures: [], browserErrors: [] };
const contexts = [];
let currentPage;
const nonce = Date.now().toString(36).replace(/\d/g, (digit) => String.fromCharCode(97 + Number(digit)));
const title = `Kitchen faucet service ${nonce}`;
const description = "Repair a dripping kitchen faucet this week in Gonzales. Replace worn seals and check for leaks.";

async function context(viewport) {
  const ctx = await browser.newContext({ baseURL, viewport });
  contexts.push(ctx);
  await ctx.tracing.start({ screenshots: true, snapshots: true });
  const page = await ctx.newPage();
  currentPage = page;
  page.on("pageerror", (error) => report.browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500 && /\/api\/(direct-connect|business-providers)/.test(response.url())) {
      report.serverFailures.push({ url: response.url(), status: response.status() });
    }
  });
  return { ctx, page };
}
async function ready(page) {
  await page.waitForLoadState("networkidle");
  const close = page.getByRole("button", { name: "Close Start here guide", exact: true });
  if (await close.count()) await close.last().click();
}
async function fillDraft(page, requestTitle) {
  await page.getByPlaceholder("What would you like to get done?", { exact: true }).fill(requestTitle);
  await page.getByPlaceholder("Share the useful details, timing, and what a good result looks like.", { exact: true }).fill(description);
  await page.getByRole("button", { name: "Review request", exact: true }).click();
}
async function submit(page, requestTitle, label) {
  await expect(page.getByText("Ascension Parish, LA", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Review request details", exact: true }).click();
  await page.getByRole("button", { name: "Send when ready", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose who can receive this request" })).toBeVisible();
  await page.getByPlaceholder("Search outside your area or by company name").fill("Recovery County Repair");
  const company = page.getByRole("button", { name: /Recovery County Repair/ });
  await expect(company).toBeVisible();
  await expect(page.getByText("County context is missing", { exact: false })).toHaveCount(0);
  const send = page.getByRole("button", { name: "Send with my selection", exact: true });
  if (!(await company.innerText()).includes("Selected")) await company.click();
  await expect(send).toBeEnabled();
  await page.screenshot({ path: path.join(out, `${label}-review.png`), fullPage: true });
  const created = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/direct-connect/requests" && response.request().method() === "POST");
  await send.click();
  const response = await created;
  const payload = await response.json();
  assert.ok(response.ok(), `Create failed ${response.status()}: ${JSON.stringify(payload)}`);
  assert.ok(payload.id);
  await ready(page);
  await expect(page.getByText(requestTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  const reopenedUrl = page.url();
  await page.reload();
  await ready(page);
  await expect(page.getByText(requestTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: path.join(out, `${label}-persisted.png`), fullPage: true });
  const row = (await db.query("SELECT id,title,created_by_user_id,county_fips,state_code,scope,status FROM work_requests WHERE id=$1", [payload.id])).rows[0];
  assert.equal(row.created_by_user_id, "recovery-requester-20260907");
  assert.equal(row.county_fips, "22005");
  assert.equal(row.state_code, "LA");
  assert.notEqual(row.scope, "global");
  assert.notEqual(row.status, "draft");
  const assignments = (await db.query("SELECT contractor_id,responder_user_id,status FROM work_request_assignments WHERE work_request_id=$1", [payload.id])).rows;
  assert.ok(assignments.some((assignment) => assignment.responder_user_id === "recovery-recipient-20260907"), "Selected local business must own an assignment");
  const dispatch = (await db.query("SELECT county,contact_gate_state FROM direct_connect_dispatch_requests WHERE id=$1", [payload.id])).rows[0];
  assert.equal(dispatch.county, "22005");
  const delivery = (await db.query(`SELECT n.id AS notification_id,n.sent_at,
      d.delivery_method,d.status,d.delivered_at
    FROM notifications n
    JOIN notification_delivery_log d ON d.notification_id=n.id AND d.user_id=n.user_id
    WHERE n.user_id=$1 AND n.type='new_project_request' AND n.message=$2
      AND d.delivery_method='in_app' AND d.status='delivered'`,
    ["recovery-recipient-20260907", `You have a new Direct Connect request: ${requestTitle}`])).rows;
  assert.equal(delivery.length, 1, "Selected recipient must receive one recorded in-app notification");
  assert.ok(delivery[0].sent_at, "Notification service must finish sending the selected request notification");
  assert.ok(delivery[0].delivered_at, "In-app delivery must record its completion timestamp");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, "Request view must fit the viewport");
  report.requests.push({ label, row, assignments, dispatch, delivery: delivery[0], reopenedUrl, reloadPersisted: true, horizontalOverflow: false });
  return payload.id;
}

try {
  const desktop = await context({ width: 1440, height: 1000 });
  await desktop.page.goto("/direct-connect");
  await ready(desktop.page);
  await fillDraft(desktop.page, title);
  await expect(desktop.page.getByRole("button", { name: "Sign in to send", exact: true })).toBeVisible();
  await desktop.page.screenshot({ path: path.join(out, "anonymous-draft.png"), fullPage: true });
  const anonymousCreate = await desktop.ctx.request.post("/api/direct-connect/requests", { data: { title, description, category: "service_request" } });
  assert.equal(anonymousCreate.status(), 401);
  assert.equal((await db.query("SELECT count(*)::int AS total FROM work_requests WHERE title=$1", [title])).rows[0].total, 0);
  report.anonymousCreateDenied = true;
  await desktop.page.getByRole("button", { name: "Sign in to send", exact: true }).click();
  await desktop.page.getByRole("button", { name: "Send when ready", exact: true }).click();
  await expect(desktop.page.getByRole("heading", { name: "Sign in to send this Direct Connect request." })).toBeVisible();
  await desktop.page.getByPlaceholder("you@example.com", { exact: true }).fill("recovery-requester@example.test");
  await desktop.page.getByPlaceholder("Your password", { exact: true }).fill("Recovery2026!TestOnly");
  await desktop.page.getByRole("button", { name: "Sign in to continue", exact: true }).click();
  await desktop.page.waitForURL("**/direct-connect", { timeout: 15000 });
  await ready(desktop.page);
  assert.equal(new URL(desktop.page.url()).pathname, "/direct-connect", "Completed requester must stay at the intended destination after sign-in");
  await expect(desktop.page.getByPlaceholder("What would you like to get done?", { exact: true })).toHaveValue(title);
  report.authHandoffPreservesDraft = true;
  const userResponse = await desktop.ctx.request.get("/api/auth/user");
  const user = (await userResponse.json()).user;
  assert.equal(user.role, "homeowner");
  assert.equal(user.id, "recovery-requester-20260907");
  assert.equal(user.preferences.recoveryBrowserRun, fixtureBinding, "App must read this exact disposable fixture database before any authenticated request write");
  assert.equal(user.isAdmin, false);
  assert.equal(user.verificationBypass.active, false);
  await desktop.page.getByRole("button", { name: "Review request", exact: true }).click();
  const desktopId = await submit(desktop.page, title, "desktop");

  const mobile = await context({ width: 390, height: 844 });
  const login = await mobile.ctx.request.post("/api/auth/login", { data: { email: "recovery-requester@example.test", password: "Recovery2026!TestOnly" } });
  assert.equal(login.status(), 200);
  await mobile.page.goto("/direct-connect");
  await ready(mobile.page);
  await fillDraft(mobile.page, `${title} mobile`);
  const mobileId = await submit(mobile.page, `${title} mobile`, "mobile");

  const recipient = await context({ width: 1280, height: 900 });
  assert.equal((await recipient.ctx.request.post("/api/auth/login", { data: { email: "recovery-recipient@example.test", password: "Recovery2026!TestOnly" } })).status(), 200);
  await recipient.page.goto("/direct-connect/inbox");
  await ready(recipient.page);
  await expect(recipient.page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await recipient.page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
  await expect(recipient.page.getByRole("button", { name: "Prepare response", exact: true })).toBeVisible();
  const inbox = await recipient.ctx.request.get("/api/direct-connect/inbox");
  assert.equal(inbox.status(), 200);
  assert.ok(!(await inbox.text()).includes("+12025550198"), "Private requester phone must be absent before contact release");
  await recipient.page.screenshot({ path: path.join(out, "recipient-inbox.png"), fullPage: true });
  report.recipientCanReopenSelectedRequest = true;

  currentPage = desktop.page;
  await desktop.page.goto(`/direct-connect/active?county=22005&selected=${desktopId}`);
  await ready(desktop.page);
  await desktop.page.getByRole("button", { name: "Show details", exact: true }).click();
  const cancelResponse = desktop.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/direct-connect/requests/${desktopId}/cancel` && response.request().method() === "POST");
  await desktop.page.getByRole("button", { name: "Cancel request", exact: true }).click();
  assert.equal((await cancelResponse).status(), 200);
  await desktop.page.getByRole("button", { name: /^Cancelled \(/ }).click();
  await desktop.page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
  await expect(desktop.page.getByRole("button", { name: "Reopen request", exact: true }).filter({ visible: true }).first()).toBeVisible();
  const reopenResponse = desktop.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/direct-connect/requests/${desktopId}/reopen` && response.request().method() === "POST");
  await desktop.page.getByRole("button", { name: "Reopen request", exact: true }).filter({ visible: true }).first().click();
  assert.equal((await reopenResponse).status(), 200);
  await desktop.page.getByRole("button", { name: /^All \(/ }).click();
  await desktop.page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
  await desktop.page.reload();
  await ready(desktop.page);
  await expect(desktop.page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  assert.equal((await db.query("SELECT status FROM work_requests WHERE id=$1", [desktopId])).rows[0].status, "open");
  assert.equal((await db.query("SELECT contact_gate_state FROM direct_connect_dispatch_requests WHERE id=$1", [desktopId])).rows[0].contact_gate_state, "locked");
  await desktop.page.screenshot({ path: path.join(out, "desktop-lifecycle-reopened.png"), fullPage: true });
  report.cancelReopenPersisted = true;

  const signedOut = await context({ width: 390, height: 844 });
  for (const id of [desktopId, mobileId]) {
    const denied = await signedOut.ctx.request.post(`/api/direct-connect/requests/${id}/contact-gate`, { data: { nextState: "released" } });
    assert.equal(denied.status(), 401);
  }
  await signedOut.page.goto("/direct-connect/requests");
  await ready(signedOut.page);
  await expect(signedOut.page.getByText(title, { exact: true })).toHaveCount(0);
  await signedOut.page.screenshot({ path: path.join(out, "signed-out-private-requests.png"), fullPage: true });
  report.signedOutContactDenied = true;
  report.signedOutPrivateRequestHidden = true;
  assert.deepEqual(report.serverFailures, []);
  assert.deepEqual(report.browserErrors, []);
  report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  if (currentPage) {
    report.failureUrl = currentPage.url();
    await currentPage.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
    report.failureBody = await currentPage.locator("body").innerText().catch(() => "");
  }
  process.exitCode = 1;
} finally {
  for (const [index, ctx] of contexts.entries()) {
    await ctx.tracing.stop({ path: path.join(out, `trace-${index}.zip`) });
    await ctx.close();
  }
  await browser.close();
  await db.end();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
