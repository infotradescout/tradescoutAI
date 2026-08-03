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
  await page.goto("/jw-stone", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: `I’m a ${buyer}` }).click();
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

    const firstCutSection = page.locator("section:has(> div #first-cut-title)");
    const firstCutPositions = firstCutSection.locator('[data-first-cut-placeholder="true"]');
    await expect(firstCutSection).toBeVisible();
    await expect(firstCutPositions).toHaveCount(3);
    const landingOrder = await page.evaluate(() => {
      const hero = document.querySelector('[data-testid="buyer-selection"]');
      const firstCut = document.querySelector("#first-cut-title")?.closest("section");
      const buyerChoices = document.querySelector("#choose-buyer");
      if (!hero || !firstCut || !buyerChoices) return null;
      return {
        heroBeforeFirstCut: Boolean(
          hero.compareDocumentPosition(firstCut) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
        firstCutBeforeBuyer: Boolean(
          firstCut.compareDocumentPosition(buyerChoices) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
      };
    });
    expect(landingOrder).toEqual({ heroBeforeFirstCut: true, firstCutBeforeBuyer: true });

    const firstCutGeometry = await firstCutPositions.evaluateAll((positions) =>
      positions.map((position) => {
        const rect = position.getBoundingClientRect();
        return { left: rect.left, right: rect.right, bottom: rect.bottom };
      })
    );
    expect(firstCutGeometry[0].right).toBeLessThan(firstCutGeometry[1].left);
    expect(firstCutGeometry[1].right).toBeLessThan(firstCutGeometry[2].left);
    expect(
      Math.max(...firstCutGeometry.map(({ bottom }) => bottom)) -
        Math.min(...firstCutGeometry.map(({ bottom }) => bottom))
    ).toBeLessThanOrEqual(2);
    await expectNoHorizontalOverflow(page);
    await capture(page, "desktop-landing.png");
    await firstCutSection.scrollIntoViewIfNeeded();
    await capture(page, "desktop-first-cut-placeholders.png");

    await page.getByRole("button", { name: "I’m a fabricator" }).click();
    const colorSelection = page.getByTestId("color-selection");
    await expect(colorSelection).toBeVisible();
    await expect(page.locator("[data-stone-card]")).toHaveCount(0);
    await expect(colorSelection).not.toContainText("All current selections");
    const colorImages = colorSelection.locator("button img");
    await expect(colorImages).toHaveCount(5);
    await expect
      .poll(() =>
        colorImages.evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.src.includes("/images/businesses/jw-stone/inventory") &&
              image.complete &&
              image.naturalWidth > 0
          )
        )
      )
      .toBe(true);
    await capture(page, "desktop-color-selection.png");
    await page.getByRole("button", { name: /^Soft & Light/ }).click();
    await expect(page.getByTestId("fabricator-workspace")).toBeVisible();
    await expect(page.locator("[data-stone-card]")).toHaveCount(50);
    await expect(page.getByRole("button", { name: "Show more stones" })).toHaveCount(0);

    const materialFilter = page.getByLabel("Filter by material");
    const filterPresentation = await materialFilter.evaluate((select) => {
      const parseRgb = (value: string) =>
        (value.match(/[\d.]+/g) || []).slice(0, 3).map((channel) => Number(channel) / 255);
      const luminance = (value: string) => {
        const [red = 0, green = 0, blue = 0] = parseRgb(value).map((channel) =>
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        );
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const style = getComputedStyle(select);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return {
        background,
        colorScheme: style.colorScheme,
        contrast:
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        labels: Array.from(select.querySelectorAll("option")).map((option) =>
          option.textContent?.trim()
        ),
        foreground,
      };
    });
    expect(filterPresentation.background).toBeGreaterThan(filterPresentation.foreground);
    expect(filterPresentation.contrast).toBeGreaterThanOrEqual(4.5);
    expect(filterPresentation.colorScheme).toContain("light");
    expect(filterPresentation.labels.length).toBeGreaterThan(1);
    expect(filterPresentation.labels.every(Boolean)).toBe(true);
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
    expect(await anonymous.innerText()).not.toMatch(/Trending Selection|Unnamed slab/i);
    await capture(page, "desktop-anonymous-selection.png");

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

    const mobileFirstCut = page.locator("section:has(> div #first-cut-title)");
    const mobileFirstCutPositions = mobileFirstCut.locator('[data-first-cut-placeholder="true"]');
    await mobileFirstCut.scrollIntoViewIfNeeded();
    await expect(mobileFirstCutPositions).toHaveCount(3);
    const mobileFirstCutGeometry = await mobileFirstCutPositions.evaluateAll((positions) =>
      positions.map((position) => {
        const rect = position.getBoundingClientRect();
        return { left: rect.left, right: rect.right, bottom: rect.bottom };
      })
    );
    expect(mobileFirstCutGeometry[0].right).toBeLessThan(mobileFirstCutGeometry[1].left);
    expect(mobileFirstCutGeometry[1].right).toBeLessThan(mobileFirstCutGeometry[2].left);
    expect(
      Math.max(...mobileFirstCutGeometry.map(({ bottom }) => bottom)) -
        Math.min(...mobileFirstCutGeometry.map(({ bottom }) => bottom))
    ).toBeLessThanOrEqual(2);
    await expectNoHorizontalOverflow(page);
    await capture(page, "mobile-first-cut-horizontal-390.png");

    await page.getByRole("button", { name: "I’m a homeowner" }).click();
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
