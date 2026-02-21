import { test, expect } from "./fixtures/botArmy";

test("Address verification can start postcard flow (or is already verified)", async ({ page }) => {
  await page.goto("/address-verification");

  // Guest users are expected to be routed through auth gating.
  const redirectedToAuth = await page
    .waitForURL(/\/pre-scout-setup(?:\?|$)/i, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (redirectedToAuth) {
    await expect(page).toHaveURL(/\/pre-scout-setup(?:\?|$)/i);
    return;
  }

  // Some accounts may already be verified; that's still a pass for "flow not broken."
  if (
    await page
      .getByText("Address Verified!")
      .isVisible()
      .catch(() => false)
  ) {
    await expect(page.getByText("Address Verified!")).toBeVisible();
    return;
  }

  await expect(page.getByRole("heading", { name: /Address Verification Required/i })).toBeVisible();

  await page.getByPlaceholder("123 Main Street, Apt 4B").fill("123 Main Street");
  await page.getByPlaceholder("Los Angeles").fill("Chicago");
  await page.getByPlaceholder("CA").fill("IL");
  await page.getByPlaceholder("90210").fill("60601");

  await page.getByRole("button", { name: /Start Verification/i }).click();

  await expect(page.getByRole("heading", { name: /Enter Postcard Code/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByPlaceholder("123456")).toBeVisible();
});
