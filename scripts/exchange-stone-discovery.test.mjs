import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
function load(file, deps = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(deps, id)) return deps[id];
    if (id.startsWith('.')) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), id)) + '.ts';
      if (!cache.has(target)) cache.set(target, load(target));
      return cache.get(target);
    }
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const policy = load('server/services/exchangeStoneDiscovery.ts');
cache.set('server/services/exchangeStoneDiscovery.ts', policy);
const identity = load('server/data/exchangeStoneCatalogIdentity.ts');
cache.set('server/data/exchangeStoneCatalogIdentity.ts', identity);
const merge = load('server/exchangeDiscovery.ts');
cache.set('server/exchangeDiscovery.ts', merge);
const safety = load('shared/publicListingSafety.ts');
const projection = load('server/publicExchangeListing.ts', { '@shared/publicListingSafety': safety });
const secret = 'synthetic-test-publication-key-only-not-production';
const digest = createHash('sha256').update('RIFFtestWEBPsynthetic-image').digest('hex');
const row = (patch = {}) => {
  const base = { id: 'tradescout-stone-matrix-basalt', sellerId: 'tradescout-owner-test', categoryId: 'building-materials-db-test',
    title: 'Matrix Basalt', description: 'Stone material sold by TradeScout.', price: '27.75', status: 'active', condition: 'new',
    images: ['/api/exchange/stone-media/tradescout-stone-matrix-basalt'], expiresAt: null,
    createdAt: '2026-09-21T12:00:00Z', specifications: { commerceChannel: policy.STONE_CHANNEL, sellerBrand: 'TradeScout',
      retailAudience: policy.STONE_AUDIENCE, priceUnit: 'sqft', material: 'basalt', referenceSizesInches: '126x78',
      availability: 'confirm_before_purchase', retailPublication: { approvedBy: 'synthetic-approver', approvedAt: '2026-09-21T10:00:00Z', assetSha256: digest } }, ...patch };
  base.specifications.retailPublication.signature = policy.stonePublicationSignature(base, secret);
  return base;
};
const publicItem = (patch = {}) => policy.projectPublicStone(row(patch));
const context = (location = { state: 'TX', city: 'Dallas' }, items = [publicItem()], query = {}) => ({ audience: policy.stoneAudience(location), items, query, feed: true, publicationReady: items.length > 0 });
const native = { id: 'native-listing', sellerId: 'ordinary-seller', price: 10, createdAt: '2026-09-20', title: 'Ordinary listing', status: 'active', description: 'Unchanged native item' };

test('119 exact catalog identities, including punctuation-derived source identity', () => {
  assert.equal(identity.stoneCatalog.size, 119);
  assert.equal(identity.stoneCatalog.get('tradescout-stone-valle-nevada-luna-pearl'), 'Valle Nevada (Luna Pearl)');
  assert.equal(identity.stoneCatalog.get('tradescout-stone-taj-mahal'), 'Taj Mahal');
  assert.equal([...identity.stoneCatalog.values()].some(value => typeof value !== 'string'), false);
});
test('all 50 states and DC permit eligible cities; Pensacola city alone is excluded', () => {
  assert.equal(policy.STONE_STATES.length, 51);
  for (const state of policy.STONE_STATES) assert.equal(policy.stoneAudience({ state, city: 'Gulf Breeze' }).allowed, true);
  for (const city of ['Pensacola', ' pensacola ', 'PENSACOLA']) assert.equal(policy.stoneAudience({ state: 'Florida', city }).reason, 'pensacola');
  for (const city of ['Pensacola Beach', 'Gulf Breeze', 'Milton', 'Pace', 'Cantonment']) assert.equal(policy.stoneAudience({ state: 'FL', city }).allowed, true);
  assert.equal(policy.stoneAudience({ state: 'TX', city: 'Pensacola' }).allowed, true);
});
test('unknown location is not inferred from county or malformed values', () => {
  for (const value of [undefined, {}, { state: 'FL', county: 'Escambia' }, { state: ['TX'] }, { state: 'TX', city: {} }, { state: 'TX', city: 'x'.repeat(161) }]) assert.equal(policy.stoneAudience(value).allowed, false);
  assert.equal(policy.stoneAudience({ state: 'TX', country: 'CA' }).reason, 'outside_us');
  assert.equal(policy.stoneAudience({ state: 'New York' }).market.state, 'NY');
});
test('known excluded account cannot be reenabled by query or remembered market', () => {
  assert.equal(policy.resolveStoneAudience({ state: 'FL', city: 'Pensacola' }, { state: 'TX' }, { state: 'CA' }).allowed, false);
  assert.equal(policy.resolveStoneAudience(undefined, { state: 'FL', city: 'Pensacola' }, { state: 'CA' }).allowed, false);
  assert.equal(policy.resolveStoneAudience(undefined, undefined, { state: 'TX' }).allowed, true);
});
test('publication binds seller, price, media and public copy', () => {
  const approved = row();
  assert.equal(policy.validStonePublication(approved, approved.sellerId, secret), true);
  for (const [key, value] of [['price', '28.00'], ['sellerId', 'supplier'], ['title', 'Wrong stone'], ['description', 'Unreviewed copy'], ['requiresBuyerVerification', true], ['priceNegotiable', true]]) {
    assert.equal(policy.validStonePublication({ ...approved, [key]: value }, approved.sellerId, secret), false, key);
  }
  assert.equal(policy.validStonePublication(approved, 'supplier', secret), false);
  assert.equal(policy.validStonePublication(approved, approved.sellerId, ''), false);
});
test('missing price, reviewed photo, exact full slab, and invalid timing never publish', () => {
  const approved = row();
  for (const price of [null, 0, '1e3', '27.755', '9999999999.99']) assert.equal(policy.validStonePublication(row({ price }), approved.sellerId, secret), false);
  for (const change of [{ assetSha256: '' }, { approvedAt: 'bad-date' }, { approvedAt: '2099-01-01' }, { approvedBy: '' }]) {
    const value = row(); Object.assign(value.specifications.retailPublication, change);
    value.specifications.retailPublication.signature = policy.stonePublicationSignature(value, secret);
    assert.equal(policy.validStonePublication(value, value.sellerId, secret), false);
  }
  const slab = row(); slab.specifications.priceUnit = 'slab'; slab.specifications.retailPublication.signature = policy.stonePublicationSignature(slab, secret);
  assert.equal(policy.validStonePublication(slab, slab.sellerId, secret), false);
  assert.equal(policy.validStonePublication(row({ expiresAt: '2020-01-01' }), approved.sellerId, secret), false);
});
test('public projection contains no supplier price, source URL, approval or contact data', () => {
  const value = row({ supplierCost: 18.5, buyerEmail: 'private@example.test', phone: '5555551234' });
  value.specifications.supplierCost = 18.5; value.specifications.sourceImageId = 'private-drive-id';
  const result = policy.projectPublicStone(value), text = JSON.stringify(result);
  for (const privateValue of ['supplierCost', '18.5', 'private-drive-id', 'retailPublication', 'private@example.test', '5555551234']) assert.equal(text.includes(privateValue), false);
  assert.equal(result.seller.name, 'TradeScout'); assert.equal(result.inStock, null); assert.equal(result.shippingCost, null);
  assert.equal(result.priceLabel, '$27.75 / sq ft'); assert.equal(result.requiresBuyerVerification, false);
});
test('direct projection defaults closed outside a resolved eligible request', () => {
  assert.equal(projection.toPublicExchangeListing(row()), null);
  assert.equal(policy.withStoneDiscovery(context({ state: 'FL', city: 'Pensacola' }), () => projection.toPublicExchangeListing(row())), null);
  const output = policy.withStoneDiscovery(context(), () => projection.toPublicExchangeListing({ ...row(), supplierCost: 18 }));
  assert.equal(output.businessName, 'TradeScout'); assert.equal('supplierCost' in output, false);
  assert.equal(projection.toPublicExchangeListing(native).id, native.id);
});
test('concurrent request scopes never share eligible or excluded retail data', async () => {
  await Promise.all(Array.from({ length: 24 }, (_, i) => policy.withStoneDiscovery(context(i % 2 ? { state: 'FL', city: 'Pensacola' } : { state: 'NY' }), async () => {
    await new Promise(resolve => setTimeout(resolve, i % 4));
    assert.equal(Boolean(policy.currentPublicStone(row().id)), i % 2 === 0);
  })));
  assert.equal(policy.stoneDiscoveryContext(), undefined);
});
test('national retail and native/profile content share one stable sorted page', () => {
  const items = [...identity.stoneCatalog].map(([id, name], i) => ({ ...publicItem(), id, title: name, price: i + 0.75 }));
  policy.withStoneDiscovery(context({ state: 'CA' }, items, { categoryId: 'building-materials', stateCode: 'CA' }), () => {
    const pages = [0, 48, 96].flatMap(offset => merge.mergeExchangeDiscoveryItems([[native]], { sort: 'price_asc', offset, limit: 48 }));
    assert.equal(pages.length, 120); assert.equal(new Set(pages.map(item => item.id)).size, 120);
    assert.equal(pages[0].price, 0.75); assert.equal(pages.at(-1).price, 118.75);
  });
});
test('raw unapproved retail rows cannot leak through an alternate merged source', () => {
  assert.deepEqual(merge.mergeExchangeDiscoveryItems([[row(), native]]).map(item => item.id), [native.id]);
  policy.withStoneDiscovery(context(undefined, [publicItem()], { categoryId: 'vehicles' }), () => {
    assert.deepEqual(merge.mergeExchangeDiscoveryItems([[row(), native]]).map(item => item.id), [native.id]);
  });
});
test('duplicate native retail source is replaced with approved public data once', () => {
  policy.withStoneDiscovery(context(), () => {
    const result = merge.mergeExchangeDiscoveryItems([[{ ...row(), privateSupplier: 'secret' }], [row()]]);
    assert.equal(result.length, 1); assert.equal(result[0].price, 27.75); assert.equal('privateSupplier' in result[0], false);
  });
});
test('source pagination continues past pages occupied only by withheld retail rows', async () => {
  const calls = [];
  const result = await merge.readExchangeSourcePages(async offset => {
    calls.push(offset);
    return offset === 0 ? { items: Array(100).fill(row()), sourceCount: 100 } : { items: [native], sourceCount: 1 };
  }, 1);
  assert.deepEqual(calls, [0, 100]); assert.deepEqual(result, [native]);
});
test('filters preserve material/price intent and do not substitute local inventory geography', () => {
  assert.equal(policy.filterStoneDiscovery([publicItem()], { q: 'basalt', minPrice: '27.75', maxPrice: '27.75', material: 'basalt', state: 'NY', county: 'another county' }).length, 1);
  for (const query of [{ q: 'marble' }, { maxPrice: 27 }, { minPrice: 28 }, { categoryId: 'vehicles' }, { hoursMax: 10 }, { material: ['basalt'] }, { minPrice: 'garbage' }]) assert.equal(policy.filterStoneDiscovery([publicItem()], query).length, 0);
});

let readError = false, photoError = false, returned = { items: [publicItem()], assets: new Map([[row().id, digest]]), configured: true };
const publicOrigin = { CANONICAL_WEB_HOST: 'www.thetradescout.com', resolveMappedProfileShareSlug: req => req.headers.host === 'jw.example.test' ? 'jw-stone' : undefined };
const route = load('server/routes/exchange-stone-catalog.ts', {
  '../utils/publicOrigin': publicOrigin,
  '../services/exchangeStoneCatalogReader': { readExchangeStoneCatalog: async () => { if (readError) throw Error('synthetic db failure'); return returned; }, readExchangeStonePhoto: async () => { if (photoError) throw Error('synthetic storage failure'); return Buffer.from('RIFFtestWEBPsynthetic-image'); } },
});
const handlers = new Map(); let middleware;
route.registerExchangeStoneCatalogRoutes({ use: handler => middleware = handler, get: (name, handler) => handlers.set(name, handler) });
async function request(routePath, options = {}) {
  const req = { method: 'GET', path: routePath.replace(':id', row().id), params: { id: row().id }, headers: { host: 'www.thetradescout.com' }, query: {}, session: {}, ...options };
  const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, status(value) { this.statusCode = value; return this; }, type(value) { this.headers.type = value; return this; }, send(value) { this.body = value; return this; }, json(value) { this.body = value; return this; }, end() { this.ended = true; return this; }, writeHead() {} };
  await middleware(req, res, async () => {
    if (handlers.has(routePath)) return handlers.get(routePath)(req, res, () => res.fallthrough = true);
    res.body = merge.mergeExchangeDiscoveryItems([[native]]);
  });
  return { req, res };
}
test('mounted landing is public to eligible anonymous buyers and carries stone-specific actions', async () => {
  const { req, res } = await request('/exchange/stone', { query: { audienceState: 'TX', audienceCountry: 'US', q: 'basalt' } });
  assert.equal(res.statusCode, 200); assert.match(res.body, /Matrix Basalt/); assert.match(res.body, /\$27\.75 \/ sq ft/);
  assert.match(res.body, /inquiry=availability/); assert.match(res.body, /inquiry=callback/); assert.equal(req.session.exchangeStoneMarket.state, 'TX');
  assert.match(res.body, /stone-media\/tradescout-stone-matrix-basalt\?audienceState=TX/);
  assert.equal(res.headers['x-robots-tag'], 'index, follow');
});
test('Pensacola landing reveals no product in HTML, image links or structured data', async () => {
  const { res } = await request('/exchange/stone', { query: { audienceState: 'FL', audienceCity: 'Pensacola' } });
  assert.equal(res.body.includes('Matrix Basalt'), false); assert.equal(res.body.includes(row().id), false);
  assert.match(res.body, /not displayed/);
});
test('standalone catalog API paginates and retains remembered eligible discovery market', async () => {
  const { res } = await request('/api/exchange/stone', { session: { exchangeStoneMarket: { state: 'NY' } }, query: { limit: '1', offset: '0' } });
  assert.equal(res.body.total, 1); assert.equal(res.body.items.length, 1); assert.equal(res.body.items[0].id, row().id);
});
test('real Exchange merge receives request-approved national rows before pagination', async () => {
  const { res } = await request('/api/exchange/items', { user: { stateCode: 'CA' }, query: { categoryId: 'building-materials', stateCode: 'CA' } });
  assert.deepEqual(res.body.map(item => item.id), [row().id, native.id]);
});
test('mapped supplier host and missing location cannot display stone catalog', async () => {
  const denied = await request('/api/exchange/stone', { headers: { host: 'jw.example.test' }, query: { audienceState: 'TX' } });
  assert.equal(denied.res.statusCode, 404);
  const unknown = await request('/api/exchange/stone'); assert.equal(unknown.res.body.items.length, 0); assert.equal(unknown.res.body.audience, 'location_required');
});
test('direct media route uses same market decision as catalog and detail', async () => {
  assert.equal((await request('/api/exchange/stone-media/:id', { query: { audienceState: 'TX' } })).res.statusCode, 200);
  assert.equal((await request('/api/exchange/stone-media/:id', { query: { audienceState: 'FL', audienceCity: 'Pensacola' } })).res.statusCode, 404);
  assert.equal((await request('/api/exchange/stone-media/:id')).res.statusCode, 404);
});
test('catalog and storage outages return unavailable, not stale or fabricated retail results', async () => {
  readError = true;
  try { const { res } = await request('/api/exchange/stone', { query: { audienceState: 'TX' } }); assert.equal(res.statusCode, 503); }
  finally { readError = false; }
  photoError = true;
  try { assert.equal((await request('/api/exchange/stone-media/:id', { query: { audienceState: 'TX' } })).res.statusCode, 503); }
  finally { photoError = false; }
});
test('late cache headers cannot expose an eligible response to another market', () => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, writeHead(status, headers) { this.final = { ...this.headers, ...headers }; } };
  route.protectStoneResponseCache(res); res.setHeader('Cache-Control', 'public, max-age=3600');
  res.writeHead(200, { 'cache-control': 'public', 'X-Test': 'unchanged' });
  assert.equal(res.final['cache-control'], 'private, no-store'); assert.equal(res.final['X-Test'], 'unchanged');
});
test('unlocalized crawler retains native listings but excludes retail rows', async () => {
  const crawler = load('server/crawler/extractors/marketplace.ts', { '../.././db': { db: { query: { marketplaceListings: { findMany: async () => [row(), native] } } } } });
  assert.deepEqual((await crawler.extractMarketplace()).map(item => item.id), [native.id]);
});
test('route mounting preserves journey capture before the catalog owner', () => {
  const source = fs.readFileSync(path.join(root, 'server/routes/public-metadata.ts'), 'utf8');
  assert.ok(source.indexOf('  registerExchangeStoneInquiryRoutes(app);') < source.indexOf('  registerExchangeStoneCatalogRoutes(app);'));
  assert.equal(source.includes('public-profile-app-base'), false);
});

// These adapters execute the actual publication reader, not PostgreSQL or Drizzle itself.
let settingsRows = [{ value: row().sellerId }], queryRows = [], queries = [], exposureCalls = 0, photoBytes = Buffer.from('RIFFtestWEBPsynthetic-image');
const sqlAdapter = (parts, ...values) => ({ sql: parts.join('?'), values });
const reader = load('server/services/exchangeStoneCatalogReader.ts', {
  'drizzle-orm': { sql: sqlAdapter },
  'drizzle-orm/pg-core': { PgDialect: class { sqlToQuery(value) { return { sql: value.sql, params: value.values }; } } },
  '@shared/publicListingSafety': safety,
  '../db': { pool: { query: async (sql, params) => { queries.push({ sql, params }); return { rows: sql.includes('site_settings') ? settingsRows : queryRows }; } } },
  '../publicMediaStorage': { readPublicObjectBuffer: async ({ key }) => { assert.match(key, /^public-media\/images\/exchange\/stone\//); return photoBytes; } },
  './exposureAuthority': { exposureAuthoritySqlPredicate: () => { exposureCalls++; return 'canonical-trust-predicate'; } },
});
function dbRow(value = row()) { return { ...value, seller_id: value.sellerId, category_id: value.categoryId, expires_at: value.expiresAt, created_at: value.createdAt, is_seller_verified: false }; }
test('actual reader enforces configured seller, canonical exposure and exact source identities', async () => {
  const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = secret;
  try {
    queries = []; exposureCalls = 0;
    queryRows = [dbRow(), dbRow(row({ id: 'tradescout-stone-not-a-source-material' })), dbRow(row({ sellerId: 'supplier' })), dbRow(row({ price: null }))];
    const result = await reader.readExchangeStoneCatalog();
    assert.equal(result.items.length, 1); assert.equal(result.items[0].sellerName, 'TradeScout');
    assert.equal(exposureCalls, 1); assert.equal(queries.length, 2); assert.match(queries[1].sql, /c\.is_active = true/);
    assert.equal(queries[1].params[0].length, 119); assert.equal(result.assets.get(row().id), digest);
  } finally { if (old == null) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; }
});
test('absent or ambiguous seller setting never selects a guessed supplier account', async () => {
  const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = secret;
  try {
    for (const settings of [[], [{ value: 7 }], [{ value: 'one' }, { value: 'two' }]]) {
      settingsRows = settings; queries = [];
      assert.equal((await reader.readExchangeStoneCatalog()).configured, false); assert.equal(queries.length, 1);
    }
  } finally { settingsRows = [{ value: row().sellerId }]; if (old == null) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; }
});
test('actual reader rejects direct contact copy despite a matching publication signature', async () => {
  const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = secret;
  try { queryRows = [dbRow(row({ description: 'Call 850-555-1234 to purchase.' }))]; assert.equal((await reader.readExchangeStoneCatalog()).items.length, 0); }
  finally { if (old == null) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; }
});
test('actual media reader verifies the reviewed WebP digest instead of serving arbitrary source bytes', async () => {
  assert.ok(await reader.readExchangeStonePhoto(row().id, digest));
  assert.equal(await reader.readExchangeStonePhoto(row().id, 'a'.repeat(64)), null);
  assert.equal(await reader.readExchangeStonePhoto('tradescout-stone-unknown', digest), null);
  photoBytes = Buffer.from('<html>not an image</html>');
  assert.equal(await reader.readExchangeStonePhoto(row().id, digest), null);
  photoBytes = Buffer.from('RIFFtestWEBPsynthetic-image');
});
test('unpublished catalog exposes no reference prices and remains noindex', async () => {
  const prior = returned; returned = { items: [], assets: new Map(), configured: false };
  try { const { res } = await request('/exchange/stone', { query: { audienceState: 'TX' } }); assert.equal(res.headers['x-robots-tag'], 'noindex, follow'); assert.equal(res.body.includes('$27.75'), false); }
  finally { returned = prior; }
});

let searchFilters;
const queryChain = { from() { return this; }, where(value) { searchFilters = value; return this; }, orderBy() { return this; }, limit: async () => [native] };
const searchService = load('server/services/marketplaceService.ts', {
  'drizzle-orm': { and: (...args) => args, desc: value => value, eq: (...args) => args, gte: (...args) => args, lte: (...args) => args, ilike: (...args) => args, sql: sqlAdapter },
  '../db': { db: { select: () => queryChain } },
  '@shared/schema': { marketplaceListings: { id: 'id', specifications: 'specifications', status: 'status', createdAt: 'created_at', county: 'county', state: 'state' }, marketplaceCategories: {} },
});
test('Scout search uses only scoped approved retail rows, never raw retail query results', async () => {
  await policy.withStoneDiscovery(context(), async () => {
    const result = await searchService.searchMarketplaceListings({ state: 'NY', county: 'another county' });
    assert.equal(result.success, true); assert.deepEqual(result.data.map(item => item.id), [row().id, native.id]);
    assert.ok(searchFilters.some(filter => filter?.sql?.includes("NOT LIKE 'tradescout-stone-%'")));
  });
  await policy.withStoneDiscovery(context({ state: 'FL', city: 'Pensacola' }), async () => {
    const result = await searchService.getMarketplaceForCounty('Escambia', 'FL');
    assert.deepEqual(result.data.map(item => item.id), [native.id]);
  });
});
test('supplier or direct contact content in specification fields fails public read validation', async () => {
  const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = secret;
  try {
    const value = row(); value.specifications.material = 'JW Stone';
    value.specifications.retailPublication.signature = policy.stonePublicationSignature(value, secret);
    assert.equal(policy.validStonePublication(value, value.sellerId, secret), false);
    value.specifications.material = 'Phone 850-555-1234';
    value.specifications.retailPublication.signature = policy.stonePublicationSignature(value, secret); queryRows = [dbRow(value)];
    assert.equal((await reader.readExchangeStoneCatalog()).items.length, 0);
  } finally { if (old == null) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; }
});

test('malformed location cannot turn into an eligible remembered market on the next request', async () => {
  const session = { exchangeStoneMarket: { state: 'CA' } };
  const first = await request('/api/exchange/stone', { session, query: { audienceState: 'TX', audienceCountry: ['CA'] } });
  assert.equal(first.res.body.items.length, 0);
  const second = await request('/api/exchange/stone-media/:id', { session });
  assert.equal(second.res.statusCode, 404);
});
test('structured product names cannot close the JSON-LD script element', () => {
  const renderer = load('server/publicExchangeStoneHtml.ts');
  const dangerous = { ...publicItem(), title: '</script><script>alert(1)</script>' };
  const result = renderer.renderExchangeStoneLanding({ audience: { allowed: true, reason: 'eligible' }, publicationReady: true, items: [dangerous], states: ['TX'], market: { state: 'TX' } });
  assert.equal(result.html.includes('</script><script>'), false);
  assert.equal((result.html.match(/<script/g) || []).length, 1);
  const structured = result.html.split('<script type="application/ld+json">')[1].split('</script>')[0];
  assert.equal(JSON.parse(structured).mainEntity.itemListElement[0].name, dangerous.title);
});
