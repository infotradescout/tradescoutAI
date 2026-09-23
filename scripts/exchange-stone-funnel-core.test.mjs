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

test('full slab material estimate leads from approved square-foot rate and every recorded size', () => {
  assert.deepEqual(buyer.stoneSlabMaterialPriceRange('27.75', 'sqft', '126x78'), {
    kind: 'estimated', minimumCents: 189394, maximumCents: 189394, referenceSizeCount: 1,
  });
  assert.deepEqual(buyer.stoneSlabMaterialPriceRange('27.75', 'sqft', '126x78, 127x77.5'), {
    kind: 'estimated', minimumCents: 189394, maximumCents: 189673, referenceSizeCount: 2,
  });
  const one = buyer.stoneSlabMaterialPrice('27.75', 'sqft', '126x78');
  assert.equal(one.kind, 'estimated');
  assert.equal(one.primaryPrice, '$1,893.94');
  assert.equal(one.secondaryPrice, '$27.75 / sq ft');
  assert.equal(one.referenceSizeCount, 1);
  const varied = buyer.stoneSlabMaterialPrice('27.75', 'sqft', '126x78, 127x77.5');
  assert.equal(varied.primaryPrice, '$1,893.94–$1,896.73');
  assert.equal(varied.referenceSizeCount, 2);
  assert.match(varied.explanation, /confirm the selected slab's dimensions and total/);
  const card = renderer.renderExchangeStoneLanding(landing({ items: [{ ...item, specifications: {
    priceUnit: 'sqft', referenceSizesInches: '126x78, 127x77.5',
  } }] })).html;
  assert.match(card, /Estimated full slab material price<\/p><p class="price">\$1,893\.94–\$1,896\.73<\/p><p class="price-secondary">\$27\.75 \/ sq ft/);
});

test('missing or malformed dimensions never invent a full slab total', () => {
  for (const sizes of [null, '', '126x78, nonsense', '126x78,', '10x78', '126x780']) {
    assert.equal(buyer.stoneSlabMaterialPriceRange('27.75', 'sqft', sizes), null);
    const display = buyer.stoneSlabMaterialPrice('27.75', 'sqft', sizes);
    assert.equal(display.kind, 'size_required');
    assert.equal(display.primaryLabel, 'Slab price TBD');
    assert.equal(display.primaryPrice, '$27.75 / sq ft');
    assert.equal(display.secondaryPrice, null);
  }
  const card = renderer.renderExchangeStoneLanding(landing()).html;
  assert.match(card, /Slab price TBD<\/p><p class="price">\$27\.75 \/ sq ft<\/p>/);
  assert.equal(card.includes('Estimated full slab material price'), false);
  assert.equal(buyer.stoneSlabMaterialPrice(1707, 'slab', null), null);
  assert.deepEqual(buyer.stoneSlabMaterialPriceRange(1707, 'slab', null, 'Slab A'), {
    kind: 'exact', minimumCents: 170700, maximumCents: 170700, referenceSizeCount: 0,
  });
  assert.deepEqual(buyer.stoneSlabMaterialPrice(1707, 'slab', null, 'Slab A'), {
    kind: 'exact', primaryLabel: 'Full slab material price', primaryPrice: '$1,707.00', secondaryPrice: null,
    referenceSizeCount: 0,
    explanation: 'For the identified slab. Confirm availability; delivery, fabrication and installation are separate.',
  });
});

test('phone browse keeps search and count visible while all 96 cards remain server-rendered in bounded groups', () => {
  const items = Array.from({ length: 96 }, (_, index) => {
    const id = `tradescout-stone-test-${index + 1}`;
    return { ...item, id, title: `Stone ${index + 1}`, images: [`/api/exchange/stone-media/${id}`],
      specifications: { priceUnit: 'sqft', referenceSizesInches: '126x78' } };
  });
  const html = renderer.renderExchangeStoneLanding(landing({ items, search: 'Stone' })).html;
  assert.equal((html.match(/<article class="stone-card">/g) || []).length, 96);
  assert.equal((html.match(/<details class="stone-more">/g) || []).length, 7);
  assert.match(html, /<input type="search" name="q"[^>]*value="Stone"/);
  assert.match(html, /<details class="area-change"><summary><span>Showing Dallas, TX<\/span><span>Change area<\/span><\/summary>/);
  assert.match(html, /96 stones for Dallas, TX\. First 12 shown; open more groups below\.<\/p>/);
  assert.ok(html.indexOf('name="q"') < html.indexOf('role="status"'));
  assert.ok(html.indexOf('role="status"') < html.indexOf('<article class="stone-card">'));
  assert.ok(html.indexOf('name="q"') < html.indexOf('<details class="stone-more">'));
  assert.match(html, /Show stones 13–24 of 96/);
  assert.match(html, /Show stones 85–96 of 96/);
  assert.match(html, /inquiry=availability[^\"]*"[^>]*>Ask TradeScout about availability<\/a>/);
  assert.equal(html.includes('Test fixture only.'), false);
  const firstGroup = html.split('<section class="grid" aria-label="Published stone listings">')[1].split('</section>')[0];
  assert.equal((firstGroup.match(/<article class="stone-card">/g) || []).length, 12);
  const structured = html.split('<script type="application/ld+json">')[1].split('</script>')[0];
  assert.equal(JSON.parse(structured).mainEntity.itemListElement.length, 96);
  assert.match(renderer.renderExchangeStoneLanding(landing()).html, /1 stone for Dallas, TX/);
});
test('selected market search and area change preserve each other and attribution', () => {
  const html = renderer.renderExchangeStoneLanding(landing({ search: 'Stone & quartz', acquisitionTags: {
    utm_source: 'facebook', utm_medium: 'marketplace',
  } })).html;
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match => match[0]);
  assert.equal(forms.length, 2);
  assert.match(forms[0], /name="q"[^>]*value="Stone &amp; quartz"/);
  assert.match(forms[0], /type="hidden" name="audienceState" value="TX"/);
  assert.match(forms[0], /type="hidden" name="audienceCity" value="Dallas"/);
  assert.match(forms[1], /type="hidden" name="q" value="Stone &amp; quartz"/);
  assert.match(forms[1], /name="audienceState"[^>]*><option value="">Choose state<\/option>.*<option value="TX" selected>/);
  assert.match(forms[1], /name="audienceCity"[^>]*value="Dallas"/);
  for (const form of forms) {
    assert.match(form, /name="utm_source" value="facebook"/);
    assert.match(form, /name="utm_medium" value="marketplace"/);
    assert.match(form, /name="audienceCountry" value="US"/);
  }
  const unselected = renderer.renderExchangeStoneLanding(landing({
    audience: { allowed: false, reason: 'location_required' }, market: {},
  })).html;
  assert.equal([...unselected.matchAll(/<form\b/g)].length, 1);
  assert.equal(unselected.includes('class="area-change"'), false);
  assert.match(unselected, /<form class="stone-search needs-area"[^>]*>[\s\S]*name="audienceState"/);
});
test('retail card omits the repeated seller suffix without changing signed product identity', () => {
  const html = renderer.renderExchangeStoneLanding(landing({
    items: [{ ...item, title: 'Ocean Blue | TradeScout' }],
  })).html;
  const card = html.split('<article class="stone-card">')[1].split('</article>')[0];
  assert.match(card, /aria-label="View Ocean Blue"/);
  assert.match(card, /alt="Ocean Blue"/);
  assert.match(card, /<h2><a[^>]*>Ocean Blue<\/a><\/h2>/);
  assert.equal(card.includes('Ocean Blue | TradeScout'), false);
  const structured = JSON.parse(html.split('<script type="application/ld+json">')[1].split('</script>')[0]);
  assert.equal(structured.mainEntity.itemListElement[0].name, 'Ocean Blue | TradeScout');
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
