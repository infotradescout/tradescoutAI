import { test, expect } from "../fixtures/botArmy";
import { env } from "../utils/env";
import { selectors } from "../utils/selectors";

async function expectCreateMode(page: any) {
  await expect(page).toHaveURL(/\/pre-scout-setup\?.*mode=create/i);
  await expect(page.locator(selectors.auth.createAccountNameInput)).toBeVisible();
}

async function expectSignInMode(page: any) {
  await expect(page).toHaveURL(/\/pre-scout-setup\?.*mode=signin/i);
  await expect(page.locator(selectors.auth.loginEmailInput)).toBeVisible();
}

test.describe("Pre-Scout auth integrity", () => {
  test("mode query selects the correct initial form", async ({ page }) => {
    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=create`);
    await expectCreateMode(page);

    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=signin`);
    await expectSignInMode(page);
  });

  test("tab switching keeps URL mode in sync", async ({ page }) => {
    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=create`);
    await expectCreateMode(page);

    await page
      .getByRole("button", { name: /^Sign in$/i })
      .first()
      .click();
    await expectSignInMode(page);

    await page
      .getByRole("button", { name: /^Create account$/i })
      .first()
      .click();
    await expectCreateMode(page);
  });

  test("OAuth next path preserves active auth mode", async ({ page }) => {
    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=create`);
    const createGoogleHref = await page
      .locator(selectors.auth.createAccountGoogleButton)
      .getAttribute("href");
    expect(createGoogleHref).toContain("/api/auth/google?next=");
    const createNext = decodeURIComponent(String(createGoogleHref).split("next=")[1] || "");
    expect(createNext).toContain("/pre-scout-setup?mode=create");

    await page
      .getByRole("button", { name: /^Sign in$/i })
      .first()
      .click();
    const signInGoogleHref = await page
      .locator(selectors.auth.loginGoogleButton)
      .getAttribute("href");
    expect(signInGoogleHref).toContain("/api/auth/google?next=");
    const signInNext = decodeURIComponent(String(signInGoogleHref).split("next=")[1] || "");
    expect(signInNext).toContain("/pre-scout-setup?mode=signin");
  });

  test("create-account errors do not auto-switch into sign-in", async ({ page }) => {
    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=create`);

    await page.route("**/api/auth/register", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Account already exists" }),
      });
    });

    await page.locator(selectors.auth.createAccountNameInput).fill("Trade");
    await page.locator("#create-last-name").fill("Scout");
    await page.locator(selectors.auth.createAccountEmailInput).fill("existing@example.com");
    await page.locator("#create-phone").fill("(312) 555-0182");
    await page.locator(selectors.auth.createAccountPasswordInput).fill("Password123!");
    await page.locator("#create-confirm-password").fill("Password123!");
    await page.locator('input[type="checkbox"]').first().check();

    await page.locator(selectors.auth.createAccountSubmitButton).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
    await expectCreateMode(page);
    await expect(page.getByRole("button", { name: /Switch to sign in/i })).toBeVisible();

    await page.getByRole("button", { name: /Switch to sign in/i }).click();
    await expectSignInMode(page);
  });
});
