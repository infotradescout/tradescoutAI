import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Execute the actual handler from the verifier without starting its browsers,
// release commands, or any network request. The old source can be supplied for
// a negative-control run; no duplicated implementation can make this pass.
const source = await readFile(process.env.ISSA_PREVIEW_HANDLER_SOURCE || new URL('../verify-issa-footer-discovery.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  server = http.createServer(async (req, res) => {');
const end = source.indexOf('  await new Promise((resolve) => server.listen', start);
assert.ok(start >= 0 && end > start, 'The actual preview handler must be present');
const create = new Function('http', 'fs', 'path', 'publicDir', 'mime', 'origin', 'userAgent', 'fetch', `let server;\n${source.slice(start, end)}\nreturn server;`);

function response() {
  return {
    headersSent: false, writableEnded: false, destroyed: false, statuses: [], body: null,
    writeHead(status) {
      assert.equal(this.headersSent, false, 'ERR_HTTP_HEADERS_SENT');
      assert.equal(this.destroyed, false, 'Cannot write a destroyed response');
      assert.equal(this.writableEnded, false, 'Cannot write an ended response');
      this.headersSent = true; this.statuses.push(status); return this;
    },
    end(body) { this.body = body; this.writableEnded = true; },
    destroy() { this.destroyed = true; },
  };
}
function handler({ fetch, read = async () => Buffer.from('page'), stat = async () => ({ isFile: () => true }) } = {}) {
  return create({ createServer: (fn) => fn }, { stat, readFile: read }, path, '/preview/public', { '.html': 'text/html' }, 'https://public.invalid', 'test', fetch || (async () => ({ status: 200, headers: new Headers(), arrayBuffer: async () => Buffer.from('asset') })));
}
const upstream = (arrayBuffer) => async () => ({ status: 200, headers: new Headers(), arrayBuffer });

test('upstream body rejection returns one 502 instead of committing 200 first', async () => {
  const res = response();
  await handler({ fetch: upstream(async () => { throw new Error('body interrupted'); }) })({ method: 'GET', url: '/images/stone.webp' }, res);
  assert.deepEqual(res.statuses, [502]); assert.equal(res.body, 'Public resource unavailable');
});
test('local file rejection returns one 502 instead of a second header write', async () => {
  const res = response();
  await handler({ read: async () => { throw new Error('file unavailable'); } })({ method: 'GET', url: '/issa-build' }, res);
  assert.deepEqual(res.statuses, [502]); assert.equal(res.writableEnded, true);
});
test('successful upstream bytes and status are preserved', async () => {
  const res = response();
  await handler()({ method: 'GET', url: '/images/stone.webp' }, res);
  assert.deepEqual(res.statuses, [200]); assert.equal(res.body.toString(), 'asset');
});
test('successful local bytes are preserved', async () => {
  const res = response();
  await handler()({ method: 'GET', url: '/issa-build' }, res);
  assert.deepEqual(res.statuses, [200]); assert.equal(res.body.toString(), 'page');
});
test('browser cancellation before upstream completion writes nothing', async () => {
  const res = response();
  await handler({ fetch: upstream(async () => { res.destroyed = true; return Buffer.from('late'); }) })({ method: 'GET', url: '/images/stone.webp' }, res);
  assert.deepEqual(res.statuses, []); assert.equal(res.body, null);
});
test('browser cancellation followed by rejected upstream body writes nothing', async () => {
  const res = response();
  await handler({ fetch: upstream(async () => { res.destroyed = true; throw new Error('cancelled'); }) })({ method: 'GET', url: '/images/stone.webp' }, res);
  assert.deepEqual(res.statuses, []);
});
test('local read completing after the response ended writes nothing', async () => {
  const res = response();
  await handler({ read: async () => { res.writableEnded = true; return Buffer.from('late'); } })({ method: 'GET', url: '/issa-build' }, res);
  assert.deepEqual(res.statuses, []);
});
test('an already-started response is destroyed on error rather than rewritten', async () => {
  const res = response();
  await handler({ fetch: async () => { res.writeHead(200); throw new Error('connection failed'); } })({ method: 'GET', url: '/images/stone.webp' }, res);
  assert.deepEqual(res.statuses, [200]); assert.equal(res.destroyed, true);
});
test('preview still refuses all write methods without contacting upstream', async () => {
  let called = false; const res = response();
  await handler({ fetch: async () => { called = true; throw new Error('Unexpected contact'); } })({ method: 'POST', url: '/api/request' }, res);
  assert.deepEqual(res.statuses, [405]); assert.equal(called, false);
});
