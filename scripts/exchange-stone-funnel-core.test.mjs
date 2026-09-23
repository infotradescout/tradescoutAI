import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import * as buyer from '../shared/exchangeStoneBuyerFlow.ts';
import * as funnel from '../server/services/exchangeStoneFunnel.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative, dependencies) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => dependencies[id] || require(id), module, module.exports);
  return module.exports;
}
const renderer = load('server/publicExchangeStoneHtml.ts', { '../shared/exchangeStoneBuyerFlow': buyer });
const store = load('server/services/exchangeStoneFunnelStore.ts', { './exchangeStoneFunnel': funnel });
const acquisition = { channel: 'tradescout', medium: 'organic', evidence: 'referrer', referrerHost: 'www.thetradescout.com', campaign: null };
const event = (overrides = {}) => ({ eventKey: 'inquiry:1', journeyKey: 'journey:1', buyerKey: 'a'.repeat(64), offerKey: 'offer:1', stage: 'inquiry_submitted', occurredAt: '2026-09-21T12:00:00Z', acquisition, evidence: 'saved_inquiry', evidenceId: 'inquiry:1', environment: 'production', marketKey: 'US:TX:Dallas', ...overrides });
const scope = { start: '2026-09-21T00:00:00Z', endExclusive: '2026-09-22T00:00:00Z', offerKeys: ['offer:1'], marketKeys: ['US:TX:Dallas'], medium: 'organic' };
const coverage = ['tradescout', 'facebook_marketplace'].map(channel => ({ channel, start: scope.start, throughExclusive: scope.endExclusive, complete: true, offerKeys: scope.offerKeys, marketKeys: scope.marketKeys, medium: 'organic', evidenceId: `coverage:${channel}` }));
const item = { id: 'tradescout-stone-test', title: 'Synthetic test stone', description: 'Test fixture only.', price: '27.75', images: ['/api/exchange/stone-media/tradescout-stone-test'], specifications: { priceUnit: 'sqft' } };
const landing = (overrides = {}) => ({ audience: { allowed: true, reason: 'eligible' }, publicationReady: true, items: [item], states: ['FL', 'TX'], market: { city: 'Dallas', state: 'TX' }, ...overrides });

test('exact product links, explicit price units and sign-in continuation', () => {
  assert.equal(buyer.stoneListingPath(item.id), '/exchange/building-materials/tradescout-stone-test');
  assert.equal(buyer.stonePriceLabel('27.75', 'sqft'), '$27.75 / sq ft');
  assert.equal(buyer.stonePriceLabel(1707, 'slab'), '$1,707.00 / slab');
  for (const bad of [null, '', 0, -1, '1e2', '27.755', false]) assert.equal(buyer.stonePriceLabel(bad, 'sqft'), null);
  for (const id of ['../private', 'https://evil.test', 'tradescout-stone-test?x=1']) assert.equal(buyer.stoneListingPath(id), null);
  assert.match(buyer.stoneInquiryReturnPath(item.id, 'callback'), /^\/pre-scout-setup\?mode=signin&next=/);
  assert.match(decodeURIComponent(buyer.stoneInquiryReturnPath(item.id, 'callback')), /inquiry=callback$/);
  assert.match(buyer.stoneInquiryMessage(item, 'callback'), /Synthetic test stone.*\$27.75 \/ sq ft.*TradeScout/s);
});
test('Facebook acquisition survives internal navigation without retaining private URL queries', () => {
  const original = funnel.captureAcquisition('/exchange/stone?utm_source=facebook&utm_medium=marketplace', 'https://l.facebook.com/l.php?private=123');
  assert.equal(original.channel, 'facebook_marketplace');
  assert.deepEqual(funnel.retainFirstAcquisition(original, funnel.captureAcquisition('/exchange?utm_source=tradescout')), original);
  assert.equal(JSON.stringify(original).includes('private'), false);
  assert.equal(funnel.captureAcquisition('/', 'https://facebook.com.evil.test').channel, 'other_referral');
  assert.equal(funnel.captureAcquisition('/', 'https://facebook.com').channel, 'facebook_other');
});
test('browser clicks cannot establish submitted inquiries, connected calls or payments', () => {
  for (const stage of ['inquiry_submitted', 'callback_requested', 'call_connected', 'quote_sent', 'order_paid']) assert.throws(() => funnel.validateFunnelEvent(event({ stage, evidence: 'browser' })));
  const result = funnel.compareStoneChannels([event({ stage: 'listing_view', evidence: 'browser', buyerKey: null })], scope, coverage);
  assert.equal(result.tradescout.interestedBuyers, 0);
  assert.equal(result.tradescout.connectedCalls, 0);
});
test('duplicate events and repeated interest from the same buyer do not inflate totals', () => {
  assert.equal(funnel.deduplicateFunnelEvents([event(), event({ eventKey: 'retry:1' })]).length, 1);
  assert.throws(() => funnel.deduplicateFunnelEvents([event(), event({ buyerKey: 'b'.repeat(64) })]));
  assert.equal(funnel.compareStoneChannels([event(), event({ eventKey: 'inquiry:2', evidenceId: 'inquiry:2' })], scope, coverage).tradescout.interestedBuyers, 1);
});
test('provider and operator confirmation of one call remain one outcome', () => {
  const call = event({ stage: 'call_connected', evidence: 'provider_connected_call', evidenceId: 'call:1' });
  assert.equal(funnel.deduplicateFunnelEvents([call, { ...call, eventKey: 'operator:1', evidence: 'operator_confirmed_call' }]).length, 1);
  assert.throws(() => funnel.deduplicateFunnelEvents([call, { ...call, eventKey: 'operator:1', evidence: 'operator_confirmed_call', acquisition: { ...acquisition, channel: 'facebook_marketplace' } }]));
});
test('outperformance requires both primary metrics, complete matched coverage and reliable attribution', () => {
  const call = event({ eventKey: 'call:1', stage: 'call_connected', evidence: 'provider_connected_call', evidenceId: 'call:1' });
  assert.equal(funnel.compareStoneChannels([event()], scope, coverage).outperformsOnBothPrimaryMetrics, false);
  assert.equal(funnel.compareStoneChannels([event(), call], scope, coverage).outperformsOnBothPrimaryMetrics, true);
  assert.equal(funnel.compareStoneChannels([event(), call], scope, coverage.slice(0, 1)).outperformsOnBothPrimaryMetrics, null);
  assert.equal(funnel.compareStoneChannels([event()], scope, [coverage[0], { ...coverage[1], offerKeys: ['wrong-price'] }]).facebookMarketplace, null);
  assert.equal(funnel.compareStoneChannels([event({ acquisition: { ...acquisition, medium: 'unspecified' } })], scope, coverage).status, 'attribution_incomplete');
});
test('tests, other offers, paid campaigns and records at the exclusive end are not organic results', () => {
  const result = funnel.compareStoneChannels([event({ environment: 'test' }), event({ eventKey: 'later:1', evidenceId: 'later:1', occurredAt: scope.endExclusive }), event({ eventKey: 'paid:1', evidenceId: 'paid:1', acquisition: { ...acquisition, medium: 'paid' } }), event({ eventKey: 'other:1', evidenceId: 'other:1', offerKey: 'other' })], scope, coverage);
  assert.equal(result.tradescout.interestedBuyers, 0);
});
test('unknown or excluded viewers see no product data in HTML or structured data', () => {
  for (const reason of ['location_required', 'pensacola', 'outside_us']) {
    const page = renderer.renderExchangeStoneLanding(landing({ audience: { allowed: false, reason } }));
    for (const hidden of [item.id, item.title, '27.75', 'ItemList']) assert.equal(page.html.includes(hidden), false);
    assert.ok(page.html.includes('What the displayed price includes'));
  }
});
test('approved hub indexability, direct inquiry links, source tags and no invented availability', () => {
  const page = renderer.renderExchangeStoneLanding(landing({ acquisitionTags: { utm_source: 'facebook', utm_medium: 'marketplace' } }));
  assert.equal(page.robots, 'index, follow');
  assert.ok(page.html.includes('/exchange/building-materials/tradescout-stone-test?inquiry=callback'));
  assert.ok(page.html.includes('name="utm_source" value="facebook"'));
  for (const bad of ['/exchange?item=', 'InStock', 'aggregateRating', 'supplierCost']) assert.equal(page.html.includes(bad), false);
  const draft = renderer.renderExchangeStoneLanding(landing({ publicationReady: false }));
  assert.equal(draft.robots, 'noindex, follow'); assert.equal(draft.html.includes(item.title), false);
});
test('missing-price cards and HTML injection are rejected or escaped', () => {
  const page = renderer.renderExchangeStoneLanding(landing({ items: [{ ...item, title: '<script>alert(1)</script>' }] }));
  assert.equal(page.html.includes('<script>alert(1)'), false);
  assert.equal(renderer.renderExchangeStoneLanding(landing({ items: [{ ...item, price: null }] })).html.includes(item.title), false);
});
test('append-only store persists one outcome across concurrent retries and rejects changed evidence', async () => {
  // Bounded SQLite semantic execution; not a PostgreSQL/production integration claim.
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE exchange_stone_funnel_events(event_key TEXT PRIMARY KEY,evidence_family TEXT,evidence_id TEXT,stage TEXT,environment TEXT,payload TEXT,fingerprint TEXT,UNIQUE(environment,evidence_family,evidence_id,stage))');
  const transaction = { query: async (sql, params) => ({ rows: db.prepare(sql.replace('::jsonb', '').replace(/\$\d+/g, '?')).all(...params) }) };
  assert.equal(await store.appendStoneFunnelEvent(transaction, event()), 'inserted');
  assert.deepEqual(await Promise.all(Array.from({ length: 10 }, (_, index) => store.appendStoneFunnelEvent(transaction, event({ eventKey: `retry:${index}` })))), Array(10).fill('duplicate'));
  await assert.rejects(store.appendStoneFunnelEvent(transaction, event({ buyerKey: 'b'.repeat(64) })));
  assert.equal(db.prepare('SELECT count(*) AS n FROM exchange_stone_funnel_events').get().n, 1); db.close();
});
