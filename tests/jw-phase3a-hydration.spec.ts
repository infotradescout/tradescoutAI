import { expect, test, type Page } from "@playwright/test";

function watchRuntime(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    if (/Content Security Policy|ws:\/\/127\.0\.0\.1:24678/i.test(text)) return;
    if (message.type() === "error" || /hydration/i.test(text)) {
      errors.push(`console: ${text}`);
    }
  });
  return errors;
}

test.describe("JW Phase 3A hydration / browser equivalence", () => {
  test("luxury marketplace hydrates without mismatch or duplicate SSR chrome", async ({ page }) => {
    test.setTimeout(180_000);
    const runtimeErrors = watchRuntime(page);
    const landingBodies: unknown[] = [];

    await page.route("**/api/auth/user", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      })
    );
    await page.route("**/api/analytics/shell", async (route) => {
      const postData = route.request().postDataJSON();
      if (postData?.type === "discovery_landing") {
        landingBodies.push(postData);
      }
      await route.fulfill({ status: 204, body: "" });
    });

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/jw-stone", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "Natural stone, selected at the source." })
    ).toBeVisible();
    await expect(page.getByTestId("jw-marketplace-header")).toBeVisible();
    await expect(page.getByTestId("jw-marketplace-hero")).toBeVisible();

    // SEO system-ui summary must not remain visible after client mount.
    const visibleSeoMains = await page
      .locator('main[data-seo-jw-stone-marketplace="true"]')
      .evaluateAll(
        (nodes) =>
          nodes.filter((node) => {
            const style = window.getComputedStyle(node);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              style.clip !== "rect(0px, 0px, 0px, 0px)"
            );
          }).length
      );
    expect(visibleSeoMains).toBe(0);

    // Color selection remains functional after luxury mount.
    await page.getByTestId("jw-palette-rail-toggle").click();
    await expect(page.getByTestId("jw-palette-rail")).toHaveAttribute("data-expanded", "true");
    await expect(page.getByTestId("jw-palette-chip-row")).toBeVisible();
    await page.getByTestId("jw-palette-green").click();
    await expect(page.getByTestId("jw-palette-results")).toBeVisible();

    // Deliberate contact action (existing Contact CTA wording unchanged).
    await page.getByTestId("jw-marketplace-connect-cta").evaluate((el: HTMLElement) => {
      el.scrollIntoView({ block: "center", inline: "nearest" });
      el.click();
    });
    await expect(page.locator("body")).toContainText(
      /Tell JW Stone|Ask about|request|Direct Connect|What do you need/i,
      {
        timeout: 20_000,
      }
    );

    expect(runtimeErrors.filter((e) => /hydration/i.test(e))).toEqual([]);
    expect(landingBodies.length).toBe(1);
    expect(landingBodies[0]).toMatchObject({
      type: "discovery_landing",
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
    });
    expect(JSON.stringify(landingBodies[0])).not.toMatch(/utm_campaign|phone|mechanism/i);
  });

  test("analytics failure does not block JW browsing", async ({ page }) => {
    test.setTimeout(120_000);
    await page.route("**/api/auth/user", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      })
    );
    await page.route("**/api/analytics/shell", (route) => route.abort());

    await page.goto("/jw-stone", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Natural stone, selected at the source." })
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("jw-marketplace-connect-cta")).toBeVisible();
  });
});
