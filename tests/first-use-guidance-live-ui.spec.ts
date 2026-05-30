import { test, expect } from "./fixtures/botArmy";

test.describe("First-use guidance live UI verification", () => {
  test.skip(
    process.env.RUN_LIVE_GUIDANCE_UI_SMOKE !== "1",
    "Set RUN_LIVE_GUIDANCE_UI_SMOKE=1 to run first-use guidance live UI verification"
  );

  test("verifies launcher, route mapping, guidance surfaces, and banned copy", async ({ page }) => {
    test.setTimeout(180_000);

    const homeRes = await page.request.get("/");
    const buildHeader = homeRes.headers()["x-tradescout-build"] || "";
    expect(buildHeader.length, "missing x-tradescout-build header").toBeGreaterThan(0);

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_200);

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

    await page.getByRole("link", { name: "Keep track of my home" }).click();
    await page.waitForTimeout(900);
    expect(page.url()).toContain("/homes");
    await expect(
      page.getByText(
        "HomeID stores property details, systems, documents, requests, completed work, and evidence in one place.",
        { exact: true }
      )
    ).toBeVisible();

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Create a local work request" }).click();
    await page.waitForTimeout(900);
    expect(page.url()).toContain("/direct-connect");
    await expect(
      page.getByText(
        "Direct Connect lets you prepare and submit a clear local work request before anyone is contacted.",
        { exact: true }
      )
    ).toBeVisible();

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Review local activity" }).click();
    await page.waitForTimeout(900);
    expect(page.url()).toContain("/scout");
    await expect(
      page.getByText(
        "Scout shows local activity, saved context, HomeID updates, request history, and items worth reviewing.",
        { exact: true }
      )
    ).toBeVisible();

    const visibleText = (await page.locator("body").innerText()).toLowerCase();
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
