import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const phase = process.env.JW_WORKFLOW_PHASE || 'release';
assert(['release', 'production'].includes(phase));
const output = 'test-results/jw-fabricator-portal';
const nativePath = 'scripts/jw-stone-customer-workflow.native.mjs';
const releasePath = 'scripts/verify-jw-stone-customer-workflow.mjs';
function replaceOnce(source, from, to) {
  assert.equal(source.split(from).length, 2, 'Expected one reviewed insertion point: ' + from.slice(0, 100));
  return source.replace(from, to);
}
async function checkedSource(file, expected) {
  const bytes = await fs.readFile(file);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), expected, 'Review baseline verifier changes before extending: ' + file);
  return bytes.toString('utf8');
}

// These assertions are injected into the existing real-route/native-database and
// production browser paths. All original signup, privacy, revocation and request
// assertions remain; no test fixtures are given new entitlements by this wrapper.
async function assertPortalEntry(page, directory, device) {
  const entry = page.getByTestId('jw-marketplace-account-button');
  assert((await entry.innerText()).includes('Fabricator Portal'));
  assert((await entry.innerText()).includes('Business access'));
  assert((await entry.getAttribute('aria-label')).includes('Fabricator Portal'));
  const original = page.viewportSize();
  for (const width of device === 'touch' ? [320, 390] : [original.width]) {
    await page.setViewportSize({ width, height: original.height });
    const bounds = await entry.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, 'Portal entry clipped at ' + width);
    const header = page.getByTestId('jw-marketplace-header');
    assert.equal(await header.evaluate(node => node.scrollWidth > innerWidth + 1), false, 'Header overflow at ' + width);
    await page.screenshot({ path: path.join(directory, `portal-entry-${device}-${width}.png`), fullPage: false });
  }
  await page.setViewportSize(original);
  await page.getByTestId('jw-marketplace-menu-button').click();
  const menu = page.getByTestId('jw-marketplace-menu-panel');
  assert((await menu.innerText()).includes('Fabricator Portal'));
  assert((await menu.innerText()).includes('Business access'));
  assert(!/\b(?:pric(?:e|es|ing)|wholesale|discount|unlock)\b/i.test(await menu.innerText()));
  await page.keyboard.press('Escape');
}
async function assertPortalForm(page, directory, device) {
  const dialog = page.getByTestId('profile-account-dialog');
  assert.equal(await dialog.getByRole('heading', { name: 'JW Stone Fabricator Portal', exact: true }).count(), 1);
  assert((await dialog.innerText()).includes('For fabricators and stone-industry businesses.'));
  assert.equal((await page.getByTestId('profile-account-submit').innerText()).trim(), 'Create business account');
  assert(!/\b(?:pric(?:e|es|ing)|wholesale|discount|unlock)\b/i.test(await dialog.innerText()));
  await page.screenshot({ path: path.join(directory, `portal-create-${device}.png`), fullPage: false });
  await dialog.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
  assert((await dialog.innerText()).includes('Use your existing TradeScout account'));
  assert.equal((await page.getByTestId('profile-account-submit').innerText()).trim(), 'Sign in and continue');
  assert(!/\b(?:pric(?:e|es|ing)|wholesale|discount|unlock)\b/i.test(await dialog.innerText()));
  await page.screenshot({ path: path.join(directory, `portal-signin-${device}.png`), fullPage: false });
  await dialog.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  await page.getByTestId('profile-account-business-name').waitFor();
}
async function assertPortalConnected(page, directory, device) {
  const dialog = page.getByTestId('profile-account-dialog');
  assert.equal(await dialog.getByRole('heading', { name: 'JW Stone Fabricator Portal', exact: true }).count(), 1);
  assert((await dialog.innerText()).includes('Business verification is pending. Some business features may require approval.'));
  assert(!/\b(?:pric(?:e|es|ing)|wholesale|discount|unlock)\b/i.test(await dialog.innerText()));
  await page.screenshot({ path: path.join(directory, `portal-connected-${device}.png`), fullPage: false });
}

if (phase === 'release') {
  const affected = spawnSync('npm', ['run', 'test:run', '--', 'client/src/features/jw-stone', 'client/src/components/profile', '--maxWorkers=2'], { stdio: 'inherit', env: process.env });
  assert.equal(affected.status, 0, 'All JW and shared account component regressions must pass');
}
let native = await checkedSource(nativePath, '00dc4ce095af3fa6863ca02a7e9a7096caa46bd8');
native = native.replace("from './start-cabinet-loopback-test-db.mjs'", "from './scripts/start-cabinet-loopback-test-db.mjs'")
  .replace("from './jw-stone-request-journey.mjs'", "from './scripts/jw-stone-request-journey.mjs'");
native = replaceOnce(native, "    await page.getByTestId('jw-marketplace-account-button').waitFor();\n", "    await page.getByTestId('jw-marketplace-account-button').waitFor();\n    await assertPortalEntry(page, out, device);\n");
native = replaceOnce(native, "    await page.getByTestId('profile-account-business-name').waitFor();\n", "    await page.getByTestId('profile-account-business-name').waitFor();\n    await assertPortalForm(page, out, device);\n");
native = replaceOnce(native, "await page.getByTestId('profile-account-dialog-connected').waitFor();", "await page.getByTestId('profile-account-dialog-connected').waitFor();\n    await assertPortalConnected(page, out, device);");
native = [assertPortalEntry.toString(), assertPortalForm.toString(), assertPortalConnected.toString(), native].join('\n');
let release = await checkedSource(releasePath, '5d321156d17d76df10af381781816816f32fd3e5');
release = release.replace("from './start-cabinet-loopback-test-db.mjs'", "from './scripts/start-cabinet-loopback-test-db.mjs'");
release = replaceOnce(release, "[process.execPath, 'scripts/jw-stone-customer-workflow.native.mjs']", `[process.execPath, '--input-type=module', '-e', ${JSON.stringify(native)}]`);
release = replaceOnce(release, "    await page.getByTestId('jw-marketplace-account-button').waitFor();\n", "    await page.getByTestId('jw-marketplace-account-button').waitFor();\n    await assertPortalEntry(page, out, device);\n");
release = replaceOnce(release, "    await page.getByTestId('profile-account-business-name').waitFor();\n", "    await page.getByTestId('profile-account-business-name').waitFor();\n    await assertPortalForm(page, out, device);\n");
release = [assertPortalEntry.toString(), assertPortalForm.toString(), release].join('\n');
const result = spawnSync(process.execPath, ['--input-type=module', '-e', release], {
  stdio: 'inherit', env: { ...process.env, JW_WORKFLOW_PHASE: phase, JW_WORKFLOW_OUTPUT: output },
});
if (result.error) throw result.error;
const evidence = JSON.parse(await fs.readFile(path.join(output, 'evidence.json'), 'utf8'));
assert.equal(evidence.head, head);
console.log('JW_PORTAL_RESULT ' + JSON.stringify({ head, phase, passed: evidence.passed, error: evidence.error || null, tests: evidence.tests || null, release: evidence.release?.result || null, attestable: evidence.release?.attestable || false, deployed: evidence.deployed || null }));
assert.equal(result.status, 0); assert.equal(evidence.passed, true, 'Portal verification must pass; a published report alone is not approval');
if (phase === 'release') assert.equal(evidence.release?.attestable, true);
