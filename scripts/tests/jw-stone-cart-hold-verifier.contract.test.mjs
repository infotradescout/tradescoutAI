import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

