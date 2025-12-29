import { test, expect } from '@playwright/test';

// Minimal e2e check that Scout's routing explainer
// includes a navigate action to the canonical Direct Connect help URL.

const ROUTING_HELP_HASH = '/help/how-tradescout-works#direct-connect-workflow';

test.describe('Scout routing explainer', () => {
  // This flow relies on the same test DB + server wiring
  // used by other DB-backed E2E suites.
  test.skip(!process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL not set for Scout routing E2E');

  test('navigates to Direct Connect workflow help', async ({ page }) => {
    await page.goto('/scout');

    const input = page.getByRole('textbox').first();
    await input.click();
    await input.fill('Why is this not routed yet?');

    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();

    // Wait for a Scout explainer cluster to appear.
    const clusterCard = page.locator('.scout-card').first();
    await expect(clusterCard).toBeVisible();

    // Click the primary action button for the cluster
    // (validated NAVIGATE action wired via getHelpLink('directConnect')).
    const primaryActionButton = clusterCard.locator('button').first();
    await expect(primaryActionButton).toBeVisible();
    await primaryActionButton.click();

    // Assert navigation to the canonical Direct Connect workflow help anchor.
    await expect(page).toHaveURL(new RegExp(`${ROUTING_HELP_HASH.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`));
  });
});
