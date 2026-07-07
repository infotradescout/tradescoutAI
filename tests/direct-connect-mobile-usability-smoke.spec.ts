import { expect, test } from "./fixtures/botArmy";
import type { Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

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

  async function assertMobileComposerHierarchyAndCapture(args: {
    page: Page;
    width: number;
    height: number;
    screenshotName: string;
  }) {
    const { page, width, height, screenshotName } = args;

    test.setTimeout(180_000);
    await page.context().clearCookies();
    await page.setViewportSize({ width, height });

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

    const composer = page.getByTestId("direct-connect-mobile-composer");
    await expect(composer).toBeVisible();
    await expect(composer.getByText("Direct Connect", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Tell local businesses what you need. Add photos on the next step.")
    ).toBeVisible();
    await expect(page.getByText("Describe", { exact: true })).toBeVisible();
    await expect(page.getByText("Review", { exact: true })).toBeVisible();
    await expect(page.getByText("Send", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review request" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open directory" })).toBeVisible();

    const reviewButton = page.getByRole("button", { name: "Review request" });
    const directoryPrompt = page.getByText("Prefer browsing first?", { exact: false });
    await expect(directoryPrompt).toBeVisible();

    const reviewButtonBox = await reviewButton.boundingBox();
    const directoryPromptBox = await directoryPrompt.boundingBox();
    expect(reviewButtonBox).not.toBeNull();
    expect(directoryPromptBox).not.toBeNull();
    expect((directoryPromptBox?.y ?? 0) > (reviewButtonBox?.y ?? 0)).toBeTruthy();

    const pageText = (await page.locator("body").innerText()).toLowerCase();
    expect(pageText).not.toContain("hero");
    expect(pageText).not.toContain("marketing header");
    expect(pageText).not.toContain("landing section");
    expect(pageText).not.toContain("pitch");
    expect(pageText).not.toContain("contact gate");

    const screenshotDir = path.resolve(process.cwd(), "artifacts", "screenshots");
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDir, screenshotName),
      fullPage: true,
    });
  }

  test("shows rescued mobile composer hierarchy on 390x844", async ({ page }) => {
    await assertMobileComposerHierarchyAndCapture({
      page,
      width: 390,
      height: 844,
      screenshotName: "direct-connect-mobile-390x844-after.png",
    });
  });

  test("shows rescued mobile composer hierarchy on 430x932", async ({ page }) => {
    await assertMobileComposerHierarchyAndCapture({
      page,
      width: 430,
      height: 932,
      screenshotName: "direct-connect-mobile-430x932-after.png",
    });
  });
});
