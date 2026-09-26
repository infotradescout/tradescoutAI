/** Read-only deployment contract for the canonical cart-hold ledger. */
export async function inspectJwCartHoldSchema(client) {
  const { rows } = await client.query(`SELECT
    to_regclass('public.jw_stone_cart_holds') IS NOT NULL AS holds,
    to_regclass('public.jw_stone_cart_hold_items') IS NOT NULL AS items,
    (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'
      AND (tgrelid=to_regclass('public.jw_stone_cart_holds') AND tgname='jw_stone_cart_hold_receipt_guard'
        OR tgrelid=to_regclass('public.jw_stone_cart_hold_items') AND tgname='jw_stone_cart_hold_item_guard')) AS guards,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND indexname IN
      ('jw_stone_cart_holds_one_active_buyer','jw_stone_cart_holds_expiration','jw_stone_cart_hold_items_position')) AS indexes,
    (SELECT count(*)::int FROM pg_constraint WHERE contype='f' AND conrelid IN
      (to_regclass('public.jw_stone_cart_holds'),to_regclass('public.jw_stone_cart_hold_items'))) AS foreign_keys,
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='jw_stone_cart_holds'
      AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%(seller_business_id, buyer_user_id, idempotency_key)%') AS retry_identity,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jw_stone_cart_holds'
      AND column_name='fulfillment' AND data_type='jsonb' AND is_nullable='NO') AS fulfillment`);
  const row = rows[0] || {};
  const missing = [];
  if (!row.holds || !row.items) missing.push('JW cart-hold tables');
  if (row.guards !== 2) missing.push('JW cart-hold immutable receipt guards');
  if (row.indexes !== 3 || !row.retry_identity) missing.push('JW cart-hold allocation/retry indexes');
  if (row.foreign_keys !== 7 || !row.fulfillment) missing.push('JW cart-hold ownership/fulfillment schema');
  return { contract: missing.length === 0, missing };
}
