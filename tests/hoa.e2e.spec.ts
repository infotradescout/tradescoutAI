import { test, expect } from './fixtures/botArmy';

// Minimal e2e checks for HOA pages

test.describe('HOA pages', () => {
  test('hoa-management shows member or not-member state', async ({ page }) => {
    await page.goto('/hoa-management');

    const notMember = page.locator('[data-testid="hoa-not-member"]');
    const memberPanel = page.locator('[data-testid="hoa-management-page"]');

    await expect(notMember.or(memberPanel).first()).toBeVisible();
  });

  test('hoa-dashboard renders metrics section', async ({ page }) => {
    await page.goto('/hoa-dashboard');

    const metrics = page.locator('[data-testid="hoa-dashboard-metrics"]');
    await expect(metrics.first()).toBeVisible();
  });
});
