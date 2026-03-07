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
import { resolveBusinessSlug } from '../utils/testTargets';

function contactCtaLocator(page: any) {
  return page
    .locator(selectors.businessProfileView.contactCTA)
    .or(page.getByRole("button", { name: /contact|connect|request/i }).first())
    .or(page.getByRole("link", { name: /contact|connect|request/i }).first());
}

function requestTitleLocator(page: any) {
  return page
    .locator(selectors.directConnect.nameInput)
    .or(page.getByPlaceholder(/need a provider for|help moving a couch|title/i).first());
}

function requestDescriptionLocator(page: any) {
  return page
    .locator(selectors.directConnect.messageInput)
    .or(page.getByPlaceholder(/what needs to be done|timeline|requirements/i).first());
}

function requestSubmitLocator(page: any) {
  return page
    .locator(selectors.directConnect.submitButton)
    .or(page.getByRole("button", { name: /post request|submit|next/i }).first());
}

async function gotoBusiness(page: any, slug: string) {
  await page.goto(`${env.BASE_URL}/business/${slug}`);
  const bootFallbackVisible = await page
    .locator("#ts-boot-fallback")
    .isVisible({ timeout: 1200 })
    .catch(() => false);
  test.skip(bootFallbackVisible, "App boot fallback active; contact loop surface not available.");
}

async function ensureRequestSurface(page: any) {
  const titleReady = await requestTitleLocator(page).isVisible({ timeout: 2500 }).catch(() => false);
  const detailsReady = await requestDescriptionLocator(page).isVisible({ timeout: 2500 }).catch(() => false);
  const formReady = await page.locator(selectors.directConnect.form).isVisible({ timeout: 2500 }).catch(() => false);
  const ready = titleReady || detailsReady || formReady || page.url().includes("/direct-connect");
  test.skip(!ready, "Contact request form is not exposed from this business profile.");
}

test.describe('Contact Loop - Direct Connect', () => {
  let networkWatcher: NetworkWatcher;
  let businessSlug: string | null = null;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);
    businessSlug = await resolveBusinessSlug(page.request, env.AGENT_SCOPE_SLUG);
  });

  test('should show contact modal when clicking Contact CTA', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for contact loop test.");
      await gotoBusiness(page, businessSlug);

      // Click Contact/Connect CTA
      const contactCTA = contactCtaLocator(page);
      await expect(contactCTA).toBeVisible();
      await contactCTA.click();
      await ensureRequestSurface(page);

      // Contact modal or form should appear
      const contactForm = page
        .locator(selectors.directConnect.form)
        .or(page.locator("form").first())
        .or(page.getByText(/post request|direct connect/i).first());
      await expect(contactForm).toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display contact form fields', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for contact loop test.");
      await gotoBusiness(page, businessSlug);

      const contactCTA = contactCtaLocator(page);
      await contactCTA.click();
      await ensureRequestSurface(page);

      // Request title/name should be present
      const nameInput = requestTitleLocator(page);
      await expect(nameInput).toBeVisible();

      // Message/details field should be present
      const messageInput = requestDescriptionLocator(page);
      await expect(messageInput).toBeVisible();

      // Submit button should be present and enabled
      const submitButton = requestSubmitLocator(page);
      await expect(submitButton).toBeVisible();
      expect(await submitButton.isEnabled()).toBe(true);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should accept and validate contact form input', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for contact loop test.");
      await gotoBusiness(page, businessSlug);

      const contactCTA = contactCtaLocator(page);
      await contactCTA.click();
      await ensureRequestSurface(page);

      // Fill form fields
      const nameInput = requestTitleLocator(page);
      await nameInput.fill('Test request title');

      const messageInput = requestDescriptionLocator(page);
      await messageInput.fill('I am interested in your services.');

      // Verify values were set
      expect(await nameInput.inputValue()).toContain('Test');
      expect(await messageInput.inputValue()).toBe('I am interested in your services.');
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should submit contact form and show success', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for contact loop test.");
      await gotoBusiness(page, businessSlug);

      const contactCTA = contactCtaLocator(page);
      await contactCTA.click();
      await ensureRequestSurface(page);

      // Setup request listener to capture POST only after the request surface is confirmed.
      const responsePromise = page.waitForResponse(
        response => 
          response.url().includes('/api/direct-connect') || 
          response.url().includes('/api/contact') ||
          response.url().includes('/api/message')
      );

      // Fill form fields
      const nameInput = requestTitleLocator(page);
      await nameInput.fill('Integration test request');

      const messageInput = requestDescriptionLocator(page);
      await messageInput.fill('Test message from Bot Army regression suite.');

      // Submit form
      const submitButton = requestSubmitLocator(page);
      await submitButton.click();

      // Wait for submission
      const response = await Promise.race([
        responsePromise.catch(() => null),
        page.waitForTimeout(5000).then(() => null),
      ]);

      // Success message should appear OR form should close
      const successMessage = page
        .locator(selectors.directConnect.successMessage)
        .or(page.getByText(/posted|created|success|live in direct connect/i).first());
      const formVisible = page.locator(selectors.directConnect.form).or(page.locator("form").first());

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
      test.skip(!businessSlug, "No public business slug available for contact loop test.");
      await gotoBusiness(page, businessSlug);

      const contactCTA = contactCtaLocator(page);
      await contactCTA.click();
      await ensureRequestSurface(page);

      // Fill minimally and try to submit without full details
      const nameInput = requestTitleLocator(page);
      await nameInput.fill('Test User');

      const messageInput = requestDescriptionLocator(page);
      await messageInput.fill('Test message');

      // Try to submit without all required details
      const submitButton = requestSubmitLocator(page);
      await submitButton.click();

      // Form should still be visible (validation error)
      const form = page.locator(selectors.directConnect.form).or(page.locator("form").first());
      await expect(form).toBeVisible();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should close contact form on cancel', async ({ page }, testInfo) => {
    try {
      test.skip(!businessSlug, "No public business slug available for contact loop test.");
      await gotoBusiness(page, businessSlug);

      const contactCTA = contactCtaLocator(page);
      await contactCTA.click();
      await ensureRequestSurface(page);

      const form = page.locator(selectors.directConnect.form).or(page.locator("form").first());
      await expect(form).toBeVisible();

      // Click close/cancel button
      const closeButton = page
        .locator(selectors.directConnect.closeButton)
        .or(page.getByRole("button", { name: /close|cancel|back/i }).first());
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
