import assert from 'node:assert/strict';
import path from 'node:path';
import { expect } from '@playwright/test';

const base = 'http://127.0.0.1:5228';
const rootPath = '/u/jw-stone';
const holdPath = '/api/u/jw-stone/member-pricing/holds';

const clickFor = device => async locator => {
  await locator.scrollIntoViewIfNeeded();
  return device === 'touch' ? locator.tap() : locator.click();
};

async function positions(database, businessId) {
  return (
    await database.query(
      `SELECT passport.public_id, position.quantity, position.held_quantity, position.version
       FROM stone_inventory_positions position
       JOIN stone_asset_passports passport ON passport.id=position.asset_passport_id
       WHERE position.holder_business_id=$1
       ORDER BY passport.public_id`,
      [businessId]
    )
  ).rows;
}

function heldByPublicId(rows) {
  return Object.fromEntries(rows.map(row => [row.public_id, Number(row.held_quantity)]));
}

/**
 * Real built-client reservation acceptance on the disposable native database.
 * The caller must already have the verified two-line cart produced by the cart offer journey.
 * No fixture service creates or releases this hold.
 */
export async function proveJwStoneCartHoldJourney({
  page,
  database,
  fixture,
  userId,
  device,
  output,
}) {
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name, 'ts_jw_workflow_test');
  const click = clickFor(device);
  const beforePositions = await positions(database, fixture.businessId);
  const beforeHeld = heldByPublicId(beforePositions);
  assert.equal(beforeHeld[fixture.cartStockId], 0);
  assert.equal(beforeHeld[fixture.otherStockId], 0);

  const holdsBefore = (
    await database.query(
      'SELECT count(*)::int AS n FROM jw_stone_cart_holds WHERE seller_business_id=$1 AND buyer_user_id=$2',
      [fixture.businessId, userId]
    )
  ).rows[0].n;
  const workBefore = (
    await database.query(
      'SELECT count(*)::int AS n FROM work_requests WHERE created_by_user_id=$1',
      [userId]
    )
  ).rows[0].n;
  const transactionsBefore = (
    await database.query('SELECT count(*)::int AS n FROM marketplace_transactions')
  ).rows[0].n;

  const network = [];
  const observe = request => {
    const url = new URL(request.url());
    if (url.origin === base && request.method() === 'POST') network.push(url.pathname);
  };
  page.on('request', observe);

  try {
    await page.goto(base + rootPath, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('jw-stone-member-cart-button').waitFor();
    await click(page.getByTestId('jw-stone-member-cart-button'));

    const cart = page.getByTestId('jw-stone-member-cart');
    await cart.waitFor();
    await expect(cart.getByTestId('jw-cart-reviewed-subtotal')).toContainText('$28,680.00');
    const reserve = cart.getByTestId('jw-cart-reserve-stock');
    await expect(reserve).toBeEnabled();

    const reserveResponse = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === holdPath &&
        response.request().method() === 'POST'
    );
    await click(reserve);
    const response = await reserveResponse;
    const receipt = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(receipt));
    assert.equal(receipt.status, 'active');
    assert.equal(receipt.currency, 'USD');
    assert.equal(receipt.paymentStatus, 'not_started');
    assert.equal(receipt.readyForCheckout, false);
    assert.equal(receipt.materialSubtotalCents, 2868000);
    assert.equal(receipt.lines.reduce((sum, line) => sum + Number(line.quantity), 0), 7);
    assert.equal(receipt.deliveryFeeCents, null);
    assert.equal(receipt.estimatedDeliveryDate, null);

    await expect(page.getByTestId('jw-stone-member-cart')).toHaveCount(0);
    const panel = page.getByTestId('jw-owned-reservation-status');
    await panel.waitFor();
    await expect(panel).toContainText(receipt.reservationId);
    await expect(panel).toContainText('7 slabs');
    await expect(page.getByRole('button', { name: /pay now|checkout|place order/i })).toHaveCount(0);

    const [hold] = (
      await database.query(
        `SELECT public_id,buyer_user_id,seller_business_id,status,subtotal_cents,currency,origin,
                created_at,expires_at,released_at
         FROM jw_stone_cart_holds WHERE public_id=$1`,
        [receipt.reservationId]
      )
    ).rows;
    assert(hold);
    assert.equal(hold.buyer_user_id, userId);
    assert.equal(hold.seller_business_id, fixture.businessId);
    assert.equal(hold.status, 'active');
    assert.equal(Number(hold.subtotal_cents), 2868000);
    assert.equal(hold.currency, 'USD');
    assert.equal(hold.origin, 'jw_stone_member_cart');
    assert.equal(hold.released_at, null);
    assert(new Date(hold.expires_at).getTime() > new Date(hold.created_at).getTime());
    assert(new Date(hold.expires_at).getTime() - new Date(hold.created_at).getTime() <= 30 * 60 * 1000);

    const items = (
      await database.query(
        `SELECT inventory_public_id,quantity,line_total_cents,pricing_tier
         FROM jw_stone_cart_hold_items
         WHERE hold_id=(SELECT id FROM jw_stone_cart_holds WHERE public_id=$1)
         ORDER BY inventory_public_id`,
        [receipt.reservationId]
      )
    ).rows;
    assert.deepEqual(
      items.map(row => [row.inventory_public_id, Number(row.quantity)]).sort(),
      [[fixture.cartStockId, 4], [fixture.otherStockId, 3]].sort()
    );

    const reservedPositions = heldByPublicId(await positions(database, fixture.businessId));
    assert.equal(reservedPositions[fixture.cartStockId], 4);
    assert.equal(reservedPositions[fixture.otherStockId], 3);
    assert.equal(
      (await database.query('SELECT count(*)::int AS n FROM marketplace_transactions')).rows[0].n,
      transactionsBefore
    );
    assert.equal(
      (
        await database.query(
          'SELECT count(*)::int AS n FROM work_requests WHERE created_by_user_id=$1',
          [userId]
        )
      ).rows[0].n,
      workBefore
    );

    await page.screenshot({
      path: path.join(output, device + '-customer-reservation-active.png'),
      fullPage: false,
    });

    // Reload must recover the same immutable hold instead of creating another reservation.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('jw-owned-reservation-status').waitFor();
    await expect(page.getByTestId('jw-owned-reservation-status')).toContainText(receipt.reservationId);
    assert.equal(
      (
        await database.query(
          'SELECT count(*)::int AS n FROM jw_stone_cart_holds WHERE seller_business_id=$1 AND buyer_user_id=$2',
          [fixture.businessId, userId]
        )
      ).rows[0].n,
      holdsBefore + 1
    );

    await click(page.getByTestId('jw-stone-member-cart-button'));
    const reopened = page.getByTestId('jw-stone-member-cart');
    await reopened.waitFor();
    await expect(reopened.getByTestId('jw-cart-active-reservation-block')).toContainText(
      'already have an active JW Stone reservation'
    );
    const blockedReserve = reopened.getByTestId('jw-cart-reserve-stock');
    await expect(blockedReserve).toBeDisabled();
    await expect(blockedReserve).toContainText('Active reservation already exists');
    await click(reopened.getByRole('button', { name: 'Close cart', exact: true }));

    // Release is a separate explicit confirmation. It returns stock but never creates payment/order state.
    const releaseResponse = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === holdPath + '/' + receipt.reservationId + '/release' &&
        response.request().method() === 'POST'
    );
    await click(page.getByTestId('jw-release-reservation'));
    await expect(page.getByText('Release these slabs back to available stock now?', { exact: true })).toBeVisible();
    await click(page.getByRole('button', { name: 'Confirm release', exact: true }));
    const releasedResponse = await releaseResponse;
    const released = await releasedResponse.json();
    assert.equal(releasedResponse.status(), 200, JSON.stringify(released));
    assert.deepEqual(released, { reservationId: receipt.reservationId, status: 'released' });
    await expect(page.getByTestId('jw-owned-reservation-status')).toHaveCount(0);

    const [terminal] = (
      await database.query(
        'SELECT status,released_at FROM jw_stone_cart_holds WHERE public_id=$1',
        [receipt.reservationId]
      )
    ).rows;
    assert.equal(terminal.status, 'released');
    assert(terminal.released_at);

    const afterPositions = heldByPublicId(await positions(database, fixture.businessId));
    assert.equal(afterPositions[fixture.cartStockId], 0);
    assert.equal(afterPositions[fixture.otherStockId], 0);
    assert.equal(
      (await database.query('SELECT count(*)::int AS n FROM marketplace_transactions')).rows[0].n,
      transactionsBefore
    );
    assert.equal(
      (
        await database.query(
          'SELECT count(*)::int AS n FROM work_requests WHERE created_by_user_id=$1',
          [userId]
        )
      ).rows[0].n,
      workBefore
    );

    assert.equal(network.filter(url => url === holdPath).length, 1);
    assert.equal(
      network.filter(url => url === holdPath + '/' + receipt.reservationId + '/release').length,
      1
    );
    assert(!network.some(url => /stripe|checkout|payment_intents|marketplace\/transactions/i.test(url)));

    await page.screenshot({
      path: path.join(output, device + '-customer-reservation-released.png'),
      fullPage: false,
    });

    return {
      actualBrowserReserve: true,
      actualDatabaseHold: true,
      actualBrowserReloadRecovery: true,
      duplicateReserveBlocked: true,
      actualBrowserRelease: true,
      stockReturnedAfterRelease: true,
      reservationId: receipt.reservationId,
      slabs: 7,
      subtotalCents: receipt.materialSubtotalCents,
      paymentStarted: false,
      marketplaceTransactionsAdded: 0,
      workRequestsAdded: 0,
    };
  } finally {
    page.off('request', observe);
  }
}
