/** Production-built HomeID record/launch screens with synthetic, loopback-only APIs.
 * Accepted writes update test fixtures only; native identity persistence is verified separately.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const out = path.resolve(process.env.CORE_UI_PROOF_DIR || ".core-ui-proof");
const root = path.resolve("dist/public");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const homeId = "073b355c-1aa3-4658-a776-ebedaa6aaefc";
const projectId = "d703435e-f059-468a-a8b2-bafff6a5047e";
const stamp = "2026-09-12T12:00:00Z";
const proof = { head, scope: "Built frontend with synthetic authenticated APIs and simulated writes; no live records, storage or contact delivery", passed: false, checks: [], pageErrors: [], writes: [], blockedWrites: [], screenshots: [], contrast: [] };
let server, browser, page;
const write = () => { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "home-record-report.json"), JSON.stringify(proof, null, 2)); };
async function check(name, fn) { await fn(); proof.checks.push({ name, passed: true }); write(); console.log("HOME_RECORD_CHECK " + name); }
function fixture() {
  return {
    home: { id: homeId, nickname: "Record workflow fixture", propertyType: "single_family", address1: "Synthetic property address", city: "Example", stateCode: "FL", countyFips: "12033", zipCode: "32501" },
    records: [{ id: "history-one", title: "Recorded inspection", recordType: "inspection", occurredAt: "2026-09-12" }],
    documents: [{ id: "doc-one", originalName: "saved-plan.pdf", documentType: "other", bytes: 1200, createdAt: stamp }],
    appliances: [{ id: "appliance-one", category: "water_heater", brand: "Fixture", model: "Model", serial: "TEST-ONLY", notes: "Recorded equipment note" }],
    persistence: {
      propertyDetails: [{ id: "fact-one", category: "roof", note: "Original saved roof detail", status: "needs_review", createdAt: stamp, savedAt: stamp }],
      requestPackets: [],
      components: [{ id: "stone", type: "natural_stone", label: "Stone selection", status: "needs_review" }, { id: "solar", type: "solar", label: "Solar array", status: "unknown" }],
      evidence: [{ id: "ref-one", title: "External manual reference", status: "pending", fileUrl: "https://example.invalid/manual.pdf" }],
    },
    projects: [{ id: projectId, title: "Selected package project", status: "planning", metadata: {
      currentStage: "Engineering", currentCoverage: { roofing: "Needs written scope" },
      unresolvedPackageLanes: ["hvac"], requiredNextInputs: ["Confirm scope"], boundaries: ["Saved project-specific boundary"],
      launchBoard: { currentGate: "Recorded scope review", currentGateStatus: "needs_review", completedCount: 17, tasks: [{ title: "Actual saved task", status: "blocked", proof: "Saved task note" }] },
      packageExecution: { anchorScopeMatrix: [{ label: "Structure", status: "included", responsibility: "Recorded supplier responsibility" }, { label: "Roof", status: "needs_review" }], packageLevels: [], executionSteps: [{ label: "Recorded first step", status: "not_started" }] },
      partnerPipeline: { primaryTargets: [{ lane: "hvac", slug: "pb-target-mrcool", backupSlug: "pb-target-rheem" }] },
      firstPackageQuoteTemplate: { requiredSections: Array.from({ length: 12 }, (_, index) => `Required quote item ${index + 1}`) },
      builderHandoffTemplate: { requiredItems: ["Warranty records"] }, ownershipActivationTemplate: { activationRequirements: ["Maintenance requirements"] },
      sourceDerivedPlan: { planningEconomicsExample: { upfrontPackageRevenue: 0 }, mechanicalSpaceExample: { recoveredSquareFeet: 0 }, commissionableCoverage: { launchMinimumPercent: 0 } },
      sourceFilesUsed: [{ title: "Saved source record", note: "Original source description" }], sourceFilesExcluded: [],
    } }, { id: "other-project", title: "Second saved project", status: "paused", metadata: {} }],
    schedules: [],
  };
}
try {
  const build = JSON.parse(fs.readFileSync(path.join(out, "report.json"), "utf8"));
  assert.equal(build.head, head); assert(build.checks.some((item) => item.command === "npm run build" && item.code === 0));
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
      const candidate = path.resolve(root, "." + pathname);
      if (candidate !== root && !candidate.startsWith(root + path.sep)) return res.writeHead(403).end();
      const exists = fs.existsSync(candidate) && fs.statSync(candidate).isFile();
      if (!exists && path.extname(pathname)) return res.writeHead(404).end();
      const file = exists ? candidate : path.join(root, "index.html");
      res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(400).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const user = { id: "record-proof-viewer", email: "record-proof@example.invalid", firstName: "Record", lastName: "Fixture", role: "homeowner", userIntent: "person", stateCode: "FL", countyFips: "12033", countyName: "Escambia", state: "FL", county: "Escambia", onboardingCompleted: true, profileVersion: 1, locationCommitted: true, emailVerified: true, addressVerified: true };
  for (const [device, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const state = fixture(); let persistenceFailed = false, projectsFailed = false, omitPackage = false;
    const context = await browser.newContext({ viewport, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("ts:start-guide-seen-v1", "1"));
    await context.route("**/*", async (route) => {
      const req = route.request(), url = new URL(req.url()), method = req.method(), p = url.pathname;
      if (url.origin !== base) return route.abort();
      if (!p.startsWith("/api/")) return route.continue();
      if (!["GET", "HEAD"].includes(method)) {
        const body = req.postDataJSON();
        if (method === "PUT" && p === `/api/homeid/${homeId}/property-details`) { state.persistence.propertyDetails = body.propertyDetails; proof.writes.push({ device, path: p, simulated: true }); return route.fulfill({ json: { ok: true, persistence: state.persistence } }); }
        if (method === "PUT" && p === `/api/homeid/${homeId}/request-packets`) { state.persistence.requestPackets = body.requestPackets; proof.writes.push({ device, path: p, simulated: true }); return route.fulfill({ json: { ok: true, persistence: state.persistence } }); }
        if (method === "POST" && p === `/api/homes/${homeId}/records`) { const record = { ...body, id: "new-event", createdAt: stamp }; state.records.unshift(record); proof.writes.push({ device, path: p, simulated: true }); return route.fulfill({ status: 201, json: { record } }); }
        if (method === "POST" && p === `/api/homes/${homeId}/maintenance-schedules`) { const schedule = { ...body, id: "new-schedule", status: "active" }; state.schedules.push(schedule); proof.writes.push({ device, path: p, simulated: true }); return route.fulfill({ status: 201, json: { schedule } }); }
        proof.blockedWrites.push({ device, method, path: p }); return route.fulfill({ status: 403, json: { message: "Write blocked by isolated proof" } });
      }
      if (p === "/api/auth/user") return route.fulfill({ json: { authenticated: true, user } });
      if (p === "/api/homes") return route.fulfill({ json: { homes: [state.home] } });
      if (p === `/api/homes/${homeId}`) return route.fulfill({ json: { home: state.home, records: state.records, documents: state.documents, appliances: state.appliances } });
      if (p === `/api/homeid/${homeId}/persistence`) return route.fulfill(persistenceFailed ? { status: 503, json: { message: "Simulated read failure" } } : { json: { persistence: state.persistence } });
      if (p === `/api/homes/${homeId}/projects`) return route.fulfill(projectsFailed ? { status: 503, json: { message: "Simulated read failure" } } : { json: { projects: omitPackage ? state.projects.slice(1) : state.projects } });
      if (p === `/api/homes/${homeId}/maintenance-schedules`) return route.fulfill({ json: { schedules: state.schedules } });
      if (p === "/api/states") return route.fulfill({ json: [{ code: "FL", name: "Florida" }] });
      if (p === "/api/counties") return route.fulfill({ json: [{ fips: "12033", name: "Escambia" }] });
      if (p === "/api/social/conversations/requests/incoming") return route.fulfill({ json: { requests: [] } });
      return route.fulfill({ status: 404, json: { message: "Unconfigured fixture" } });
    });
    page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => proof.pageErrors.push({ device, message: error.message }));
    const recordUrl = (tab, selected = projectId) => `${base}/homes?${new URLSearchParams({ homeId, workspace: "record", tab, ...(selected ? { projectId: selected } : {}) })}`;
    const go = (tab) => page.locator('nav[aria-label="Property record sections"] a').filter({ hasText: new RegExp(`^${tab}$`) }).click();
    await page.goto(recordUrl("overview"));
    await check(device + ": full record opens with saved progress and all nine sections", async () => {
      await expect(page.getByTestId("homeid-workspace")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Record workflow fixture", exact: true })).toBeVisible();
      assert.equal(await page.locator('nav[aria-label="Property record sections"] a').count(), 9);
      const content = await page.getByTestId("homeid-workspace").innerText();
      assert(content.includes("Engineering"));
      for (const invented of ["Ready for next gate", "Design and property screening", "Preconstruction", "relationships in place"]) assert(!content.includes(invented));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    });
    await check(device + ": property notes save separately from canonical address editing", async () => {
      await go("Property details");
      await expect(page.getByRole("button", { name: "Edit address & details", exact: true })).toBeVisible();
      await page.getByLabel("Property note", { exact: true }).fill("New property note from browser proof");
      await page.getByRole("button", { name: "Save property note", exact: true }).click();
      await expect(page.getByText("New property note from browser proof", { exact: true })).toBeVisible();
      assert.equal(state.persistence.propertyDetails.length, 2);
      assert(state.persistence.propertyDetails.some((item) => item.id === "fact-one"));
    });
    await page.screenshot({ path: path.join(out, `home-record-property-${device}.png`) }); proof.screenshots.push(`home-record-property-${device}.png`);
    await check(device + ": system categories never replace recorded review status", async () => {
      await go("Systems");
      const card = page.locator(".hr-item").filter({ has: page.getByRole("heading", { name: "Stone selection", exact: true }) });
      await expect(card).toContainText("Needs review"); await expect(page.getByRole("heading", { name: "Solar array", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Other systems", exact: true })).toBeVisible();
      assert(!(await page.getByTestId("homeid-workspace").innerText()).includes("Relationship covered"));
    });
    await check(device + ": uploaded documents open through the authorized property endpoint", async () => {
      await go("Documents");
      const link = page.getByRole("link", { name: "Open saved-plan.pdf", exact: true });
      await expect(link).toHaveAttribute("href", `/api/homes/${homeId}/documents/doc-one/download`);
      await expect(page.getByRole("link", { name: "Open file link", exact: true })).toBeVisible();
      persistenceFailed = true; await page.reload();
      await expect(link).toBeVisible(); await expect(page.getByText("References could not be loaded. Saved information has not changed.", { exact: true })).toBeVisible();
      persistenceFailed = false; await page.getByRole("button", { name: "Retry references", exact: true }).click();
      await expect(page.getByRole("link", { name: "Open file link", exact: true })).toBeVisible();
    });
    await check(device + ": project selection, missing IDs, and browser Back preserve the selected work", async () => {
      await go("Projects & build");
      await page.getByLabel("Choose project", { exact: true }).selectOption("other-project");
      await expect(page.getByRole("heading", { name: "Second saved project", exact: true })).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get("projectId"), "other-project");
      await expect(page.getByRole("link", { name: "Open Build Timeline", exact: true })).toHaveAttribute("href", `/homes/build?homeId=${homeId}&projectId=other-project`);
      await page.goBack(); await expect(page.getByRole("heading", { name: "Selected package project", exact: true })).toBeVisible();
      await page.goto(recordUrl("build", "missing-project"));
      await expect(page.getByRole("heading", { name: "This project is not available in this property", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Selected package project", exact: true })).toHaveCount(0);
    });
    await page.goto(recordUrl("timeline"));
    await check(device + ": history creation retains existing events and dates", async () => {
      await page.getByLabel("Event title", { exact: true }).fill("Browser proof event");
      await page.getByLabel("Event date", { exact: true }).fill("2026-09-12");
      await page.getByRole("button", { name: "Save timeline event", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Browser proof event", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recorded inspection", exact: true })).toBeVisible();
      assert.equal(state.records[0].occurredAt, "2026-09-12");
    });
    await check(device + ": maintenance form records a schedule without deleting equipment", async () => {
      await go("Maintenance"); await page.getByLabel("Maintenance title", { exact: true }).fill("Browser proof filter check");
      await page.getByLabel("Next due date", { exact: true }).fill("2026-09-20");
      await page.getByRole("button", { name: "Create schedule", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Browser proof filter check", exact: true })).toBeVisible();
      await expect(page.getByText("Recorded equipment note", { exact: true })).toBeVisible();
      assert.equal(state.schedules[0].cadenceDays, 90);
    });
    await check(device + ": request preparation keeps selected facts and explicit Direct Connect handoff", async () => {
      await go("Requests"); await page.locator(".hr-check input").first().check();
      await page.getByRole("button", { name: "Save request details", exact: true }).click();
      await expect(page.getByRole("button", { name: "Open in Direct Connect", exact: true })).toBeVisible();
      assert.equal(state.persistence.requestPackets.length, 1);
      assert.equal(state.persistence.requestPackets[0].selectedDetailIds.length, 1);
      assert.equal(state.persistence.requestPackets[0].status, "needs_info");
      assert(!proof.writes.some((item) => item.path.includes("direct-connect")));
    });
    await check(device + ": failed persistence cannot expose an empty editable collection", async () => {
      persistenceFailed = true; await page.goto(recordUrl("property"));
      await expect(page.getByText("Property details could not be loaded. Saved information has not changed.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Save property note", exact: true })).toHaveCount(0);
      persistenceFailed = false; await page.getByRole("button", { name: "Retry property details", exact: true }).click();
      await expect(page.getByText("New property note from browser proof", { exact: true })).toBeVisible();
    });
    await check(device + ": dark record labels and field boundaries remain readable", async () => {
      const contrast = await page.evaluate(() => {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const ctx = canvas.getContext("2d");
        const rgba = (color) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
        const over = (front, back) => { const a = front[3] / 255; return [0, 1, 2].map((i) => front[i] * a + back[i] * (1 - a)).concat(255); };
        const background = (element) => { let bg = [0, 0, 0, 255]; const chain = []; for (let el = element; el; el = el.parentElement) chain.unshift(el); for (const el of chain) bg = over(rgba(getComputedStyle(el).backgroundColor), bg); return bg; };
        const lum = (rgb) => rgb.slice(0, 3).map((x) => x / 255).map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
        const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
        const samples = [...document.querySelectorAll(".ts-home-record .hr-muted,.ts-home-record .hr-panel-heading h2,.ts-home-record .hr-form label")].filter((el) => el.getBoundingClientRect().width && el.getBoundingClientRect().height).map((el) => { const bg = background(el); return { text: el.textContent.trim().slice(0, 45), ratio: ratio(over(rgba(getComputedStyle(el).color), bg), bg) }; });
        const input = document.querySelector(".ts-home-record textarea"); const bg = background(input);
        return { minimum: Math.min(...samples.map((sample) => sample.ratio)), samples, inputBorder: ratio(over(rgba(getComputedStyle(input).borderTopColor), bg), bg), scheme: getComputedStyle(document.querySelector(".ts-home-record")).colorScheme };
      });
      proof.contrast.push({ device, ...contrast }); assert(contrast.minimum >= 4.5); assert(contrast.inputBorder >= 3); assert(contrast.scheme.includes("dark"));
    });
    const launchUrl = (tab) => `${base}/homes?${new URLSearchParams({ homeId, workspace: "launch", launchTab: tab })}`;
    await page.goto(launchUrl("control"));
    await check(device + ": package dashboard uses saved task/scope counts and zero package levels", async () => {
      await expect(page.getByTestId("property-blessings-launch-workspace")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Actual saved task", exact: true })).toBeVisible();
      await expect(page.locator(".hr-summary").filter({ hasText: /^Package levels/ })).toHaveCount(0);
      const summary = await page.locator(".hr-summary").allTextContents();
      assert(summary.some((text) => text === "0Package levels"));
      assert(summary.some((text) => text === "0Tasks marked complete"));
      assert(summary.some((text) => text === "0/2Scope lines marked confirmed"));
      assert.equal(await page.locator('nav[aria-label="Package planning sections"] a').count(), 6);
    });
    await page.screenshot({ path: path.join(out, `home-package-control-${device}.png`) }); proof.screenshots.push(`home-package-control-${device}.png`);
    await check(device + ": all package sections retain detailed saved content and full templates", async () => {
      const nav = page.locator('nav[aria-label="Package planning sections"]');
      await nav.getByRole("link", { name: "Scope Matrix", exact: true }).click();
      await expect(page.getByRole("heading", { name: "2-line anchor metal-building scope matrix", exact: true })).toBeVisible();
      await expect(page.getByText("Recorded supplier responsibility", { exact: true })).toBeVisible();
      await nav.getByRole("link", { name: "Package Levels", exact: true }).click();
      await expect(page.getByText("Required quote item 12", { exact: true })).toBeVisible();
      await nav.getByRole("link", { name: "Partner Pipeline", exact: true }).click();
      await expect(page.getByRole("heading", { name: "MRCOOL", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open partner operations", exact: true })).toHaveAttribute("href", "/admin/tradepartners");
      await nav.getByRole("link", { name: "Documents & references", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Saved source record", exact: true })).toBeVisible();
      assert(!(await page.getByTestId("property-blessings-launch-workspace").innerText()).includes("$13,600"));
      await nav.getByRole("link", { name: "Release Gates", exact: true }).click();
      await expect(page.getByText("Saved project-specific boundary", { exact: true })).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get("launchTab"), "release");
      await page.goBack(); assert.equal(new URL(page.url()).searchParams.get("launchTab"), "evidence");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    });
    await check(device + ": package failures retry and missing canonical projects never select a substitute", async () => {
      projectsFailed = true; await page.goto(launchUrl("control"));
      await expect(page.getByRole("heading", { name: "Package planning could not be loaded", exact: true })).toBeVisible();
      projectsFailed = false; await page.getByRole("button", { name: "Retry package planning", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Actual saved task", exact: true })).toBeVisible();
      omitPackage = true; await page.reload();
      await expect(page.getByRole("heading", { name: "The package planning project is not attached to this property", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Second saved project", exact: true })).toHaveCount(0);
    });
    await context.close(); page = undefined;
  }
  assert.deepEqual(proof.pageErrors, []); proof.passed = true;
} catch (error) {
  proof.error = String(error.stack || error); process.exitCode = 1;
  if (page) { proof.failureUrl = page.url(); proof.failureText = await page.locator("body").innerText().catch(() => ""); await page.screenshot({ path: path.join(out, "home-record-failure.png") }).catch(() => {}); }
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  write(); console.log("HOME_RECORD_RESULT " + JSON.stringify(proof));
}
