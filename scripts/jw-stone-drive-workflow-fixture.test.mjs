import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createSyntheticReceivingDrive, syntheticReceivingEnvironment as env } from './jw-stone-drive-workflow-fixture.mjs';

const tokenRequest = () => ({ method: 'POST', body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
  refresh_token: env.JW_STONE_DRIVE_REFRESH_TOKEN, grant_type: 'refresh_token' }) });

test('only invented credentials receive a synthetic token; inherited or duplicated credentials are rejected', async () => {
  const drive = createSyntheticReceivingDrive();
  const valid = await drive.fetch('https://oauth2.googleapis.com/token', tokenRequest());
  assert.equal(valid.status, 200);
  const wrong = tokenRequest(); wrong.body.set('refresh_token', 'not-the-invented-fixture-token');
  await assert.rejects(drive.fetch('https://oauth2.googleapis.com/token', wrong));
  const duplicate = tokenRequest(); duplicate.body.append('client_id', env.GOOGLE_CLIENT_ID);
  await assert.rejects(drive.fetch('https://oauth2.googleapis.com/token', duplicate));
  assert.deepEqual(drive.snapshot().files, []);
  assert.equal(drive.snapshot().counts.blockedRequests, 2);
});

test('unknown hosts, lookalike URLs, wrong methods and hidden Request bodies fail without forwarding', async () => {
  const drive = createSyntheticReceivingDrive();
  const headers = { Authorization: 'Bearer synthetic-only-access-token' };
  for (const [url, init] of [
    ['https://example.test/anything', { headers }],
    ['https://www.googleapis.com.evil.test/drive/v3/files/generateIds?count=2&space=drive&type=files', { headers }],
    ['https://www.googleapis.com/drive/v3/files/generateIds?count=2&space=drive&type=files&alt=media', { headers }],
    ['https://www.googleapis.com/drive/v3/files/generateIds?count=2&space=drive&type=files', { method: 'DELETE', headers }],
    ['https://www.googleapis.com/drive/v3/files/generateIds?count=2&space=drive&type=files', { headers: { Authorization: 'Bearer other-token' } }],
  ]) await assert.rejects(drive.fetch(url, init));
  await assert.rejects(drive.fetch(new Request('https://oauth2.googleapis.com/token', tokenRequest())));
  assert.equal(drive.snapshot().counts.allocatedIds, 0);
  assert.equal(drive.snapshot().counts.blockedRequests, 6);
});

test('private snapshots are awaited and copies cannot mutate simulated immutable files or counters', async () => {
  const snapshots = [];
  const drive = createSyntheticReceivingDrive({ onSnapshot: async value => { snapshots.push(value); } });
  await drive.fetch('https://oauth2.googleapis.com/token', tokenRequest());
  const response = await drive.fetch('https://www.googleapis.com/drive/v3/files/generateIds?count=2&space=drive&type=files', { headers: { Authorization: 'Bearer synthetic-only-access-token' } });
  assert.deepEqual((await response.json()).ids, ['synthetic-drive-1', 'synthetic-drive-2']);
  assert.equal(snapshots.length, 2);
  const snapshot = drive.snapshot(); snapshot.counts.allocatedIds = 999; snapshot.files.push({ id: 'invented' });
  assert.equal(drive.snapshot().counts.allocatedIds, 2); assert.deepEqual(drive.snapshot().files, []);
});

test('a second upload cannot overwrite existing binary source bytes and nested snapshot data is detached', async () => {
  const drive = createSyntheticReceivingDrive();
  const authorization = 'Bearer synthetic-only-access-token';
  const allocation = await drive.fetch('https://www.googleapis.com/drive/v3/files/generateIds?count=2&space=drive&type=files', { headers: { Authorization: authorization } });
  const id = (await allocation.json()).ids[0], boundary = 'jw-' + randomUUID();
  const bytes = Buffer.from([0xff, 0xd8, 0x00, 0x0d, 0x0a, 0xff, 0xd9]);
  const metadata = { id, name: 'synthetic.jpg', mimeType: 'image/jpeg', parents: [env.JW_STONE_RECEIVING_DRIVE_FOLDER_ID],
    appProperties: { receiptId: randomUUID(), sha256: createHash('sha256').update(bytes).digest('hex') } };
  const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id';
  const init = { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'multipart/related; boundary=' + boundary }, body };
  assert.equal((await drive.fetch(url, init)).status, 200);
  await assert.rejects(drive.fetch(url, init), /not overwrite/);
  const snapshot = drive.snapshot(); snapshot.files[0].appProperties.sha256 = 'changed'; snapshot.files[0].parents[0] = 'public';
  const stored = drive.snapshot().files[0];
  assert.equal(stored.sha256, metadata.appProperties.sha256); assert.equal(stored.appProperties.sha256, metadata.appProperties.sha256);
  assert.deepEqual(stored.parents, metadata.parents); assert.equal(drive.snapshot().counts.uploads, 1);
});
