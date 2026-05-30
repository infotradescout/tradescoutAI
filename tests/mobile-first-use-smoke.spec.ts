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

test.describe("Mobile first-use smoke", () => {
  test.skip(
    process.env.RUN_MOBILE_FIRST_USE_SMOKE !== "1",
    "Set RUN_MOBILE_FIRST_USE_SMOKE=1 to run mobile first-use smoke"
  );

  test("shows first useful step surfaces on mobile without blocking core flows", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

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

    await page.getByRole("link", { name: "Keep track of my home" }).click();
    await page.waitForTimeout(900);
    expect(page.url()).toContain("/homes");
    await expect(
      page.getByText("HomeID keeps your home history organized.", { exact: true })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Create a local work request" }).click();
    await page.waitForTimeout(900);
    expect(page.url()).toContain("/direct-connect");
    await expect(
      page.getByText("Direct Connect lets you prepare and submit a clear local work request", {
        exact: false,
      })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Review local activity" }).click();
    await page.waitForTimeout(900);
    expect(page.url()).toContain("/scout");
    await expect(page.getByText("Scout is your discovery page.", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await expect(page.locator(".ts-bottom-nav")).toBeVisible();

    const visibleText = (await page.locator("body").innerText()).toLowerCase();
    for (const phrase of BANNED_COPY) {
      expect(visibleText).not.toContain(phrase);
    }
  });
});
