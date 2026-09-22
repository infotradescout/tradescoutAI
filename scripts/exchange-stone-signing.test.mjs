import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolveStoneRetailSigningSecret } from '../shared/stoneRetailSigning.mjs';
import { inspectStoneLaunchEnvironment } from './lib/exchange-stone-launch-preflight.mjs';
import { STONE_LAUNCH } from './lib/exchange-stone-launch-package.mjs';
const dedicated = 'test-only-dedicated-retail-key-never-deployed-20260922';
const legacy = 'test-only-legacy-session-key-never-deployed';
for (const session of [undefined, '', 'short-session', legacy]) test(`dedicated signing does not depend on session configuration ${String(session).length}`, () => {
  const env = Object.freeze({ SESSION_SECRET: session, STONE_RETAIL_SIGNING_SECRET: dedicated });
  assert.equal(resolveStoneRetailSigningSecret(env), dedicated);
  assert.equal(env.SESSION_SECRET, session);
});
for (const invalid of ['', null, false, 1234, 'x'.repeat(31), 'x'.repeat(1025), ' '.repeat(32), ' '+dedicated, dedicated+'\n']) test(`explicit invalid dedicated key fails closed (${typeof invalid}:${String(invalid).length})`, () => {
  assert.equal(resolveStoneRetailSigningSecret({SESSION_SECRET:legacy,STONE_RETAIL_SIGNING_SECRET:invalid}), '');
});
test('legacy valid session key is compatible only while dedicated key is absent', () => {
  assert.equal(resolveStoneRetailSigningSecret({SESSION_SECRET:legacy}), legacy);
  assert.equal(resolveStoneRetailSigningSecret({SESSION_SECRET:'x'.repeat(24)}), 'x'.repeat(24));
  assert.equal(resolveStoneRetailSigningSecret({SESSION_SECRET:'x'.repeat(23)}), '');
  assert.equal(resolveStoneRetailSigningSecret({}), '');
});
test('a session-key change cannot silently change dedicated retail signatures', () => {
  const env = {SESSION_SECRET:legacy,STONE_RETAIL_SIGNING_SECRET:dedicated};
  const before = resolveStoneRetailSigningSecret(env);
  env.SESSION_SECRET = 'a different session configuration';
  assert.equal(resolveStoneRetailSigningSecret(env), before);
});
test('production-shaped preflight accepts independent signing without changing or revealing login configuration', () => {
  const env = Object.freeze({NODE_ENV:'production',RENDER_SERVICE_ID:STONE_LAUNCH.serviceId,SESSION_SECRET:'short-session',
    STONE_RETAIL_SIGNING_SECRET:dedicated,STONE_METRICS_SECRET:legacy,
    DATABASE_URL:`postgresql://test:private-password@${STONE_LAUNCH.hosts[0]}/${STONE_LAUNCH.database}?sslmode=require`});
  const result = inspectStoneLaunchEnvironment(env);
  assert.equal(result.ready,true);assert.equal(result.checks.publicationSecretConfigured,true);
  assert.equal(result.databaseConnected,false);assert.equal(result.publicationAuthorized,false);
  const text = JSON.stringify(result);
  for(const privateValue of [dedicated,legacy,'short-session','private-password']) assert.equal(text.includes(privateValue),false);
  assert.equal(env.SESSION_SECRET,'short-session');
  assert.equal(inspectStoneLaunchEnvironment({...env,STONE_RETAIL_SIGNING_SECRET:''}).ready,false);
});
for(const file of ['scripts/apply-exchange-stone-package.mjs','scripts/import-exchange-stone.ts','server/services/exchangeStoneCatalogReader.ts','server/services/exchangeStoneJourney.ts']) test(`${file} shares the non-authentication signing resolver`, async () => {
  const source = await fs.readFile(file,'utf8');
  assert.match(source,/resolveStoneRetailSigningSecret\(\)/);
  assert.doesNotMatch(source,/process\.env\.SESSION_SECRET/);
});
