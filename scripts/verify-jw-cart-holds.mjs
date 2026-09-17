import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import pg from 'pg';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const output=path.resolve('test-results/jw-cart-holds');
if(!process.argv.includes('--exact-copy')) {
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'jw-hold-proof-'));
  const checkout=path.join(temporary,'source'); let status=1;
  try {
    execFileSync('git',['clone','--no-hardlinks','--no-checkout',process.cwd(),checkout],{stdio:'inherit'});
    execFileSync('git',['-C',checkout,'checkout','--detach',head],{stdio:'inherit'});
    assert.equal(execFileSync('git',['-C',checkout,'status','--porcelain'],{encoding:'utf8'}).trim(),'');
    execFileSync('npm',['ci','--include=dev'],{cwd:checkout,stdio:'inherit',timeout:300000});
    const result=spawnSync(process.execPath,['scripts/verify-jw-cart-holds.mjs','--exact-copy'],{cwd:checkout,env:process.env,stdio:'inherit',timeout:1200000});
    status=result.status??1;
    await fs.mkdir(output,{recursive:true});
    await fs.cp(path.join(checkout,'test-results/jw-cart-holds'),output,{recursive:true});
  } finally { await fs.rm(temporary,{recursive:true,force:true}); }
  process.exit(status);
}
const report={head,startedAt:new Date().toISOString(),passed:false,releaseApproved:false,productionWrites:false,steps:[]};
let database;
function run(name,command,args,env={}) {
  const result=spawnSync(command,args,{env:{...process.env,...env},encoding:'utf8',timeout:600000,maxBuffer:20*1024*1024});
  const text=((result.stdout||'')+(result.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[DISPOSABLE_DATABASE]');
  console.log(text.slice(-18000));
  report.steps.push({name,exitCode:result.status,passed:result.status===0});
  assert.equal(result.status,0,name+' failed: '+text.slice(-5000));
  return text;
}
try {
  for(const key of ['DATABASE_URL','TEST_DATABASE_URL','STRIPE_SECRET_KEY','JW_STONE_PRICING_APPROVED_IMPORT','JW_CART_DEPLOYED_SHA']) assert(!process.env[key],'No production credentials or mode may be inherited: '+key);
  assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
  run('Full TypeScript','npm',['run','check']);
  run('Existing shipped availability and membership HTTP regressions','npm',['run','test:run','--','server/tests/jw-stone-member-pricing-route.behavior.test.ts','server/tests/jw-stone-cart-availability.test.ts','--maxWorkers=2']);
  database=await startCabinetLoopbackTestDatabase();
  const client=new pg.Client({connectionString:database.url}); await client.connect();
  try { await client.query('CREATE DATABASE ts_jw_hold_test'); await client.query('CREATE DATABASE ts_jw_hold_compat_test'); } finally { await client.end(); }
  const target=new URL(database.url); target.pathname='/ts_jw_hold_test';
  report.database=database.evidence;
  const native=run('Native hold lifecycle and competing-writer transactions',process.execPath,['--import','tsx','scripts/jw-stone-cart-holds.native.ts'],{
    NODE_ENV:'test',TEST_DATABASE_URL:target.href,JW_HOLD_NATIVE_FIXTURE:'true',ALLOW_INSECURE_TEST_DATABASE:'true',
  });
  const line=native.split('\n').find(value=>value.startsWith('JW_HOLD_NATIVE_SUMMARY '));
  assert(line,'Native test receipt missing'); report.native=JSON.parse(line.slice('JW_HOLD_NATIVE_SUMMARY '.length));
  assert.equal(report.native.passed,true);
  target.pathname='/ts_jw_hold_compat_test';
  const compatibilityEnv={NODE_ENV:'test',DATABASE_URL:target.href,TEST_DATABASE_URL:target.href,ALLOW_INSECURE_TEST_DATABASE:'true',JW_HOLD_COMPAT_FIXTURE:'true'};
  run('Canonical base migrations on a second fresh native database','npm',['run','db:migrate'],compatibilityEnv);
  run('Independent canonical required-schema verification','npm',['run','db:verify:required'],compatibilityEnv);
  const compatibility=run('Actual account, pricing and published-stock compatibility',process.execPath,['--import','tsx','scripts/jw-stone-cart-holds.compat.ts'],compatibilityEnv);
  const compatibilityLine=compatibility.split('\n').find(value=>value.startsWith('JW_HOLD_COMPAT_SUMMARY '));
  assert(compatibilityLine,'Full-schema compatibility receipt missing');
  report.compatibility=JSON.parse(compatibilityLine.slice('JW_HOLD_COMPAT_SUMMARY '.length)); assert.equal(report.compatibility.passed,true);
  assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
  report.passed=true;
} catch(error) {
  report.error=String(error.stack||error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[DISPOSABLE_DATABASE]');
  console.error('JW_HOLD_PROOF_FAILURE '+report.error); process.exitCode=1;
} finally {
  await database?.stop(); report.finishedAt=new Date().toISOString();
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(report,null,2));
  await fs.writeFile(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(output,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>JW Stone reservation transaction proof</h1><p>Isolated tests only; not a storefront or production release.</p><a href="evidence.json">Exact-source evidence</a>');
  console.log('JW_HOLD_PROOF_SUMMARY '+JSON.stringify(report));
}
