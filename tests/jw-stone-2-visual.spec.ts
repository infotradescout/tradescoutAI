import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = path.resolve(process.cwd(), "artifacts", "jw-stone-2");

function watchRuntime(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
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
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, name),
    fullPage: true,
  });
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test("desktop preserves approved chrome and proves the below-hero luxury journey", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });

  await expect(page.getByLabel("JW Stone marketplace home")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a Request" })).toBeVisible();
  await expect(page.getByText("JW Stone · A new way to discover stone")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Natural stone, selected at the source." })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Begin your selection" })).toBeVisible();
  await expect(
    page.getByText("Stone discovery on your terms. Saving never starts a request.")
  ).toBeVisible();
  await expect(page.getByText("Stone chosen around the way you see a project")).toHaveCount(0);
  await expect(page.getByText("Begin with your point of view")).toHaveCount(0);

  const sectionOrder = await page.evaluate(() => {
    const hero = document.querySelector('[data-testid="buyer-selection"]');
    const firstCut = document.querySelector("#first-cut-title")?.closest("section");
    const audience = document.querySelector("#choose-buyer");
    if (!hero || !firstCut || !audience) return [];
    return [hero, firstCut, audience].map((node) =>
      Array.from(node.parentElement?.children || []).indexOf(node)
    );
  });
  expect(sectionOrder[0]).toBeLessThan(sectionOrder[1]);
  expect(sectionOrder[1]).toBeLessThan(sectionOrder[2]);
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "01-desktop-approved-shell.png");

  await page.getByRole("button", { name: "Architects & Designers" }).click();
  await page.getByRole("button", { name: /^Soft & Light/ }).click();
  await expect(page.getByTestId("designer-workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: "JW Stone Picks" })).toBeVisible();
  await expect(page.locator("[data-stone-card]")).toHaveCount(12);

  const materialFilter = page.getByLabel("Filter by material");
  const finishFilter = page.getByLabel("Filter by finish");
  await expect(materialFilter).toBeVisible();
  await expect(finishFilter).toBeVisible();
  for (const filter of [materialFilter, finishFilter]) {
    expect(
      await filter
        .locator("option")
        .evaluateAll((options) => options.every((option) => Boolean(option.textContent?.trim())))
    ).toBe(true);
  }
  await finishFilter.selectOption("polished");
  await expect(page).toHaveURL(/finish=polished/);
  for (const card of await page.locator("[data-stone-card]").all()) {
    await expect(card).toContainText("Polished");
  }
  await finishFilter.selectOption("");
  expect(
    await page
      .locator("[data-stone-card] img")
      .first()
      .evaluate((image) => getComputedStyle(image).objectFit)
  ).toBe("contain");

  await page.getByRole("button", { name: "Show more stones" }).click();
  expect(await page.locator("[data-stone-card]").count()).toBeGreaterThan(12);
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "02-desktop-progressive-inventory.png");

  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Homeowners" }).click();
  await page.getByRole("button", { name: /^Bold & Expressive/ }).click();
  const anonymous = page.locator('[data-anonymous="true"]').first();
  await expect(anonymous).toContainText("Call for availability");
  await expect(anonymous.getByRole("button", { name: /^Save / })).toHaveCount(0);
  expect(await anonymous.innerText()).not.toMatch(/Trending Selection\s+\d+|Unnamed slab/i);
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "03-desktop-trending-rail.png");

  expect(runtimeErrors).toEqual([]);
});

test("mobile keeps the approved shell, staged choices, gallery, and saved state usable", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });

  await expect(page.getByLabel("JW Stone marketplace home")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask JW" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First Cut Exclusives" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await screenshot(page, "04-mobile-approved-shell.png");

  await page.getByRole("button", { name: "Homeowners" }).click();
  const colorRail = page.getByLabel("Color directions");
  await expect(colorRail).toBeVisible();
  const colorRailBox = await colorRail.boundingBox();
  expect(colorRailBox?.height).toBeLessThan(600);
  const firstTwoChoices = await colorRail.locator("button").evaluateAll((buttons) =>
    buttons.slice(0, 2).map((button) => {
      const box = button.getBoundingClientRect();
      return { x: box.x, y: box.y };
    })
  );
  expect(firstTwoChoices[1]?.x).toBeGreaterThan(firstTwoChoices[0]?.x ?? 0);
  expect(Math.abs((firstTwoChoices[1]?.y ?? 0) - (firstTwoChoices[0]?.y ?? 0))).toBeLessThan(2);
  await page.getByRole("button", { name: /^Warm & Earthy/ }).click();
  await expect(page.getByTestId("homeowner-workspace")).toBeVisible();
  await expect(page.locator("[data-stone-card]")).toHaveCount(12);
  await assertNoHorizontalOverflow(page);

  await page
    .getByRole("button", { name: /^Open .* gallery$/ })
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
  await screenshot(page, "05-mobile-workspace-and-saved-state.png");

  expect(runtimeErrors).toEqual([]);
});
