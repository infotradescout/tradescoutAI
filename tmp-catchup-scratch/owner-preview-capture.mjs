import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:5058";
const outDir = path.resolve("tmp-catchup-scratch/owner-preview-gate");

async function capture(label, url, viewport) {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const discoveryPosts = [];

  page.on("request", (req) => {
    if (req.url().includes("/api/analytics/shell") && req.method() === "POST") {
      try {
        discoveryPosts.push(JSON.parse(req.postData() || "{}"));
      } catch {
        discoveryPosts.push({ raw: req.postData() });
      }
    }
  });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const html = await page.content();
  const hasLuxury = await page
    .getByText(/Natural stone, selected at the source\./i)
    .first()
    .isVisible()
    .catch(() => false);
  const hasColorRail = await page
    .locator('[data-testid="color-palette-rail"], button:has-text("Warm")')
    .first()
    .isVisible()
    .catch(() => false);
  const hasJwHeader = await page
    .getByText(/JW Stone/i)
    .first()
    .isVisible()
    .catch(() => false);

  const shotPath = path.join(outDir, `${label}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  const initialFacts = {
    hasCanonical: /rel="canonical" href="https:\/\/www\.thetradescout\.com\/jw-stone"/i.test(html),
    hasJsonLd: /"@type"\s*:\s*"CollectionPage"/i.test(html),
    hasSeoMarker: /data-seo-jw-stone-marketplace/i.test(html),
    hasH1: /Natural stone, selected at the source\./i.test(html),
  };

  await browser.close();

  return {
    label,
    url,
    viewport,
    screenshot: shotPath,
    hasLuxury,
    hasColorRail,
    hasJwHeader,
    consoleErrors,
    discoveryPosts,
    initialFacts,
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const desktopBase = await capture("desktop-jw-stone", `${baseURL}/jw-stone`, {
    width: 1440,
    height: 960,
  });
  const desktopUtm = await capture(
    "desktop-jw-stone-chatgpt-utm",
    `${baseURL}/jw-stone?utm_source=chatgpt.com`,
    { width: 1440, height: 960 }
  );
  const mobileBase = await capture("mobile-jw-stone", `${baseURL}/jw-stone`, {
    width: 390,
    height: 844,
  });
  const mobileUtm = await capture(
    "mobile-jw-stone-chatgpt-utm",
    `${baseURL}/jw-stone?utm_source=chatgpt.com`,
    { width: 390, height: 844 }
  );

  const report = {
    baseURL,
    capturedAt: new Date().toISOString(),
    results: [desktopBase, desktopUtm, mobileBase, mobileUtm],
  };

  fs.writeFileSync(path.join(outDir, "preview-report.json"), JSON.stringify(report, null, 2));
  console.log("OWNER_PREVIEW_CAPTURE_DONE");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
