import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("tmp/color-spectrum-preview");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:5000/jw-stone", { waitUntil: "networkidle", timeout: 90000 });
await page.getByTestId("jw-palette-rail").scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, "desktop-color-rail.png"), fullPage: false });
const srcs = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="jw-color-collage"] img')].map((img) =>
    img.getAttribute("src")
  )
);
console.log(srcs);
await browser.close();
