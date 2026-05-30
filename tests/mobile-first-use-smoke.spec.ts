import { test, expect } from "./fixtures/botArmy";

const BANNED_COPY = [
  "scout helps",
  "scout recommends",
  "ask scout",
  "action surface",
  "handoff",
  "decision packet",
  "execute",
];

async function expectNoHorizontalOverflow(page: Parameters<typeof test>[0]["page"]) {
  const hasOverflow = await page.evaluate(() => {
    const maxRight = Math.max(
      ...Array.from(document.querySelectorAll("body *")).map((el) =>
        Math.ceil((el as HTMLElement).getBoundingClientRect().right)
      )
    );
    return maxRight > window.innerWidth + 1;
  });
  expect(hasOverflow).toBe(false);
}

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

test.describe("Mobile first-use smoke", () => {
  test.skip(
    process.env.RUN_MOBILE_FIRST_USE_SMOKE !== "1",
    "Set RUN_MOBILE_FIRST_USE_SMOKE=1 to run mobile first-use smoke"
  );

  test("shows first useful step surfaces on mobile without blocking core flows", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await resetToFreshLandingState(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    await expect(page.getByTestId("first-use-launcher")).toBeVisible();
    await expect(page.getByText("Where should I start?", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Fix or improve my home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Keep track of my home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a local work request" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review local activity" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue something I started" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Just looking" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("button", { name: "Show choices" })).toBeVisible();
    await page.getByRole("button", { name: "Show choices" }).click();
    await expect(page.getByText("Where should I start?", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const homesLink = page.getByRole("link", { name: "Keep track of my home" });
    await expect(homesLink).toHaveAttribute("href", "/homes");
    await homesLink.click();
    await page.waitForTimeout(900);
    const homesUrl = page.url();
    expect(
      homesUrl.includes("/homes") || isSignInRedirectTo(homesUrl, "/homes"),
      `expected /homes or sign-in redirect, received ${homesUrl}`
    ).toBeTruthy();
    await expectNoHorizontalOverflow(page);

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
    await expectNoHorizontalOverflow(page);

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
    await expectNoHorizontalOverflow(page);

    await expect(page.locator(".ts-bottom-nav")).toBeVisible();

    const visibleText = (
      await page.getByTestId("first-use-guidance-surface").innerText()
    ).toLowerCase();
    for (const phrase of BANNED_COPY) {
      expect(visibleText).not.toContain(phrase);
    }
  });
});
