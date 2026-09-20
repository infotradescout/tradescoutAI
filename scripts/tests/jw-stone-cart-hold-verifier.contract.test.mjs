import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
const wrapper = read('scripts/verify-jw-stone-cart-hold-actions.mjs');
const driver = read('scripts/jw-stone-offer.native.mjs');
const offerJourney = read('scripts/jw-stone-offer-journey.mjs');
const holdJourney = read('scripts/jw-stone-cart-hold-journey.mjs');

test('customer reservation verifier starts from a detached clean exact-head clone', () => {
  assert.equal(
    pkg.scripts['verify:jw-stone:cart-holds'],
    'node scripts/verify-jw-stone-cart-hold-actions.mjs'
  );
  for (const token of [
    "git', ['rev-parse', 'HEAD']",
    "'status', '--porcelain'",
    "'clone', '--no-hardlinks', '--no-checkout'",
    "'checkout', '--detach', head",
    "'npm', ['ci', '--include=dev']",
  ]) {
    assert(wrapper.includes(token), 'Missing exact-source verifier boundary: ' + token);
  }
});

test('customer reservation verifier requires the complete desktop/touch and backend proof receipts', () => {
  for (const token of [
    "'--feature-control'",
    "'--owned-hold-status'",
    "'--cart-hold-actions'",
    "'jw-cart-hold-actions'",
    "'jw-cart-holds'",
    "assert.equal(receipt.head, head)",
    "assert.deepEqual([...receipt.customerReservationDevices].sort(), ['desktop', 'touch'])",
    "assert.equal(receipt.backendCartHoldProof?.head, head)",
    "assert.equal(backendReceipt.head, head)",
    "assert.equal(backendReceipt.productionWrites, false)",
    "reservationBundleScope === 'single_material'",
    "mixedMaterialBundlePolicyAsserted === false",
    "'exact-source.json'",
    "nativeExitCode",
    "verificationExitCode",
    "failure",
    "'final-evidence-copy'",
  ]) {
    assert(wrapper.includes(token), 'Missing exact receipt requirement: ' + token);
  }
});

test('integrated driver reuses the native ledger expiry proof and does not claim release approval', () => {
  for (const token of [
    "'scripts/verify-jw-cart-holds.mjs', '--exact-copy'",
    "assert.equal(report.backendCartHoldProof.head, head)",
    "assert.equal(report.backendCartHoldProof.releaseApproved, false)",
    "assert.equal(report.backendCartHoldProof.productionWrites, false)",
    "['desktop', 'touch']",
    'report.customerReservationActionsProved = true',
  ]) {
    assert(driver.includes(token), 'Missing integrated proof requirement: ' + token);
  }
});

test('reservation acceptance does not approve unresolved mixed-material bundle eligibility', () => {
  assert(offerJourney.includes("['honey-onyx', 'Honey Onyx', fixture.cartStockId, 2]"));
  assert(offerJourney.includes("['fantasy-brown', 'Fantasy Brown', fixture.otherStockId, 2]"));
  assert(offerJourney.includes("$18,101.00"));
  assert(!offerJourney.includes("$28,680.00"));

  assert(holdJourney.includes("getByLabel('Quantity for Honey Onyx', { exact: true }).fill('7')"));
  assert(holdJourney.includes("Remove Fantasy Brown from cart"));
  assert(holdJourney.includes("$31,815.00"));
  assert(holdJourney.includes("assert.equal(receipt.lines.length, 1)"));
  assert(holdJourney.includes("assert.equal(receipt.lines[0].pricingTier, 'bundle')"));
});

function commandRunner() {
  // Execute the exact committed helper without starting the driver's database/browser.
  const start = driver.indexOf('function run(');
  const end = driver.indexOf('\nasync function stop(', start);
  assert(start >= 0 && end > start, 'Native command runner source was not located');
  const notes = [], logs = [];
  const run = new Function(
    'spawnSync', 'process', 'console', 'assert', 'note',
    driver.slice(start, end) + '\nreturn run;'
  )(spawnSync, process, { log: text => logs.push(text) }, assert, name => notes.push(name));
  return { run, notes, logs };
}

test('native command runner returns sanitized child output for backend receipt parsing', () => {
  const { run, notes, logs } = commandRunner();
  const output = run('fixture output', [
    process.execPath, '-e',
    "process.stdout.write('JW_HOLD_PROOF_SUMMARY {\"passed\":true}\\n');" +
      "process.stderr.write('postgresql://fixture:fake@127.0.0.1/test');",
  ]);
  assert.equal(output, 'JW_HOLD_PROOF_SUMMARY {"passed":true}\n[LOCAL_TEST_DATABASE]');
  const summary = output.split('\n').find(line => line.startsWith('JW_HOLD_PROOF_SUMMARY '));
  assert.deepEqual(JSON.parse(summary.slice('JW_HOLD_PROOF_SUMMARY '.length)), { passed: true });
  assert.deepEqual(notes, ['fixture output']);
  assert.deepEqual(logs, [output]);
});

test('native command runner rejects failed children rather than recording a passed stage', () => {
  const { run, notes } = commandRunner();
  assert.throws(
    () => run('failed fixture', [process.execPath, '-e', 'process.exit(3)']),
    /failed fixture/
  );
  assert.deepEqual(notes, []);
});
