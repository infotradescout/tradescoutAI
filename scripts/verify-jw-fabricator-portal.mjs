import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import sharp from 'sharp';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const phase = process.env.JW_PORTAL_PHASE || 'release';
assert(['release', 'production'].includes(phase));
const working = path.resolve('test-results/jw-fabricator-portal');
const out = path.resolve('.jw-fabricator-portal-proof');
function blobHash(text) {
  const bytes = Buffer.from(text);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function once(source, oldValue, newValue) {
  assert.equal(source.split(oldValue).length, 2, 'Expected one reviewed verification anchor: ' + oldValue.slice(0, 90));
  return source.replace(oldValue, newValue);
}
let passed = false;
try {
  // Extend, never replace or skip, the existing native signup/private-access/request assertions.
  let native = await fs.readFile('scripts/jw-stone-customer-workflow.native.mjs', 'utf8');
  assert.equal(blobHash(native), '00dc4ce095af3fa6863ca02a7e9a7096caa46bd8');
  native = native.replace("from './start-cabinet-loopback-test-db.mjs'", "from './scripts/start-cabinet-loopback-test-db.mjs'")
    .replace("from './jw-stone-request-journey.mjs'", "from './scripts/jw-stone-request-journey.mjs'");
  native = once(native, "    await page.getByTestId('profile-account-business-name').waitFor();", "    await page.getByTestId('profile-account-business-name').waitFor();\n    note(device + ': public fabricator membership language', await verifyJwPortalCopy({ page, device, output: out, phase: 'synthetic' }));");
  native = once(native, "    note(device + ': actual signup, private identity, pending business and one membership');", "    await verifyJwPortalConfirmation(page);\n    note(device + ': actual signup, private identity, pending business and one membership');");
  native = "import { verifyJwPortalCopy, verifyJwPortalConfirmation } from './scripts/verify-jw-portal-copy-browser.mjs';\n" + native;

  let source = await fs.readFile('scripts/verify-jw-stone-customer-workflow.mjs', 'utf8');
  assert.equal(blobHash(source), '5d321156d17d76df10af381781816816f32fd3e5');
  source = source.replace("from './start-cabinet-loopback-test-db.mjs'", "from './scripts/start-cabinet-loopback-test-db.mjs'");
  source = once(source, "[process.execPath, 'scripts/jw-stone-customer-workflow.native.mjs']", "[process.execPath, '--input-type=module', '-e', " + JSON.stringify(native) + "]");
  source = once(source, "await page.getByTestId('profile-account-password').waitFor();", "await page.getByTestId('profile-account-password').waitFor();\n    (report.portalCopy ||= []).push(await verifyJwPortalCopy({ page, device, output: out, phase: 'production' }));");
  source = "import { verifyJwPortalCopy } from './scripts/verify-jw-portal-copy-browser.mjs';\n" + source;

  const processResult = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    stdio: 'inherit', env: { ...process.env, JW_WORKFLOW_PHASE: phase, JW_WORKFLOW_OUTPUT: working },
  });
  if (processResult.error) throw processResult.error;
  const evidence = JSON.parse(await fs.readFile(path.join(working, 'evidence.json'), 'utf8'));
  assert.equal(evidence.head, head);
  passed = evidence.passed === true && processResult.status === 0;
  if (phase === 'release') passed &&= evidence.release?.commit === head && evidence.release?.attestable === true && evidence.release?.result === 'pass';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const images = (await fs.readdir(working)).filter(name => /fabricator.*\.png$/.test(name));
  for (const name of images) await fs.copyFile(path.join(working, name), path.join(out, name));
  await fs.writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out, 'index.html'), '<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JW Stone portal verification</title><h1>' + (passed ? 'Declared portal checks passed' : 'FAILED — not release approval') + '</h1><p>' + phase + ' / ' + head + '</p><a href="evidence.json">Evidence</a>' + images.map(name => '<figure><img src="' + name + '" alt="' + name + '" style="max-width:100%;max-height:850px"><figcaption>' + name + '</figcaption></figure>').join('') + '</html>');
  const visual = images.find(name => name === 'touch-320-fabricator-membership.png');
  if (visual) {
    const image = await sharp(path.join(out, visual)).resize({ width: 320, withoutEnlargement: true }).webp({ quality: 40 }).toBuffer();
    await fs.writeFile(path.join(out, 'membership-review.webp'), image);
    console.log('JW_PORTAL_VISUAL ' + JSON.stringify({ head, phase, name: visual, sha256: createHash('sha256').update(image).digest('hex'), base64: image.toString('base64') }));
  }
  console.log('JW_PORTAL_FINAL ' + JSON.stringify({ head, phase, passed, tests: evidence.tests, nativeWorkflow: evidence.workflow?.passed, release: evidence.release?.result, attestable: evidence.release?.attestable === true, productionCopy: evidence.portalCopy, health: evidence.healthAfter, error: evidence.error || null }));
} catch (error) {
  console.error('JW_PORTAL_FAILURE ' + String(error.stack || error));
}
if (!passed) process.exitCode = 1;
// The static report is not an app deployment. Only exact-source passing release evidence authorizes merge.
