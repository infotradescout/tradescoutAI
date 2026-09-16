import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectConnectRequestEmail } from '../server/services/directConnectRequestEmail.ts';

const fixture = (patch = {}) => ({
  requestId: 'request-1', assignmentId: 'assignment-1',
  title: 'Kitchen countertop replacement',
  description: 'Remove existing tops.\nInstall the selected slab.\nCall 985-555-0100 or buyer@example.com.',
  category: 'service_request', trade: 'Countertop installation', location: 'Tangipahoa Parish, LA',
  jobAddress: '123 Example Lane', budget: '$4,000-$6,000', timing: 'Within two weeks',
  requester: { name: 'Example Requester', phone: '985-555-0100', email: 'buyer@example.com' },
  attachmentCount: 3, origin: 'https://www.thetradescout.com', ...patch,
});

test('includes the entire supplied scope and requester contact without a second approval field', () => {
  const input = fixture();
  const output = buildDirectConnectRequestEmail(input);
  for (const value of [input.description, input.requester.name, input.requester.phone, input.requester.email,
    input.category, input.trade, input.location, input.jobAddress, input.budget, input.timing]) {
    assert.ok(output.message.includes(value), value);
  }
  assert.equal(output.title, 'Direct Connect: Kitchen countertop replacement');
  assert.ok(output.message.includes('Photos / files: 3'));
  assert.ok(!output.message.includes('[hidden]'));
});

test('links to the exact incoming assignment in both text and HTML action data', () => {
  const output = buildDirectConnectRequestEmail(fixture());
  assert.equal(output.actionUrl, '/direct-connect/inbox?selected=assignment-1');
  assert.ok(output.message.includes(`https://www.thetradescout.com${output.actionUrl}`));
  assert.equal(output.actionText, 'Open this request');
});

test('encodes identity values rather than introducing another recipient or redirect', () => {
  const output = buildDirectConnectRequestEmail(fixture({ assignmentId: 'a&next=https://evil.example' }));
  const target = new URL(output.actionUrl, 'https://www.thetradescout.com');
  assert.equal(target.searchParams.get('selected'), 'a&next=https://evil.example');
  assert.equal([...target.searchParams.keys()].length, 1);
  assert.equal(target.pathname, '/direct-connect/inbox');
});

test('does not invent contact, price, timing, address, or media', () => {
  const output = buildDirectConnectRequestEmail(fixture({ requester: {}, budget: null, timing: null,
    jobAddress: null, attachmentCount: 0 }));
  assert.ok(output.message.includes('Phone: Not provided'));
  assert.ok(output.message.includes('Email: Not provided'));
  assert.ok(!output.message.includes('Budget:'));
  assert.ok(!output.message.includes('Timing:'));
  assert.ok(!output.message.includes('Job address:'));
  assert.ok(output.message.includes('Photos / files: 0'));
});

test('keeps body text intact while removing header/control injection from the subject', () => {
  const output = buildDirectConnectRequestEmail(fixture({ title: 'Roof\r\nBcc: other@example.com\u0000' }));
  assert.ok(!/[\r\n\u0000]/.test(output.title));
  assert.ok(output.message.includes(fixture().description));
});

test('does not spread private metadata or put contact details into URL parameters', () => {
  const output = buildDirectConnectRequestEmail(fixture({ privateAudit: 'internal-secret',
    attachments: ['https://storage.example/private?token=secret'] }));
  assert.ok(!JSON.stringify(output).includes('internal-secret'));
  assert.ok(!JSON.stringify(output).includes('token=secret'));
  assert.ok(!output.actionUrl.includes('buyer'));
  assert.ok(!output.actionUrl.includes('985'));
});

test('rejects invalid identities and counts instead of linking to the generic inbox', () => {
  for (const patch of [{ requestId: '' }, { assignmentId: '' }, { assignmentId: 'x'.repeat(121) },
    { attachmentCount: -1 }, { attachmentCount: NaN }, { attachmentCount: 1.5 }]) {
    assert.throws(() => buildDirectConnectRequestEmail(fixture(patch)));
  }
});

test('rejects non-web or credential-bearing origins', () => {
  for (const origin of ['javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com', 'bad']) {
    assert.throws(() => buildDirectConnectRequestEmail(fixture({ origin })));
  }
});

test('does not use an origin path, query, or fragment as a request destination', () => {
  const output = buildDirectConnectRequestEmail(fixture({ origin: 'https://www.thetradescout.com/other?x=1#secret' }));
  assert.equal(output.actionUrl, '/direct-connect/inbox?selected=assignment-1');
  assert.ok(!output.message.includes('#secret'));
});

test('preserves submitted measurements and every line of a long scope', () => {
  const description = Array.from({ length: 100 }, (_, i) => `Line ${i}: 120 x 26 inches`).join('\n');
  assert.ok(buildDirectConnectRequestEmail(fixture({ description })).message.includes(description));
});
