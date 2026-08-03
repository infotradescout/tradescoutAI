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
  await assertNoOverflow(page);
  await screenshot(page, "01-desktop-landing.png");

  await page.getByRole("button", { name: /Fabricator Desk/i }).click();
  await expect(page.locator(".jw2-color-choices")).toBeVisible();
  await screenshot(page, "02-desktop-color-selection.png");

  await page.getByRole("button", { name: /Warm neutrals/i }).click();
  await expect(page.locator(".jw2-fabricator")).toBeVisible();
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

test("First Cut order, complete collection, and readable filters", async ({ page }) => {
  const runtimeErrors = watchRuntime(page);
  await prepareStaticPreview(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/jw-stone", { waitUntil: "networkidle" });

  const sectionOrder = await page.evaluate(() => {
    const firstCut = document.querySelector("#first-cut");
    const discovery = document.querySelector("#discover");
    if (!firstCut || !discovery) return false;
    return Boolean(firstCut.compareDocumentPosition(discovery) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(sectionOrder).toBe(true);

  await page.getByRole("button", { name: /Designer Selection Board/i }).click();
  await expect(page.locator(".jw2-color-choice img")).toHaveCount(0);
  await page.getByRole("button", { name: /All current selections/i }).click();
  await expect(page.locator(".jw2-designer-card, .jw2-trending-card")).toHaveCount(119);
  await expect(page.locator("h3", { hasText: /^Panda$/ })).toHaveCount(1);

  const filterReadability = await page
    .locator(".jw2-filter select")
    .first()
    .evaluate((select) => {
      const style = getComputedStyle(select);
      const labels = Array.from(select.querySelectorAll("option")).map((option) =>
        option.textContent?.trim()
      );
      return {
        color: style.color,
        background: style.backgroundColor,
        labels,
      };
    });
  expect(filterReadability.labels.length).toBeGreaterThan(2);
  expect(filterReadability.labels.every(Boolean)).toBe(true);
  expect(filterReadability.color).not.toBe(filterReadability.background);

  await page.locator(".jw2-designer").scrollIntoViewIfNeeded();
  await assertNoOverflow(page);
  await screenshot(page, "16-desktop-complete-collection.png");
  expect(runtimeErrors).toEqual([]);
});
