/** Exercises the actual production-built Homes entry with synthetic loopback-only data.
 * Requires an exact-head successful build; never sends requests to a production API.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
const out = path.resolve(process.env.CORE_UI_PROOF_DIR || ".core-ui-proof");
const root = path.resolve("dist/public");
const id = "073b355c-1aa3-4658-a776-ebedaa6aaefc";
const secondId = "home-ui-fixture-two";
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const proof = { head, scope: "Production-built frontend, synthetic API fixtures only; no live property records or server writes", passed: false, checks: [], errors: [], blockedWrites: [] };
let browser, server, page;
const write = () => { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "homes-report.json"), JSON.stringify(proof, null, 2)); };
async function check(name, fn) { await fn(); proof.checks.push({ name, passed: true }); console.log("HOMES_UI_CHECK " + name); write(); }
try {
  const buildReport = JSON.parse(fs.readFileSync(path.join(out, "report.json"), "utf8"));
  assert.equal(buildReport.head, head);
  assert(buildReport.checks.some((check) => check.command === "npm run build" && check.code === 0));
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
      const target = path.resolve(root, "." + pathname);
      if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const exists = fs.existsSync(target) && fs.statSync(target).isFile();
      if (!exists && path.extname(pathname)) { res.writeHead(404).end(); return; }
      const file = exists ? target : path.join(root, "index.html");
      res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(400).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const user = { id: "home-ui-fixture-owner", email: "home-ui@example.invalid", firstName: "UI", lastName: "Fixture", role: "homeowner", userIntent: "person", stateCode: "FL", countyFips: "12033", countyName: "Escambia", state: "FL", county: "Escambia", onboardingCompleted: true, profileVersion: 1, locationCommitted: true, emailVerified: true, addressVerified: true };
  const home = { id, nickname: "Home workspace review", propertyType: "single_family", address1: "Synthetic test property", city: "Example", stateCode: "FL" };
  const second = { id: secondId, nickname: "Second property", propertyType: "new_build" };
  let failProjects = false;
  for (const [device, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("ts:start-guide-seen-v1", "1"));
    await context.route("**/*", async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (!['GET', 'HEAD'].includes(request.method())) { proof.blockedWrites.push({ method: request.method(), path: url.pathname }); return route.fulfill({ status: 403, json: { message: "Writes blocked in UI proof" } }); }
      if (url.pathname === "/api/auth/user") return route.fulfill({ json: { authenticated: true, user } });
      if (url.pathname === "/api/social/conversations/requests/incoming") return route.fulfill({ json: { requests: [] } });
      if (url.pathname === "/api/homes") return route.fulfill({ json: { homes: [home, second] } });
      for (const property of [home, second]) {
        const path = `/api/homes/${property.id}`;
        if (url.pathname === path) return route.fulfill({ json: { home: property, records: [{ id: "record", title: "Roof inspection saved", recordType: "inspection", occurredAt: "2026-09-01" }], documents: [{ id: "file", originalName: "inspection.pdf", documentType: "inspection_report", createdAt: "2026-09-01" }], appliances: [] } });
        if (url.pathname === path + "/projects") return failProjects ? route.fulfill({ status: 503, json: { message: "Synthetic failure" } }) : route.fulfill({ json: { projects: [{ id: "project-one", title: "Kitchen renovation", description: "Synthetic saved project", status: "planning", metadata: {} }] } });
        if (url.pathname === path + "/maintenance-schedules") return route.fulfill({ json: { schedules: [{ id: "schedule", title: "Check HVAC filter", status: "active", cadenceDays: 90, nextDueAt: "2026-01-01" }] } });
        if (url.pathname === `/api/homeid/${property.id}/persistence`) return route.fulfill({ json: { persistence: { propertyDetails: [{ id: "detail", category: "roof", note: "Confirm dimensions", status: "needs_review" }], components: [], requestPackets: [], evidence: [] } } });
      }
      return route.fulfill({ status: 404, json: { message: "No fixture for this endpoint" } });
    });
    page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => proof.errors.push({ device, message: error.message }));
    await page.goto(`${base}/homes?homeId=${id}`);
    await check(device + ": exact reported link opens the property overview, not launch control", async () => {
      await expect(page.getByTestId("homeid-overview")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Home workspace review", exact: true })).toBeVisible();
      await expect(page.getByTestId("property-blessings-launch-workspace")).toHaveCount(0);
      await expect(page.getByText("Kitchen renovation", { exact: true })).toBeVisible();
      await expect(page.getByText("Check HVAC filter", { exact: true })).toBeVisible();
      assert.equal(await page.locator(".home-sections a").count(), 9);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    });
    await page.screenshot({ path: path.join(out, `homes-${device}.png`), fullPage: false });
    await check(device + ": property switch and browser back retain identity", async () => {
      await page.getByLabel("Choose property").selectOption(secondId);
      await expect(page.getByRole("heading", { name: "Second property", exact: true })).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get("homeId"), secondId);
      await page.goBack();
      await expect(page.getByRole("heading", { name: "Home workspace review", exact: true })).toBeVisible();
    });
    await check(device + ": stored documents remain reachable and the editor does not cover navigation", async () => {
      await page.getByRole("link", { name: "Add a document", exact: true }).click();
      await expect(page.getByTestId("homeid-workspace")).toBeVisible();
      await expect(page.getByRole("link", { name: "← Property overview", exact: true })).toBeVisible();
      const pos = await page.getByTestId("homeid-workspace").evaluate((element) => getComputedStyle(element).position);
      assert.equal(pos, "relative");
      if (device === "desktop") {
        const rail = await page.getByTestId("desktop-app-rail").boundingBox();
        const editor = await page.getByTestId("homeid-workspace").boundingBox();
        assert(rail && editor && editor.x >= rail.x + rail.width);
      } else await expect(page.locator(".ts-bottom-nav").first()).toBeVisible();
      await page.getByRole("link", { name: "← Property overview", exact: true }).click();
      await expect(page.getByTestId("homeid-overview")).toBeVisible();
    });
    await check(device + ": load failure remains a retryable failure, not an empty project list", async () => {
      failProjects = true;
      await page.reload();
      await expect(page.getByText("Projects could not be loaded. Saved information has not been changed.", { exact: true })).toBeVisible();
      await expect(page.getByText("No projects have been saved for this property.", { exact: true })).toHaveCount(0);
      failProjects = false;
      await page.locator(".home-panel").filter({ has: page.getByRole("heading", { name: "Projects & work", exact: true }) }).getByRole("button", { name: "Retry", exact: true }).click();
      await expect(page.getByText("Kitchen renovation", { exact: true })).toBeVisible();
    });
    await context.close(); page = undefined;
  }
  assert.deepEqual(proof.errors, []);
  proof.passed = true;
} catch (error) {
  proof.error = String(error.stack || error); process.exitCode = 1;
  if (page) { proof.failureUrl = page.url(); proof.failureText = await page.locator("body").innerText().catch(() => ""); await page.screenshot({ path: path.join(out, "homes-failure.png") }).catch(() => {}); }
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  write(); console.log("HOMES_UI_RESULT " + JSON.stringify(proof));
}
