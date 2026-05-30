import { test, expect } from "./fixtures/botArmy";

test.describe("Live app startup fallback verification", () => {
  test.skip(
    process.env.RUN_LIVE_STARTUP_FALLBACK_SMOKE !== "1",
    "Set RUN_LIVE_STARTUP_FALLBACK_SMOKE=1 to run live startup fallback verification"
  );

  test("keeps startup fallback hidden on core routes", async ({ page }) => {
    test.setTimeout(120_000);

    const routes = ["/", "/homes", "/direct-connect", "/scout"];

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1_200);

      const fallback = page.locator("#ts-boot-fallback");
      await expect(fallback, `${route}: startup fallback should stay hidden`).toBeHidden();

      const mounted = await page.evaluate(
        () => document.body.getAttribute("data-app-mounted") === "true"
      );
      expect(mounted, `${route}: app should mark shell as mounted`).toBeTruthy();
    }
  });
});
