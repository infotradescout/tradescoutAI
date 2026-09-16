
// Invoked only by the isolated native driver with disposable DATABASE_URL.
const url = new URL(process.env.DATABASE_URL || 'invalid:');
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    decodeURIComponent(url.pathname.slice(1)) !== 'cabinet_placement_test') {
  throw new Error('Disposable local database required');
}
const { hashPassword } = await import('../../server/auth');
const { CURRENT_PROFILE_VERSION } = await import('../../shared/profile');
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 16384) throw new Error('Smoke credential batch is too large');
}
const passwords: unknown = JSON.parse(input);
if (!Array.isArray(passwords) || passwords.length > 128 ||
    !passwords.every(password => typeof password === 'string' && /^[a-f0-9]{48}$/.test(password))) {
  throw new Error('Invalid synthetic password batch');
}
const hashes: string[] = [];
for (const password of passwords) hashes.push(await hashPassword(password));
process.stdout.write(`SCOUT_SMOKE_HASHES ${JSON.stringify({ hashes, profileVersion: CURRENT_PROFILE_VERSION })}\n`);
process.exit(0);
