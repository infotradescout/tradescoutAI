import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const screenshotDir = path.resolve(process.cwd(), "artifacts", "screenshots", "jw-stone-2");

async function capture(page: Page, name: string) {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
}

async function openWorkspace(page: Page, buyer: string, color = "Soft & Light") {
  const buyerLabels: Record<string, string> = {
    fabricator: "Fabricators",
    builder: "Builders & Developers",
    designer: "Architects & Designers",
    homeowner: "Homeowners",
  };
  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: buyerLabels[buyer] }).click();
  await page.getByRole("button", { name: new RegExp(`^${color}`) }).click();
  await expect(page.getByTestId(`${buyer}-workspace`)).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

test.describe("JW Stone 2.0 rendered proof", () => {
  test("desktop covers the four workspaces, gallery, anonymous inventory, and saved return", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const runtimeErrors: string[] = [];
    let requestSubmissions = 0;
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/api/tradepartner-profiles/jw-stone/express-request")
      ) {
        requestSubmissions += 1;
      }
    });

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/jw-stone", { waitUntil: "networkidle" });
    await expect(page.getByTestId("buyer-selection")).toBeVisible();
    await expect(page.locator("[data-stone-card]")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await capture(page, "desktop-landing.png");

    await page.getByRole("button", { name: "Fabricators" }).click();
    await expect(page.getByTestId("color-selection")).toBeVisible();
    await expect(page.locator("[data-stone-card]")).toHaveCount(0);
    await capture(page, "desktop-color-selection.png");
    await page.getByRole("button", { name: /^Soft & Light/ }).click();
    await expect(page.getByTestId("fabricator-workspace")).toBeVisible();
    await capture(page, "desktop-fabricator-desk.png");

    const firstSave = page.getByRole("button", { name: /^Save .* to saved stones$/ }).first();
    await firstSave.click();
    await expect(page.getByRole("button", { name: /Open saved stones, 1 saved/ })).toBeVisible();
    expect(requestSubmissions).toBe(0);

    await page
      .getByRole("button", { name: /^Open .* gallery$/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await capture(page, "desktop-named-stone-gallery.png");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Open saved stones, 1 saved/ }).click();
    await capture(page, "desktop-saved-stones.png");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Open saved stones, 1 saved/ })).toBeVisible();
    await page.getByRole("button", { name: /Open saved stones, 1 saved/ }).click();
    await expect(page.getByRole("heading", { name: "Saved stones" })).toBeVisible();
    await page.getByRole("button", { name: /Ask about this stone/ }).click();
    await expect(page.getByRole("dialog", { name: "JW Stone" })).toBeVisible();
    expect(requestSubmissions).toBe(0);
    await page.getByRole("button", { name: "Close Direct Connect" }).click();

    await openWorkspace(page, "builder");
    await capture(page, "desktop-builder-project-room.png");
    await openWorkspace(page, "designer");
    await capture(page, "desktop-designer-selection-board.png");
    await openWorkspace(page, "homeowner");
    await capture(page, "desktop-homeowner-stone-finder.png");

    await openWorkspace(page, "homeowner", "Bold & Expressive");
    const anonymous = page.locator('[data-anonymous="true"]').first();
    await expect(anonymous).toContainText("Call for availability");
    await expect(anonymous.getByRole("button", { name: /^Save / })).toHaveCount(0);
    expect(await anonymous.innerText()).not.toMatch(/Trending Selection\s+\d+|Unnamed slab/i);
    await capture(page, "desktop-anonymous-selection.png");

    await page.goto("/jw-stone", { waitUntil: "networkidle" });
    const firstCut = page.getByRole("heading", { name: "First Cut Exclusives" });
    await firstCut.scrollIntoViewIfNeeded();
    await expect(page.locator('[data-first-cut-placeholder="true"]')).toHaveCount(3);
    await capture(page, "desktop-first-cut-placeholders.png");

    expect(runtimeErrors).toEqual([]);
    expect(requestSubmissions).toBe(0);
  });

  test("mobile preserves staged discovery, filters, saved state, and usable overlays", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/jw-stone", { waitUntil: "networkidle" });
    await expect(page.getByTestId("buyer-selection")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, "mobile-landing-390.png");

    await page.getByRole("button", { name: "Homeowners" }).click();
    await expect(page.getByTestId("color-selection")).toBeVisible();
    await page.getByRole("button", { name: /^Warm & Earthy/ }).click();
    await expect(page.getByTestId("homeowner-workspace")).toBeVisible();
    await expect(page.getByLabel("Search named stones")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, "mobile-homeowner-results-390.png");

    await page
      .getByRole("button", { name: /^Save .* to saved stones$/ })
      .first()
      .click();
    await page.getByRole("button", { name: /Open saved stones, 1 saved/ }).click();
    await expect(page.getByRole("heading", { name: "Saved stones" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, "mobile-saved-stones-390.png");

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Open saved stones, 1 saved/ })).toBeVisible();
    await page
      .getByRole("button", { name: /^Open .* gallery$/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, "mobile-gallery-390.png");

    expect(runtimeErrors).toEqual([]);
  });
});
