import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Imported only by isolated proof code, after its inherited environment is erased.
// No request is forwarded: unknown hosts, operations and credentials fail closed.
export const syntheticReceivingEnvironment = Object.freeze({
  JW_STONE_RECEIVING_ENABLED: 'true',
  JW_STONE_DRIVE_FOLDER_ID: 'synthetic-jw-source-root',
  JW_STONE_RECEIVING_DRIVE_FOLDER_ID: 'synthetic-jw-receiving-folder',
  GOOGLE_CLIENT_ID: 'synthetic-only-client',
  GOOGLE_CLIENT_SECRET: 'synthetic-only-secret',
  JW_STONE_DRIVE_REFRESH_TOKEN: 'synthetic-only-refresh',
});
const token = 'synthetic-only-access-token';
const api = 'https://www.googleapis.com/drive/v3';
const folder = syntheticReceivingEnvironment.JW_STONE_RECEIVING_DRIVE_FOLDER_ID;
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

export function createSyntheticReceivingDrive({ onSnapshot = async () => {} } = {}) {
  const files = new Map(), allocated = new Set(), lostAcknowledgements = new Set();
  const counts = { tokenRequests: 0, allocatedIds: 0, uploads: 0, existingFileReads: 0, lostAcknowledgements: 0, blockedRequests: 0 };
  function snapshot() {
    return {
      scope: 'Synthetic in-memory Drive only; no provider request was forwarded',
      counts: { ...counts },
      files: [...files.values()].map(({ metadata, bytes }) => ({
        ...structuredClone(metadata), bytes: bytes.length, sha256: hash('sha256', bytes), md5Checksum: hash('md5', bytes),
        ...(metadata.mimeType === 'application/json' ? { manifest: JSON.parse(bytes.toString('utf8')) } : {}),
      })),
    };
  }
  async function dispatch(input, init = {}) {
    // Actual receiving uses a string and explicit RequestInit. Do not accept a
    // Request whose hidden body/method could evade the fixture's exact checks.
    assert.equal(typeof input, 'string', 'Unexpected synthetic Drive request representation');
    const url = new URL(input);
    assert.equal(url.href, input, 'Noncanonical synthetic Drive URL');
    assert.equal(url.username + url.password + url.hash, '');
    const method = init.method || 'GET';
    const headers = new Headers(init.headers);
    if (input === 'https://oauth2.googleapis.com/token') {
      assert.equal(method, 'POST');
      assert(init.body instanceof URLSearchParams);
      assert.deepEqual(Object.fromEntries(init.body), {
        client_id: syntheticReceivingEnvironment.GOOGLE_CLIENT_ID,
        client_secret: syntheticReceivingEnvironment.GOOGLE_CLIENT_SECRET,
        refresh_token: syntheticReceivingEnvironment.JW_STONE_DRIVE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      });
      assert.equal([...init.body].length, 4);
      counts.tokenRequests++;
      return json({ access_token: token, expires_in: 3600 });
    }
    assert.equal(headers.get('authorization'), `Bearer ${token}`, 'Only invented fixture credentials are accepted');
    if (input === `${api}/files/${folder}?supportsAllDrives=true&fields=id,mimeType,trashed,parents,capabilities(canAddChildren)`) {
      assert.equal(method, 'GET');
      return json({ id: folder, mimeType: 'application/vnd.google-apps.folder', trashed: false,
        parents: [syntheticReceivingEnvironment.JW_STONE_DRIVE_FOLDER_ID], capabilities: { canAddChildren: true } });
    }
    if (input === `${api}/files/${folder}/permissions?supportsAllDrives=true&fields=nextPageToken,permissions(type)&pageSize=100`) {
      assert.equal(method, 'GET');
      return json({ permissions: [{ type: 'user' }] });
    }
    if (url.origin === 'https://www.googleapis.com' && url.pathname === '/drive/v3/files/generateIds') {
      const count = Number(url.searchParams.get('count'));
      assert(Number.isInteger(count) && count >= 2 && count <= 9);
      assert.equal(input, `${api}/files/generateIds?count=${count}&space=drive&type=files`);
      assert.equal(method, 'GET');
      const ids = Array.from({ length: count }, () => `synthetic-drive-${++counts.allocatedIds}`);
      ids.forEach(id => allocated.add(id));
      return json({ ids });
    }
    const id = url.pathname.slice('/drive/v3/files/'.length);
    if (url.origin === 'https://www.googleapis.com' && allocated.has(id)) {
      assert.equal(input, `${api}/files/${id}?supportsAllDrives=true&fields=id,mimeType,trashed,parents,appProperties,md5Checksum`);
      assert.equal(method, 'GET');
      const file = files.get(id);
      if (!file) return json({ error: 'Synthetic file does not exist' }, 404);
      counts.existingFileReads++;
      return json({ ...file.metadata, trashed: false, md5Checksum: hash('md5', file.bytes) });
    }
    if (input === 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id') {
      assert.equal(method, 'POST');
      assert(Buffer.isBuffer(init.body), 'Expected the actual binary multipart body');
      const match = /^multipart\/related; boundary=(jw-[a-f0-9-]{36})$/.exec(headers.get('content-type') || '');
      assert(match, 'Unexpected multipart encoding');
      const boundary = match[1], body = init.body;
      const prefix = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`);
      assert(body.subarray(0, prefix.length).equals(prefix));
      const divider = Buffer.from(`\r\n--${boundary}\r\nContent-Type: `);
      const metadataEnd = body.indexOf(divider, prefix.length);
      assert(metadataEnd > prefix.length);
      const metadata = JSON.parse(body.subarray(prefix.length, metadataEnd).toString('utf8'));
      assert(allocated.has(metadata.id), 'Only durably allocated source IDs may be uploaded');
      assert(!files.has(metadata.id), 'A retry must inspect the existing source, not overwrite it');
      assert.deepEqual(Object.keys(metadata).sort(), ['appProperties', 'id', 'mimeType', 'name', 'parents']);
      assert.deepEqual(metadata.parents, [folder]);
      assert(['image/jpeg', 'application/json'].includes(metadata.mimeType));
      assert.match(metadata.appProperties?.receiptId || '', /^[a-f0-9-]{36}$/);
      const contentStart = metadataEnd + divider.length;
      const contentPrefix = Buffer.from(`${metadata.mimeType}\r\n\r\n`);
      assert(body.subarray(contentStart, contentStart + contentPrefix.length).equals(contentPrefix));
      const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
      assert(body.subarray(-suffix.length).equals(suffix));
      const bytes = Buffer.from(body.subarray(contentStart + contentPrefix.length, -suffix.length));
      assert(bytes.length > 0 && bytes.length <= 10 * 1024 * 1024);
      assert.equal(metadata.appProperties.sha256, hash('sha256', bytes));
      if (metadata.mimeType === 'application/json') {
        const manifest = JSON.parse(bytes.toString('utf8'));
        assert.equal(manifest.receipt.receiptId, metadata.appProperties.receiptId);
      }
      files.set(metadata.id, { metadata, bytes });
      counts.uploads++;
      // Model a provider accepting the immutable manifest but losing its success
      // response. The application must leave stock private and retry the same IDs.
      if (metadata.mimeType === 'application/json' && !lostAcknowledgements.has(metadata.appProperties.receiptId)) {
        lostAcknowledgements.add(metadata.appProperties.receiptId);
        counts.lostAcknowledgements++;
        return json({ error: 'Synthetic manifest acknowledgement lost after durable write' }, 503);
      }
      return json({ id: metadata.id });
    }
    throw new Error(`Blocked unexpected synthetic Drive operation: ${method} ${url.origin}${url.pathname}`);
  }
  return {
    snapshot,
    async fetch(input, init) {
      try {
        return await dispatch(input, init);
      } catch (error) {
        counts.blockedRequests++;
        throw error;
      } finally {
        await onSnapshot(snapshot());
      }
    },
  };
}
