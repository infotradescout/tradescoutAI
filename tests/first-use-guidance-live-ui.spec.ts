import { test, expect } from "./fixtures/botArmy";

async function resetToFreshLandingState(page: Parameters<typeof test>[0]["page"]) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

function isSignInRedirectTo(url: string, expectedPath: string): boolean {
  try {
    const parsed = new URL(url);
    const next = parsed.searchParams.get("next") || "";
    return (
      parsed.pathname === "/pre-scout-setup" && decodeURIComponent(next).startsWith(expectedPath)
    );
  } catch {
    return false;
  }
}

test.describe("First-use guidance live UI verification", () => {
  test.skip(
    process.env.RUN_LIVE_GUIDANCE_UI_SMOKE !== "1",
    "Set RUN_LIVE_GUIDANCE_UI_SMOKE=1 to run first-use guidance live UI verification"
  );

  test("verifies launcher, route mapping, guidance surfaces, and banned copy", async ({ page }) => {
    test.setTimeout(180_000);
    await resetToFreshLandingState(page);

    const homeRes = await page.request.get("/");
    const buildHeader = homeRes.headers()["x-tradescout-build"] || "";
    expect(buildHeader.length, "missing x-tradescout-build header").toBeGreaterThan(0);

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_200);

    await expect(page.getByTestId("first-use-launcher")).toBeVisible();
    await expect(page.getByText("Where should I start?", { exact: true })).toBeVisible();
    await expect(page.getByText("Fix or improve my home", { exact: true })).toBeVisible();
    await expect(page.getByText("Keep track of my home", { exact: true })).toBeVisible();
    await expect(page.getByText("Create a local work request", { exact: true })).toBeVisible();
    await expect(page.getByText("Review local activity", { exact: true })).toBeVisible();
    await expect(page.getByText("Continue something I started", { exact: true })).toBeVisible();
    await expect(page.getByText("Just looking", { exact: true })).toBeVisible();

    const dismissButton = page.getByRole("button", { name: "Dismiss" });
    await expect(dismissButton).toBeVisible();
    await dismissButton.click();
    await expect(page.getByRole("button", { name: "Show choices" })).toBeVisible();
    await page.getByRole("button", { name: "Show choices" }).click();
    await expect(page.getByText("Where should I start?", { exact: true })).toBeVisible();

    const homesLink = page.getByRole("link", { name: "Keep track of my home" });
    await expect(homesLink).toHaveAttribute("href", "/homes");
    await homesLink.click();
    await page.waitForTimeout(900);
    const homesUrl = page.url();
    expect(
      homesUrl.includes("/homes") || isSignInRedirectTo(homesUrl, "/homes"),
      `expected /homes or sign-in redirect, received ${homesUrl}`
    ).toBeTruthy();

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    const directConnectLink = page.getByRole("link", { name: "Create a local work request" });
    await expect(directConnectLink).toHaveAttribute("href", "/direct-connect");
    await directConnectLink.click();
    await page.waitForTimeout(900);
    const directConnectUrl = page.url();
    expect(
      directConnectUrl.includes("/direct-connect") ||
        isSignInRedirectTo(directConnectUrl, "/direct-connect"),
      `expected /direct-connect or sign-in redirect, received ${directConnectUrl}`
    ).toBeTruthy();

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    const scoutLink = page.getByRole("link", { name: "Review local activity" });
    await expect(scoutLink).toHaveAttribute("href", "/scout");
    await scoutLink.click();
    await page.waitForTimeout(900);
    const scoutUrl = page.url();
    expect(
      scoutUrl.includes("/scout") || isSignInRedirectTo(scoutUrl, "/scout"),
      `expected /scout or sign-in redirect, received ${scoutUrl}`
    ).toBeTruthy();

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("first-use-guidance-surface")).toBeVisible();
    const visibleText = (
      await page.getByTestId("first-use-guidance-surface").innerText()
    ).toLowerCase();
    const bannedPhrases = [
      "scout helps",
      "scout recommends",
      "ask scout",
      "action surface",
      "handoff",
      "decision packet",
      "execute",
      "enrichment",
      "bidirectional",
      "context capture",
    ];
    for (const phrase of bannedPhrases) {
      expect(visibleText).not.toContain(phrase);
    }
  });
});
