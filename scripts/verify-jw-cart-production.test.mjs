import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectJwCartProduction } from './verify-jw-cart-production.mjs';

const expected = 'a'.repeat(40);
const platform = 'https://www.thetradescout.com';
const jw = 'https://jwstonelogistics.com';
function harness(override = () => undefined) {
  const calls = [], checks = [];
  const fetch = async (url, options) => {
    calls.push(url.href);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Authorization, undefined);
    const custom = override(url);
    if (custom) return custom;
    const headers = { 'x-tradescout-build': expected, 'content-type': 'application/json' };
    if (url.pathname === '/api/health') return new Response(JSON.stringify({ commit: expected, status: 'healthy', database: 'connected',
      migrations: { compatibility: 'compatible', requiredSchemaOk: true, appliedCount: 142, expectedCount: 142 } }), { headers });
    if (url.pathname === '/api/version') return new Response(JSON.stringify({ commit: expected }), { headers });
    if (url.pathname === '/u/jw-stone') return new Response('', { status: 301, headers: { location: '/jw-stone' } });
    if (url.pathname === '/jw-stone') return new Response('', { status: 301, headers: { location: jw + '/' } });
    if (url.origin === jw && url.pathname === '/') return new Response('<!doctype html><script>window.__TS_JW_STONE_MARKETPLACE_SURFACE__=true;window.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__="jw-stone";</script><script src="/assets/app-fixture.js"></script><link href="/assets/app-fixture.css">', { headers: { 'content-type': 'text/html' } });
    if (url.pathname.startsWith('/assets/')) return new Response(url.pathname.endsWith('.js') ? 'console.log("same release")' : 'body{color:black}', { headers: { ...headers, 'content-type': url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css' } });
    if (url.pathname === '/api/u/jw-stone/member-pricing') return new Response('{"message":"Authentication required"}', { status: 401, headers });
    throw new Error('Unexpected public fetch: ' + url.href);
  };
  return { calls, checks, run: () => inspectJwCartProduction(expected, (name, detail) => checks.push({ name, ...detail }), fetch) };
}

test('documented bounded JW redirects and missing custom HTML header require exact backend and matching assets', async () => {
  const h = harness(); await h.run();
  assert(h.calls.includes(jw + '/api/health'));
  assert(h.calls.includes(jw + '/api/version'));
  assert(h.calls.includes(platform + '/assets/app-fixture.js'));
  assert(h.calls.includes(jw + '/assets/app-fixture.js'));
  assert.equal(h.checks.find(check => check.redirects)?.redirects.length, 2);
  assert.equal(h.checks.filter(check => check.name.includes('Anonymous')).length, 2);
});
test('foreign redirect is rejected before fetching its destination', async () => {
  const h = harness(url => url.pathname === '/u/jw-stone' ? new Response('', { status: 301, headers: { location: 'https://unrelated.example/' } }) : undefined);
  await assert.rejects(h.run(), /explicitly allowed JW route/);
  assert(!h.calls.some(url => url.includes('unrelated.example')));
});
test('JW redirect loops stop instead of following indefinitely', async () => {
  const h = harness(url => url.pathname === '/jw-stone' ? new Response('', { status: 301, headers: { location: '/u/jw-stone' } }) : undefined);
  await assert.rejects(h.run(), /redirect loop/);
});
test('custom domain backend cannot identify a different release', async () => {
  const h = harness(url => url.origin === jw && url.pathname === '/api/version' ? new Response(JSON.stringify({ commit: 'b'.repeat(40) }), { headers: { 'x-tradescout-build': expected } }) : undefined);
  await assert.rejects(h.run());
});
test('a present wrong HTML build header is never waived', async () => {
  const h = harness(url => url.origin === jw && url.pathname === '/' ? new Response('<html></html>', { headers: { 'content-type': 'text/html', 'x-tradescout-build': 'b'.repeat(40) } }) : undefined);
  await assert.rejects(h.run());
});
test('custom asset bytes must match canonical bytes even when both build headers are correct', async () => {
  const h = harness(url => url.origin === jw && url.pathname.endsWith('.js') ? new Response('console.log("stale asset")', { headers: { 'content-type': 'application/javascript', 'x-tradescout-build': expected } }) : undefined);
  await assert.rejects(h.run(), /asset bytes must match/);
});
test('a missing asset build header cannot establish release authority', async () => {
  const h = harness(url => url.origin === jw && url.pathname.endsWith('.js') ? new Response('console.log("same release")', { headers: { 'content-type': 'application/javascript' } }) : undefined);
  await assert.rejects(h.run(), /exact release/);
});
test('anonymous custom-domain prices are a failure despite otherwise correct release evidence', async () => {
  const h = harness(url => url.origin === jw && url.pathname.endsWith('/member-pricing') ? new Response('{"slabPriceCents":100}', { status: 401 }) : undefined);
  await assert.rejects(h.run());
});
