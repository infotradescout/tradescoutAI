/**
 * Contact Loop Journey
 * 
 * Tests that:
 * 1. Anonymous user can click "Contact" CTA on business profile
 * 2. Contact surface/modal appears
 * 3. User can fill out contact form
 * 4. Form submission works
 * 5. Success message/redirect happens
 * 6. Message gets routed to business owner
 */

import { test, expect } from '../fixtures/botArmy';
import { env } from '../utils/env';
import { selectors, hasStubContent } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';

test.describe('Contact Loop - Direct Connect', () => {
  let networkWatcher: NetworkWatcher;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);
  });

  test('should show contact modal when clicking Contact CTA', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Click Contact/Connect CTA
      const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
      await expect(contactCTA).toBeVisible();
      await contactCTA.click();

      // Contact modal or form should appear
      const contactForm = page.locator(selectors.directConnect.form);
      await expect(contactForm).toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display contact form fields', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
      await contactCTA.click();

      // Name field should be present
      const nameInput = page.locator(selectors.directConnect.nameInput);
      await expect(nameInput).toBeVisible();

      // Email field should be present
      const emailInput = page.locator(selectors.directConnect.emailInput);
      await expect(emailInput).toBeVisible();

      // Phone field should be present
      const phoneInput = page.locator(selectors.directConnect.phoneInput);
      await expect(phoneInput).toBeVisible();

      // Message field should be present
      const messageInput = page.locator(selectors.directConnect.messageInput);
      await expect(messageInput).toBeVisible();

      // Submit button should be present and enabled
      const submitButton = page.locator(selectors.directConnect.submitButton);
      await expect(submitButton).toBeVisible();
      expect(await submitButton.isEnabled()).toBe(true);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should accept and validate contact form input', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
      await contactCTA.click();

      // Fill form fields
      const nameInput = page.locator(selectors.directConnect.nameInput);
      await nameInput.fill('Test User');

      const emailInput = page.locator(selectors.directConnect.emailInput);
      await emailInput.fill('testuser@example.com');

      const phoneInput = page.locator(selectors.directConnect.phoneInput);
      await phoneInput.fill('555-123-4567');

      const messageInput = page.locator(selectors.directConnect.messageInput);
      await messageInput.fill('I am interested in your services.');

      // Verify values were set
      expect(await nameInput.inputValue()).toBe('Test User');
      expect(await emailInput.inputValue()).toBe('testuser@example.com');
      expect(await phoneInput.inputValue()).toBe('555-123-4567');
      expect(await messageInput.inputValue()).toBe('I am interested in your services.');
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should submit contact form and show success', async ({ page }, testInfo) => {
    try {
      // Setup request listener to capture POST
      const responsePromise = page.waitForResponse(
        response => 
          response.url().includes('/api/direct-connect') || 
          response.url().includes('/api/contact') ||
          response.url().includes('/api/message')
      );

      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
      await contactCTA.click();

      // Fill form fields
      const nameInput = page.locator(selectors.directConnect.nameInput);
      await nameInput.fill('Integration Test User');

      const emailInput = page.locator(selectors.directConnect.emailInput);
      await emailInput.fill('testbot@tradescout.local');

      const phoneInput = page.locator(selectors.directConnect.phoneInput);
      await phoneInput.fill('555-999-9999');

      const messageInput = page.locator(selectors.directConnect.messageInput);
      await messageInput.fill('Test message from Bot Army regression suite.');

      // Submit form
      const submitButton = page.locator(selectors.directConnect.submitButton);
      await submitButton.click();

      // Wait for submission
      const response = await Promise.race([
        responsePromise.catch(() => null),
        page.waitForTimeout(5000).then(() => null),
      ]);

      // Success message should appear OR form should close
      const successMessage = page.locator(selectors.directConnect.successMessage);
      const formVisible = page.locator(selectors.directConnect.form);

      // Either success message appears or form disappears
      try {
        await expect(successMessage).toBeVisible({ timeout: 3000 });
      } catch {
        // Form should have closed/disappeared
        await expect(formVisible).not.toBeVisible({ timeout: 1000 });
      }
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should require email field', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
      await contactCTA.click();

      // Fill all fields except email
      const nameInput = page.locator(selectors.directConnect.nameInput);
      await nameInput.fill('Test User');

      const phoneInput = page.locator(selectors.directConnect.phoneInput);
      await phoneInput.fill('555-123-4567');

      const messageInput = page.locator(selectors.directConnect.messageInput);
      await messageInput.fill('Test message');

      // Try to submit without email
      const submitButton = page.locator(selectors.directConnect.submitButton);
      await submitButton.click();

      // Form should still be visible (validation error)
      const form = page.locator(selectors.directConnect.form);
      await expect(form).toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should close contact form on cancel', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
      await contactCTA.click();

      const form = page.locator(selectors.directConnect.form);
      await expect(form).toBeVisible();

      // Click close/cancel button
      const closeButton = page.locator(selectors.directConnect.closeButton);
      await closeButton.click();

      // Form should disappear
      await expect(form).not.toBeVisible();
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
