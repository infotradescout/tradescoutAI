/**
 * Authentication Buttons Journey
 * 
 * Tests that:
 * 1. /login page shows Google and Facebook login buttons
 * 2. /create-account page shows Google and Facebook signup buttons
 * 3. Buttons are clickable and properly configured
 * 4. OAuth flows are accessible (not stubbed)
 */

import { test, expect } from '@playwright/test';
import { env } from '../utils/env';
import { selectors, hasStubContent } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';

test.describe('Authentication Buttons', () => {
  let networkWatcher: NetworkWatcher;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);
  });

  test('should display Google and Facebook buttons on login page', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/login`);

      // Google login button should be visible and enabled
      const googleButton = page.locator(selectors.auth.loginGoogleButton);
      await expect(googleButton).toBeVisible();
      expect(await googleButton.isEnabled()).toBe(true);

      const googleText = await googleButton.textContent();
      expect(googleText).toBeTruthy();
      expect(googleText?.toLowerCase()).toContain('google');
      expect(hasStubContent(googleText || '')).toBe(false);

      // Facebook login button should be visible and enabled
      const facebookButton = page.locator(selectors.auth.loginFacebookButton);
      await expect(facebookButton).toBeVisible();
      expect(await facebookButton.isEnabled()).toBe(true);

      const facebookText = await facebookButton.textContent();
      expect(facebookText).toBeTruthy();
      expect(facebookText?.toLowerCase()).toContain('facebook');
      expect(hasStubContent(facebookText || '')).toBe(false);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display Google and Facebook buttons on create-account page', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/create-account`);

      // Google signup button should be visible
      const googleButton = page.locator(selectors.auth.createAccountGoogleButton);
      await expect(googleButton).toBeVisible();
      expect(await googleButton.isEnabled()).toBe(true);

      const googleText = await googleButton.textContent();
      expect(googleText).toBeTruthy();
      expect(googleText?.toLowerCase()).toContain('google');

      // Facebook signup button should be visible
      const facebookButton = page.locator(selectors.auth.createAccountFacebookButton);
      await expect(facebookButton).toBeVisible();
      expect(await facebookButton.isEnabled()).toBe(true);

      const facebookText = await facebookButton.textContent();
      expect(facebookText).toBeTruthy();
      expect(facebookText?.toLowerCase()).toContain('facebook');
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should have proper href/onclick attributes on OAuth buttons', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/login`);

      const googleButton = page.locator(selectors.auth.loginGoogleButton);
      
      // Should have either href or onclick (not stub)
      const href = await googleButton.getAttribute('href');
      const onclick = await googleButton.getAttribute('onclick');
      
      expect(href || onclick).toBeTruthy();
      
      // Should not be a dead link
      if (href) {
        expect(href.length).toBeGreaterThan(0);
        expect(href).not.toBe('#');
      }
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display email login form on login page', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/login`);

      // Email input should be visible
      const emailInput = page.locator(selectors.auth.loginEmailInput);
      await expect(emailInput).toBeVisible();

      // Password input should be visible
      const passwordInput = page.locator(selectors.auth.loginPasswordInput);
      await expect(passwordInput).toBeVisible();

      // Submit button should be visible
      const submitButton = page.locator(selectors.auth.loginSubmitButton);
      await expect(submitButton).toBeVisible();
      expect(await submitButton.isEnabled()).toBe(true);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should display email signup form on create-account page', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/create-account`);

      // Name input should be visible
      const nameInput = page.locator(selectors.auth.createAccountNameInput);
      await expect(nameInput).toBeVisible();

      // Email input should be visible
      const emailInput = page.locator(selectors.auth.createAccountEmailInput);
      await expect(emailInput).toBeVisible();

      // Password input should be visible
      const passwordInput = page.locator(selectors.auth.createAccountPasswordInput);
      await expect(passwordInput).toBeVisible();

      // Submit button should be visible
      const submitButton = page.locator(selectors.auth.createAccountSubmitButton);
      await expect(submitButton).toBeVisible();
      expect(await submitButton.isEnabled()).toBe(true);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should have "forgot password" link on login page', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/login`);

      const forgotLink = page.locator(selectors.auth.forgotPasswordLink);
      await expect(forgotLink).toBeVisible();

      const linkText = await forgotLink.textContent();
      expect(linkText?.toLowerCase()).toContain('forgot');
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should show "already have an account" link on create-account page', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/create-account`);

      const loginLink = page.locator(selectors.auth.haveAccountLink);
      await expect(loginLink).toBeVisible();

      const linkText = await loginLink.textContent();
      expect(linkText?.toLowerCase()).toContain('sign in');
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
