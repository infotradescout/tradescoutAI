import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { getJwStoneBundleProgress, priceJwStoneBundleLine } from "../shared/jwStoneBundle.ts";

// Real member-cart components, isolated API fixtures. No production account or inventory writes.
const root = process.cwd();
const suffix = "jw-bundle-proof-" + process.pid;
const entryPath = path.join(root, "client/src", suffix + ".tsx");
const htmlPath = path.join(root, "client", suffix + ".html");
const output = path.join(root, "artifacts/jw-stone-bundle");
const viewerId = "bundle-browser-fixture";
const id = (n) => "stone_" + n.toString(16).padStart(32, "0");
const stock = ["Honey Onyx", "Fantasy Brown"].map((materialName, index) => ({
  id: id(index + 1), materialName, quantity: 20, unit: "slabs", assetKind: "slab",
  dimensions: { length: 120, height: 60, unit: "in" }, imageUrls: [], finishQuantities: [],
}));
const prices = stock.map((s, index) => ({ stoneName: s.materialName, stoneKey: s.materialName.toLowerCase(),
  slabPriceCents: index ? 400 : 300, bundlePriceCents: index ? 250 : 200 }));
function reviewed(body) {
  const candidates = body.lines.map((line) => {
    const index = stock.findIndex((s) => s.id === line.inventoryPublicId);
    assert(index >= 0); const s = stock[index], p = prices[index];
    return { inventoryPublicId: s.id, requestedQuantity: line.quantity, availableQuantity: 20,
      materialName: s.materialName, materialSlug: p.stoneKey.replaceAll(" ", "-"), assetKind: "slab",
      dimensions: s.dimensions, status: "ready", bundlePricing: {
        slabRateCents: p.slabPriceCents, bundleRateCents: p.bundlePriceCents, minimumSlabs: 7,
        regularOneSlabCents: p.slabPriceCents * 50, bundleOneSlabCents: p.bundlePriceCents * 50,
      } };
  });
  const progress = getJwStoneBundleProgress(candidates);
  const lines = candidates.map((line) => ({ ...line, ...priceJwStoneBundleLine(line.bundlePricing, line.requestedQuantity, progress.unlocked) }));
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const regularSubtotalCents = lines.reduce((sum, line) => sum + line.bundlePricing.regularOneSlabCents * line.requestedQuantity, 0);
  return { profileSlug: "jw-stone", viewerId, currency: "USD", sourceUpdatedAt: "2026-09-16T00:00:00.000Z",
    reviewedAt: new Date().toISOString(), materialReady: true, readyForCheckout: false, inventoryReserved: false,
    fulfillment: body.fulfillment, subtotalCents, deliveryFeeCents: null, estimatedDeliveryDate: null, lines,
    bundle: { ...progress, regularSubtotalCents, savingsCents: regularSubtotalCents - subtotalCents } };
}
let vite, browser;
const results = [];
try {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(entryPath, [
    'import React from "react";', 'import { createRoot } from "react-dom/client";',
    'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";',
    'import { JwStoneMemberPricingProvider, JwStoneMemberPriceDisplay } from "./features/jw-stone/JwStoneMemberPricing";',
    'import "./index.css";',
    'const client = new QueryClient({defaultOptions:{queries:{retry:false}}});',
    'createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><JwStoneMemberPricingProvider viewerId="' + viewerId + '"><main style={{padding:24}}><h1>JW Stone bundle test</h1>',
    ...stock.map((s) => '<JwStoneMemberPriceDisplay stoneName="' + s.materialName + '" slabDimensions="120 x 60" inventoryPublicId="' + s.id + '" />'),
    '</main></JwStoneMemberPricingProvider></QueryClientProvider>);',
  ].join("\n"));
  await fs.writeFile(htmlPath, '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="/src/' + suffix + '.tsx"></script></body></html>');
  vite = await createServer({ configFile: path.join(root, "vite.config.ts"),
    cacheDir: path.join(root, ".cache/jw-bundle-browser-vite"),
    server: { host: "127.0.0.1", port: 5197, strictPort: true },
    optimizeDeps: { entries: [entryPath] },
  });
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ name: "desktop", width: 1280, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.name === "mobile", hasTouch: viewport.name === "mobile" });
    const page = await context.newPage(); const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url()); let payload;
      if (url.pathname.endsWith("/member-pricing")) payload = { profileSlug: "jw-stone", viewerId,
        access: "member", currency: "USD", unit: "square_foot", sourceUpdatedAt: "2026-09-16T00:00:00.000Z", prices };
      else if (url.pathname.endsWith("/current")) payload = { profileSlug: "jw-stone", items: stock };
      else if (url.pathname.endsWith("/cart-review")) payload = reviewed(route.request().postDataJSON());
      else return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Unconfigured local fixture" }) });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
    });
    await page.goto("http://127.0.0.1:5197/" + suffix + ".html");
    await page.getByTestId("jw-stone-add-to-cart-card").nth(0).click();
    await page.getByLabel("Quantity for Honey Onyx", { exact: true }).fill("3");
    await expect(page.getByTestId("jw-bundle-builder")).toContainText("Add 4 more eligible slabs");
    await page.getByRole("button", { name: "Close cart", exact: true }).click();
    await page.getByTestId("jw-stone-add-to-cart-card").nth(1).click();
    await page.getByLabel("Quantity for Fantasy Brown", { exact: true }).fill("3");
    await expect(page.getByTestId("jw-bundle-builder")).toContainText("Mixed-material bundle eligibility needs JW Stone confirmation");
    await expect(page.getByTestId("jw-bundle-complete-line")).toHaveCount(0);
    await expect(page.getByTestId("jw-bundle-savings")).toHaveCount(0);
    await expect(page.getByTestId("jw-cart-reviewed-subtotal")).toContainText("$1,050.00");
    await page.getByLabel("Quantity for Fantasy Brown", { exact: true }).fill("4");
    await expect(page.getByTestId("jw-cart-reviewed-subtotal")).toContainText("$1,250.00");
    await expect(page.getByTestId("jw-bundle-builder")).not.toContainText("Bundle pricing unlocked");
    await expect(page.getByTestId("jw-bundle-complete-line")).toHaveCount(0);
    await expect(page.getByTestId("jw-bundle-savings")).toHaveCount(0);
    await page.getByTestId("jw-stone-member-cart").screenshot({ path: path.join(output, viewport.name + "-mixed-unconfirmed.png") });
    await page.getByRole("button", { name: "Remove Fantasy Brown from cart", exact: true }).click();
    await expect(page.getByTestId("jw-bundle-builder")).toContainText("Add 4 more eligible slabs");
    await page.getByTestId("jw-bundle-complete-line").first().click();
    await expect(page.getByTestId("jw-bundle-builder")).toContainText("Bundle pricing unlocked");
    await expect(page.getByTestId("jw-bundle-savings")).toContainText("$350.00");
    await expect(page.getByTestId("jw-cart-reviewed-subtotal")).toContainText("$700.00");
    const overflow = await page.getByTestId("jw-stone-member-cart").evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    assert.equal(overflow, false, "Cart must not overflow horizontally");
    await page.getByTestId("jw-bundle-builder").scrollIntoViewIfNeeded();
    await page.getByTestId("jw-stone-member-cart").screenshot({ path: path.join(output, viewport.name + "-unlocked.png") });
    await page.getByRole("button", { name: "Decrease Honey Onyx quantity", exact: true }).click();
    await expect(page.getByTestId("jw-bundle-builder")).toContainText("Add 1 more eligible slab");
    await expect(page.getByTestId("jw-bundle-savings")).toHaveCount(0);
    await page.reload();
    await page.getByTestId("jw-stone-member-cart-button").click();
    await expect(page.getByTestId("jw-bundle-builder")).toContainText("Add 1 more eligible slab");
    assert.deepEqual(errors, []);
    results.push({ viewport: viewport.name, threshold: true, mixedMaterialDiscountBlocked: true,
      unapprovedCompletionHidden: true, singleMaterialBundle: true, exactSavings: true,
      automaticRepricing: true, persistence: true, horizontalOverflow: false, pageErrors: errors });
    console.log(JSON.stringify(results.at(-1))); await context.close();
  }
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify({ kind: "fixture-backed real-component browser proof", results }, null, 2));
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  await fs.rm(entryPath, { force: true }); await fs.rm(htmlPath, { force: true });
}
