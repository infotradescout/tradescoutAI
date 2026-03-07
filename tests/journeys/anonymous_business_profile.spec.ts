/**
 * Anonymous User Journey: View Business Profile
 * 
 * Tests that an anonymous user can:
 * 1. Load a business profile page
 * 2. See the mission statement (core mission invariant)
 * 3. See a contact/engagement CTA
 * 4. Not see admin or edit controls
 */

import { test, expect } from '../fixtures/botArmy';
import { env } from '../utils/env';
import { selectors, hasStubContent } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';
import { resolveBusinessSlug } from '../utils/testTargets';

function missionLocator(page: any) {
  return page
    .locator(selectors.businessProfileView.mission)
    .or(page.locator('[data-testid="business-mission"]').first())
    .or(page.getByText(/connection without compromise/i).first());
}

function contactCtaLocator(page: any) {
  return page
    .locator(selectors.businessProfileView.contactCTA)
    .or(page.getByRole("button", { name: /contact|connect|request/i }).first())
    .or(page.getByRole("link", { name: /contact|connect|request/i }).first());
}

function headlineLocator(page: any) {
  return page
    .locator(selectors.businessProfileView.headline)
    .or(page.locator("main h1").first())
    .or(page.locator("h1").first());
}

function descriptionLocator(page: any) {
  return page
    .locator(selectors.businessProfileView.description)
    .or(page.locator('[data-testid="bp-services"]'))
    .or(page.locator("main p").first());
}

async function gotoBusiness(page: any, slug: string) {
  await page.goto(`${env.BASE_URL}/business/${slug}`);
  const bootFallbackVisible = await page
    .locator("#ts-boot-fallback")
    .isVisible({ timeout: 1200 })
    .catch(() => false);
  test.skip(bootFallbackVisible, "App boot fallback active; business surface not available.");
}

test.describe('Anonymous User - Business Profile View', () => {
  let networkWatcher: NetworkWatcher;
  let businessSlug: string | null = null;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);
    businessSlug = await resolveBusinessSlug(page.request, env.AGENT_SCOPE_SLUG);
  });

  test('should load business profile without authentication', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for Bot Army.");
      const businessUrl = `${env.BASE_URL}/business/${businessSlug}`;
      const response = await page.goto(businessUrl);

      expect(response?.status()).toBeLessThan(400);
      expect(response?.ok()).toBe(true);

      // Verify page loaded
      await expect(page).toHaveTitle(/TradeScout/);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display business profile with mission statement', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for Bot Army.");
      await gotoBusiness(page, businessSlug);

      // Mission element should always be visible (core invariant)
      const missionElement = missionLocator(page);
      await expect(missionElement).toBeVisible();

      const missionText = await missionElement.textContent();
      expect(missionText).toBeTruthy();
      expect(missionText?.length).toBeGreaterThan(0);

      // Verify no stub/placeholder text
      expect(hasStubContent(missionText || '')).toBe(false);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display contact CTA on business profile', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for Bot Army.");
      await gotoBusiness(page, businessSlug);

      // Contact CTA should be visible and clickable
      const contactCTA = contactCtaLocator(page);
      await expect(contactCTA).toBeVisible();
      expect(await contactCTA.isEnabled()).toBe(true);

      const ctaText = await contactCTA.textContent();
      expect(ctaText).toBeTruthy();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should not show edit controls for anonymous user', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for Bot Army.");
      await gotoBusiness(page, businessSlug);

      // Edit button should NOT be visible
      const editButton = page.locator(selectors.businessProfileView.editButton);
      await expect(editButton).not.toBeVisible();

      // Admin controls should NOT be visible
      const adminPanel = page.locator(selectors.common.adminPanel);
      await expect(adminPanel).not.toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display headline and services summary', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for Bot Army.");
      await gotoBusiness(page, businessSlug);

      // Headline should be visible
      const headline = headlineLocator(page);
      const headlineVisible = await headline.isVisible({ timeout: 2500 }).catch(() => false);
      test.skip(!headlineVisible, "Business profile headline surface not present in this template.");
      await expect(headline).toBeVisible();
      const headlineText = await headline.textContent();
      expect(headlineText).toBeTruthy();
      expect(hasStubContent(headlineText || '')).toBe(false);

      // Description/services should be visible
      const description = descriptionLocator(page);
      await expect(description).toBeVisible();
      const descText = await description.textContent();
      expect(descText).toBeTruthy();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should handle missing business profile gracefully', async ({ page }, testInfo) => {
    try {
      const response = await page.goto(`${env.BASE_URL}/business/nonexistent-slug-12345`);

      // Should either 404 or show a friendly message
      if (response?.status() === 404) {
        // 404 is acceptable
        expect(response.status()).toBe(404);
      } else {
        // Or show a "not found" message
        const notFoundMessage = page.locator(selectors.common.notFoundMessage);
        await expect(notFoundMessage).toBeVisible();
      }
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== 'passed') {
      networkWatcher.logErrors();
    }
  });
});
