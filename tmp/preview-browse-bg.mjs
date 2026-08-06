import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("tmp/browse-bg-preview");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function capture(viewport, prefix) {
  const page = await browser.newPage({ viewport });
  await page.goto("http://127.0.0.1:5000/jw-stone", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(500);
  await page.getByTestId("jw-palette-rail").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `${prefix}-color.png`), fullPage: false });
  await page.getByTestId("jw-material-rail").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${prefix}-material.png`), fullPage: false });
  await page.getByTestId("jw-finished-work-bridge").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${prefix}-finished.png`), fullPage: false });
  await page.getByTestId("jw-inventory").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${prefix}-inventory.png`), fullPage: false });
  const info = await page.evaluate(() => {
    const color = document.querySelector('[data-testid="jw-palette-rail-toggle"]');
    const material = document.querySelector('[data-testid="jw-material-rail-toggle"]');
    const inv = document.querySelector('[data-testid="jw-inventory-toggle"]');
    const bridge = document.querySelector('[data-testid="jw-finished-work-bridge"]');
    const rect = (el) =>
      el
        ? {
            h: Math.round(el.getBoundingClientRect().height),
            open: el.textContent?.includes("Open"),
          }
        : null;
    return {
      color: {
        ...rect(color),
        src: color?.querySelector("img")?.getAttribute("src") || null,
        label: color?.textContent?.trim().slice(0, 120),
      },
      material: {
        ...rect(material),
        src: material?.querySelector("img")?.getAttribute("src") || null,
        label: material?.textContent?.trim().slice(0, 120),
      },
      inventory: {
        ...rect(inv),
        src: inv?.querySelector("img")?.getAttribute("src") || null,
        label: inv?.textContent?.trim().slice(0, 120),
      },
      bridge: {
        h: bridge ? Math.round(bridge.getBoundingClientRect().height) : 0,
        src: bridge?.querySelector("img")?.getAttribute("src") || null,
      },
      vh: window.innerHeight,
    };
  });
  console.log(prefix, JSON.stringify(info, null, 2));
  await page.close();
}

await capture({ width: 390, height: 844 }, "mobile-390");
await capture({ width: 1280, height: 900 }, "desktop-1280");
await browser.close();
console.log("done", outDir);
