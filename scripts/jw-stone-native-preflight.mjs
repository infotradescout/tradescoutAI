import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const receiptPath = 'test-results/jw-offers-preflight.json';
function builtFingerprint(directory = 'dist') {
  const hash = createHash('sha256');
  function visit(dir) { for (const name of fs.readdirSync(dir).sort()) { const file = path.join(dir, name); const stat = fs.statSync(file); if (stat.isDirectory()) visit(file); else { hash.update(file); hash.update(fs.readFileSync(file)); } } }
  visit(directory); return hash.digest('hex');
}
export function saveNativeOfferPreflight(head, checks) {
  for (const name of ['Profile account customer-session isolation', 'Typecheck', 'Production client and server build', 'Install Chromium']) assert(checks.some(check => check.name === name && check.passed), name);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), head);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify({ head, fingerprint: builtFingerprint(), checks, capturedAt: new Date().toISOString() }, null, 2));
}
export function reuseNativeOfferPreflight(head) {
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const changed = execFileSync('git', ['diff', '--name-only', receipt.head, head], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const allowed = new Set(['scripts/jw-stone-offer.native.mjs', 'scripts/jw-stone-offer-journey.mjs', 'scripts/jw-stone-native-preflight.mjs', 'scripts/jw-stone-feature-journey.mjs']);
  assert(changed.every(file => allowed.has(file) || file.startsWith('.selective-intelligence/builds/')), 'Application, fixture, dependency or build configuration changes require fresh preflight');
  assert.equal(builtFingerprint(), receipt.fingerprint, 'Previously built assets were modified');
  return { fromHead: receipt.head, buildFingerprint: receipt.fingerprint, unchangedApplicationAndFixture: true, testOnlyChanges: changed, fullReleaseGateStillRequired: true };
}
