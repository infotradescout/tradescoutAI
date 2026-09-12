import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import sharp from 'sharp';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const phase = process.env.CABINET_LIBRARY_PHASE || 'preview';
assert(['preview', 'production'].includes(phase));
if (phase === 'preview') {
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  if (remote.status !== 0) execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/infotradescout/tradescoutAI.git']);
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true';
  execFileSync('git', ['fetch', '--filter=blob:none', '--no-tags', ...(shallow ? ['--unshallow'] : []), 'origin', 'refs/heads/main:refs/remotes/origin/main'], { stdio: 'inherit' });
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), head);
  execFileSync('node', ['scripts/guard-production-readiness-registry.mjs'], { stdio: 'inherit' });
}
const original = await fs.readFile('scripts/verify-cabinet-library.mjs', 'utf8');
const bytes = Buffer.from(original);
const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
assert.equal(hash, '81792e9b7b89edddc2184f05cd0c64ec354867d9', 'Review changes in the existing verifier before extending it');
const anchor = '  await browser.close(); browser = null; server.kill(); server = null;';
assert.equal(original.split(anchor).length, 2);
let source = original
  .replace("from './prepare-cabinet-parent-proof.mjs'", "from './scripts/prepare-cabinet-parent-proof.mjs'")
  .replace("from './start-cabinet-loopback-test-db.mjs'", "from './scripts/start-cabinet-loopback-test-db.mjs'")
  .replace("const out = '.cabinet-library-proof';", "const out = '.cabinet-canvas-proof';")
  .replace(anchor, '  await verifyCabinetAccessories({ browser, local, phase, deployed, working, record });\n  await verifyKitchenWorkspace({ browser, local, phase, deployed, working, record });\n  await verifyCabinetCanvas({ browser, local, phase, deployed, working, record });\n' + anchor)
  .replace('prior cabinet/countertop regressions retained\'', 'prior cabinet/countertop regressions retained; existing accessory/handoff and workspace checks plus real zoomed dragging, hidden-layer collisions, read-only panning, visual catalog and selected-dimension navigation passed\'');
source = "import { verifyCabinetAccessories } from './scripts/verify-cabinet-accessories-browser.mjs';\nimport { verifyKitchenWorkspace } from './scripts/verify-kitchen-workspace-browser.mjs';\nimport { verifyCabinetCanvas } from './scripts/verify-cabinet-canvas-browser.mjs';\n" + source;
console.log('CANVAS_VERIFICATION_SOURCE ' + JSON.stringify({ head, phase, baseVerifier: hash }));
const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
const out = '.cabinet-canvas-proof';
try {
  const evidence = JSON.parse(await fs.readFile(path.join(out, 'evidence.json'), 'utf8'));
  const imageFiles = (await fs.readdir(out)).filter(name => name.endsWith('.png'));
  const images = [];
  for (const name of imageFiles) {
    const bytes = await fs.readFile(path.join(out, name));
    images.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await fs.writeFile(path.join(out, 'screenshots.json'), JSON.stringify({ head, phase, images }, null, 2));
  await fs.writeFile(path.join(out, 'index.html'), '<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TradeScout cabinet canvas review</title></head><body style="font-family:system-ui;margin:24px"><h1>' + (evidence.passed ? 'Verified cabinet canvas workflow' : 'FAILED — not a release approval') + '</h1><p>' + phase + ' / ' + head + '</p><a href="evidence.json">Evidence</a>' + images.map(image => '<figure><a href="' + image.name + '"><img src="' + image.name + '" style="max-width:100%;max-height:720px" alt="' + image.name + '"></a><figcaption>' + image.name + '</figcaption></figure>').join('') + '</body></html>');
  const preferred = process.env.CANVAS_IMAGE || 'canvas-catalog-laptop.png';
  const selected = images.find(image => image.name === preferred) || images.find(image => image.name.startsWith('canvas-failure')) || images.find(image => image.name.includes('failure'));
  if (selected) {
    const image = await sharp(path.join(out, selected.name)).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 40, effort: 6 }).toBuffer();
    await fs.writeFile(path.join(out, 'canvas-review.webp'), image);
    console.log('CANVAS_REVIEW_IMAGE ' + JSON.stringify({ name: selected.name, sha256: createHash('sha256').update(image).digest('hex'), base64: image.toString('base64') }));
  }
  console.log('CANVAS_FINAL_RESULT ' + JSON.stringify({ head, phase, passed: evidence.passed, error: evidence.error || null, checks: evidence.checks?.length, minimumRelease: evidence.minimumRelease?.result || null, attestable: evidence.minimumRelease?.attestable || false, deployed: evidence.deployed || null }));
  if (!evidence.passed || result.status !== 0) process.exitCode = 1;
} catch (error) {
  console.error('CANVAS_REPORT_ERROR ' + String(error)); process.exitCode = 1;
}
// All existing source, guard and verification files remain unchanged; no tracked files are rewritten during validation.
