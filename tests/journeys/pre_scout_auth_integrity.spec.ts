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

async function expectBootFallbackHidden(page: any) {
  await expect(page.locator("#ts-boot-fallback")).toBeHidden();
}

test.describe("Pre-Scout auth integrity", () => {
  test("legacy auth routes resolve to explicit pre-scout modes", async ({ page }) => {
    await page.goto(`${env.BASE_URL}/login`);
    await expectBootFallbackHidden(page);
    await expectSignInMode(page);

    await page.goto(`${env.BASE_URL}/create-account`);
    await expectBootFallbackHidden(page);
    await expectCreateMode(page);
  });

  test("mode query selects the correct initial form", async ({ page }) => {
    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=create`);
    await expectBootFallbackHidden(page);
    await expectCreateMode(page);

    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=signin`);
    await expectBootFallbackHidden(page);
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

  test("sign-in submits only the login endpoint", async ({ page }) => {
    let loginCalls = 0;
    let registerCalls = 0;

    await page.route("**/api/auth/login", async (route) => {
      loginCalls += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Account not found" }),
      });
    });

    await page.route("**/api/auth/register", async (route) => {
      registerCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unexpected register call in sign-in mode" }),
      });
    });

    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=signin`);
    await expectSignInMode(page);

    await page.locator(selectors.auth.loginEmailInput).fill("nobody@example.com");
    await page.locator(selectors.auth.loginPasswordInput).fill("Password123!");
    await page.locator(selectors.auth.loginSubmitButton).click();

    await expect.poll(() => loginCalls).toBeGreaterThan(0);
    expect(loginCalls).toBeGreaterThan(0);
    expect(registerCalls).toBe(0);
  });

  test("create-account submits only the register endpoint", async ({ page }) => {
    let loginCalls = 0;
    let registerCalls = 0;

    await page.route("**/api/auth/login", async (route) => {
      loginCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unexpected login call in create mode" }),
      });
    });

    await page.route("**/api/auth/register", async (route) => {
      registerCalls += 1;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "User already exists" }),
      });
    });

    await page.goto(`${env.BASE_URL}/pre-scout-setup?mode=create`);
    await expectCreateMode(page);

    await page.locator(selectors.auth.createAccountNameInput).fill("Trade");
    await page.locator("#create-last-name").fill("Scout");
    await page.locator(selectors.auth.createAccountEmailInput).fill("existing@example.com");
    await page.locator("#create-phone").fill("(312) 555-0182");
    await page.locator(selectors.auth.createAccountPasswordInput).fill("Password123!");
    await page.locator("#create-confirm-password").fill("Password123!");
    await page.locator('input[type="checkbox"]').first().check();

    await page.locator(selectors.auth.createAccountSubmitButton).click();

    await expect(page.getByText(/already exists|account exists/i)).toBeVisible();
    expect(registerCalls).toBeGreaterThan(0);
    expect(loginCalls).toBe(0);
  });
});
