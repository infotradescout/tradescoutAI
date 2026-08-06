import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("tmp/first-cut-full-slab-preview");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const viewport of [
  { width: 390, height: 844, prefix: "mobile-390" },
  { width: 1280, height: 900, prefix: "desktop-1280" },
]) {
  const page = await browser.newPage({ viewport });
  await page.goto("http://127.0.0.1:5000/jw-stone", { waitUntil: "networkidle", timeout: 90000 });
  await page.locator("#first-cut-title").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, `${viewport.prefix}-first-cut.png`),
    fullPage: false,
  });
  const section = page.locator("#first-cut-title").locator("xpath=ancestor::section[1]");
  await section.screenshot({ path: path.join(outDir, `${viewport.prefix}-section.png`) });
  const info = await page.evaluate(() => {
    const slots = [...document.querySelectorAll('[data-first-cut-photo="true"]')];
    return slots.map((slot) => {
      const img = slot.querySelector("img");
      const box = slot.getBoundingClientRect();
      return {
        src: img?.getAttribute("src"),
        className: img?.className,
        w: Math.round(box.width),
        h: Math.round(box.height),
        natural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
      };
    });
  });
  console.log(viewport.prefix, JSON.stringify(info, null, 2));
  await page.close();
}

await browser.close();
console.log("done", outDir);
