import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = path.resolve(process.cwd(), "artifacts", "jw-stone-2");

function watchRuntime(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function screenshot(page: Page, name: string) {
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await page.waitForTimeout(120);
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, name),
    fullPage: false,
  });
}

async function prepareStaticPreview(page: Page) {
  await page.route("**/api/auth/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    })
  );
  await page.route("**/api/analytics/shell", (route) =>
    route.fulfill({
      status: 204,
      body: "",
    })
  );
}

async function assertNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test("desktop flagship journey and workspace evidence", async ({ page }) => {
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await expect(page.locator("[data-jw-stone-2]")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("main").evaluate((main) =>
        Array.from(main.children)
          .slice(0, 3)
          .map((child) => child.id || child.className)
      )
    )
    .toEqual(["jw2-hero", "first-cut", "discover"]);
  await assertNoOverflow(page);
  await screenshot(page, "01-desktop-landing.png");

  await page.getByRole("button", { name: /Fabricator Desk/i }).click();
  await expect(page.locator(".jw2-color-choices")).toBeVisible();
  await expect(page.locator(".jw2-color-choice")).toHaveCount(5);
  await expect(page.locator(".jw2-color-choice img")).toHaveCount(5);
  await expect(page.locator(".jw2-color-choices")).not.toContainText("All current selections");
  await screenshot(page, "02-desktop-color-selection.png");

  await page.getByRole("button", { name: /Warm neutrals/i }).click();
  await expect(page.locator(".jw2-fabricator")).toBeVisible();
  const selectColors = await page.locator(".jw2-filter select").evaluateAll((selects) =>
    selects.map((select) => ({
      color: getComputedStyle(select).color,
      background: getComputedStyle(select).backgroundColor,
      labels: Array.from((select as HTMLSelectElement).options).map((option) => option.text),
    }))
  );
  expect(selectColors.length).toBeGreaterThan(0);
  expect(selectColors.every((select) => select.color === "rgb(23, 23, 19)")).toBe(true);
  expect(selectColors.every((select) => select.background !== "rgba(0, 0, 0, 0)")).toBe(true);
  expect(selectColors.every((select) => select.labels.every(Boolean))).toBe(true);
  await page.locator(".jw2-fabricator").scrollIntoViewIfNeeded();
  await screenshot(page, "03-desktop-fabricator.png");

  await page.goto("/jw-stone?buyer=builder&color=warm-neutrals", {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".jw2-builder-sheet")).toBeVisible();
  await page.locator(".jw2-builder").scrollIntoViewIfNeeded();
  await screenshot(page, "04-desktop-builder.png");

  await page.goto("/jw-stone?buyer=designer&color=cool-lights", {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".jw2-designer-board")).toBeVisible();
  await page.locator(".jw2-designer").scrollIntoViewIfNeeded();
  await screenshot(page, "05-desktop-designer.png");

  await page.goto("/jw-stone?buyer=homeowner&color=cool-lights", {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".jw2-homeowner-grid")).toBeVisible();
  await page.locator(".jw2-homeowner").scrollIntoViewIfNeeded();
  await screenshot(page, "06-desktop-homeowner.png");

  await page.locator(".jw2-homeowner-photo").first().click();
  await expect(page.locator(".jw2-dialog")).toBeVisible();
  await expect(page.locator(".jw2-dialog h2")).not.toHaveText("Call for availability");
  await screenshot(page, "07-desktop-named-details.png");
  await page.keyboard.press("ArrowRight");
  await page
    .locator(".jw2-dialog")
    .getByRole("button", { name: "Ask about this stone", exact: true })
    .click();
  const namedDirectConnect = page.getByRole("dialog", { name: "JW Stone LLC", exact: true });
  await expect(namedDirectConnect).toBeVisible();
  await expect(namedDirectConnect.getByText("Direct Connect", { exact: true })).toBeVisible();
  await expect(namedDirectConnect.getByRole("heading", { name: "JW Stone LLC" })).toBeVisible();
  await namedDirectConnect.getByRole("button", { name: "Close Direct Connect" }).click();
  await expect(namedDirectConnect).toBeHidden();
  await expect(page.locator(".jw2-dialog")).toBeHidden();

  await page.goto("/jw-stone?buyer=designer&color=mixed-palette", {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".jw2-trending")).toBeVisible();
  await expect(page.locator(".jw2-trending")).not.toContainText(/trending-selection-\d+/i);
  await expect(page.locator(".jw2-trending")).not.toContainText(/Unnamed slab/i);
  await expect(page.locator(".jw2-trending")).toContainText(/\d+ slabs recorded/i);
  await page.locator(".jw2-trending").scrollIntoViewIfNeeded();
  await screenshot(page, "08-desktop-trending-selection.png");
  await page.locator(".jw2-trending-image").first().click();
  await expect(page.locator(".jw2-dialog h2")).toHaveText("Call for availability");
  await expect(page.locator(".jw2-dialog")).not.toContainText(/trending-selection-\d+/i);
  await expect(
    page.locator(".jw2-dialog").getByRole("button", { name: "Ask about this stone" })
  ).toHaveCount(0);
  await expect(
    page.locator(".jw2-dialog").getByRole("button", { name: /Save stone|Saved/ })
  ).toHaveCount(0);
  await screenshot(page, "09-desktop-anonymous-gallery.png");
  await page.keyboard.press("Escape");

  await page.goto("/jw-stone?buyer=homeowner&color=cool-lights", {
    waitUntil: "networkidle",
  });
  await page.locator('.jw2-homeowner [aria-label^="Save "]').first().click();
  await expect(page.locator(".jw2-nav button")).toContainText("1");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".jw2-nav button")).toContainText("1");
  await page.locator(".jw2-nav button").click();
  await expect(page.locator(".jw2-drawer-item")).toHaveCount(1);
  await screenshot(page, "10-desktop-wishlist-return.png");
  await page
    .getByRole("dialog", { name: "Saved stones" })
    .getByRole("button", { name: "Ask about these stones", exact: true })
    .click();
  const wishlistDirectConnect = page.getByRole("dialog", {
    name: "JW Stone LLC",
    exact: true,
  });
  await expect(wishlistDirectConnect).toBeVisible();
  await expect(wishlistDirectConnect.getByText("Direct Connect", { exact: true })).toBeVisible();
  await wishlistDirectConnect
    .getByRole("button", { name: "Fill out the form", exact: true })
    .click();
  await expect(
    wishlistDirectConnect.getByRole("heading", { name: "Ask about 1 stone selection" })
  ).toBeVisible();
  await wishlistDirectConnect.getByRole("button", { name: "Close Direct Connect" }).click();
  await expect(wishlistDirectConnect).toBeHidden();

  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await page.locator(".jw2-first-cut").scrollIntoViewIfNeeded();
  await expect(page.locator(".jw2-first-cut-placeholder")).toHaveCount(3);
  await expect(page.locator(".jw2-first-cut button")).toHaveCount(0);
  const firstCutBoxes = await page.locator(".jw2-first-cut-placeholder").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { left: box.left, top: box.top };
    })
  );
  expect(firstCutBoxes[1].left).toBeGreaterThan(firstCutBoxes[0].left);
  expect(firstCutBoxes[2].left).toBeGreaterThan(firstCutBoxes[1].left);
  expect(
    Math.max(...firstCutBoxes.map((box) => box.top)) -
      Math.min(...firstCutBoxes.map((box) => box.top))
  ).toBeLessThan(2);
  await screenshot(page, "11-desktop-first-cut.png");

  expect(runtimeErrors).toEqual([]);
});

test("mobile landing, discovery, results, and gallery evidence", async ({ page }) => {
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await expect(page.locator("[data-jw-stone-2]")).toBeVisible();
  await assertNoOverflow(page);
  await screenshot(page, "12-mobile-landing.png");

  await page.locator(".jw2-first-cut").scrollIntoViewIfNeeded();
  const mobileFirstCutBoxes = await page
    .locator(".jw2-first-cut-placeholder")
    .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().left));
  expect(mobileFirstCutBoxes[1]).toBeGreaterThan(mobileFirstCutBoxes[0]);
  await assertNoOverflow(page);
  await screenshot(page, "12b-mobile-first-cut.png");

  await page.getByRole("button", { name: /Homeowner Stone Finder/i }).click();
  await page.getByRole("button", { name: /Cool & light/i }).click();
  await expect(page.locator(".jw2-homeowner-grid")).toBeVisible();
  await page.locator(".jw2-homeowner").scrollIntoViewIfNeeded();
  await assertNoOverflow(page);
  await screenshot(page, "13-mobile-homeowner.png");

  await page.locator(".jw2-homeowner-photo").first().click();
  await expect(page.locator(".jw2-dialog")).toBeVisible();
  await assertNoOverflow(page);
  await screenshot(page, "14-mobile-details.png");
  await page.keyboard.press("Escape");

  expect(runtimeErrors).toEqual([]);
});

test("test-only verified-origin control appearance", async ({ page }) => {
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto("/jw-stone?buyer=designer&color=cool-lights", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("#jw2-origin-filter")).toHaveCount(0);

  await page.evaluate(() => {
    const row = document.querySelector(".jw2-filter-row");
    if (!row) throw new Error("Filter row missing");
    const fixture = document.createElement("label");
    fixture.className = "jw2-filter";
    fixture.dataset.testOnlyOriginFixture = "true";
    fixture.innerHTML =
      '<span>Verified origin · test fixture</span><select aria-label="Verified origin test fixture"><option>All</option><option selected>Italy (1)</option></select>';
    row.appendChild(fixture);
  });
  await page.locator("[data-test-only-origin-fixture]").scrollIntoViewIfNeeded();
  await screenshot(page, "15-desktop-origin-test-fixture.png");
  expect(runtimeErrors).toEqual([]);
});
