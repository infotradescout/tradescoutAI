import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STONE_TABLES, STONE_COLUMNS, STONE_CHECKS, STONE_KEYS, STONE_FOREIGN_KEYS, STONE_SCHEMA_QUERY, stoneSchemaProblems, assertExchangeStoneSchema } from './lib/exchange-stone-schema.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function snapshot() {
  return {
    columns: Object.entries(STONE_COLUMNS).flatMap(([table,columns])=>Object.entries(columns).map(([column,type])=>({table,column,type,notNull:true,default:column==='created_at'?'now()':null}))),
    constraints: [
      ...Object.entries(STONE_CHECKS).flatMap(([table,checks])=>checks.map(definition=>({table,kind:'c',validated:true,definition}))),
      ...STONE_KEYS.map(key=>({...key,validated:true,deferrable:false})),
      ...STONE_FOREIGN_KEYS.map(([column,targetTable])=>({table:STONE_TABLES[1],kind:'f',columns:[column],targetColumns:['id'],targetSchema:'public',targetTable,validated:true,deferrable:false,onDelete:'a',onUpdate:'a'})),
    ],
    indexes: [...STONE_KEYS.map(key=>({table:key.table,columns:key.columns,unique:true})), {table:STONE_TABLES[1],columns:['buyer_id','listing_id','seller_id','fingerprint','created_at'],unique:false}].map(row=>({...row,descending:row.columns.map((_,i)=>!row.unique && i===4),valid:true,ready:true,immediate:true,method:'btree',predicate:null})),
  };
}
test('verifies complete native column/constraint/index shapes, not only table names',()=>assert.deepEqual(stoneSchemaProblems(snapshot()),[]));
for (const [name,mutate] of [
  ['missing tables',s=>{s.columns=[];}],
  ['changed column type',s=>{s.columns[0].type='character varying';}],
  ['nullable identity',s=>{s.columns[0].notNull=false;}],
  ['missing timestamp default',s=>{s.columns.find(c=>c.column==='created_at').default=null;}],
  ['weakened same-named constraint',s=>{s.constraints[0].definition='CHECK (true)';}],
  ['unvalidated constraint',s=>{s.constraints[0].validated=false;}],
  ['missing evidence uniqueness',s=>{s.constraints=s.constraints.filter(c=>c.kind!=='u');}],
  ['invalid index',s=>{s.indexes[0].valid=false;}],
  ['unready index',s=>{s.indexes[0].ready=false;}],
  ['partial identity index',s=>{s.indexes[0].predicate='event_key IS NOT NULL';}],
  ['deferred key',s=>{s.indexes[0].immediate=false;}],
  ['foreign key into another schema',s=>{s.constraints.find(c=>c.kind==='f').targetSchema='other';}],
  ['unexpected cascading deletion',s=>{s.constraints.find(c=>c.kind==='f').onDelete='c';}],
  ['missing lookup index',s=>{s.indexes.pop();}],
  ['wrong lookup direction',s=>{s.indexes.at(-1).descending[4]=false;}],
  ['cast text embedded inside a literal',s=>{s.constraints[1].definition=s.constraints[1].definition.replace("'production'", "'production::text'");}],
  ['whitespace embedded inside a literal',s=>{s.constraints[1].definition=s.constraints[1].definition.replace("'production'", "'produ ction'");}],
]) test(`refuses ${name}`,()=>{const s=snapshot();mutate(s);assert.ok(stoneSchemaProblems(s).length>0);});
test('parameterizes schema selection and requires exactly one inspection result',async()=>{
  let called;
  const client={query:async(sql,params)=>{called={sql,params};return {rows:[snapshot()]};}};
  assert.equal((await assertExchangeStoneSchema(client)).status,'verified');
  assert.equal(called.sql,STONE_SCHEMA_QUERY);assert.deepEqual(called.params,['public',STONE_TABLES]);
  await assert.rejects(assertExchangeStoneSchema(client,"public';drop"),/Invalid schema/);
  await assert.rejects(assertExchangeStoneSchema({query:async()=>({rows:[]})}),/one snapshot/);
});
test('canonical migrations are enrolled once after existing history with unchanged staged DDL',()=>{
  const j=JSON.parse(fs.readFileSync(path.join(root,'migrations/meta/_journal.json'),'utf8'));
  assert.ok(j.entries.length>=145);
  assert.equal(createHash('sha256').update(JSON.stringify(j.entries.slice(0,143))).digest('hex'),'f8d1477ba5346bf1370b099d8464910e9dadd95c38812bb98c6b7d0277560894');
  assert.equal(j.entries.filter(e=>e.tag==='0140_exchange_stone_funnel').length,1);
  assert.equal(j.entries.filter(e=>e.tag==='0141_exchange_stone_inquiry_receipts').length,1);
  for(const [idx,tag,staged] of [[143,'0140_exchange_stone_funnel','exchange-stone-funnel.sql'],[144,'0141_exchange_stone_inquiry_receipts','exchange-stone-inquiry.sql']]) {
    assert.equal(j.entries[idx].idx,idx);assert.equal(j.entries[idx].tag,tag);
    assert.ok(j.entries[idx].when>Math.max(...j.entries.slice(0,idx).map(e=>e.when)));
    const canonical=fs.readFileSync(path.join(root,'migrations',tag+'.sql'),'utf8');
    const old=fs.readFileSync(path.join(root,'scripts/sql',staged),'utf8');
    assert.equal(canonical.slice(canonical.indexOf('CREATE TABLE')),old.slice(old.indexOf('CREATE TABLE')));
  }
});
function launch({baseExit=0,stoneExit=0,missing=false,pair=false,bundled=false,args}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stone-release-'));
  try {
    for(const sub of ['runtime','shared','scripts','dist/release'])fs.mkdirSync(path.join(dir,sub),{recursive:true});
    fs.copyFileSync(path.join(root,'runtime/run-release.mjs'),path.join(dir,'runtime/run-release.mjs'));
    // Explicit fixture: exercise actual launcher/process sequencing, not TLS-provider behavior.
    fs.writeFileSync(path.join(dir,'shared/database-url-security.mjs'),'export const allowExplicitInsecureTestDatabase=()=>false;export const secureDatabaseEnvironment=env=>({...env});');
    const write=(name,exit)=>fs.writeFileSync(path.join(dir,bundled?'dist/release':'scripts',name+'.mjs'),`import fs from 'node:fs';fs.appendFileSync('trace', ${JSON.stringify(name+String.fromCharCode(10))});process.exit(${exit});`);
    write('check-required-production-schema',baseExit);write('db-migrate-safe',0);
    if(!missing)write('check-exchange-stone-schema',stoneExit);
    const normal=pair?['db-migrate-safe','scripts/db-migrate-safe.mjs','&&','npm','run','db:verify:required']:['check-required-production-schema','scripts/check-required-production-schema.mjs'];
    const result=spawnSync(process.execPath,['runtime/run-release.mjs',...(args||normal)],{cwd:dir,encoding:'utf8',env:{...process.env,DATABASE_URL:'',TEST_DATABASE_URL:''}});
    return {status:result.status,trace:fs.existsSync(path.join(dir,'trace'))?fs.readFileSync(path.join(dir,'trace'),'utf8').trim().split('\n'):[],stderr:result.stderr};
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('canonical startup verifier includes stone schema',()=>assert.deepEqual(launch().trace,['check-required-production-schema','check-exchange-stone-schema']));
test('base schema failure stops before stone verification',()=>{const r=launch({baseExit:9});assert.equal(r.status,9);assert.deepEqual(r.trace,['check-required-production-schema']);});
test('stone schema failure fails the release',()=>assert.equal(launch({stoneExit:7}).status,7));
test('missing verifier stops before any migration',()=>{const r=launch({missing:true,pair:true});assert.notEqual(r.status,0);assert.deepEqual(r.trace,[]);});
test('canonical migration/check pair retains both independent verifiers',()=>assert.deepEqual(launch({pair:true,bundled:true}).trace,['db-migrate-safe','check-required-production-schema','check-exchange-stone-schema']));
test('unapproved shell command sequences remain rejected',()=>{const r=launch({args:['db-migrate-safe','scripts/db-migrate-safe.mjs',';','echo','done']});assert.notEqual(r.status,0);assert.deepEqual(r.trace,[]);});
test('new verifier is bundled and direct migrate path invokes it',()=>{
  assert.ok(fs.readFileSync(path.join(root,'build-server.mjs'),'utf8').includes("'check-exchange-stone-schema': 'scripts/check-exchange-stone-schema.mjs'"));
  const source=fs.readFileSync(path.join(root,'scripts/db-migrate-safe.mjs'),'utf8');
  assert.ok(source.includes('requiredSchemaEntrypoint("check-exchange-stone-schema")'));
  assert.ok(source.indexOf('const verifiers =')<source.indexOf('const status = await runVerifiedMigration'));
});
