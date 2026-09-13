import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalImportJson, fingerprintImportRow, indexOwnImports, normalizeImportKey, runRecoverableExchangeBatch, sha256ImportBytes } from '../shared/exchangeBatchRecovery.ts';
import { prepareDetailedExchangeBatch } from '../shared/exchangeBatchDetails.ts';

const row = (key = 'ITEM1', photoIndexes = [0, 1]) => ({ key, line: 2, title: 'Contractor drill bundle', errors: [], photoIndexes, payload: { title: 'Contractor drill bundle', price: '125.00', description: 'Complete tool set with batteries.', categoryId: 'tools', city: 'Baton Rouge', state: 'LA', specifications: { externalListingId: key } } });
const hash = async index => sha256ImportBytes(new TextEncoder().encode(`image ${index}`).buffer);
const fingerprint = async r => fingerprintImportRow(r, await Promise.all(r.photoIndexes.map(hash)));
const saved = async (r, overrides = {}) => ({ ...r.payload, id: `listing-${r.key}`, sellerId: 'seller-a', specifications: { ...r.payload.specifications, exchangeBatchFingerprint: await fingerprint(r) }, ...overrides });
function setup(overrides = {}) {
  const records = [], results = [], calls = [], progress = [];
  const options = {
    rows: [row(), row('ITEM2', [2, 3])], sellerId: 'seller-a',
    loadOwnListings: async () => { calls.push('read'); return [...records]; },
    hashPhoto: async index => { calls.push(`hash:${index}`); return hash(index); },
    uploadPhoto: async index => { calls.push(`upload:${index}`); return `/uploads/${index}.jpg`; },
    createListing: async payload => {
      calls.push('create');
      const value = { ...payload, id: `listing-${records.length + 1}`, sellerId: 'seller-a' };
      records.push(value); return value;
    },
    shouldStop: () => false, onResult: result => results.push(result), onProgress: value => progress.push(value),
    ...overrides,
  };
  return { records, results, calls, progress, options };
}

test('stable digest ignores key order and import ID casing', async () => {
  const left = row(), right = row('item1');
  right.payload = Object.fromEntries(Object.entries(right.payload).reverse());
  assert.equal(await fingerprint(left), await fingerprint(right));
  assert.equal(canonicalImportJson({ z: undefined, b: 2, a: [1, true] }), '{"a":[1,true],"b":2}');
});
test('price changes, image content changes and image order changes have different fingerprints', async () => {
  const original = row(), changed = row(); changed.payload.price = '126.00';
  assert.notEqual(await fingerprint(original), await fingerprint(changed));
  assert.notEqual(await fingerprint(original), await fingerprint(row('ITEM1', [1, 0])));
  assert.notEqual(await fingerprint(original), await fingerprint(row('ITEM1', [0, 5])));
});
test('file byte digest is SHA-256 and invalid photo proofs are rejected', async () => {
  assert.equal(await sha256ImportBytes(new TextEncoder().encode('abc').buffer), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await assert.rejects(() => fingerprintImportRow(row(), ['bad', 'bad']), /Every photo/);
  await assert.rejects(() => fingerprintImportRow(row(), []), /Every photo/);
  assert.throws(() => canonicalImportJson({ x: Infinity }), /cannot be imported/);
});
test('import keys reject unsafe characters and normalize matching', () => {
  assert.equal(normalizeImportKey(' Cab_A-1 '), 'cab_a-1');
  for (const key of ['', '../x', 'a.b', 'a b', 'x'.repeat(81), null]) assert.throws(() => normalizeImportKey(key));
});
test('existing listing responses must be arrays owned by the current seller', async () => {
  const r = await saved(row());
  assert.throws(() => indexOwnImports({ listings: [r] }, 'seller-a'));
  assert.throws(() => indexOwnImports([r], 'seller-b'));
  assert.throws(() => indexOwnImports([{ ...r, id: '' }], 'seller-a'));
  assert.throws(() => indexOwnImports([r, { ...r, id: 'another' }], 'seller-a'), /More than one/);
  assert.equal(indexOwnImports([r], 'seller-a').get('item1').id, r.id);
});
test('normal non-imported listings and unrelated legacy identifiers are ignored', () => {
  const r = { id: 'ordinary', sellerId: 'seller-a' };
  assert.equal(indexOwnImports([r, { ...r, id: 'legacy', specifications: { externalListingId: 'old.source/id' } }], 'seller-a').size, 0);
});
test('one run uploads multiple photos to each separate listing in order', async () => {
  const s = setup(); await runRecoverableExchangeBatch(s.options);
  assert.equal(s.records.length, 2);
  assert.deepEqual(s.records.map(record => record.images), [['/uploads/0.jpg', '/uploads/1.jpg'], ['/uploads/2.jpg', '/uploads/3.jpg']]);
  assert.ok(s.results.every(result => result.status === 'submitted'));
  assert.equal(s.calls.filter(call => call.startsWith('hash')).length, 4);
  assert.ok(s.calls.indexOf('hash:3') < s.calls.indexOf('upload:0'));
});
test('fresh browser skips server-confirmed imports without uploading photos again', async () => {
  const s = setup(); s.records.push(await saved(row())); await runRecoverableExchangeBatch(s.options);
  assert.deepEqual(s.results.map(result => result.status), ['skipped', 'submitted']);
  assert.ok(!s.calls.includes('upload:0'));
  assert.equal(s.records.length, 2);
});
test('reselecting a successful batch creates no duplicates and uses no localStorage', async () => {
  const s = setup(); await runRecoverableExchangeBatch(s.options); await runRecoverableExchangeBatch(s.options);
  assert.equal(s.records.length, 2); assert.equal(s.results.filter(result => result.status === 'skipped').length, 2);
});
test('a conflicting later row blocks every new upload in the batch', async () => {
  const s = setup(); const r = row('ITEM2', [2, 3]); r.payload.price = '999.00'; s.records.push(await saved(r));
  await runRecoverableExchangeBatch(s.options);
  assert.equal(s.results[0].status, 'conflict'); assert.ok(!s.calls.some(call => call.startsWith('upload') || call === 'create'));
});
test('legacy imported rows without fingerprints are not blindly recreated or overwritten', async () => {
  const s = setup(); s.records.push(await saved(row(), { specifications: { externalListingId: 'ITEM1' } }));
  await runRecoverableExchangeBatch(s.options); assert.equal(s.results[0].status, 'conflict'); assert.ok(!s.calls.includes('create'));
});
test('lost successful POST response is reconciled from server records and processing continues', async () => {
  const s = setup(); const create = s.options.createListing; let lost = false;
  s.options.createListing = async payload => { const value = await create(payload); if (!lost) { lost = true; throw new Error('Lost response'); } return value; };
  await runRecoverableExchangeBatch(s.options);
  assert.equal(s.records.length, 2); assert.deepEqual(s.results.map(result => result.status), ['recovered', 'submitted']);
  assert.equal(s.calls.filter(call => call === 'create').length, 2);
});
test('a database duplicate rejection is recovered only when the saved fingerprint matches', async () => {
  const s = setup({ rows: [row()] });
  s.options.createListing = async payload => { s.records.push({ ...payload, id: 'concurrent', sellerId: 'seller-a' }); throw new Error('Duplicate import key'); };
  await runRecoverableExchangeBatch(s.options); assert.equal(s.results[0].status, 'recovered'); assert.equal(s.records.length, 1);
});
test('competing changed content is reported as conflict after a rejected creation', async () => {
  const s = setup({ rows: [row()] });
  s.options.createListing = async () => { const r = row(); r.payload.price = '7'; s.records.push(await saved(r)); throw new Error('Duplicate import key'); };
  await runRecoverableExchangeBatch(s.options); assert.equal(s.results[0].status, 'conflict');
});
test('unconfirmed failures stop without blind retry', async () => {
  let writes = 0; const s = setup({ createListing: async () => { writes++; throw new Error('Network failure'); } });
  await runRecoverableExchangeBatch(s.options); assert.equal(writes, 1); assert.equal(s.results[0].status, 'needs_check');
});
test('verification-like 200 responses without listing records are not successful', async () => {
  const s = setup({ createListing: async () => ({ verificationRequired: true }) });
  await runRecoverableExchangeBatch(s.options); assert.equal(s.results[0].status, 'needs_check');
});
test('ownership mismatch in create response is not recorded as success', async () => {
  const s = setup({ createListing: async payload => ({ ...payload, id: 'wrong', sellerId: 'seller-b' }) });
  await runRecoverableExchangeBatch(s.options); assert.equal(s.results[0].status, 'needs_check');
});
test('initial record lookup failure happens before all uploads and creation', async () => {
  const s = setup({ loadOwnListings: async () => { throw new Error('Offline'); } });
  await assert.rejects(() => runRecoverableExchangeBatch(s.options), /Offline/); assert.equal(s.calls.length, 0);
});
test('failed recovery lookup does not permit another POST', async () => {
  let reads = 0, writes = 0;
  const s = setup({ loadOwnListings: async () => { if (++reads > 1) throw new Error('Offline'); return []; }, createListing: async () => { writes++; throw new Error('Timeout'); } });
  await runRecoverableExchangeBatch(s.options); assert.equal(writes, 1); assert.equal(s.results[0].status, 'needs_check');
});
test('photo upload failure cannot submit a partially photographed listing', async () => {
  const s = setup({ uploadPhoto: async index => { if (index === 1) throw new Error('Upload failed'); return '/file.jpg'; } });
  await runRecoverableExchangeBatch(s.options); assert.equal(s.records.length, 0); assert.equal(s.results[0].status, 'upload_failed');
});
test('pause during hashing happens before any upload', async () => {
  let paused = false; const s = setup({ hashPhoto: async index => { paused = true; return hash(index); }, shouldStop: () => paused });
  await runRecoverableExchangeBatch(s.options); assert.ok(!s.calls.includes('create')); assert.equal(s.records.length, 0);
});
test('pause during photo upload prevents that row being submitted', async () => {
  let paused = false; const s = setup({ uploadPhoto: async () => { paused = true; return '/image.jpg'; }, shouldStop: () => paused });
  await runRecoverableExchangeBatch(s.options); assert.equal(s.records.length, 0);
});
test('duplicate keys, invalid rows and oversized batches fail before reads', async () => {
  for (const rows of [[row(), row('item1')], [{ ...row(), errors: ['Bad price'] }], [], Array.from({ length: 101 }, (_, i) => row(`I${i}`))]) {
    const s = setup({ rows }); await assert.rejects(() => runRecoverableExchangeBatch(s.options)); assert.equal(s.calls.length, 0);
  }
});
test('shared photos are hashed and uploaded once per run while preserving each listing order', async () => {
  const s = setup({ rows: [row(), row('ITEM2', [1, 0])] }); await runRecoverableExchangeBatch(s.options);
  assert.equal(s.calls.filter(call => call.startsWith('hash')).length, 2);
  assert.equal(s.calls.filter(call => call.startsWith('upload')).length, 2);
  assert.deepEqual(s.records[1].images, ['/uploads/1.jpg', '/uploads/0.jpg']);
});

// Inject the canonical parser and category validator in production; these tests
// exercise the detail adapter's own logic without duplicating category policy.
function detailPreview(columns, values, overrides = {}) {
  let validationInput;
  const dependencies = {
    parseCsv: () => [{ line: 1, cells: columns }, { line: 6, cells: values }],
    prepare: () => ({ rows: [row()], errors: [], unusedPhotos: [] }),
    categorySlug: () => 'tools',
    validate: input => { validationInput = input; return null; }, ...overrides,
  };
  const result = prepareDetailedExchangeBatch('csv', [], [{ id: 'tools', name: 'Tools & Hardware' }], dependencies);
  return { result, input: validationInput };
}
test('spec_* columns map to canonical camelCase keys and preserve real CSV line numbers', () => {
  const { result, input } = detailPreview(['listing_id', 'spec_delivery_option', 'spec_powers_on'], ['ITEM1', 'pickup', 'yes']);
  assert.equal(result.rows[0].line, 6); assert.equal(input.specs.deliveryOption, 'pickup'); assert.equal(input.specs.powersOn, 'yes');
});
test('flat JSON specifications support numeric quantities without inventing details', () => {
  const { input } = detailPreview(['listing_id', 'specifications'], ['ITEM1', '{"quantityUnits":4,"material":"wood"}']);
  assert.equal(input.specs.quantityUnits, 4); assert.equal(input.specs.material, 'wood');
});
test('category rule failures are displayed before uploads', () => {
  const { result } = detailPreview(['listing_id'], ['ITEM1'], { validate: () => ({ message: 'This category requires more photos.' }) });
  assert.ok(result.rows[0].errors.includes('This category requires more photos.'));
});
test('reserved specification keys and prototype keys are rejected', () => {
  for (const text of ['{"externalListingId":"fake"}', '{"__proto__":"pollute"}', '{"sellerId":"someone"}', '{"exchangeBatchFingerprint":"fake"}']) {
    const { result } = detailPreview(['listing_id', 'specifications'], ['ITEM1', text]); assert.ok(result.rows[0].errors.length);
  }
});
test('JSON objects, array values and duplicate specification keys fail clearly', () => {
  for (const text of ['[]', '{"x":{"nested":true}}', '{"x":[1]}', 'invalid']) {
    const { result } = detailPreview(['listing_id', 'specifications'], ['ITEM1', text]); assert.ok(result.rows[0].errors.length);
  }
  const { result } = detailPreview(['listing_id', 'specifications', 'spec_material'], ['ITEM1', '{"material":"wood"}', 'stone']);
  assert.ok(result.rows[0].errors.some(error => error.includes('more than once')));
});
test('false attestations stay false and are never supplied automatically', () => {
  const value = detailPreview(['listing_id', 'spec_cottage_food_attestation'], ['ITEM1', 'false']);
  assert.equal(value.input.specs.cottageFoodAttestation, false);
  const invalid = detailPreview(['listing_id', 'spec_cottage_food_attestation'], ['ITEM1', 'yes']);
  assert.ok(invalid.result.rows[0].errors.length);
  assert.equal(detailPreview(['listing_id'], ['ITEM1']).input.specs.cottageFoodAttestation, undefined);
});
test('adapter does not conceal column-count errors or duplicate extra headers', () => {
  assert.ok(detailPreview(['listing_id', 'spec_material'], ['ITEM1']).result.rows[0].errors.length);
  assert.ok(detailPreview(['listing_id', 'spec_material', 'spec_material'], ['ITEM1', 'a', 'b']).result.errors.length);
});

test('money formatting alone does not turn a repeated import into a conflict', async () => {
  const a = row(), b = row(); b.payload.price = '125';
  assert.equal(await fingerprint(a), await fingerprint(b));
});
test('vehicle details populate the existing searchable top-level fields', () => {
  const { result } = detailPreview(['listing_id', 'spec_make', 'spec_model', 'spec_year', 'spec_mileage'], ['ITEM1', 'Ford', 'F-150', '2020', '75000']);
  assert.equal(result.rows[0].payload.brand, 'Ford'); assert.equal(result.rows[0].payload.model, 'F-150');
  assert.equal(result.rows[0].payload.year, 2020); assert.equal(result.rows[0].payload.mileage, 75000);
});
test('invalid numeric category details are not silently coerced', () => {
  for (const value of ['NaN', '-1', '1.5', '1e3']) {
    assert.ok(detailPreview(['listing_id', 'spec_mileage'], ['ITEM1', value]).result.rows[0].errors.length);
  }
});

test('specification-only rows cannot shift details onto the following listing', () => {
  const { result } = detailPreview(['listing_id', 'spec_material'], ['', 'wood']);
  assert.ok(result.errors.some(error => error.includes('no listing fields')));
  assert.equal(result.rows.length, 0);
});


test('recovery checks a later row concurrently saved with conflicting content', async () => {
  const s = setup(); const create = s.options.createListing;
  s.options.createListing = async payload => {
    await create(payload);
    const changed = row('ITEM2', [2, 3]); changed.payload.price = '999.00';
    s.records.push(await saved(changed));
    throw new Error('Lost response');
  };
  await runRecoverableExchangeBatch(s.options);
  assert.deepEqual(s.results.map(result => result.status), ['recovered', 'conflict']);
  assert.ok(!s.calls.includes('upload:2'));
  assert.equal(s.calls.filter(call => call === 'create').length, 1);
});
test('recovery reports a later row concurrently saved with matching content', async () => {
  const s = setup(); const create = s.options.createListing;
  s.options.createListing = async payload => {
    await create(payload); s.records.push(await saved(row('ITEM2', [2, 3])));
    throw new Error('Lost response');
  };
  await runRecoverableExchangeBatch(s.options);
  assert.deepEqual(s.results.map(result => result.status), ['recovered', 'skipped']);
  assert.ok(!s.calls.includes('upload:2'));
  assert.equal(s.calls.filter(call => call === 'create').length, 1);
});
