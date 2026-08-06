import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("tmp/jw-all-sections-preview");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:5000/jw-stone", { waitUntil: "networkidle", timeout: 90000 });

const shots = [
  ["01-first-cut", "#first-cut-title"],
  ["02-color", '[data-testid="jw-palette-rail"]'],
  ["03-material", '[data-testid="jw-material-rail"]'],
  ["04-inventory", '[data-testid="jw-inventory"]'],
  ["05-finished", '[data-testid="jw-finished-work-bridge"]'],
];

for (const [name, sel] of shots) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
}

const report = await page.evaluate(() => {
  const firstCutImgs = [...document.querySelectorAll("[data-first-cut-photo] img")].map(
    (img) => img.className
  );
  const collage = [...document.querySelectorAll('[data-testid="jw-color-collage"] img')].map(
    (img) => img.getAttribute("src")
  );
  const material = document
    .querySelector('[data-testid="jw-material-rail-toggle"] img')
    ?.getAttribute("src");
  const finished = [...document.querySelectorAll('[data-testid="jw-finished-work-bridge"] img')].map(
    (img) => img.getAttribute("src")
  );
  return { firstCutImgs, collage, material, finished };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
console.log("wrote", out);
