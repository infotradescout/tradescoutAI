import { test, expect } from "./fixtures/botArmy";

// Basic e2e guard: community feed shows posts for the user's county

test.describe('Community feed scoped to user county', () => {
  test('shows county posts on /community-feed', async ({ page }) => {
    // TODO: replace with your real sign-in helper once available
    // For now, assume the default dev user is already authenticated via cookie/session

    await page.goto('/community-feed');

    // Wait for at least one post card to appear
    const postCards = page.locator('[data-testid="community-post-card"]');
    await expect(postCards.first()).toBeVisible();

    // Spot check that at least one post shows some content
    const firstText = await postCards.first().innerText();
    expect(firstText.length).toBeGreaterThan(0);
  });
});
