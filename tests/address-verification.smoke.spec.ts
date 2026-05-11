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

  const verifiedState = page.getByText("Address Verified!");
  const requiredState = page.getByRole("heading", { name: /Address Verification Required/i });

  // Some accounts may already be verified; that's still a pass for "flow not broken."
  const state = await Promise.any([
    verifiedState
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => "verified" as const)
      .catch(() => Promise.reject()),
    requiredState
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => "required" as const)
      .catch(() => Promise.reject()),
  ]).catch(() => null);

  expect(state, "address verification should show verified or required state").not.toBeNull();

  if (state === "verified") {
    await expect(verifiedState).toBeVisible();
    return;
  }

  await expect(requiredState).toBeVisible();

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
