import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = path.resolve(process.cwd(), "artifacts", "jw-stone-2");

function watchRuntime(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    // Vite HMR websocket is blocked by production CSP in local preview; ignore that noise.
    if (/Content Security Policy|ws:\/\/127\.0\.0\.1:24678/i.test(text)) return;
    if (message.type() === "error" || /hydration/i.test(text)) {
      errors.push(`console: ${text}`);
    }
  });
  return errors;
}

async function prepareStaticPreview(page: Page) {
  await page.route("**/api/auth/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    })
  );
  await page.route("**/api/analytics/shell", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/u/jw-stone/stone-inventory/new-arrivals", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profileSlug: "jw-stone",
        freshnessDays: 45,
        generatedAt: "2026-08-26T12:00:00.000Z",
        items: [],
      }),
    })
  );
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, name), fullPage: false });
}

async function screenshotElement(locator: Locator, name: string) {
  await locator.screenshot({ path: path.join(EVIDENCE_DIR, name) });
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test("desktop proves catalog-first luxury storefront", async ({ page }) => {
  test.setTimeout(180_000);
  const runtimeErrors = watchRuntime(page);
  let requestSubmissions = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/tradepartner-profiles/jw-stone/express-request")
    ) {
      requestSubmissions += 1;
    }
  });
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });

  await expect(page.getByTestId("jw-marketplace-header")).toBeVisible();
  await expect(
    page.getByTestId("jw-marketplace-header").getByLabel("JW Stone marketplace home")
  ).toBeVisible();
  await expect(page.getByTestId("jw-marketplace-footer")).toBeVisible();
  await expect(page.getByTestId("jw-marketplace-footer-logo")).toBeVisible();
  await expect(page.getByTestId("jw-marketplace-tradescout-link")).toHaveText(
    "Powered by TradeScout"
  );
  await expect(page.getByTestId("jw-marketplace-connect")).toHaveCount(0);
  await expect(page.getByTestId("jw-marketplace-connect-cta")).toBeVisible();
  await expect(page.getByText("JW Stone · A new way to discover stone")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Natural stone, selected at the source." })
  ).toBeVisible();
  await expect(page.getByTestId("jw-marketplace-hero-brand")).toHaveCount(0);
  await expect(page.getByTestId("jw-marketplace-hero-image")).toHaveCount(0);
  await expect(
    page.getByText(
      "Thirty years of expertise for fabricators, architects, designers, builders, and homeowners."
    )
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Browse inventory" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View First Cut" })).toHaveCount(0);
  await expect(page.getByText("Open for palette filters")).toHaveCount(0);
  await expect(page.getByText("Open for stacked materials")).toHaveCount(0);
  await expect(page.getByText("expand to search and browse")).toHaveCount(0);
  const logo = page.getByTestId("jw-marketplace-logo");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", "/images/businesses/jw-stone/logo.svg");
  await expect(page.getByRole("heading", { name: "First Cut Exclusives" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse Full Inventory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse by Color" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse by Material" })).toBeVisible();
  await expect(page).toHaveURL(/\/jw-stone\/?$/);
  await expect(page).not.toHaveURL(/\/materials\//);
  await expect(page).not.toHaveURL(/[?&]material=/);
  await expect(page).not.toHaveURL(/[?&]color=/);
  await expect(page.getByTestId("jw-palette-rail")).toHaveAttribute("data-expanded", "false");
  await expect(page.getByTestId("jw-material-rail")).toHaveAttribute("data-expanded", "false");
  await expect(page.getByTestId("jw-inventory")).toHaveAttribute("data-expanded", "false");
  await expect(page.getByTestId("jw-palette-all")).toHaveCount(0);
  await expect(page.getByTestId("jw-material-stack")).toHaveCount(0);
  await expect(page.getByTestId("jw-material-stone-rail")).toHaveCount(0);
  await expect(page.locator("#current-inventory [data-stone-card]")).toHaveCount(0);
  await expect(page.getByTestId("jw-new-arrivals")).toHaveCount(0);
  await expect(page.getByTestId("jw-marketplace-story")).toHaveCount(1);
  await expect(page.getByTestId("jw-marketplace-trust")).toHaveCount(0);
  await expect(page.getByText("Why JW Stone")).toHaveCount(0);
  await expect(page.getByTestId("jw-finished-work-bridge")).toHaveCount(0);
  await expect(page.getByTestId("jw-marketplace-trending")).toHaveCount(0);
  await expect(page.getByTestId("jw-marketplace-connect-cta")).toHaveText("Contact");
  await expect(page.getByText("Call for availability")).toHaveCount(0);
  await expect(page.getByTestId("jw-inventory-categories")).toHaveCount(0);
  await expect(page.getByTestId("jw-material-rail")).toBeVisible();

  await page.getByTestId("jw-palette-rail-toggle").click();
  await expect(page.getByTestId("jw-palette-all")).toHaveCount(0);
  await expect(page.getByTestId("jw-palette-beige")).toBeVisible();
  await expect(page.getByTestId("jw-palette-gray")).toBeVisible();
  await expect(page.getByTestId("jw-palette-gold")).toBeVisible();
  await page.getByTestId("jw-palette-rail-toggle").click();

  await page.getByTestId("jw-inventory-toggle").click();
  await expect(page.locator("#current-inventory [data-stone-card]").first()).toBeVisible();
  await expect(page.getByLabel("Search the collection")).toBeVisible();
  await expect(page.getByTestId("jw-filters-sheet-open")).toBeVisible();
  await expect(page.locator('select[aria-label="Color"]')).toHaveCount(0);
  await expect(page.locator('select[aria-label="Material"]')).toHaveCount(0);
  const stoneCount = await page.locator("#current-inventory [data-stone-card]").count();
  expect(stoneCount).toBe(8);
  await page.getByTestId("jw-inventory-toggle").click();

  const sectionOrder = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="jw-marketplace-header"]');
    const hero = document.querySelector('[data-testid="jw-marketplace-hero"]');
    const firstCut = document.querySelector("#first-cut-title")?.closest("section");
    const palette = document.querySelector('[data-testid="jw-palette-rail"]');
    const materials = document.querySelector('[data-testid="jw-material-rail"]');
    const inventory = document.querySelector("#current-inventory");
    const request = document.querySelector('[data-testid="jw-marketplace-request"]');
    if (!header || !hero || !firstCut || !palette || !materials || !inventory || !request) {
      return [];
    }
    return [header, hero, firstCut, inventory, palette, materials, request].map((node) =>
      Array.from(node.parentElement?.children || []).indexOf(node)
    );
  });
  expect(sectionOrder).toHaveLength(7);
  expect(sectionOrder).toEqual([...sectionOrder].sort((left, right) => left - right));
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "01-desktop-immediate-storefront.png");

  await page.getByTestId("jw-material-rail-toggle").click();
  await expect(page.getByTestId("jw-material-stack")).toBeVisible();
  await expect(page.getByTestId("jw-material-stone-rail")).toHaveCount(0);
  await page.getByTestId("jw-material-granite").click();
  await expect(page).toHaveURL(/material=granite/);
  await expect(page).not.toHaveURL(/buyer=/);
  await expect(page).not.toHaveURL(/finish=/);
  await expect(page.getByTestId("jw-material-section-granite")).toHaveAttribute(
    "data-expanded",
    "true"
  );
  const graniteRail = page.getByTestId("jw-material-stone-rail");
  await expect(graniteRail).toBeVisible();
  const graniteCards = graniteRail.locator("[data-stone-card]");
  expect(await graniteCards.count()).toBeGreaterThan(10);
  const graniteSlide = await graniteRail.locator("li").first().boundingBox();
  expect(graniteSlide?.width ?? 0).toBeGreaterThan(280);
  expect(graniteSlide?.width ?? 0).toBeLessThan(560);
  for (const card of await graniteCards.all()) {
    await expect(card).toContainText(/Granite/i);
    await expect(card.getByRole("button", { name: /^Ask/ })).toHaveCount(0);
  }
  await expect(page.getByTestId("jw-inventory")).toHaveAttribute("data-expanded", "false");
  await screenshot(page, "02-desktop-material-compact-grid.png");

  await page.getByTestId("jw-inventory-toggle").click();
  await page.getByTestId("jw-filters-sheet-open").click();
  await expect(page.getByTestId("jw-filters-sheet")).toBeVisible();
  await page.locator('select[aria-label="Material"]').selectOption("marble");
  await page.getByRole("button", { name: /Show \d+ results/ }).click();
  await expect(page).toHaveURL(/material=marble/);
  await expect(page.getByTestId("jw-material-section-marble")).toHaveAttribute(
    "data-expanded",
    "true"
  );
  const marbleCards = page.getByTestId("jw-material-stone-rail").locator("[data-stone-card]");
  expect(await marbleCards.count()).toBeGreaterThan(10);
  for (const card of await marbleCards.all()) {
    await expect(card).toContainText(/Marble/i);
  }

  await page.getByTestId("jw-material-marble").click();
  await expect(page).not.toHaveURL(/material=/);
  await expect(page.getByTestId("jw-material-stone-rail")).toHaveCount(0);

  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await page.getByTestId("jw-inventory-toggle").click();
  const firstInventoryCard = page
    .locator('#current-inventory [data-stone-card][data-anonymous="false"]')
    .first();
  await expect(firstInventoryCard.getByText("Pairs with")).toHaveCount(0);
  await expect(firstInventoryCard.locator('[aria-label^="Colors #"]')).toHaveCount(0);
  await firstInventoryCard.locator('button[aria-label^="Open "]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/stone=/);
  const detailDialog = page.getByRole("dialog");
  await expect(detailDialog.getByText("Colors from photo")).toHaveCount(0);
  await expect(detailDialog.getByText("Pairs with")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page
    .locator("#current-inventory")
    .getByRole("button", { name: /^Save .* to saved stones$/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /Open saved stones, 1 saved/ })).toBeVisible();
  expect(requestSubmissions).toBe(0);

  // Hash landing clears sticky header via scroll-margin (inventory not "missing").
  await page.evaluate(() => {
    window.location.hash = "current-inventory";
  });
  await page.waitForTimeout(200);
  const inventoryVisible = await page.evaluate(() => {
    const el = document.querySelector("#current-inventory");
    if (!el) return false;
    const top = el.getBoundingClientRect().top;
    return top >= 0 && top < window.innerHeight * 0.55;
  });
  expect(inventoryVisible).toBe(true);

  await assertNoHorizontalOverflow(page);
  await screenshot(page, "03-desktop-saved-and-inventory.png");

  expect(runtimeErrors).toEqual([]);
  expect(requestSubmissions).toBe(0);
});

test("mobile keeps editorial showroom usable at 390", async ({ page }) => {
  test.setTimeout(120_000);
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });

  await expect(
    page.getByTestId("jw-marketplace-header").getByLabel("JW Stone marketplace home")
  ).toBeVisible();
  await expect(page.getByTestId("jw-marketplace-connect")).toHaveCount(0);
  await expect(page.getByTestId("jw-marketplace-connect-cta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse Full Inventory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse by Color" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse by Material" })).toBeVisible();
  await expect(page.getByTestId("jw-inventory-categories")).toHaveCount(0);
  await expect(page.getByTestId("jw-material-rail")).toHaveAttribute("data-expanded", "false");
  await expect(page.getByTestId("jw-material-stack")).toHaveCount(0);
  await expect(page.getByTestId("jw-inventory")).toHaveAttribute("data-expanded", "false");
  await assertNoHorizontalOverflow(page);

  // First Cut: full-width lead on top, two supports in one row below (tight gap, no beige void).
  const firstCutSlots = page.locator(
    '[data-first-cut-photo="true"], [data-first-cut-placeholder="true"]'
  );
  await expect(firstCutSlots).toHaveCount(3);
  const firstCutPositions = await firstCutSlots.evaluateAll((positions) =>
    positions.map((position) => {
      const box = position.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, right: box.right, bottom: box.bottom };
    })
  );
  expect(firstCutPositions).toHaveLength(3);
  const leadWidth = firstCutPositions[0]?.width ?? 0;
  expect(leadWidth).toBeGreaterThan(390 * 0.85);
  expect(firstCutPositions[0]?.right ?? 0).toBeLessThanOrEqual(390 + 1);
  const supportWidth = firstCutPositions[1]?.width ?? 0;
  expect(supportWidth).toBeGreaterThan(90);
  expect(supportWidth).toBeLessThan(390 * 0.55);
  expect(firstCutPositions[1]?.x ?? 0).toBeLessThan(firstCutPositions[2]?.x ?? 0);
  expect(Math.abs((firstCutPositions[2]?.y ?? 0) - (firstCutPositions[1]?.y ?? 0))).toBeLessThan(2);
  expect(
    (firstCutPositions[1]?.y ?? 0) - (firstCutPositions[0]?.bottom ?? 0)
  ).toBeGreaterThanOrEqual(0);
  expect((firstCutPositions[1]?.y ?? 0) - (firstCutPositions[0]?.bottom ?? 0)).toBeLessThan(20);
  await expect(page.getByText(/Details pending/i)).toHaveCount(0);

  await screenshot(page, "04-mobile-390-storefront.png");
  await page.locator("#first-cut-title").scrollIntoViewIfNeeded();
  await screenshot(page, "04-mobile-390-first-cut-stacked.png");

  await page.getByTestId("jw-material-rail-toggle").click();
  await page.getByTestId("jw-material-granite").scrollIntoViewIfNeeded();
  await page.getByTestId("jw-material-granite").click();
  await expect(page).toHaveURL(/material=granite/);
  const mobileRail = page.getByTestId("jw-material-stone-rail");
  await expect(mobileRail).toBeVisible();
  const mobileSlide = await mobileRail.locator("li").first().boundingBox();
  expect(mobileSlide?.width ?? 0).toBeGreaterThan(250);
  expect(mobileSlide?.width ?? 0).toBeLessThan(350);
  expect(mobileSlide?.width ?? 0).toBeGreaterThan(390 * 0.65);
  await mobileRail.scrollIntoViewIfNeeded();
  await screenshot(page, "04-mobile-390-material-cards.png");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/material=/);
  await expect(page.getByTestId("jw-material-stone-rail")).toHaveCount(0);

  await page.getByTestId("jw-inventory-toggle").click();
  const cardBox = await page.locator("#current-inventory [data-stone-card]").first().boundingBox();
  expect(cardBox?.width ?? 0).toBeGreaterThan(300);
  expect(cardBox?.height ?? 0).toBeGreaterThan(280);
  const inventoryList = page.locator('[data-testid="jw-inventory-grid"] ul');
  await expect(inventoryList).toHaveClass(/\bgrid\b/);
  await expect(inventoryList).not.toHaveClass(/flex-col/);
  await expect(page.locator("#current-inventory [data-stone-card]")).toHaveCount(8);
  await page.locator("#current-inventory").scrollIntoViewIfNeeded();
  await screenshot(page, "04-mobile-390-editorial-cards.png");
  await screenshotElement(page.getByTestId("jw-marketplace-request"), "04-mobile-connect.png");

  const mobileCard = page
    .locator('#current-inventory [data-stone-card][data-anonymous="false"]')
    .first();
  await expect(mobileCard.getByText("Pairs with")).toHaveCount(0);
  await expect(mobileCard.locator('[aria-label^="Colors #"]')).toHaveCount(0);
  await mobileCard.locator('button[aria-label^="Open "]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const mobileDialog = page.getByRole("dialog");
  await expect(mobileDialog.getByText("Colors from photo")).toHaveCount(0);
  await expect(mobileDialog.getByText("Pairs with")).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "04-mobile-390-detail.png");
  await page.keyboard.press("Escape");

  await page
    .locator("#current-inventory")
    .getByRole("button", { name: /^Save .* to saved stones$/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Open saved stones, 1 saved/ }).click();
  await expect(page.getByRole("heading", { name: "Saved stones" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "05-mobile-gallery-and-saved.png");

  expect(runtimeErrors).toEqual([]);
});
