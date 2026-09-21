import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative, dependencies = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => Object.hasOwn(dependencies, id) ? dependencies[id] : require(id), module, module.exports);
  return module.exports;
}
const funnel = load('server/services/exchangeStoneFunnel.ts');
const eventStore = load('server/services/exchangeStoneFunnelStore.ts', { './exchangeStoneFunnel': funnel });
const engine = load('server/services/exchangeStoneInquiryTransaction.ts', { './exchangeStoneFunnel': funnel, './exchangeStoneFunnelStore': eventStore });
const client = load('client/src/lib/exchangeStoneInquiryRequest.ts');

// Real SQLite commit/rollback/uniqueness, with an explicit SQL translation adapter.
// Advisory/row locking is NOT PostgreSQL acceptance: BEGIN is serialized by this test adapter.
function harness() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE decision_cards(id TEXT PRIMARY KEY,user_id TEXT,status TEXT,intent TEXT,decision_scope TEXT,decided_at TEXT,updated_at TEXT);
    CREATE TABLE marketplace_inquiries(id TEXT PRIMARY KEY,listing_id TEXT,buyer_id TEXT,seller_id TEXT,message TEXT,offer_amount TEXT,buyer_phone TEXT,buyer_email TEXT,preferred_contact_method TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE marketplace_conversations(id TEXT PRIMARY KEY,listing_id TEXT,buyer_id TEXT,seller_id TEXT,status TEXT,intent TEXT,authority_gate TEXT,source_decision_card_id TEXT,decision_scope TEXT,last_message_at TEXT,is_read_by_buyer INTEGER,is_read_by_seller INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT);
    CREATE TABLE marketplace_messages(id TEXT PRIMARY KEY,conversation_id TEXT,sender_id TEXT,sender_type TEXT,content TEXT,message_type TEXT,metadata TEXT);
    CREATE TABLE notification_fixture(id TEXT PRIMARY KEY,seller_id TEXT,conversation_id TEXT,inquiry_id TEXT);
    CREATE TABLE exchange_stone_inquiry_receipts(buyer_id TEXT,request_key TEXT,decision_card_id TEXT UNIQUE,listing_id TEXT,seller_id TEXT,fingerprint TEXT,inquiry_id TEXT,response TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(buyer_id,request_key));
    CREATE TABLE exchange_stone_funnel_events(event_key TEXT PRIMARY KEY,evidence_family TEXT,evidence_id TEXT,stage TEXT,environment TEXT,payload TEXT,fingerprint TEXT,UNIQUE(environment,evidence_family,evidence_id,stage));
  `);
  let tail = Promise.resolve(), failOn = null, dropCommit = false, connects = 0;
  const releases = [], statements = [];
  const pool = { async connect() {
    connects++;
    let unlock;
    return { async query(text, values = []) {
      statements.push(text);
      if (text === 'BEGIN') {
        const previous = tail;
        tail = new Promise(resolve => { unlock = resolve; });
        await previous;
        database.exec('BEGIN'); return { rows: [] };
      }
      if (text === 'COMMIT' || text === 'ROLLBACK') {
        try { database.exec(text); }
        finally { unlock?.(); unlock = null; }
        if (text === 'COMMIT' && dropCommit) { dropCommit = false; throw new Error('Lost COMMIT acknowledgement'); }
        return { rows: [] };
      }
      if (failOn?.test(text)) { failOn = null; throw new Error('Injected write failure'); }
      if (text.includes('pg_advisory_xact_lock')) return { rows: [] };
      const params = [];
      const translated = text
        .replace(/created_at >= now\(\) - interval '30 minutes'/g, "datetime(created_at) >= datetime('now','-30 minutes')")
        .replace(/FOR UPDATE|FOR SHARE OF \w+|FOR SHARE/g, '')
        .replace(/now\(\)/g, 'CURRENT_TIMESTAMP').replace(/::jsonb/g, '')
        .replace(/\$(\d+)/g, (_, n) => { params.push(values[Number(n) - 1]); return '?'; });
      const rows = database.prepare(translated).all(...params).map(row => ({ ...row,
        ...(row.response ? { response: JSON.parse(row.response) } : {}) }));
      return { rows };
    }, release(error) { releases.push(error?.message || null); } };
  } };
  const command = (overrides = {}) => ({ buyerId: 'buyer-one', listingId: 'tradescout-stone-test', decisionId: randomUUID(), requestKey: randomUUID(), message: 'Please confirm the exact slab and delivery cost.', inquiryIntent: 'availability', ...overrides });
  const card = (c, state = {}) => database.prepare('INSERT INTO decision_cards VALUES (?,?,?,?,?,?,?)').run(c.decisionId, state.buyerId || c.buyerId, state.status || 'active', state.intent || 'collaborate', state.scope || `marketplace_listing:${c.listingId}`, null, null);
  const acquisition = funnel.captureAcquisition('/exchange/stone?utm_source=facebook&utm_medium=marketplace', 'https://l.facebook.com/');
  const deps = { pool, metricsSecret: 'local-test-secret-not-production-1234', environment: 'test', acquisition, journeyKey: 'journey:test',
    authorizeOffer: async () => ({ sellerId: 'seller-tradescout', title: 'Synthetic test stone', priceCents: 2775, unit: 'sqft', fulfillmentTermsKey: 'material-only-delivery-quote', marketKey: 'US.TX.Dallas' }),
    insertNotification: async (tx, n) => { await tx.query('INSERT INTO notification_fixture VALUES ($1,$2,$3,$4)', [n.id,n.sellerId,n.conversationId,n.inquiryId]); },
  };
  const count = name => database.prepare(`SELECT count(*) AS n FROM ${name}`).get().n;
  const events = () => database.prepare('SELECT payload FROM exchange_stone_funnel_events').all().map(row => JSON.parse(row.payload));
  return { database, deps, command, card, count, events, statements, releases, get connects() { return connects; },
    fail: pattern => { failOn = pattern; }, dropCommit: () => { dropCommit = true; } };
}

test('commits inquiry, seller inbox, notification, Decision Card and saved-inquiry evidence together', async () => {
  const h = harness(), c = h.command(); h.card(c);
  const result = await engine.saveStoneInquiry(c, h.deps);
  assert.equal(result.replayed, false);
  for (const table of ['marketplace_inquiries','marketplace_messages','marketplace_conversations','notification_fixture','exchange_stone_inquiry_receipts','exchange_stone_funnel_events']) assert.equal(h.count(table), 1, table);
  assert.equal(h.database.prepare('SELECT status FROM decision_cards').get().status, 'completed');
  const evidence = h.events()[0];
  assert.equal(evidence.evidence, 'saved_inquiry'); assert.equal(evidence.environment, 'test');
  assert.equal(evidence.evidenceId, result.receipt.id); assert.equal(evidence.acquisition.channel, 'facebook_marketplace');
  assert.match(evidence.buyerKey, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(evidence).includes('buyer-one'), false);
  assert.equal(h.statements.at(-1), 'COMMIT'); assert.equal(h.releases.length, 1);
});

test('same explicit request survives a lost COMMIT acknowledgement without another message', async () => {
  const h = harness(), c = h.command(); h.card(c); h.dropCommit();
  await assert.rejects(engine.saveStoneInquiry(c, h.deps), /Lost COMMIT/);
  assert.equal(h.count('marketplace_inquiries'), 1);
  const replay = await engine.saveStoneInquiry(c, { ...h.deps, acquisition: funnel.captureAcquisition('/?utm_source=tradescout') });
  assert.equal(replay.replayed, true); assert.equal(h.count('marketplace_inquiries'), 1); assert.equal(h.count('marketplace_messages'), 1);
  assert.equal(h.events()[0].acquisition.channel, 'facebook_marketplace');
});

test('20 concurrent attempts return one receipt and one saved message', async () => {
  const h = harness(), c = h.command(); h.card(c);
  const results = await Promise.all(Array.from({ length: 20 }, () => engine.saveStoneInquiry(c, h.deps)));
  assert.equal(new Set(results.map(r => r.receipt.id)).size, 1);
  assert.equal(results.filter(r => !r.replayed).length, 1);
  assert.equal(h.count('marketplace_messages'), 1); assert.equal(h.count('notification_fixture'), 1); assert.equal(h.connects, 20);
});

for (const [name, pattern] of [
  ['message', /INSERT INTO marketplace_messages/],
  ['notification', /INSERT INTO notification_fixture/],
  ['Decision Card', /UPDATE decision_cards/],
  ['measurement', /INSERT INTO exchange_stone_funnel_events/],
  ['receipt', /INSERT INTO exchange_stone_inquiry_receipts/],
]) test(`${name} failure rolls back the entire inquiry and leaves its card reusable`, async () => {
  const h = harness(), c = h.command(); h.card(c); h.fail(pattern);
  await assert.rejects(engine.saveStoneInquiry(c, h.deps), /Injected/);
  for (const table of ['marketplace_inquiries','marketplace_messages','marketplace_conversations','notification_fixture','exchange_stone_inquiry_receipts','exchange_stone_funnel_events']) assert.equal(h.count(table), 0, table);
  assert.equal(h.database.prepare('SELECT status FROM decision_cards').get().status, 'active');
  assert.equal((await engine.saveStoneInquiry(c, h.deps)).replayed, false);
});

test('request-key conflict cannot replace another listing, text, intent or saved outcome', async () => {
  const h = harness(), c = h.command(); h.card(c); await engine.saveStoneInquiry(c, h.deps);
  for (const change of [{ message: 'different' }, { inquiryIntent: 'callback' }, { listingId: 'tradescout-stone-other' }])
    await assert.rejects(engine.saveStoneInquiry({ ...c, ...change }, h.deps), e => e.code === 'REQUEST_CONFLICT');
  assert.equal(h.count('marketplace_inquiries'), 1);
});

for (const [name, state] of [
  ['another buyer', { buyerId: 'different-buyer' }], ['wrong scope', { scope: 'marketplace_listing:other' }],
  ['wrong intent', { intent: 'sell' }], ['completed without a receipt', { status: 'completed' }],
]) test(`rejects ${name} Decision Card before any inquiry or metric`, async () => {
  const h = harness(), c = h.command(); h.card(c, state);
  await assert.rejects(engine.saveStoneInquiry(c, h.deps), e => e.code === 'INVALID_DECISION_CARD');
  assert.equal(h.count('marketplace_inquiries'), 0); assert.equal(h.count('exchange_stone_funnel_events'), 0);
});

test('legacy retries with a newly created card reuse an exact recent saved inquiry', async () => {
  const h = harness(), c = h.command({ requestKey: undefined }); h.card(c);
  const first = await engine.saveStoneInquiry(c, h.deps);
  const retry = { ...c, decisionId: randomUUID() }; h.card(retry);
  const second = await engine.saveStoneInquiry(retry, h.deps);
  assert.equal(second.replayed, true); assert.deepEqual(first.receipt, second.receipt);
  assert.equal(h.count('marketplace_inquiries'), 1); assert.equal(h.count('exchange_stone_inquiry_receipts'), 2);
});

test('explicit new requests can use one conversation without conflating inquiries or distinct buyers', async () => {
  const h = harness(), c = h.command(); h.card(c); await engine.saveStoneInquiry(c, h.deps);
  const next = h.command(); h.card(next); await engine.saveStoneInquiry(next, h.deps);
  assert.equal(h.count('marketplace_inquiries'), 2); assert.equal(h.count('marketplace_conversations'), 1);
  assert.equal(new Set(h.events().map(e => e.buyerKey)).size, 1);
});

test('callback intent is stored separately and never becomes a connected call', async () => {
  const h = harness(), c = h.command({ inquiryIntent: 'callback' }); h.card(c);
  await engine.saveStoneInquiry(c, h.deps);
  assert.deepEqual(h.events().map(e => e.stage).sort(), ['callback_requested','inquiry_submitted']);
  assert.equal(h.events().filter(e => e.stage === 'call_connected').length, 0);
  assert.equal(new Set(h.events().map(e => e.buyerKey)).size, 1);
});

test('a blocked conversation cannot be bypassed by creating a fresh one', async () => {
  const h = harness(), c = h.command(); h.card(c);
  h.database.prepare('INSERT INTO marketplace_conversations(id,listing_id,buyer_id,seller_id,status) VALUES (?,?,?,?,?)')
    .run('blocked',c.listingId,c.buyerId,'seller-tradescout','blocked');
  await assert.rejects(engine.saveStoneInquiry(c, h.deps), e => e.code === 'CONTACT_BLOCKED');
  assert.equal(h.count('marketplace_inquiries'), 0); assert.equal(h.count('marketplace_conversations'), 1);
});

test('revoked offer authority and invalid measurement source fail atomically', async () => {
  const h = harness(), c = h.command(); h.card(c);
  await assert.rejects(engine.saveStoneInquiry(c, { ...h.deps, authorizeOffer: async () => { throw new Error('revoked'); } }), /revoked/);
  await assert.rejects(engine.saveStoneInquiry(c, { ...h.deps, acquisition: { ...h.deps.acquisition, channel: 'invented' } }), /acquisition/);
  assert.equal(h.count('marketplace_inquiries'), 0); assert.equal(h.count('marketplace_messages'), 0);
});

function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k), data }; }
const browserRequest = (overrides = {}) => ({ actorId: `buyer-${randomUUID()}`, listingId: 'tradescout-stone-test', title: 'Synthetic stone', message: 'Please confirm this slab.', inquiryIntent: 'callback', ...overrides });

test('browser reload/retry reuses its saved card and request UUID after delivery acknowledgement is lost', async () => {
  const store = storage(), request = browserRequest(), calls = [];
  let lost = true;
  const api = async (_method, url, body) => {
    calls.push({ url, body });
    if (url === '/api/decision-cards') return { id: 'decision-test' };
    if (lost) { lost = false; throw new Error('response lost'); }
    return { id: 'inquiry-test', listingId: request.listingId, conversationId: 'thread-test' };
  };
  await assert.rejects(client.sendStoneInquiryRequest(api, store, request, () => true), /response lost/);
  const reloaded = load('client/src/lib/exchangeStoneInquiryRequest.ts');
  await reloaded.sendStoneInquiryRequest(api, store, request, () => true);
  assert.equal(calls.filter(c => c.url === '/api/decision-cards').length, 1);
  const posts = calls.filter(c => c.url === '/api/marketplace/inquiries');
  assert.equal(posts[0].body.requestKey, posts[1].body.requestKey);
  assert.equal(posts[0].body.inquiryIntent, 'callback'); assert.equal(store.data.size, 0);
});

test('browser cannot submit under a changed account or call card creation a delivery', async () => {
  const store = storage(), request = browserRequest(), calls = []; let current = true;
  const api = async (_m, url) => { calls.push(url); current = false; return { id: 'decision-test' }; };
  await assert.rejects(client.sendStoneInquiryRequest(api, store, request, () => current), /account changed/);
  assert.deepEqual(calls, ['/api/decision-cards']); assert.equal(store.data.size, 1);
});

test('denied browser storage does not issue a fresh explicit UUID on every reload', async () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const request = browserRequest(), calls = [];
  const api = async (_m, url, body) => { calls.push({url, body}); return url === '/api/decision-cards' ? { id: 'card-denied' } : { id: 'saved', listingId: request.listingId, conversationId: 'thread' }; };
  await client.sendStoneInquiryRequest(api, denied, request, () => true);
  assert.equal(Object.hasOwn(calls.at(-1).body, 'requestKey'), false);
});

test('a malformed success response retains the browser identity for reconciliation', async () => {
  const store = storage(), request = browserRequest();
  const api = async (_m, url) => url === '/api/decision-cards' ? { id: 'card-malformed' } : { success: true };
  await assert.rejects(client.sendStoneInquiryRequest(api, store, request, () => true), /could not be confirmed/);
  assert.equal(store.data.size, 1);
  assert.equal(JSON.stringify([...store.data.values()]).includes(request.message), false);
});

test('screen routes stone requests through the persisted identity client while retaining ordinary contact flow', () => {
  const screen = fs.readFileSync(path.join(root, 'client/src/pages/exchange/ExchangeListingDetail.tsx'), 'utf8');
  assert.ok(screen.includes('await sendStoneInquiryRequest(apiRequest, requestStorage'));
  assert.ok(screen.includes('inquiryIntent: stoneInquiry.intent'));
  assert.ok(screen.includes('sourceDecisionCardId,'));
  const route = fs.readFileSync(path.join(root, 'server/routes/exchange-stone-inquiries.ts'), 'utf8');
  assert.ok(route.includes('exposureAuthoritySqlPredicate(sql`l.seller_id`)'));
  assert.ok(route.includes('const buyerId = String(req.user?.id || req.user?.claims?.sub'));
  assert.ok(!route.includes('buyerId: req.body.buyerId'));
  assert.ok(route.includes('environment: process.env.NODE_ENV'));
});

function routeHarness(save = async (_command, _dependencies) => ({ receipt: { id: 'inquiry-route', listingId: 'tradescout-stone-test', conversationId: 'thread-route' }, replayed: true })) {
  const registrations = [], middleware = [], authCalls = [];
  const route = load('server/routes/exchange-stone-inquiries.ts', {
    'drizzle-orm': { sql: () => ({}) }, 'drizzle-orm/pg-core': { PgDialect: class {} },
    'drizzle-orm/node-postgres': { drizzle: () => ({}) }, '@shared/schema': { notifications: {} },
    '@shared/publicListingSafety': { sanitizePublicListingText: text => String(text).trim() },
    '../db': { pool: {} }, '../auth': { isAuthenticated: (req, res, next) => { authCalls.push(req); return req.isAuthenticated() ? next() : res.status(401).json({ message: 'Authentication required' }); } },
    '../services/exposureAuthority': { exposureAuthoritySqlPredicate: () => ({}) },
    '../services/exchangeStoneFunnel': funnel,
    '../services/exchangeStoneInquiryTransaction': { ...engine, saveStoneInquiry: save },
    '../utils/publicOrigin': { CANONICAL_WEB_HOST: 'www.thetradescout.com', resolveMappedProfileShareSlug: req => req.mappedProfile || null },
  });
  route.registerExchangeStoneInquiryRoutes({ use: h => middleware.push(h), post: (url, ...handlers) => registrations.push({url, handlers}) });
  const req = { method: 'POST', path: '/api/marketplace/inquiries', headers: { host: 'www.thetradescout.com' }, user: { id: 'real-buyer' }, isAuthenticated: () => true, session: {},
    body: { listingId: 'tradescout-stone-test', sourceDecisionCardId: 'card-route', authorityGate: 'decision_card', decisionScope: 'marketplace_listing:tradescout-stone-test', message: 'Please confirm the slab.', inquiryIntent: 'callback' } };
  const response = () => ({ statusCode: 200, headers: {}, body: null, status(code) { this.statusCode = code; return this; }, setHeader(k,v) { this.headers[k] = v; }, json(value) { this.body = value; return this; } });
  return { route, registrations, middleware, authCalls, req, response };
}

test('HTTP adapter reuses canonical auth and ordinary listings fall through unchanged', async () => {
  const h = routeHarness(), res = h.response(), [gate] = h.registrations[0].handlers;
  let next;
  gate({ ...h.req, body: { listingId: 'ordinary-listing' } }, res, value => { next = value; });
  assert.equal(next, 'route'); assert.equal(h.authCalls.length, 0);
  gate({ ...h.req, isAuthenticated: () => false }, res, () => assert.fail('Unauthenticated request advanced'));
  assert.equal(res.statusCode, 401); assert.equal(h.authCalls.length, 1);
});

test('HTTP adapter binds actor/source/environment to server context, not claimed client fields', async () => {
  let recorded;
  const h = routeHarness(async (command, dependencies) => { recorded = {command,dependencies}; return { receipt: { id: 'saved' }, replayed: true }; });
  h.req.body.buyerId = 'forged-buyer'; h.req.body.acquisition = { channel: 'tradescout' }; h.req.body.environment = 'production';
  h.req.session.exchangeStoneJourney = { id: 'actual-journey', acquisition: funnel.captureAcquisition('/?utm_source=facebook_marketplace&utm_medium=marketplace') };
  const res = h.response();
  await h.registrations[0].handlers[1](h.req, res);
  assert.equal(res.statusCode, 200); assert.equal(recorded.command.buyerId, 'real-buyer');
  assert.equal(recorded.dependencies.acquisition.channel, 'facebook_marketplace');
  assert.equal(recorded.dependencies.environment, process.env.NODE_ENV === 'production' ? 'production' : 'test');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('initial Facebook acquisition is retained on internal navigation and source-profile hosts cannot submit', async () => {
  const h = routeHarness();
  const req = { ...h.req, method: 'GET', path: '/exchange/stone', originalUrl: '/exchange/stone?utm_source=facebook&utm_medium=marketplace', get: () => 'https://l.facebook.com/' };
  h.middleware[0](req, null, () => {});
  const first = req.session.exchangeStoneJourney;
  req.originalUrl = '/exchange/stone?utm_source=tradescout'; req.get = () => 'https://www.thetradescout.com/exchange';
  h.middleware[0](req, null, () => {});
  assert.deepEqual(req.session.exchangeStoneJourney, first); assert.equal(first.acquisition.channel, 'facebook_marketplace');
  const res = h.response();
  await h.registrations[0].handlers[1]({ ...h.req, mappedProfile: 'supplier-profile' }, res);
  assert.equal(res.statusCode, 404);
});

test('city-only market guard accepts adjacent cities, county peers, and every other US state', () => {
  const h = routeHarness();
  assert.throws(() => h.route.stoneInquiryMarket({ state: 'Florida', city: ' Pensacola ' }), e => e.code === 'LISTING_UNAVAILABLE');
  for (const city of ['Gulf Breeze','Pace','Milton','Pensacola Beach','Cantonment'])
    assert.match(h.route.stoneInquiryMarket({ state: 'FL', city, county: 'Escambia' }), /^US\.FL\./);
  for (const state of 'AL AK AZ AR CA CO CT DE DC GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '))
    assert.match(h.route.stoneInquiryMarket({ state, country: 'US' }), new RegExp(`^US\\.${state}\\.`));
  assert.equal(h.route.stoneInquiryMarket({ state: 'Texas', city: 'Dallas' }), 'US.TX.Dallas');
  assert.throws(() => h.route.stoneInquiryMarket({ state: 'FL' }), e => e.code === 'MARKET_REQUIRED');
  assert.throws(() => h.route.stoneInquiryMarket({ state: 'TX', country: 'CA' }), e => e.code === 'MARKET_REQUIRED');
});
