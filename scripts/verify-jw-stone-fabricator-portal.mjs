import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import sharp from 'sharp';

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

// Extend the existing real-route/native-database and production browser paths.
// All original signup, access and request assertions remain intact.
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
    await header.screenshot({ path: path.join(directory, `portal-entry-${device}-${width}.png`) });
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
const summary = { head, phase, passed: evidence.passed, tests: evidence.tests || null, release: evidence.release?.result || null, attestable: evidence.release?.attestable || false, deployed: evidence.deployed || null };
console.log('JW_PORTAL_RESULT ' + JSON.stringify({ ...summary, error: evidence.error || null }));

// Detailed synthetic backend evidence remains in build logs and the untouched
// release-contract artifact. A publicly served report contains only neutral UI.
const images = [];
for (const file of await fs.readdir(output)) {
  if (/^portal-(?:entry|create|signin)-(?:desktop|touch)(?:-\d+)?\.png$/.test(file)) images.push(file);
  else await fs.rm(path.join(output, file), { recursive: true, force: true });
}
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(summary, null, 2));
await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JW Stone portal review</title><h1>' + (summary.passed ? 'Portal verification passed' : 'Portal verification failed') + '</h1><p>' + phase + ' ' + head + '</p><a href="evidence.json">Verification summary</a>' + images.map(name => '<figure><img style="max-width:100%" src="' + name + '" alt="' + name + '"></figure>').join('') + '</html>');
for (const name of ['portal-entry-touch-320.png', 'portal-signin-touch.png']) {
  if (!images.includes(name)) continue;
  const bytes = await sharp(path.join(output, name)).resize({ width: 390, withoutEnlargement: true }).webp({ quality: 38 }).toBuffer();
  console.log('JW_PORTAL_VISUAL ' + JSON.stringify({ name, head, phase, sha256: createHash('sha256').update(bytes).digest('hex'), base64: bytes.toString('base64') }));
}
assert.equal(result.status, 0); assert.equal(evidence.passed, true, 'Portal verification must pass; a published report alone is not approval');
if (phase === 'release') assert.equal(evidence.release?.attestable, true);
