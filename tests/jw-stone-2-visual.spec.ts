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

async function renderedCatalogIds(page: Page) {
  return page.evaluate(() => [
    ...Array.from(document.querySelectorAll("[data-stone-card]")).map((item) =>
      item.getAttribute("data-stone-id")
    ),
    ...Array.from(document.querySelectorAll('[data-anonymous="true"]')).map((item) => {
      const source = item.querySelector("img")?.getAttribute("src");
      return source ? `anonymous:${source}` : null;
    }),
  ]);
}

async function expandCompleteCatalog(page: Page) {
  const showMore = page.getByRole("button", { name: "Show more stones" });
  for (let attempt = 0; attempt < 10 && (await showMore.isVisible()); attempt += 1) {
    await showMore.click();
  }
  await expect(showMore).toBeHidden();
  const ids = await renderedCatalogIds(page);
  expect(ids).toHaveLength(148);
  expect(new Set(ids).size).toBe(148);
  return ids;
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test("desktop proves catalog-first storefront with proportional learning", async ({ page }) => {
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

  await expect(page.getByLabel("JW Stone marketplace home")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a Request" })).toBeVisible();
  await expect(page.getByText("JW Stone · A new way to discover stone")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Natural stone, selected at the source." })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse current inventory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First Cut Exclusives" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current Inventory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learn about stone" })).toBeVisible();
  await expect(page.getByTestId("customer-path-guide")).toHaveCount(0);
  await expect(page.locator("[data-stone-card]")).toHaveCount(24);

  const sectionOrder = await page.evaluate(() => {
    const hero = document.querySelector('[data-testid="jw-marketplace-hero"]');
    const firstCut = document.querySelector("#first-cut-title")?.closest("section");
    const inventory = document.querySelector("#current-inventory");
    const learn = document.querySelector('[data-testid="stone-learning"]');
    if (!hero || !firstCut || !inventory || !learn) return [];
    return [hero, firstCut, inventory, learn].map((node) =>
      Array.from(node.parentElement?.children || []).indexOf(node)
    );
  });
  expect(sectionOrder).toHaveLength(4);
  expect(sectionOrder).toEqual([...sectionOrder].sort((left, right) => left - right));
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "01-desktop-immediate-storefront.png");

  await expandCompleteCatalog(page);
  await expect(page.locator("[data-stone-card]")).toHaveCount(110);
  await expect(page.locator('[data-anonymous="true"]')).toHaveCount(38);

  const learn = page.getByTestId("stone-learning");
  await expect(learn.locator('a[target="_blank"]')).toHaveCount(4);
  await screenshotElement(learn, "02-desktop-learn-about-stone.png");

  await page.getByLabel("Filter by finish").selectOption("polished");
  await expect(page).toHaveURL(/finish=polished/);
  await expect(page).not.toHaveURL(/buyer=/);
  for (const card of await page.locator("[data-stone-card]").all()) {
    await expect(card).toContainText("Polished");
  }

  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await page
    .locator('[data-stone-card] button[aria-label^="Open "][aria-label$=" gallery"]')
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/stone=/);
  await expect(page).not.toHaveURL(/buyer=|color=/);
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", { name: /^Save .* to saved stones$/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /Open saved stones, 1 saved/ })).toBeVisible();
  expect(requestSubmissions).toBe(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /Open saved stones, 1 saved/ })).toBeVisible();

  const anonymous = page.locator('[data-anonymous="true"]').first();
  await expect(anonymous).toContainText("Call for availability");
  await expect(anonymous.getByRole("button", { name: /^Save / })).toHaveCount(0);
  expect(await anonymous.innerText()).not.toMatch(/Trending Selection\s+\d+|Unnamed slab/i);
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "03-desktop-saved-and-anonymous.png");

  expect(runtimeErrors).toEqual([]);
  expect(requestSubmissions).toBe(0);
});

test("mobile keeps catalog and learning usable without path theater", async ({ page }) => {
  test.setTimeout(120_000);
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });

  await expect(page.getByLabel("JW Stone marketplace home")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask JW" })).toBeVisible();
  await expect(page.locator("[data-stone-card]")).toHaveCount(24);
  await expect(page.getByTestId("customer-path-guide")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Learn about stone" })).toBeVisible();
  await assertNoHorizontalOverflow(page);

  const firstCut = page
    .getByRole("heading", { name: "First Cut Exclusives" })
    .locator("xpath=ancestor::section");
  expect((await firstCut.boundingBox())?.height).toBeLessThan(600);
  const firstCutPositions = await page
    .locator('[data-first-cut-placeholder="true"]')
    .evaluateAll((positions) =>
      positions.slice(0, 2).map((position) => {
        const box = position.getBoundingClientRect();
        return { x: box.x, y: box.y };
      })
    );
  expect(firstCutPositions[1]?.x).toBeGreaterThan(firstCutPositions[0]?.x ?? 0);
  expect(Math.abs((firstCutPositions[1]?.y ?? 0) - (firstCutPositions[0]?.y ?? 0))).toBeLessThan(2);

  await expandCompleteCatalog(page);
  await screenshotElement(page.getByTestId("stone-learning"), "04-mobile-learn-about-stone.png");

  await page
    .locator('[data-stone-card] button[aria-label^="Open "][aria-label$=" gallery"]')
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", { name: /^Save .* to saved stones$/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Open saved stones, 1 saved/ }).click();
  await expect(page.getByRole("heading", { name: "Saved stones" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "05-mobile-gallery-and-saved.png");

  expect(runtimeErrors).toEqual([]);
});
