import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { getJwStoneBundleProgress, priceJwStoneBundleLine } from "../shared/jwStoneBundle.ts";

// Real member-cart components, isolated API fixtures. No production account or inventory writes.
const root = process.cwd();
const suffix = "jw-offer-proof-" + process.pid;
const entryPath = path.join(root, "client/src", suffix + ".tsx");
const htmlPath = path.join(root, "client", suffix + ".html");
const output = path.join(root, "artifacts/jw-stone-offer");
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
    cacheDir: path.join(root, ".cache/jw-offer-browser-vite"),
    server: { host: "127.0.0.1", port: 5198, strictPort: true },
    optimizeDeps: { entries: [entryPath] },
  });
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ name: "desktop", width: 1280, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.name === "mobile", hasTouch: viewport.name === "mobile" });
    const page = await context.newPage(); const errors = []; const submissions = []; const network = []; let denyMembership = false;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url()); network.push(url.pathname); let payload;
      if (denyMembership && url.pathname.endsWith("/member-pricing")) return route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({message:"Membership required"})});
      if (url.pathname.endsWith("/member-pricing")) payload = { profileSlug: "jw-stone", viewerId,
        access: "member", currency: "USD", unit: "square_foot", sourceUpdatedAt: "2026-09-16T00:00:00.000Z", prices };
      else if (url.pathname.endsWith("/current")) payload = { profileSlug: "jw-stone", items: stock };
      else if (url.pathname.endsWith("/cart-review")) payload = reviewed(route.request().postDataJSON());
      else if (url.pathname.endsWith("/express-request")) {
        const body = route.request().postDataJSON(); assert.equal(body.requestType, "make_offer");
        assert.equal(body.stoneOffer.termsAcknowledged, true); assert(body.stoneOffer.offeredTotalCents > 0);
        assert.equal(body.stoneOffer.expectedSubtotalCents, reviewed(body.stoneOffer.selection).subtotalCents);
        assert.equal(body.stoneOffer.paymentAllowed, undefined); submissions.push(body);
        await new Promise(resolve => setTimeout(resolve, 60));
        payload = {requestId:"offer-fixture-"+submissions.length,offerStatus:"pending_review",paymentAllowed:false,inventoryReserved:false,deliveryCustody:"business",requestWorkspacePath:"/direct-connect/engagements"};
      }
      else return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Unconfigured local fixture" }) });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
    });
    await page.goto("http://127.0.0.1:5198/" + suffix + ".html");

    const fillOffer = async (amount) => {
      await page.getByLabel("Your total offer (USD)", { exact: true }).fill(amount);
      await page.getByLabel("Name", { exact: true }).fill("Offer Fixture Buyer");
      await page.getByLabel("Email", { exact: true }).fill("offer-fixture@example.invalid");
      await page.locator('input[name="phone"]').fill("2255550102");
      await page.getByRole("combobox", { name: "I am a…" }).selectOption("fabricator");
      await page.getByLabel("I understand offer and payment terms", { exact: true }).check();
    };
    await page.getByTestId("jw-stone-make-offer-card").first().click();
    await expect(page.getByRole("heading", {name:"Make an offer",exact:true})).toBeVisible();
    await expect(page.getByTestId("jw-offer-listed-total")).toHaveText("$150.00");
    await page.getByLabel("Offer slab quantity", { exact: true }).fill("2");
    await expect(page.getByTestId("jw-offer-listed-total")).toHaveText("$300.00");
    await fillOffer("0");
    await expect(page.getByRole("button", { name: "Submit offer", exact: true })).toBeDisabled();
    await page.getByLabel("Your total offer (USD)", { exact: true }).fill("250.25");
    await expect(page.getByRole("button", { name: "Submit offer", exact: true })).toBeEnabled();
    await page.getByRole("heading",{name:"Make an offer",exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, viewport.name + "-stone-offer.png") });
    await page.getByRole("button", {name:"Submit offer",exact:true}).evaluate((button) => { button.click(); button.click(); });
    await expect(page.getByRole("heading", {name:"Offer submitted — pending review",exact:true})).toBeVisible();
    assert.equal(submissions.length,1,"Double-click must not create two requests");
    assert.equal(submissions[0].stoneOffer.scope,"stone"); assert.equal(submissions[0].stoneOffer.offeredTotalCents,25025);
    assert.equal(submissions[0].stoneOffer.selection.lines[0].quantity,2);
    await expect(page.getByRole("button",{name:/pay now|checkout|place order/i})).toHaveCount(0);
    await page.getByRole("button",{name:"Close Direct Connect",exact:true}).click();
    await expect(page.getByRole("button",{name:"Open JW Stone cart, 0 slabs",exact:true})).toBeVisible();
    await page.getByTestId("jw-stone-add-to-cart-card").first().click();
    await page.getByLabel("Quantity for Honey Onyx",{exact:true}).fill("4");
    await page.getByRole("button",{name:"Close cart",exact:true}).click();
    await page.getByTestId("jw-stone-add-to-cart-card").nth(1).click();
    await page.getByLabel("Quantity for Fantasy Brown",{exact:true}).fill("3");
    await expect(page.getByTestId("jw-cart-reviewed-subtotal")).toContainText("$775.00");
    const savedCart = await page.evaluate(() => Object.entries(localStorage).find(([key])=>key.includes("member-cart:v2:"))?.[1]);
    await page.getByTestId("jw-cart-make-offer").click();
    await expect(page.getByTestId("jw-offer-listed-total")).toHaveText("$775.00");
    await expect(page.getByLabel("Offer selections")).toContainText("4 × Honey Onyx");
    await expect(page.getByLabel("Offer selections")).toContainText("3 × Fantasy Brown");
    await expect(page.getByText("Bundle pricing is already included in this listed total.")).toBeVisible();
    await fillOffer("700.00");
    await page.getByRole("heading",{name:"Make an offer",exact:true}).scrollIntoViewIfNeeded();
    const dialogOverflow = await page.getByRole("dialog").evaluate((el)=>el.scrollWidth > el.clientWidth + 1);
    assert.equal(dialogOverflow,false,"Offer must fit the viewport");
    await page.screenshot({path:path.join(output,viewport.name+"-cart-offer.png")});
    await page.getByRole("button",{name:"Submit offer",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Offer submitted — pending review",exact:true})).toBeVisible();
    assert.equal(submissions.length,2); assert.equal(submissions[1].stoneOffer.scope,"cart");
    assert.equal(submissions[1].stoneOffer.offeredTotalCents,70000); assert.equal(submissions[1].stoneOffer.expectedSubtotalCents,77500);
    assert.equal(submissions[1].stoneOffer.selection.lines.reduce((sum,line)=>sum+line.quantity,0),7);
    assert.equal(await page.evaluate(()=>Object.entries(localStorage).find(([key])=>key.includes("member-cart:v2:"))?.[1]),savedCart,"Offer must not change the cart");
    await page.getByRole("button",{name:"Close Direct Connect",exact:true}).click();
    await expect(page.getByTestId("jw-cart-reviewed-subtotal")).toContainText("$775.00");
    prices[0].bundlePriceCents += 10;
    await page.getByTestId("jw-cart-make-offer").click();
    await expect(page.getByText("The cart total changed. Return to your cart and review the latest total before making an offer.")).toBeVisible();
    await fillOffer("700.00"); await expect(page.getByRole("button",{name:"Submit offer",exact:true})).toBeDisabled();
    prices[0].bundlePriceCents -= 10;
    await page.getByRole("button",{name:"Close Direct Connect",exact:true}).click();
    await page.getByRole("button",{name:"Close cart",exact:true}).click();
    denyMembership = true; const denied = page.waitForResponse((response)=>new URL(response.url()).pathname.endsWith("/member-pricing"));
    await page.reload(); await denied;
    await expect(page.getByTestId("jw-stone-make-offer-card")).toHaveCount(0);
    await expect(page.getByTestId("jw-stone-member-cart-button")).toHaveCount(0);
    assert(!network.some((url)=>/stripe|checkout|payment_intents/.test(url)),"Offer flow must never invoke payment");
    assert.deepEqual(errors,[]);
    results.push({viewport:viewport.name,status:"passed",offerSubmissions:submissions.length,checks:["stone amount and quantity","zero amount rejected","double-click prevention","cart bundle total","cart unchanged","stale total blocked","membership gate","no payment requests","no overflow or page errors"]});
    await context.close();
  }
  await fs.writeFile(path.join(output,"result.json"),JSON.stringify({status:"passed",evidence:"Isolated API fixtures; real offer, pricing and cart components. No production writes.",results},null,2));
  console.log(JSON.stringify(results,null,2));
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  await fs.rm(entryPath,{force:true}); await fs.rm(htmlPath,{force:true});
}
