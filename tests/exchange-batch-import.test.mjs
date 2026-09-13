import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExchangeCsv, prepareExchangeBatch, exchangeCsvCell, EXCHANGE_BATCH_LIMITS } from '../shared/exchangeBatchImport.ts';
import { runExchangeBatch } from '../shared/exchangeBatchRunner.ts';
const categories = [{ id: 'tools-id', name: 'Tools & Hardware' }];
const header = 'listing_id,title,description,price,category,condition,city,state,zip_code,county,images';
const fields = { listing_id: 'ITEM1', title: 'Cordless drill', description: 'Cordless drill with battery and charger.', price: '125.00', category: 'Tools & Hardware', condition: 'good', city: 'Baton Rouge', state: 'LA', zip_code: '70801', county: 'East Baton Rouge', images: '' };
const encode = value => `"${String(value).replaceAll('"', '""')}"`;
const csv = (rows = [{}], extra = []) => [header + (extra.length ? ',' + extra.join(',') : ''), ...rows.map(row => [...header.split(','), ...extra].map(key => encode(({ ...fields, ...row })[key] ?? '')).join(','))].join('\r\n');
const photo = (name, extra = {}) => ({ name, size: 1024, type: 'image/jpeg', ...extra });
const prepare = (rows = [{}], photos = [photo('ITEM1_01.jpg')], extra = []) => prepareExchangeBatch(csv(rows, extra), photos, categories);
const hasRowError = (preview, text) => preview.rows.some(row => row.errors.some(error => error.includes(text)));

test('quoted CSV preserves commas, escaped quotes, BOM, CRLF and multiline row numbers', () => {
  assert.deepEqual(parseExchangeCsv('\uFEFFa,b\r\n"one, two","line1\r\nline2 ""quoted"""\r\nlast,value'), [
    { line: 1, cells: ['a', 'b'] }, { line: 2, cells: ['one, two', 'line1\nline2 "quoted"'] }, { line: 4, cells: ['last', 'value'] },
  ]);
});
test('malformed quoting fails instead of guessing', () => {
  for (const value of ['a,b\n"unterminated', 'a,b\n"value"junk,x', 'a,b\none"two,x']) assert.throws(() => parseExchangeCsv(value));
});
test('empty CSV, unknown columns, missing columns and duplicate headers block import', () => {
  for (const value of ['', 'title\nSome item', csv().replace('listing_id,', 'seller_id,'), csv().replace('listing_id,', 'title,')]) assert.ok(prepareExchangeBatch(value, [], categories).errors.length);
});
test('missing categories block import', () => assert.ok(prepareExchangeBatch(csv(), [], []).errors.length));
test('short and oversized rows, and CSV size cap, are enforced', () => {
  assert.ok(hasRowError(prepareExchangeBatch(csv() + ',oops', [photo('ITEM1_1.jpg')], categories), 'columns'));
  assert.throws(() => parseExchangeCsv('x'.repeat(EXCHANGE_BATCH_LIMITS.csvBytes + 1)), /1 MB/);
  assert.ok(prepareExchangeBatch(csv(Array.from({ length: 101 }, (_, n) => ({ listing_id: `I${n}` }))), [], categories).errors.length);
});
test('matches anchored IDs and sorts numeric photo order', () => {
  const p = prepare([{}, { listing_id: 'ITEM10' }], [photo('ITEM1_10.jpg'), photo('ITEM10_1.jpg'), photo('ITEM1_2.jpg'), photo('ITEM1_01.jpg')]);
  assert.deepEqual(p.rows.map(row => row.photoIndexes), [[3, 2, 0], [1]]);
  assert.deepEqual(p.rows.map(row => row.errors), [[], []]);
});
test('case-insensitive IDs, hyphens and underscore IDs work', () => {
  const p = prepare([{ listing_id: 'CAB_A-10' }], [photo('cab_a-10-02.jpg'), photo('CAB_A-10_01.jpg')]);
  assert.deepEqual(p.rows[0].photoIndexes, [1, 0]);
  assert.deepEqual(p.rows[0].errors, []);
});
test('duplicate listing IDs mark every conflicting row', () => {
  const p = prepare([{}, { listing_id: 'item1' }]);
  assert.ok(p.rows.every(row => row.errors.some(error => error.includes('Duplicate listing_id'))));
});
test('duplicate photo sequence and too many images are not silently truncated', () => {
  assert.ok(hasRowError(prepare([{}], [photo('ITEM1_1.jpg'), photo('ITEM1_01.png', { type: 'image/png' })]), 'sequence'));
  assert.ok(hasRowError(prepare([{}], Array.from({ length: 9 }, (_, n) => photo(`ITEM1_${n + 1}.jpg`))), 'at most 8'));
});
test('explicit image list preserves order and reports missing or repeated names', () => {
  const photos = [photo('front.jpg'), photo('back.jpg')];
  assert.deepEqual(prepare([{ images: 'back.jpg|front.jpg' }], photos).rows[0].photoIndexes, [1, 0]);
  assert.ok(hasRowError(prepare([{ images: 'missing.jpg' }], photos), 'missing'));
  assert.ok(hasRowError(prepare([{ images: 'front.jpg|front.jpg' }], photos), 'more than once'));
});
test('same filename in different folders is ambiguous unless explicitly qualified', () => {
  const photos = [photo('front.jpg'), photo('front.jpg', { webkitRelativePath: 'B/front.jpg' })];
  assert.ok(hasRowError(prepare([{ images: 'front.jpg' }], photos), 'ambiguous'));
  assert.deepEqual(prepare([{ images: 'B/front.jpg' }], photos).rows[0].photoIndexes, [1]);
});
test('unused photos are visible and zero-photo rows fail', () => {
  assert.deepEqual(prepare([{}], [photo('ITEM1_1.jpg'), photo('other.jpg')]).unusedPhotos, ['other.jpg']);
  assert.ok(hasRowError(prepare([{}], []), 'at least one'));
});
test('unsafe file types, empty files and oversized files fail', () => {
  for (const p of [photo('x.svg', { type: 'image/svg+xml' }), photo('x.jpg', { size: 0 }), photo('x.jpg', { size: EXCHANGE_BATCH_LIMITS.imageBytes + 1 }), photo('x.jpg', { type: 'text/html' })]) assert.ok(prepare([{ images: p.name }], [p]).rows[0].errors.length);
});
test('total file count and total bytes have hard limits', () => {
  assert.ok(prepare([{}], Array.from({ length: 801 }, () => photo('x.jpg'))).errors.length);
  assert.ok(prepare([{}], [photo('ITEM1_1.jpg', { size: EXCHANGE_BATCH_LIMITS.totalImageBytes + 1 })]).errors.length);
});
test('amounts reject NaN, negative values, currency symbols and precision loss', () => {
  for (const price of ['NaN', '-1', '$100', '1,000', '1.001', 'Infinity', '1e3', '']) assert.ok(hasRowError(prepare([{ price }]), 'Price'));
  assert.deepEqual(prepare([{ price: '0' }]).rows[0].errors, []);
});
test('location and category are validated without inventing missing information', () => {
  for (const row of [{ state: 'ZZ' }, { zip_code: '123' }, { county: 'Unknown' }, { category: 'Not a category' }]) assert.ok(prepare([row]).rows[0].errors.length);
  assert.equal(prepare([{ zip_code: '01234' }]).rows[0].payload.zipCode, '01234');
  assert.equal(prepare([{}]).rows[0].payload.locationVisibility, 'meetup_only');
});
test('shipping and trade fields map to the normal listing payload', () => {
  const p = prepare([{ price_type: 'trade', will_ship: 'true', shipping_cost: '15.50' }], undefined, ['price_type', 'will_ship', 'shipping_cost']);
  assert.deepEqual(p.rows[0].errors, []);
  assert.equal(p.rows[0].payload.priceType, 'best_offer');
  assert.equal(p.rows[0].payload.specifications.tradeAccepted, true);
  assert.equal(p.rows[0].payload.isLocalPickupOnly, false);
  assert.equal(p.rows[0].payload.shippingQuote.estimatedCost, 15.5);
  assert.ok(hasRowError(prepare([{ will_ship: 'true' }], undefined, ['will_ship']), 'shipping_cost'));
});
test('error reports neutralize spreadsheet formulas', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-2+3', '@x', '  =x', '\tx']) assert.ok(exchangeCsvCell(value).startsWith('"\''));
  assert.equal(exchangeCsvCell('a,"b"'), '"a,""b"""');
});

function runner(overrides = {}) {
  const receipts = new Map(), submitted = [], results = [];
  const options = {
    rows: prepare([{}, { listing_id: 'ITEM2' }], [photo('ITEM1_1.jpg'), photo('ITEM2_1.jpg')]).rows,
    readReceipt: key => receipts.get(key), writeReceipt: (key, value) => receipts.set(key, value),
    uploadPhoto: async index => `/uploads/${index}.jpg`,
    createListing: async payload => { submitted.push(payload); return { id: `listing-${submitted.length}` }; },
    shouldStop: () => false, onResult: result => results.push(result), ...overrides,
  };
  return { receipts, submitted, results, options };
}
test('one run creates multiple listings with matched photos through the supplied API', async () => {
  const r = runner(); await runExchangeBatch(r.options);
  assert.equal(r.submitted.length, 2);
  assert.deepEqual(r.submitted.map(payload => payload.images), [['/uploads/0.jpg'], ['/uploads/1.jpg']]);
  assert.ok(r.results.every(result => result.status === 'submitted'));
});
test('receipts prevent same-browser successful rows from being submitted again', async () => {
  const r = runner(); await runExchangeBatch(r.options); await runExchangeBatch(r.options);
  assert.equal(r.submitted.length, 2);
  assert.equal(r.results.filter(result => result.status === 'skipped').length, 2);
});
test('upload failure never submits a partially photographed listing', async () => {
  const r = runner({ uploadPhoto: async () => { throw new Error('Upload failed'); } });
  await runExchangeBatch(r.options);
  assert.equal(r.submitted.length, 0); assert.equal(r.receipts.size, 0);
  assert.equal(r.results[0].status, 'upload_failed');
});
test('ambiguous creation failure pauses and is never automatically retried', async () => {
  let calls = 0;
  const r = runner({ createListing: async () => { calls++; throw new Error('Lost response'); } });
  await runExchangeBatch(r.options); await runExchangeBatch(r.options);
  assert.equal(calls, 1); assert.equal(r.receipts.get('ITEM1').status, 'submitting');
  assert.ok(r.results.every(result => result.status === 'needs_check'));
});
test('verification-like 200 responses without listing IDs are not success', async () => {
  const r = runner({ createListing: async () => ({ verificationRequired: true }) });
  await runExchangeBatch(r.options);
  assert.equal(r.results[0].status, 'needs_check');
});
test('storage failure prevents sending a creation request', async () => {
  const r = runner({ writeReceipt: () => { throw new Error('Storage unavailable'); } });
  await assert.rejects(() => runExchangeBatch(r.options), /Storage unavailable/);
  assert.equal(r.submitted.length, 0);
});
test('invalid rows and a paused run do not create listings', async () => {
  const bad = runner({ rows: prepare([{ price: 'invalid' }]).rows });
  await assert.rejects(() => runExchangeBatch(bad.options), /Fix all row errors/);
  const paused = runner({ shouldStop: () => true }); await runExchangeBatch(paused.options);
  assert.equal(paused.submitted.length, 0);
});
test('a pause during photo uploads prevents that row from being submitted', async () => {
  let pause = false;
  const r = runner({ uploadPhoto: async () => { pause = true; return '/image.jpg'; }, shouldStop: () => pause });
  await runExchangeBatch(r.options); assert.equal(r.submitted.length, 0); assert.equal(r.receipts.size, 0);
});
