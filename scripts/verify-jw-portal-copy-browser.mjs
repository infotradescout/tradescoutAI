import assert from 'node:assert/strict';
import path from 'node:path';

const promotionalWords = /\b(?:prices?|pricing|wholesale|discounts?|unlock(?:s|ed)?|rates?)\b/i;
async function noPromotion(locator) {
  const text = await locator.innerText();
  assert(!promotionalWords.test(text), 'Business membership copy advertises pricing');
  const labels = await locator.locator('[aria-label],[title]').evaluateAll(nodes => nodes.map(node => (node.getAttribute('aria-label') || '') + ' ' + (node.getAttribute('title') || '')).join(' '));
  assert(!promotionalWords.test(labels), 'Membership accessible labels advertise pricing');
}

/** Read-only view interactions. Invoked before synthetic registration and on public production pages. */
export async function verifyJwPortalCopy({ page, device, output, phase }) {
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); return device === 'touch' ? locator.tap() : locator.click(); };
  const header = page.getByTestId('jw-marketplace-header');
  const entry = page.getByTestId('jw-marketplace-account-button');
  const dialog = page.getByTestId('profile-account-dialog');
  const createTitle = 'Create a JW Stone business membership';
  assert.equal((await entry.innerText()).trim(), 'Fabricator Portal');
  assert((await entry.getAttribute('aria-label')).includes('JW Stone Fabricator Portal'));
  await dialog.getByRole('heading', { name: createTitle, exact: true }).waitFor();
  assert((await dialog.innerText()).includes('For stone fabricators and industry businesses.'));
  assert.equal((await page.getByTestId('profile-account-submit').innerText()).trim(), 'Create business membership');
  await noPromotion(dialog); await noPromotion(header);
  await page.screenshot({ path: path.join(output, device + '-fabricator-membership.png'), fullPage: false });
  await click(dialog.getByRole('button', { name: 'Already have an account? Sign in', exact: true }));
  await dialog.getByRole('heading', { name: 'Sign in to the JW Stone Fabricator Portal', exact: true }).waitFor();
  assert((await dialog.innerText()).includes('Use your existing TradeScout account'));
  await dialog.getByRole('link', { name: 'Forgot or need to set your password?', exact: true }).waitFor();
  await noPromotion(dialog);
  await click(dialog.getByRole('button', { name: 'New here? Create a business membership', exact: true }));
  await dialog.getByRole('heading', { name: createTitle, exact: true }).waitFor();
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  const originalSize = page.viewportSize();
  if (device === 'touch') await page.setViewportSize({ width: 320, height: 844 });
  await header.scrollIntoViewIfNeeded();
  const bounds = await entry.boundingBox();
  assert(bounds && bounds.width >= 44 && bounds.height >= 44, 'Portal entry lost its usable tap area');
  const viewportWidth = page.viewportSize().width;
  assert(bounds.x >= 0 && bounds.x + bounds.width <= viewportWidth + 1, 'Portal label does not fit');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await header.screenshot({ path: path.join(output, device + '-fabricator-header.png') });
  await click(page.getByTestId('jw-marketplace-menu-button'));
  const menu = page.getByTestId('jw-marketplace-menu-panel');
  await noPromotion(menu);
  await click(menu.getByRole('button', { name: 'Fabricator Portal', exact: true }));
  await dialog.getByRole('heading', { name: createTitle, exact: true }).waitFor();
  await page.getByTestId('profile-account-business-name').waitFor();
  await noPromotion(dialog);
  if (device === 'touch') {
    const form = await dialog.boundingBox();
    assert(form && form.x >= -1 && form.x + form.width <= 321, 'Membership form is clipped at 320px');
    await page.screenshot({ path: path.join(output, 'touch-320-fabricator-membership.png'), fullPage: false });
    await page.setViewportSize(originalSize);
  }
  const result = { device, phase, header: 'Fabricator Portal', createTitle, businessAudience: true, noPublicPricePromotion: true, signInRecovery: true, menuOpensMembership: true, narrowWidth: device === 'touch' ? 320 : viewportWidth };
  console.log('JW_PORTAL_COPY_CHECK ' + JSON.stringify(result));
  return result;
}

export async function verifyJwPortalConfirmation(page) {
  const dialog = page.getByTestId('profile-account-dialog');
  await dialog.getByRole('heading', { name: 'JW Stone Fabricator Portal', exact: true }).waitFor();
  await page.getByTestId('profile-account-dialog-connected').waitFor();
  assert((await dialog.innerText()).includes('Your JW Stone business membership is active.'));
  assert((await dialog.innerText()).includes('Your business verification is pending.'));
  await noPromotion(dialog);
}
