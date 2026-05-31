import { expect, test } from "./fixtures/botArmy";

function isSignInRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/pre-scout-setup";
  } catch {
    return false;
  }
}

test.describe("Direct Connect mobile usability smoke", () => {
  test.skip(
    process.env.RUN_DIRECT_CONNECT_MOBILE_USABILITY_SMOKE !== "1",
    "Set RUN_DIRECT_CONNECT_MOBILE_USABILITY_SMOKE=1 to run Direct Connect mobile usability smoke"
  );

  test("shows core request composer fields before Home Record controls", async ({ page }) => {
    test.setTimeout(180_000);
    await page.context().clearCookies();
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/direct-connect", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    const currentUrl = page.url();
    expect(
      currentUrl.includes("/direct-connect") || isSignInRedirect(currentUrl),
      `expected /direct-connect or sign-in redirect, received ${currentUrl}`
    ).toBeTruthy();

    if (isSignInRedirect(currentUrl)) {
      return;
    }

    await expect(page.getByRole("button", { name: "Start request" })).toBeVisible();
    await expect(page.getByText("What do you need?", { exact: true })).toBeVisible();
    await expect(page.getByText("Request photos", { exact: true })).toBeVisible();

    const requestSection = page.getByText("What do you need?", { exact: true });
    const homeRecordSection = page.getByText("Home record (optional)", { exact: true });
    await expect(homeRecordSection).toBeVisible();

    const requestSectionBox = await requestSection.boundingBox();
    const homeRecordSectionBox = await homeRecordSection.boundingBox();
    expect(requestSectionBox).not.toBeNull();
    expect(homeRecordSectionBox).not.toBeNull();
    expect((homeRecordSectionBox?.y ?? 0) > (requestSectionBox?.y ?? 0)).toBeTruthy();

    await expect(page.getByRole("button", { name: "Use saved home details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create a home record" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show options" })).toBeVisible();

    await expect(page.getByText("Existing component ID", { exact: false })).toHaveCount(0);
  });
});
