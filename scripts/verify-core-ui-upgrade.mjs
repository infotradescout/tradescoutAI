/** Exact-source frontend verification. Uses synthetic API responses on loopback only.
 * This is not the database-backed minimum release gate or a production smoke test.
 * Usage: npm ci --include=dev && node scripts/verify-core-ui-upgrade.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = process.cwd();
const out = path.resolve(process.env.CORE_UI_PROOF_DIR || ".core-ui-proof");
fs.mkdirSync(out, { recursive: true });
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const report = { head, startedAt: new Date().toISOString(), passed: false,
  scope: "Production-built frontend with synthetic APIs; no live customers or database writes",
  checks: [], browser: [], pageErrors: [], unconfiguredApis: [], screenshots: [] };
let browser;
let server;
let page;
const writeReport = () => {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
};
function run(command, args) {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: "", RUN_INTEGRATION_TESTS: "", VITEST_SERIAL: "true" } });
  const label = [command, ...args].join(" ");
  const log = (result.stdout || "") + (result.stderr || "");
  fs.writeFileSync(path.join(out, `command-${report.checks.length + 1}.log`), log);
  report.checks.push({ command: label, code: result.status, ms: Date.now() - started });
  console.log(`[core-ui-proof] ${label}: ${result.status}\n${log.slice(-14000)}`);
  writeReport();
  assert.equal(result.status, 0, `Command failed: ${label}`);
}
async function check(name, action) {
  await action();
  report.browser.push({ name, passed: true });
  console.log(`[core-ui-proof] browser PASS ${name}`);
  writeReport();
}
async function screenshot(name) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
  const bytes = fs.readFileSync(file);
  report.screenshots.push({ file: `${name}.png`, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}

try {
  if (process.env.RENDER_GIT_COMMIT) assert.equal(head, process.env.RENDER_GIT_COMMIT);
  assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim(), "", "Tracked source must be clean before checking");
  run("npm", ["run", "check"]);
  run("npm", ["run", "test:run", "--",
    "client/src/lib/productNavigation.test.ts", "client/src/lib/appUiScope.contract.test.ts",
    "client/src/lib/darkSurfaceConvergence.contract.test.ts",
    "client/src/components/layout/appShellMobileTaskbar.contract.test.ts",
    "client/src/components/layout/appShellRecommendation.behavior.test.tsx",
    "client/src/components/onboarding/ProfileCompletionBanner.state.test.ts",
    "server/tests/authenticated-social-frame.contract.test.ts",
    "client/src/pages/direct-connect/directConnectShellHierarchy.contract.test.ts",
    "client/src/pages/direct-connect/direct-connect-replies-ui.contract.test.ts",
    "server/tests/direct-connect-gates.regression.test.ts"]);
  run("npm", ["run", "build"]);
  run("npx", ["playwright", "install", "chromium"]);
  const { chromium, expect } = await import("@playwright/test");
  const publicRoot = path.resolve(root, "dist/public");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const target = path.resolve(publicRoot, `.${pathname}`);
      if (!target.startsWith(`${publicRoot}${path.sep}`) && target !== publicRoot) { response.writeHead(403).end(); return; }
      const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(publicRoot, "index.html");
      response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(response);
    } catch { response.writeHead(400).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("ts:start-guide-seen-v1", "1"));
  const user = { id: "core-ui-proof-person", email: "ui-proof@example.invalid", firstName: "UI", lastName: "Review", role: "homeowner",
    stateCode: "FL", countyFips: "12033", countyName: "Escambia", state: "FL", county: "Escambia",
    onboardingCompleted: true, profileVersion: 1, emailVerified: true, addressVerified: true,
    userIntent: "person", locationCommitted: true, isAdmin: false };
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/auth/user") return route.fulfill({ json: { authenticated: true, user } });
    if (url.pathname === "/api/social/conversations/requests/incoming") return route.fulfill({ json: { requests: [] } });
    const label = `${route.request().method()} ${url.pathname}`;
    if (!report.unconfiguredApis.includes(label)) report.unconfiguredApis.push(label);
    return route.fulfill({ status: 404, json: { message: "No synthetic data configured for this endpoint" } });
  });
  page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  const openTools = async () => {
    await page.getByTestId("all-tradescout-nav").click();
    await expect(page.getByTestId("product-navigator-dialog")).toBeVisible();
    await expect(page.getByLabel("Search TradeScout tools", { exact: true })).toBeFocused();
  };
  await page.goto(`${base}/help`);
  await expect(page.getByTestId("desktop-app-rail")).toBeVisible({ timeout: 30000 });
  await check("desktop rail preserves seven primary destinations", async () => {
    await expect(page.getByTestId("desktop-app-rail").locator("a")).toHaveCount(7);
    assert.deepEqual(await page.getByTestId("desktop-app-rail").locator("a").allTextContents(), ["Scout", "Requests", "Businesses", "Jobs", "Community", "Exchange", "Share"]);
  });
  await screenshot("desktop-core");
  await check("directory opens with input focus and exposes all registered destinations", async () => {
    await openTools();
    await expect(page.locator("[data-product-nav-id]")).toHaveCount(47);
  });
  await screenshot("desktop-tools");
  await check("search finds nested finance tools and clearing recovers all destinations", async () => {
    const input = page.getByLabel("Search TradeScout tools", { exact: true });
    await input.fill("zzzz-no-tool");
    await expect(page.getByText("No tools match that search.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(input).toBeFocused();
    await expect(page.locator("[data-product-nav-id]")).toHaveCount(47);
    await input.fill("invoices");
    await expect(page.locator('[data-product-nav-id="invoices"]')).toBeVisible();
  });
  await screenshot("desktop-tools-search");
  await check("Escape restores trigger focus without navigating", async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("product-navigator-dialog")).toHaveCount(0);
    await expect(page.getByTestId("all-tradescout-nav")).toBeFocused();
    assert.equal(new URL(page.url()).pathname, "/help");
  });
  await check("tool selection navigates and closes without a stale overlay", async () => {
    await openTools();
    await page.getByLabel("Search TradeScout tools", { exact: true }).fill("invoices");
    await page.locator('[data-product-nav-id="invoices"]').click();
    await expect(page).toHaveURL(/\/finances\/invoices$/);
    await expect(page.getByTestId("product-navigator-dialog")).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByTestId("product-navigator-dialog")).toHaveCount(0);
  });
  await check("Jobs does not simultaneously highlight Requests", async () => {
    await page.goto(`${base}/direct-connect/opportunities`);
    await expect(page.getByTestId("desktop-app-rail").locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.getByTestId("desktop-app-rail").locator('[aria-current="page"]')).toHaveText("Jobs");
  });
  await check("recommendation verification keeps its focused shell while ordinary verification retains navigation", async () => {
    await page.goto(`${base}/verification`);
    await expect(page.getByTestId("desktop-app-rail")).toBeVisible();
    const continuation = "/u/acme-repair?trustAction=recommend";
    await page.goto(`${base}/verification?next=${encodeURIComponent(continuation)}`);
    await page.waitForFunction(() => document.body.dataset.appMounted === "true" && document.querySelector(".app-shell"));
    await expect(page.getByTestId("desktop-app-rail")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/ts-desktop-app-rail-active/);
    assert.equal(new URL(page.url()).pathname, "/verification");
    await page.goto(`${base}/verification?next=${encodeURIComponent("/direct-connect")}`);
    await expect(page.getByTestId("desktop-app-rail")).toBeVisible();
  });
  await page.goto(`${base}/help`);
  await openTools();
  await check("short desktop keeps search and scrollable results within the viewport", async () => {
    await page.setViewportSize({ width: 1024, height: 600 });
    const box = await page.getByTestId("product-navigator-dialog").boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= 601 && box.x >= 0 && box.x + box.width <= 1025);
    const results = await page.locator("#tradescout-tool-results").evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight }));
    assert.ok(results.scroll > results.client && results.client > 100);
    await page.keyboard.press("Tab");
    assert.ok(await page.getByTestId("product-navigator-dialog").evaluate((element) => element.contains(document.activeElement)));
  });
  await screenshot("short-desktop-tools");
  await check("navigator text and input borders have measurable dark-mode contrast", async () => {
    report.contrast = await page.getByTestId("product-navigator-dialog").evaluate((dialog) => {
      const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext("2d");
      const rgba = (value) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
      const over = (top, bottom) => top.slice(0, 3).map((channel, index) => channel * top[3] / 255 + bottom[index] * (1 - top[3] / 255)).concat(255);
      const background = (element) => !element ? [255, 255, 255, 255] : over(rgba(getComputedStyle(element).backgroundColor), background(element.parentElement));
      const luminance = (rgb) => rgb.slice(0, 3).map((x) => x / 255).map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
      const samples = [...dialog.querySelectorAll("h2,h3,p,[data-product-nav-id] span span")].map((element) => ({ text: element.textContent.slice(0, 60), ratio: contrast(rgba(getComputedStyle(element).color), background(element)) }));
      const input = dialog.querySelector("input");
      return { samples, minimum: Math.min(...samples.map((sample) => sample.ratio)),
        placeholder: contrast(rgba(getComputedStyle(input, "::placeholder").color), background(input)),
        inputBorder: contrast(rgba(getComputedStyle(input).borderTopColor), background(input.parentElement)),
        scheme: getComputedStyle(dialog).colorScheme };
    });
    assert.ok(report.contrast.minimum >= 4.5, `Text contrast ${report.contrast.minimum}`);
    assert.ok(report.contrast.placeholder >= 4.5);
    assert.ok(report.contrast.inputBorder >= 3);
    assert.equal(report.contrast.scheme, "dark");
  });
  await page.keyboard.press("Escape");
  await check("mobile retains its bottom navigation and no desktop rail", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/help`);
    await expect(page.locator(".ts-bottom-nav").first()).toBeVisible();
    await expect(page.getByTestId("desktop-app-rail")).toHaveCount(0);
    assert.ok(await page.locator('[data-ts-core-ui="true"]').count() > 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  });
  await screenshot("mobile-core");
  await check("public profile navigation removes the core theme and rail", async () => {
    for (const route of ["/u/issa-build", "/p/jw-stone"]) {
      await page.goto(`${base}${route}`);
      await page.waitForFunction(() => document.body.dataset.appMounted === "true" && document.querySelector("#root")?.children.length > 0);
      await expect(page.locator('[data-ts-core-ui="true"]')).toHaveCount(0);
      await expect(page.getByTestId("desktop-app-rail")).toHaveCount(0);
    }
  });
  assert.deepEqual(report.pageErrors, [], "Production-built frontend raised unhandled errors with synthetic data");
  report.trackedChangesAfterBuild = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
  report.passed = true;
  writeReport();
  const escaped = JSON.stringify(report, null, 2).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>TradeScout core UI proof</title><h1>Core UI frontend proof</h1><p>Exact commit ${head}; synthetic APIs only. This is not a production release.</p><pre>${escaped}</pre>${report.screenshots.map((shot) => `<p>${shot.file}</p><img style="max-width:100%" src="${shot.file}">`).join("")}`);
  fs.writeFileSync(path.join(out, "robots.txt"), "User-agent: *\nDisallow: /\n");
  console.log(`[core-ui-proof] PASS ${JSON.stringify(report)}`);
} catch (error) {
  report.error = String(error?.stack || error);
  if (page) {
    report.failureUrl = page.url();
    report.failureText = await page.locator("body").innerText().catch(() => "");
    await screenshot("failure").catch(() => {});
  }
  writeReport();
  console.error(`[core-ui-proof] FAIL ${JSON.stringify(report)}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
