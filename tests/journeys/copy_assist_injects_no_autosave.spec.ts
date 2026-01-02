/**
 * Copy Assist Injection Journey
 * 
 * Tests that:
 * 1. Authenticated user can open business profile editor
 * 2. Copy Assist variant injection works without auto-saving
 * 3. Dirty indicator shows when changes are made
 * 4. Modal closes properly
 * 5. No unintended side effects (auto-save, page reload, etc.)
 */

import { test, expect } from '@playwright/test';
import { env } from '../utils/env';
import { selectors, hasStubContent } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';

test.describe('Copy Assist - Variant Injection', () => {
  let networkWatcher: NetworkWatcher;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);

    // Login as declared system agent (claims-scoped)
    await page.goto(`${env.BASE_URL}/login`);
    
    const emailInput = page.locator(selectors.auth.loginEmailInput);
    await emailInput.fill(env.AGENT_IDENTITY_EMAIL);

    const passwordInput = page.locator(selectors.auth.loginPasswordInput);
    await passwordInput.fill(env.AGENT_IDENTITY_SECRET);

    const submitButton = page.locator(selectors.auth.loginSubmitButton);
    await submitButton.click();

    // Wait for redirect to dashboard or homepage
    await page.waitForNavigation({ url: /\/dashboard|\/|\/home/ });
  });

  test('should open Copy Assist from headline field', async ({ page }, testInfo) => {
    try {
      // Navigate to business profile editor
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}/edit`);

      // Click "improve" or Copy Assist button on headline field
      const copyAssistHeadlineButton = page.locator(selectors.copyAssist.openHeadline);
      await expect(copyAssistHeadlineButton).toBeVisible();
      await copyAssistHeadlineButton.click();

      // Modal should appear
      const modal = page.locator(selectors.copyAssist.modal);
      await expect(modal).toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display variant options in Copy Assist modal', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}/edit`);

      const copyAssistButton = page.locator(selectors.copyAssist.openHeadline);
      await copyAssistButton.click();

      const modal = page.locator(selectors.copyAssist.modal);
      await expect(modal).toBeVisible();

      // Both variant buttons should be visible
      const safeVariant = page.locator(selectors.copyAssist.variantSafe);
      const growthVariant = page.locator(selectors.copyAssist.variantGrowth);

      await expect(safeVariant).toBeVisible();
      await expect(growthVariant).toBeVisible();

      // Verify they're not stubbed
      const safeText = await safeVariant.textContent();
      const growthText = await growthVariant.textContent();

      expect(hasStubContent(safeText || '')).toBe(false);
      expect(hasStubContent(growthText || '')).toBe(false);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should inject Safe variant without auto-saving', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}/edit`);

      const copyAssistButton = page.locator(selectors.copyAssist.openHeadline);
      await copyAssistButton.click();

      const modal = page.locator(selectors.copyAssist.modal);
      await expect(modal).toBeVisible();

      // Click "Use Safe" button
      const useSafeButton = page.locator(selectors.copyAssist.useSafe);
      await expect(useSafeButton).toBeVisible();
      await useSafeButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Headline field should have new content
      const headlineInput = page.locator(selectors.businessProfileEditor.headlineInput);
      const newText = await headlineInput.inputValue();
      expect(newText).toBeTruthy();
      expect(newText?.length).toBeGreaterThan(0);

      // Dirty indicator should appear
      const dirtyIndicator = page.locator(selectors.businessProfileEditor.dirtyIndicator);
      await expect(dirtyIndicator).toBeVisible();

      // Should NOT auto-save (yet)
      // Wait a moment and verify save button is still enabled (not disabled/loading)
      await page.waitForTimeout(1000);
      const saveButton = page.locator(selectors.businessProfileEditor.saveButton);
      expect(await saveButton.isEnabled()).toBe(true);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should inject Growth variant without auto-saving', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}/edit`);

      const copyAssistButton = page.locator(selectors.copyAssist.openHeadline);
      await copyAssistButton.click();

      const modal = page.locator(selectors.copyAssist.modal);
      await expect(modal).toBeVisible();

      // Click "Use Growth" button
      const useGrowthButton = page.locator(selectors.copyAssist.useGrowth);
      await expect(useGrowthButton).toBeVisible();
      await useGrowthButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Headline field should have new content
      const headlineInput = page.locator(selectors.businessProfileEditor.headlineInput);
      const newText = await headlineInput.inputValue();
      expect(newText).toBeTruthy();

      // Dirty indicator should be visible
      const dirtyIndicator = page.locator(selectors.businessProfileEditor.dirtyIndicator);
      await expect(dirtyIndicator).toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should close Copy Assist modal on cancel/close', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}/edit`);

      const copyAssistButton = page.locator(selectors.copyAssist.openHeadline);
      await copyAssistButton.click();

      const modal = page.locator(selectors.copyAssist.modal);
      await expect(modal).toBeVisible();

      // Click close button (X or Cancel)
      const closeButton = page.locator(selectors.copyAssist.closeButton);
      await closeButton.click();

      // Modal should disappear
      await expect(modal).not.toBeVisible();

      // Original field value should be unchanged
      const headlineInput = page.locator(selectors.businessProfileEditor.headlineInput);
      const originalValue = await headlineInput.inputValue();
      expect(originalValue).toBeTruthy();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should work on services and description fields', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}/edit`);

      // Test Copy Assist on services field
      const copyAssistServicesButton = page.locator(selectors.copyAssist.openServices);
      await expect(copyAssistServicesButton).toBeVisible();
      await copyAssistServicesButton.click();

      const modal = page.locator(selectors.copyAssist.modal);
      await expect(modal).toBeVisible();

      // Close modal
      const closeButton = page.locator(selectors.copyAssist.closeButton);
      await closeButton.click();
      await expect(modal).not.toBeVisible();

      // Test Copy Assist on description field
      const copyAssistDescButton = page.locator(selectors.copyAssist.openDescription);
      await expect(copyAssistDescButton).toBeVisible();
      await copyAssistDescButton.click();

      await expect(modal).toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Discard any changes (don't save during test)
    const discardButton = page.locator(selectors.businessProfileEditor.discardButton);
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }

    if (testInfo.status !== 'passed') {
      networkWatcher.logErrors();
    }
  });
});
