import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectStoneLaunchEnvironment } from './lib/exchange-stone-launch-preflight.mjs';
import { STONE_LAUNCH } from './lib/exchange-stone-launch-package.mjs';
const secret = 'PRIVATE_PASSWORD_AND_PACKAGE_TOKEN_MUST_NOT_APPEAR';
const environment = {NODE_ENV:'production',RENDER_SERVICE_ID:STONE_LAUNCH.serviceId,SESSION_SECRET:secret,STONE_METRICS_SECRET:secret,DATABASE_URL:`postgresql://user:${secret}@${STONE_LAUNCH.hosts[0]}/${STONE_LAUNCH.database}?sslmode=require&token=${secret}`};
test('valid inspection is nonmutating, nonconnecting and grants no publication authority',()=>{
  const input=Object.freeze({...environment});
  const result=inspectStoneLaunchEnvironment(input);
  assert.equal(result.ready,true);
  assert.equal(result.databaseConnected,false);
  assert.equal(result.publicationAuthorized,false);
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal(input.DATABASE_URL,environment.DATABASE_URL);
});
for(const pathname of ['%', '%E0%A4%A', '%FF']) test(`invalid encoded database name ${pathname} cannot break diagnostics`,()=>{
  const result=inspectStoneLaunchEnvironment({...environment,DATABASE_URL:`postgresql://user:${secret}@${STONE_LAUNCH.hosts[0]}/${pathname}`});
  assert.equal(result.ready,false);assert.equal(result.checks.securedDatabaseUrl,false);
  assert.equal(result.observedDatabaseName,null);assert.equal(JSON.stringify(result).includes(secret),false);
});
for(const [name,patch] of [
  ['missing database',{DATABASE_URL:undefined}],['invalid URL',{DATABASE_URL:secret}],
  ['insecure remote TLS',{DATABASE_URL:environment.DATABASE_URL.replace('require','disable')}],
  ['wrong service',{RENDER_SERVICE_ID:'srv-wrong'}],['wrong runtime',{NODE_ENV:'test'}],
  ['missing metrics key',{STONE_METRICS_SECRET:undefined}],['missing publication key',{SESSION_SECRET:''}],
]) test(`${name} is not ready`,()=>{
  const result=inspectStoneLaunchEnvironment({...environment,...patch});
  assert.equal(result.ready,false);assert.equal(result.databaseConnected,false);assert.equal(result.publicationAuthorized,false);
  assert.equal(JSON.stringify(result).includes(secret),false);
});
