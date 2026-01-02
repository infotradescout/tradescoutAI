import { test, expect } from './fixtures/botArmy';

// Minimal e2e check that the Messages page renders and shows threads/messages

test.describe('Messages page', () => {
  test('renders message threads and allows sending a message', async ({ page }) => {
    // Assumes a dev/test user is already authenticated via cookie/session,
    // matching the pattern used in other e2e specs.

    await page.goto('/messages');

    // Wait for at least one message thread card
    const threadCard = page.locator('[data-testid="message-thread-card"]').first();
    await expect(threadCard).toBeVisible();

    // Click the first thread to load messages
    await threadCard.click();

    const messageRow = page.locator('[data-testid="message-row"]').first();
    await expect(messageRow).toBeVisible();

    // Try to send a message if an input is present
    const input = page.getByRole('textbox');
    if (await input.isVisible().catch(() => false)) {
      const uniqueText = `Playwright test message ${Date.now()}`;
      await input.fill(uniqueText);

      const sendButton = page.getByRole('button', { name: /send/i });
      if (await sendButton.isVisible().catch(() => false)) {
        await sendButton.click();
      } else {
        // Fallback: press Enter to send
        await input.press('Enter');
      }

      // Expect a new message row containing our unique text
      const newMessage = page.locator('[data-testid="message-row"]', { hasText: uniqueText });
      await expect(newMessage.first()).toBeVisible();
    }
  });
});
