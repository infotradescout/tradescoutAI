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

test("CTA smoke: community shell, Direct Connect entry, and TradeDeals CTAs render", async ({
  page,
}) => {
  await page.goto("/community-feed");

  await expect(
    page
      .getByRole("heading", { name: /Local decisions, shared context/i })
      .or(page.getByText(/Set your county/i).first())
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Direct Connect/i }).first()).toBeVisible();

  const needsCounty = await page
    .getByText(/Set your county/i)
    .first()
    .isVisible();
  if (!needsCounty) {
    const firstPostCard = page.locator('[data-testid^="card-post-"]').first();
    if (await firstPostCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(
        firstPostCard.getByRole("button", { name: /Ask Scout|Direct Connect|Message|Need Help/i })
      ).toBeVisible();
    } else {
      await expect(
        page.getByText(/Community feed is live|No posts yet for this view/i).first()
      ).toBeVisible();
    }
  }

  const countyFips = await prepareDirectConnectEntry(page);
  await page.goto(`/direct-connect?entry=cta-smoke&county=${encodeURIComponent(countyFips)}`);

  await expect(page.getByText(/Direct Connect/i).first()).toBeVisible();
  await expect(page.getByPlaceholder(/Need help with|I need help with/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Send request/i })).toBeVisible();

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
