import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

type CountyRow = Record<string, unknown>;

function stringField(row: CountyRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function prepareDirectConnectEntry(page: Page) {
  let countyFips = "04013";
  let stateCode = "AZ";

  const countiesRes = await page.request.get("/api/counties");
  if (countiesRes.ok()) {
    const counties = (await countiesRes.json()) as CountyRow[];
    const list = Array.isArray(counties) ? counties : [];
    const preferred = list.find((c) => String(c.fips || "") === countyFips) ?? list[0];
    const candidate = stringField(preferred, [
      "fips",
      "countyFips",
      "county_fips",
      "county_fips_code",
    ]);
    if (candidate.length === 5) {
      countyFips = candidate;
    }

    const candidateState = stringField(preferred, [
      "stateCode",
      "state_code",
      "state",
      "stateAbbr",
    ]);
    if (candidateState.length === 2) {
      stateCode = candidateState.toUpperCase();
    }
  }

  const profileRes = await page.request.put("/api/user/profile", {
    data: {
      firstName: "Playwright",
      lastName: "E2E",
      stateCode,
      countyFips,
    },
  });
  expect(profileRes.ok(), `profile update failed: ${profileRes.status()}`).toBeTruthy();

  const onboardingRes = await page.request.post("/api/user/complete-onboarding", { data: {} });
  expect(
    onboardingRes.ok(),
    `onboarding completion failed: ${onboardingRes.status()}`
  ).toBeTruthy();

  return countyFips;
}

test("Public landing CTA says Start a Request and opens the request composer", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/");

  const primaryCta = page.getByRole("link", { name: "Start a Request" }).first();
  await expect(primaryCta).toBeVisible();

  const href = await primaryCta.getAttribute("href");
  expect(href || "").toContain("/direct-connect");

  await primaryCta.click();
  await page.waitForURL("**/direct-connect**");
  expect(new URL(page.url()).pathname).toBe("/direct-connect");

  await expect(page.getByTestId("direct-connect-mobile-composer")).toBeVisible();
  await expect(page.getByRole("button", { name: /Review request/i })).toBeVisible();
  await expect(
    page.getByText(/Your contact details stay private until you choose the next step/i)
  ).toBeVisible();
});

test("Public landing mobile first viewport fits without horizontal clipping", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.context().clearCookies();
  await page.goto("/");

  await expect(page.getByRole("link", { name: "TradeScout home" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connection Without Compromise" })).toBeVisible();

  const primaryCta = page.getByRole("link", { name: "Start a Request" }).first();
  await expect(primaryCta).toBeVisible();

  const layout = await page.evaluate(() => {
    const cta = document.querySelector<HTMLAnchorElement>(".ts-button-primary");
    const heroTitle = document.querySelector<HTMLElement>("#ts-hero-title");
    const body = document.body;
    const doc = document.documentElement;
    const ctaRect = cta?.getBoundingClientRect();
    const titleRect = heroTitle?.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: Math.max(body.scrollWidth, doc.scrollWidth),
      ctaRight: ctaRect?.right ?? 0,
      titleRight: titleRect?.right ?? 0,
    };
  });

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.ctaRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.titleRight).toBeLessThanOrEqual(layout.viewportWidth);
});

test("CTA smoke: community shell, Direct Connect entry, and TradeDeals CTAs render", async ({
  page,
}) => {
  await page.goto("/community-feed", { waitUntil: "domcontentloaded" });

  await expect(
    page
      .getByRole("heading", { name: /Local activity/i })
      .or(page.getByText(/Set your county/i).first())
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Direct Connect/i }).first()).toBeVisible();

  const needsCounty = await page
    .getByText(/Set your county/i)
    .first()
    .isVisible();
  if (!needsCounty) {
    const firstPostCard = page.locator('[data-testid^="card-post-"]').first();
    const emptyFeed = page
      .getByText(/Community feed is live|No posts here yet|No posts yet for this view/i)
      .first();

    // The shared CI database can take a few seconds to settle after the shell renders.
    // Wait for a terminal feed state instead of assuming a slow query means an empty feed.
    await expect(firstPostCard.or(emptyFeed).first()).toBeVisible({ timeout: 30_000 });

    if (await firstPostCard.isVisible()) {
      await expect(
        firstPostCard
          .getByRole("button", { name: /Add details|Direct Connect|Message|Need Help/i })
          .first()
      ).toBeVisible();
    }
  }

  const countyFips = await prepareDirectConnectEntry(page);
  await page.goto(`/direct-connect?entry=cta-smoke&county=${encodeURIComponent(countyFips)}`);

  await expect(page.getByText(/Direct Connect/i).first()).toBeVisible();
  await expect(page.getByTestId("direct-connect-mobile-composer")).toBeVisible();
  await expect(page.getByRole("button", { name: /Review request/i })).toBeVisible();
  await expect(
    page.getByText(/Your contact details stay private until you choose the next step/i)
  ).toBeVisible();

  // TradeDeals page: stable county CTA routes projects back into Direct Connect.
  await page.goto("/trade-deals");

  await expect(
    page.getByText(/TradeDeals Feed|No active TradeDeals|Featured TradeDeals/i).first()
  ).toBeVisible();

  const startProject = page
    .getByRole("button", { name: /Start a Project|Direct Connect/i })
    .first();
  await expect(startProject).toBeVisible();

  await startProject.click();
  await page.waitForURL("**/direct-connect**");
  expect(new URL(page.url()).pathname).toBe("/direct-connect");
});
