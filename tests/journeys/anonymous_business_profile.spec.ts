/**
 * Anonymous User Journey: View Business Profile
 * 
 * Tests that an anonymous user can:
 * 1. Load a business profile page
 * 2. See the mission statement (core mission invariant)
 * 3. See a contact/engagement CTA
 * 4. Not see admin or edit controls
 */

import { test, expect } from '@playwright/test';
import { env } from '../utils/env';
import { selectors, hasStubContent } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';

test.describe('Anonymous User - Business Profile View', () => {
  let networkWatcher: NetworkWatcher;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);
  });

  test('should load business profile without authentication', async ({ page }, testInfo) => {
    try {
      const businessUrl = `${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`;
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
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Mission element should always be visible (core invariant)
      const missionElement = page.locator(selectors.businessProfileView.mission);
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
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Contact CTA should be visible and clickable
      const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
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
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

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
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Headline should be visible
      const headline = page.locator(selectors.businessProfileView.headline);
      await expect(headline).toBeVisible();
      const headlineText = await headline.textContent();
      expect(headlineText).toBeTruthy();
      expect(hasStubContent(headlineText || '')).toBe(false);

      // Description/services should be visible
      const description = page.locator(selectors.businessProfileView.description);
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

  test.afterEach(({ testInfo }) => {
    if (testInfo.status !== 'passed') {
      networkWatcher.logErrors();
    }
  });
});
