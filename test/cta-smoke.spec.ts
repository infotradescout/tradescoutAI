import { test, expect } from '@playwright/test';

// Basic CTA smoke test to ensure core surfaces keep rendering
// unified Ask Scout / Direct Connect / Message actions.

test('CTA smoke: snapshot rail, community post, and TradeDeals cards render CTAs', async ({ page }) => {
  await page.goto('/community-feed');

  // Snapshot rail: wait for at least one card and its CTA buttons.
  const snapshotCard = page.locator('[data-testid="community-snapshot-rail"] [role="button"]').first();
  await snapshotCard.waitFor({ state: 'visible' });

  const snapshotAskScout = snapshotCard.getByText('Ask Scout');
  await expect(snapshotAskScout).toBeVisible();

  // We tolerate Direct Connect / Message being gated, but if present they must render.
  const snapshotDirectConnect = snapshotCard.getByText('Direct Connect');
  const snapshotMessage = snapshotCard.getByText('Message');

  // Soft assertions: only check visibility if they exist in DOM.
  if (await snapshotDirectConnect.count()) {
    await expect(snapshotDirectConnect.first()).toBeVisible();
  }
  if (await snapshotMessage.count()) {
    await expect(snapshotMessage.first()).toBeVisible();
  }

  // Community post card: check CTA grid row.
  const postCard = page.locator('[data-testid="community-post-card"]').first();
  await postCard.waitFor({ state: 'visible' });

  const postAskScout = postCard.getByText('Ask Scout');
  await expect(postAskScout).toBeVisible();

  const postDirectConnect = postCard.getByText('Direct Connect');
  const postMessage = postCard.getByText('Message');

  if (await postDirectConnect.count()) {
    await expect(postDirectConnect.first()).toBeVisible();
  }
  if (await postMessage.count()) {
    await expect(postMessage.first()).toBeVisible();
  }

  // TradeDeals page: CTA grid on at least one card.
  await page.goto('/trade-deals');

  const tradeDealAskScout = page.getByText('Ask Scout').first();
  await expect(tradeDealAskScout).toBeVisible();

  const tradeDealDirectConnect = page.getByText('Direct Connect').first();
  const tradeDealMessage = page.getByText('Message').first();

  if (await tradeDealDirectConnect.count()) {
    await expect(tradeDealDirectConnect).toBeVisible();
  }
  if (await tradeDealMessage.count()) {
    await expect(tradeDealMessage).toBeVisible();
  }

  // Simple routing assertion: clicking Ask Scout from TradeDeals should
  // navigate to /scout with a trade_deal source param.
  await tradeDealAskScout.click();
  await page.waitForURL('**/scout**');
  const url = new URL(page.url());
  expect(url.pathname).toBe('/scout');
  expect(url.searchParams.get('source')).toBe('trade_deal');
});
