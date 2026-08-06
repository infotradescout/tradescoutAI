import { chromium } from "playwright";
import fs from "node:fs";

fs.mkdirSync("tmp/material-bg-preview", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:5000/jw-stone", { waitUntil: "networkidle", timeout: 90000 });
await page.getByTestId("jw-material-rail").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: "tmp/material-bg-preview/live-material-rail.png" });
const src = await page.evaluate(
  () => document.querySelector('[data-testid="jw-material-rail-toggle"] img')?.getAttribute("src")
);
console.log("material bg", src);
await browser.close();
