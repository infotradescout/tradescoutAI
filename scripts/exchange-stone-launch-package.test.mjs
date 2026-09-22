import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { STONE_LAUNCH, stoneLaunchHash, readStoneStoredArchive, validateStoneLaunchDocuments, downloadStoneLaunch } from './lib/exchange-stone-launch-package.mjs';

function archive(entries, patch = {}) {
  const pieces = [];
  for (const [name, contents] of entries) {
    const filename = Buffer.from(name), bytes = Buffer.from(contents);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(patch.flags || 0,6); header.writeUInt16LE(patch.method || 0,8);
    header.writeUInt32LE(bytes.length,18); header.writeUInt32LE(bytes.length,22); header.writeUInt16LE(filename.length,26);
    pieces.push(header, filename, bytes);
  }
  const directory = Buffer.alloc(4); directory.writeUInt32LE(0x02014b50); pieces.push(directory);
  const bytes = Buffer.concat(pieces);
  return { bytes, pin: { size: bytes.length, sha256: stoneLaunchHash(bytes), fileCount: entries.length } };
}
const example = () => archive([['catalog.json','{}'],['approvals.json','[]']]);
test('only exact SHA-bound stored archive bytes are accepted', () => {
  const { bytes, pin } = example(); assert.equal(readStoneStoredArchive(bytes,pin).size,2);
  assert.throws(() => readStoneStoredArchive(bytes,{...pin,sha256:'0'.repeat(64)}));
  assert.throws(() => readStoneStoredArchive(bytes,{...pin,size:bytes.length+1}));
  assert.throws(() => readStoneStoredArchive(bytes,{...pin,fileCount:3}));
});
for (const name of ['../private','/absolute','prepared-media/../../private','catalog.json/evil','prepared-media/x/secret.webp','server.js']) test(`archive path ${name} cannot be extracted`, () => {
  const {bytes,pin} = archive([[name,'content']]); assert.throws(() => readStoneStoredArchive(bytes,pin));
});
test('encrypted, streaming-descriptor and compressed entries are refused', () => {
  for (const patch of [{flags:1},{flags:8},{method:8}]) { const {bytes,pin}=archive([['catalog.json','{}']],patch); assert.throws(()=>readStoneStoredArchive(bytes,pin)); }
});
test('duplicates, truncated data and excess entries fail before extraction', () => {
  let x=archive([['catalog.json','{}'],['catalog.json','{}']]);assert.throws(()=>readStoneStoredArchive(x.bytes,x.pin));
  x=example();const truncated=x.bytes.subarray(0,-2);assert.throws(()=>readStoneStoredArchive(truncated,{...x.pin,size:truncated.length,sha256:stoneLaunchHash(truncated)}));
  assert.throws(()=>readStoneStoredArchive(x.bytes,{...x.pin,fileCount:1}));
});
test('validated documents bind prices and each photo to the approved material', () => {
  const id='tradescout-stone-test',photo=Buffer.from('synthetic-reviewed-photo'),hash=stoneLaunchHash(photo);
  const approved={approvedBy:'test-owner',approvedAt:'2026-09-22T00:00:00Z',prices:[{id,priceCents:2775}]};
  const prices=[{id,priceCents:2775,unit:'sqft',status:'approved',approvedBy:approved.approvedBy,approvedAt:approved.approvedAt}];
  const catalog={version:1,items:[{id,media:{status:'reviewed',sha256:hash,file:`${id}/${hash}.webp`}}]};
  const make = (p=prices,c=catalog) => {
    const cb=Buffer.from(JSON.stringify(c)),pb=Buffer.from(JSON.stringify(p));
    return {files:new Map([['catalog.json',cb],['approvals.json',pb],[`prepared-media/${id}/${hash}.webp`,photo]]),pin:{count:1,catalogSha256:stoneLaunchHash(cb),approvalsSha256:stoneLaunchHash(pb)}};
  };
  let x=make();assert.equal(validateStoneLaunchDocuments(x.files,approved,x.pin).prices[0].priceCents,2775);
  x=make([{...prices[0],priceCents:3000}]);assert.throws(()=>validateStoneLaunchDocuments(x.files,approved,x.pin));
  x=make([{...prices[0],unit:'slab'}]);assert.throws(()=>validateStoneLaunchDocuments(x.files,approved,x.pin));
  x=make();x.files.set(`prepared-media/${id}/${hash}.webp`,Buffer.from('changed'));assert.throws(()=>validateStoneLaunchDocuments(x.files,approved,x.pin));
});
test('connector download disallows redirects to arbitrary hosts and oversize responses', async () => {
  const {bytes,pin}=example();let calls=0;
  const fetcher=async (_url,options)=>{calls++;assert.equal(options.redirect,'error');return new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}});};
  assert((await downloadStoneLaunch('https://test.oaiusercontent.com/file',fetcher,pin)).equals(bytes));
  for(const url of ['http://test.oaiusercontent.com/file','https://example.com/file','https://test.oaiusercontent.com.evil.example/file','https://name:password@test.oaiusercontent.com/file','https://test.oaiusercontent.com:4430/file'])await assert.rejects(downloadStoneLaunch(url,fetcher,pin));
  assert.equal(calls,1);
  await assert.rejects(downloadStoneLaunch('https://test.oaiusercontent.com/file',async()=>new Response(Buffer.concat([bytes,Buffer.from('x')])),pin));
});
function launcher({mode,baseExit=0,stoneExit=0,launchExit=0,missing=false}={}) {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'stone-launcher-'));
  try {
    for(const name of ['runtime','shared','scripts'])fs.mkdirSync(path.join(temp,name));
    fs.copyFileSync('runtime/run-release.mjs',path.join(temp,'runtime/run-release.mjs'));
    fs.writeFileSync(path.join(temp,'shared/database-url-security.mjs'),'export const allowExplicitInsecureTestDatabase=()=>false;export const secureDatabaseEnvironment=env=>env;');
    for(const [name,status] of [['db-migrate-safe',0],['check-required-production-schema',baseExit],['check-exchange-stone-schema',stoneExit],['apply-exchange-stone-package',launchExit]]) {
      if(missing&&name==='apply-exchange-stone-package')continue;
      fs.writeFileSync(path.join(temp,'scripts',name+'.mjs'),`import fs from 'node:fs';fs.appendFileSync('trace',${JSON.stringify(name+'\n')});process.exit(${status});`);
    }
    const env={...process.env};delete env.STONE_RETAIL_LAUNCH_MODE;if(mode!==undefined)env.STONE_RETAIL_LAUNCH_MODE=mode;
    const result=spawnSync(process.execPath,['runtime/run-release.mjs','db-migrate-safe','scripts/db-migrate-safe.mjs','&&','npm','run','db:verify:required'],{cwd:temp,env,encoding:'utf8'});
    return {status:result.status,trace:fs.existsSync(path.join(temp,'trace'))?fs.readFileSync(path.join(temp,'trace'),'utf8').trim().split('\n'):[]};
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
}
test('normal releases never invoke publication',()=>assert.deepEqual(launcher().trace,['db-migrate-safe','check-required-production-schema','check-exchange-stone-schema']));
test('explicit apply runs only after both schema verifiers',()=>assert.deepEqual(launcher({mode:'apply'}).trace,['db-migrate-safe','check-required-production-schema','check-exchange-stone-schema','apply-exchange-stone-package']));
test('schema failure prevents launch and missing launch artifact prevents any migration',()=>{
 const base=launcher({mode:'apply',baseExit:3});assert.equal(base.status,3);assert(!base.trace.includes('apply-exchange-stone-package'));
 const stone=launcher({mode:'apply',stoneExit:4});assert.equal(stone.status,4);assert(!stone.trace.includes('apply-exchange-stone-package'));
 const missing=launcher({mode:'apply',missing:true});assert.notEqual(missing.status,0);assert.deepEqual(missing.trace,[]);
});
test('unknown launch mode and failed launch cannot pass release',()=>{
 const bad=launcher({mode:'yes'});assert.notEqual(bad.status,0);assert.deepEqual(bad.trace,[]);
 assert.equal(launcher({mode:'apply',launchExit:7}).status,7);
});
test('fixed launch is restricted to the exact confirmed service and owner schedule',()=>{
 assert.equal(STONE_LAUNCH.count,96);assert.equal(STONE_LAUNCH.fileCount,98);assert.equal(STONE_LAUNCH.database,'neondb');
 const code=fs.readFileSync('scripts/apply-exchange-stone-package.mjs','utf8');
 for(const marker of ['RENDER_SERVICE_ID','STONE_METRICS_SECRET','SESSION_SECRET','already_applied','--expected-plan=','validateStoneLaunchDocuments','INSERT INTO site_settings'])assert(code.includes(marker));
 assert(!code.includes('UPDATE users'));assert(!code.includes('UPDATE marketplace_listings'));
});
