import assert from 'node:assert/strict';
import path from 'node:path';
import { expect } from '@playwright/test';

/** Actual routes, built client and disposable native database; no mocked successful responses. */
export async function proveJwStoneOfferJourney({ page, context, database, fixture, email, userId, device, output, rootPath, scope }) {
  const base = 'http://127.0.0.1:5228';
  const endpoint = '/api/tradepartner-profiles/jw-stone/express-request';
  const reviewPath = '/api/u/jw-stone/member-pricing/cart-review';
  assert.equal(fixture.base, base); assert.equal(rootPath, '/u/jw-stone');
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name, 'ts_jw_workflow_test');
  assert(['stone', 'cart'].includes(scope));
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); return device === 'touch' ? locator.tap() : locator.click(); };
  const countRequests = async () => (await database.query('SELECT count(*)::int AS n FROM work_requests WHERE created_by_user_id=$1', [userId])).rows[0].n;
  const positions = async () => (await database.query(`SELECT passport.public_id,position.quantity,position.held_quantity,position.version
    FROM stone_inventory_positions position JOIN stone_asset_passports passport ON passport.id=position.asset_passport_id
    WHERE position.holder_business_id=$1 ORDER BY passport.public_id`, [fixture.businessId])).rows;
  const beforePositions = await positions(); assert.equal(beforePositions.length, 2);
  for (const position of beforePositions) { assert.equal(Number(position.quantity), 20); assert.equal(Number(position.held_quantity), 0); }
  const transactionsBefore = (await database.query('SELECT count(*)::int AS n FROM marketplace_transactions')).rows[0].n;
  const beforeCount = await countRequests(); assert.equal(beforeCount, 0);
  const payload = { name: 'Synthetic Offer Customer', email, phone: '2025550147', requestType: 'make_offer',
    message: 'Synthetic local offer verification; not a real order.', stoneOffer: { scope: 'stone', selection: { lines: [{ inventoryPublicId: fixture.cartStockId, quantity: 1 }], fulfillment: { method: 'pickup' } }, offeredTotalCents: 480025, expectedSubtotalCents: 505050, termsAcknowledged: true } };
  const send = data => context.request.post(base + endpoint, { data });
  if (device === 'desktop' && scope === 'stone') {
    for (const [label, change, status] of [['stale total', { expectedSubtotalCents: 505049 }, 409], ['client payment authority', { paymentAllowed: true }, 400], ['missing terms', { termsAcknowledged: false }, 400], ['unavailable quantity', { selection: { ...payload.stoneOffer.selection, lines: [{ inventoryPublicId: fixture.cartStockId, quantity: 21 }] } }, 409]]) {
      const response = await send({ ...payload, stoneOffer: { ...payload.stoneOffer, ...change } });
      assert.equal(response.status(), status, label + ': ' + await response.text()); assert.equal(await countRequests(), beforeCount);
    }
  }
  await page.goto(base + rootPath + '/stones/honey-onyx', { waitUntil: 'domcontentloaded' });
  let listedTotal, offeredTotal, expectedLines;
  if (scope === 'stone') {
    await click(page.getByTestId('jw-stone-make-offer-detail'));
    await page.getByLabel('Offer stock selection', { exact: true }).selectOption(fixture.cartStockId);
    await page.getByLabel('Offer slab quantity', { exact: true }).fill('2');
    listedTotal = 1010100; offeredTotal = 900025;
    expectedLines = [{ inventoryPublicId: fixture.cartStockId, quantity: 2 }];
  } else {
    // Keep the multi-line cart offer below the seven-slab bundle threshold. Mixed-material
    // bundle eligibility is still an owner policy decision and must not be approved by a test.
    for (const [slug, material, stockId, quantity] of [['honey-onyx', 'Honey Onyx', fixture.cartStockId, 2], ['fantasy-brown', 'Fantasy Brown', fixture.otherStockId, 2]]) {
      await page.goto(base + rootPath + '/stones/' + slug, { waitUntil: 'domcontentloaded' });
      await click(page.getByTestId('jw-stone-add-to-cart-detail'));
      const cart = page.getByTestId('jw-stone-member-cart'); await cart.waitFor();
      await cart.getByRole('combobox', { name: 'Stock for ' + material, exact: true }).selectOption(stockId);
      await cart.getByLabel('Quantity for ' + material, { exact: true }).fill(String(quantity));
      await expect(cart.getByTestId('jw-cart-reviewed-subtotal')).toBeVisible();
      if (slug === 'honey-onyx') await click(cart.getByRole('button', { name: 'Close cart', exact: true }));
    }
    await expect(page.getByTestId('jw-cart-reviewed-subtotal')).toContainText('$18,101.00');
    await click(page.getByTestId('jw-cart-make-offer'));
    listedTotal = 1810100; offeredTotal = 1700000;
    expectedLines = [{ inventoryPublicId: fixture.cartStockId, quantity: 2 }, { inventoryPublicId: fixture.otherStockId, quantity: 2 }];
  }
  const dialog = page.getByRole('dialog'); await expect(dialog).toHaveCount(1);
  const money = cents => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  await expect(dialog.getByTestId('jw-offer-listed-total')).toHaveText(money(listedTotal));
  await dialog.getByLabel('Your total offer (USD)', { exact: true }).fill((offeredTotal / 100).toFixed(2));
  await dialog.getByLabel('Name', { exact: true }).fill(payload.name);
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.locator('input[name="phone"]').fill(payload.phone);
  await dialog.getByRole('combobox', { name: /^I am a/ }).selectOption('fabricator');
  await dialog.getByLabel('I understand offer and payment terms', { exact: true }).check();
  const savedCart = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.includes('member-cart:v2:'))?.[1] ?? null);
  const network = []; const observe = request => { if (request.method() === 'POST') network.push(new URL(request.url()).pathname); };
  page.on('request', observe);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === 'POST');
  await click(dialog.getByRole('button', { name: 'Submit offer', exact: true }));
  const response = await pending; const receipt = await response.json();
  assert.equal(response.status(), 201, JSON.stringify(receipt));
  await expect(dialog.getByRole('heading', { name: 'Offer submitted — pending review', exact: true })).toBeVisible();
  const submitted = response.request().postDataJSON();
  assert.deepEqual(submitted.stoneOffer.selection.lines, expectedLines);
  assert.equal(submitted.stoneOffer.expectedSubtotalCents, listedTotal); assert.equal(submitted.stoneOffer.offeredTotalCents, offeredTotal);
  assert.equal(receipt.offerStatus, 'pending_review'); assert.equal(receipt.paymentAllowed, false); assert.equal(receipt.inventoryReserved, false);
  assert.equal(await countRequests(), 1);
  const [work] = (await database.query('SELECT created_by_user_id,source_ref_id,visibility,description FROM work_requests WHERE id=$1', [receipt.requestId])).rows;
  assert(work); assert.equal(work.created_by_user_id, userId); assert.equal(work.source_ref_id, fixture.profileId); assert.equal(work.visibility, 'private');
  assert(work.description.includes(money(offeredTotal)), 'Stored request must include the actual proposed material total');
  const events = (await database.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='created'", [receipt.requestId])).rows;
  assert.equal(events.length, 1); const metadata = events[0].metadata; const offer = metadata.stoneOffer;
  assert.equal(offer.scope, scope); assert.equal(offer.status, 'pending_review'); assert.equal(offer.offeredTotalCents, offeredTotal); assert.equal(offer.listedSubtotalCents, listedTotal);
  assert.equal(offer.paymentAllowed, false); assert.equal(offer.inventoryReserved, false); assert.equal(offer.confirmedAt, null); assert.equal(offer.confirmedByUserId, null); assert.equal(offer.finalPayableTotalCents, null);
  assert(metadata.sourceDecisionCardId); assert(metadata.contactPermissionId);
  assert(!/landedCost|privateSourceId/.test(JSON.stringify(offer)), 'Private offer metadata must exclude internal source fields');
  const assignments = (await database.query('SELECT responder_user_id FROM work_request_assignments WHERE work_request_id=$1', [receipt.requestId])).rows;
  assert.deepEqual(assignments.map(row => row.responder_user_id), [fixture.ownerId]);
  const notices = (await database.query("SELECT user_id FROM notifications WHERE metadata->>'workRequestId'=$1 AND metadata->>'kind'='express_contact_authority_request'", [receipt.requestId])).rows;
  assert.deepEqual(notices.map(row => row.user_id), [fixture.ownerId]);
  const permissions = (await database.query('SELECT status FROM contact_permissions WHERE requester_id=$1 AND target_user_id=$2', [userId, fixture.ownerId])).rows;
  assert.equal(permissions.length, 1); assert.equal(permissions[0].status, 'pending');
  assert.deepEqual(await positions(), beforePositions, 'Submitting an offer must not allocate, decrement or change stock');
  assert.equal((await database.query('SELECT count(*)::int AS n FROM marketplace_transactions')).rows[0].n, transactionsBefore);
  assert.equal(await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.includes('member-cart:v2:'))?.[1] ?? null), savedCart);
  await expect(page.getByRole('button', { name: /pay now|checkout|place order/i })).toHaveCount(0);
  assert(!network.some(url => /stripe|checkout|payment_intents/i.test(url)));
  assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 2), false);
  await page.screenshot({ path: path.join(output, device + '-' + scope + '-native-offer-receipt.png') });
  await click(dialog.getByRole('button', { name: 'Close Direct Connect', exact: true }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await countRequests(), 1, 'Reload must not replay submission');
  const storedAgain = (await database.query("SELECT metadata->'stoneOffer' AS offer FROM work_request_events WHERE work_request_id=$1 AND type='created'", [receipt.requestId])).rows;
  assert.deepEqual(storedAgain[0].offer, offer, 'Persisted offer must remain unchanged after reload');
  assert.equal(network.filter(url => url === endpoint).length, 1);
  page.off('request', observe);
  return { scope, actualBrowserSubmission: true, actualDatabaseOffer: true, requestId: receipt.requestId,
    listedTotalCents: listedTotal, offeredTotalCents: offeredTotal, supplierAssigned: true, supplierInAppNotice: true,
    contactPermissionStillPending: true, reloadDidNotDuplicate: true, savedCartUnchanged: true, stockRowsUnchanged: true,
    paymentAllowed: false, inventoryReserved: false, marketplaceTransactionsAdded: 0, noPaymentNetworkCalls: true,
    mixedMaterialPolicyApproved: false, externalEmailDelivery: false };
}
