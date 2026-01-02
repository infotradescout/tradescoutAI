import { test, expect } from "./fixtures/botArmy";

// Smoke test for the Marketplace tab wired through CommunityShell

test.describe("Marketplace", () => {
  test("loads listings grid and supports creating a listing", async ({ page }) => {
    // Assumes dev user session is already authenticated via cookie/session
    await page.goto("/marketplace");

    // Grid should render (even if empty)
    const grid = page.getByTestId("marketplace-listings-grid");
    await expect(grid).toBeVisible();

    // Open create listing modal
    await page.getByTestId("marketplace-create-button").click();
    await expect(page.getByTestId("marketplace-create-modal")).toBeVisible();

    const titleText = `Playwright Test Listing ${Date.now()}`;

    await page.getByTestId("marketplace-create-title").fill(titleText);
    await page.getByTestId("marketplace-create-description").fill("Test listing created via Playwright smoke test");
    await page.getByTestId("marketplace-create-price").fill("123.45");
    await page.getByTestId("marketplace-create-submit").click();

    // Modal should close after successful submit (listing may remain
    // pending admin approval and not immediately appear in the public grid)
    await expect(page.getByTestId("marketplace-create-modal")).toHaveCount(0);
  });
});
