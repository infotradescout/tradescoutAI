import assert from 'node:assert/strict';
import test from 'node:test';
import { logger } from '../../server/services/logger.ts';

function capture(level, metadata, message = 'synthetic operational event') {
  const sink = level === 'info' ? 'log' : level;
  const original = console[sink];
  let line;
  console[sink] = (...args) => { line = args; };
  try { logger[level](message, metadata); } finally { console[sink] = original; }
  assert.ok(line, 'logger emitted a line');
  return { line, data: line[1] === '' ? undefined : JSON.parse(line[1]) };
}

test('ordinary Error retains message and stack instead of an empty object', () => {
  const error = new Error('connection timed out');
  const {data} = capture('error', error);
  assert.equal(data.message, error.message);
  assert.equal(data.name, 'Error');
  assert.equal(data.stack, error.stack);
});

test('nested provider failure preserves cause and correlation fields', () => {
  const cause = Object.assign(new Error('socket closed'), {code: 'ECONNRESET'});
  const error = Object.assign(new Error('delivery failed', {cause}), {code: 'PROVIDER_FAILURE'});
  const {data} = capture('error', {requestId:'req-synthetic', jobId:'job-synthetic', provider:'example', error});
  assert.equal(data.requestId, 'req-synthetic');
  assert.equal(data.jobId, 'job-synthetic');
  assert.equal(data.error.code, 'PROVIDER_FAILURE');
  assert.equal(data.error.cause.code, 'ECONNRESET');
  assert.equal(data.error.cause.message, 'socket closed');
});

test('circular field does not discard the rest of the diagnostic record', () => {
  const meta = {requestId:'req-synthetic', reason:'validation_failed', statusCode:400};
  meta.self = meta;
  const {data} = capture('warn', meta);
  assert.equal(data.reason, 'validation_failed');
  assert.equal(data.statusCode, 400);
  assert.equal(data.self, '[Circular]');
});

test('shared references are not misreported as cycles', () => {
  const shared = {count:2};
  assert.deepEqual(capture('info', {first:shared, second:shared}).data, {first:{count:2},second:{count:2}});
});

test('explicit false, zero, empty string and null are retained', () => {
  for (const value of [false, 0, '', null]) assert.equal(capture('info', value).data, value);
});

test('bigint, arrays and timestamps retain diagnostic values', () => {
  const date = new Date('2026-09-28T00:00:00Z');
  assert.deepEqual(capture('info', {count:7n, states:['queued','sent'], date}).data,
    {count:'7',states:['queued','sent'],date:'2026-09-28T00:00:00.000Z'});
});

test('nested credential fields are redacted, operational identifiers are retained', () => {
  const {data} = capture('info', {requestId:'req-synthetic', userId:'user-synthetic', status:'rejected', reason:'invalid_input', nested:{password:'secret-password', access_token:'secret-token', Authorization:'secret-header', cookie:'secret-cookie', apiKey:'secret-api-key'}});
  assert.equal(data.userId, 'user-synthetic');
  assert.equal(data.status, 'rejected');
  assert.equal(data.reason, 'invalid_input');
  assert.ok(Object.values(data.nested).every(value => value === '[REDACTED]'));
});

test('credentials are scrubbed from error strings and top-level messages', () => {
  const input = 'Bearer secret-bearer postgres://dbuser:dbpass@example.invalid/db?password=secret-query';
  const {data, line} = capture('error', new Error(input), input);
  for (const secret of ['secret-bearer', 'dbuser', 'dbpass', 'secret-query']) {
    assert.equal(JSON.stringify({data,line}).includes(secret), false);
  }
  assert.match(data.message, /\[REDACTED\]/);
});

test('logger does not invoke getters or toJSON methods', () => {
  const meta = {reason:'not_discarded', toJSON() {throw new Error('must not execute');}};
  Object.defineProperty(meta, 'danger', {enumerable:true,get() {throw new Error('must not execute');}});
  const {data} = capture('warn', meta);
  assert.equal(data.reason, 'not_discarded');
  assert.equal(data.danger, '[Accessor not evaluated]');
});

test('all severity sinks and no-metadata formatting remain compatible', () => {
  for (const level of ['info','warn','error','debug']) {
    const {line} = capture(level, undefined, 'unchanged message');
    assert.deepEqual(line, [`[${level.toUpperCase()}] unchanged message`, '']);
  }
});

test('cycle state does not leak across log calls', () => {
  const record = {reason:'stable'};
  assert.deepEqual(capture('info', record).data, capture('info', record).data);
});

test('deep or binary context is bounded without losing top-level reason', () => {
  const root = {reason:'diagnostic retained', bytes:Buffer.from('not-for-logging')};
  let node = root;
  for (let i=0; i<30; i++) node = node.child = {};
  const {data} = capture('warn', root);
  assert.equal(data.reason, 'diagnostic retained');
  assert.deepEqual(data.bytes, {type:'binary',byteLength:15});
  assert.match(JSON.stringify(data), /Maximum log depth/);
});


test('native Error subclass names are retained', () => {
  assert.equal(capture('error', new TypeError('invalid value')).data.name, 'TypeError');
});

test('a failing lazy error field does not discard sibling context', () => {
  const error = new Error('known reason');
  Object.defineProperty(error, 'stack', {get() {throw new Error('unavailable');}});
  const {data} = capture('error', {requestId:'req-synthetic', error});
  assert.equal(data.requestId, 'req-synthetic');
  assert.equal(data.error.message, 'known reason');
  assert.equal(data.error.stack, '[Error field unavailable]');
});


test('AggregateError retains individual failure causes', () => {
  const error = new AggregateError([new Error('first failure'), new Error('second failure')], 'batch failed');
  assert.deepEqual(capture('error', error).data.errors.map(item => item.message), ['first failure','second failure']);
});

test('non-string messages cannot crash the logging path', () => {
  assert.equal(capture('info', null, 0).line[0], '[INFO] 0');
  const message = {toString() {throw new Error('unavailable');}};
  assert.equal(capture('info', null, message).line[0], '[INFO] [Unserializable log message]');
});
