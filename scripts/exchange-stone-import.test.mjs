import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { hashStoneBytes, validateStoneMedia, stoneMediaKey, selectStoneImportInputs, buildStoneImportRows, stoneImportPlanHash, executeStoneImport } from './lib/exchange-stone-import.mjs';
const require = createRequire(import.meta.url), sharp = require('sharp');
const photo = await sharp({ create: { width: 300, height: 240, channels: 3, background: '#dedede' } }).webp({ lossless: true, effort: 0 }).toBuffer();
const hash = hashStoneBytes(photo), now = Date.parse('2026-09-22T00:00:00Z');
const id = 'tradescout-stone-matrix-basalt';
const source = { id, name: 'Matrix Basalt', material: 'basalt', referenceSizesInches: '126x78', media: { status: 'reviewed', sha256: hash, sourceSha256: 'a'.repeat(64), file: `${id}/${hash}.webp`, reviewedBy: 'synthetic-reviewer', reviewedAt: '2026-09-21T12:00:00Z' } };
const approval = { id, status: 'approved', priceCents: 2775, unit: 'sqft', approvedBy: 'synthetic-owner', approvedAt: '2026-09-21T13:00:00Z' };
const config = { sellerId: 'test-tradescout-seller', categoryId: 'test-category', profileId: 'test-profile', state: 'FL', city: 'Pensacola', county: 'Escambia', secret: 'synthetic-signing-secret-not-production' };
const manifest = { version: 1, items: [source] }, identities = new Map([[id, 'Matrix Basalt']]);
const clone = value => JSON.parse(JSON.stringify(value));
// Explicit cryptographic adapter: transaction behavior is tested separately from canonical HMAC layout.
const signPublication = (row, secret) => createHmac('sha256', secret).update(JSON.stringify([row.id,row.sellerId,row.price,row.images,row.specifications.retailAudience])).digest('hex');
const validatePublication = (row, seller, secret) => row.sellerId === seller && row.specifications.retailPublication.signature === signPublication(row, secret);
const selected = () => selectStoneImportInputs(clone(manifest), [clone(approval)], identities, now).selected;
const build = () => buildStoneImportRows(selected(), config, signPublication, validatePublication);

test('no approval means held inventory, not derived or zero-dollar public prices',()=>{
  const m=clone(manifest);m.items[0].supplierCost=18;m.items[0].candidateRetail=27;
  const result=selectStoneImportInputs(m,[],identities,now);assert.equal(result.selected.length,0);assert.equal(result.held.length,1);
});
for(const patch of [{status:'pending'},{priceCents:0},{priceCents:-1},{priceCents:27.75},{priceCents:10000000000},{priceCents:'2775'},{unit:'installed_sqft'},{approvedBy:''},{approvedAt:'future'},{approvedAt:'2027-01-01T00:00:00Z'}]) test(`invalid approval ${JSON.stringify(patch)} is rejected`,()=>assert.throws(()=>selectStoneImportInputs(manifest,[{...approval,...patch}],identities,now)));
test('duplicates and unknown source identities cannot create additional rows',()=>{
  assert.throws(()=>selectStoneImportInputs(manifest,[approval,approval],identities,now));
  assert.throws(()=>selectStoneImportInputs({...manifest,items:[source,source]},[],identities,now));
  assert.throws(()=>selectStoneImportInputs({...manifest,items:[{...source,name:'Taj Mahal'}]},[],identities,now));
});
test('full-slab prices require exact slab identification',()=>assert.throws(()=>selectStoneImportInputs(manifest,[{...approval,unit:'slab'}],identities,now)));
test('media hold, missing review and path traversal stop an approved row',()=>{
  for(const change of [{status:'pending'},{reviewedBy:''},{file:'../../secrets.webp'},{sha256:'x'}]) {
    const m=clone(manifest);Object.assign(m.items[0].media,change);assert.throws(()=>selectStoneImportInputs(m,[approval],identities,now));
  }
});
test('media validation requires matching bytes and full decoded dimensions',async()=>{
  const meta=await sharp(photo).metadata();const decoded={format:meta.format,width:meta.width,height:meta.height,pages:1,hasMetadata:false};
  validateStoneMedia(photo,hash,decoded);await sharp(photo).raw().toBuffer();
  for(const change of [{width:0},{pages:2},{hasMetadata:true},{format:'jpeg'}])assert.throws(()=>validateStoneMedia(photo,hash,{...decoded,...change}));
  assert.throws(()=>validateStoneMedia(Buffer.from('RIFFxxxxWEBP'),hash,decoded));
  assert.throws(()=>stoneMediaKey('../private',hash));
});
test('public row contains exact cents, correct units and no supplier economics or links',()=>{
  const s=selected();Object.assign(s[0].source,{supplierCost:10,supplierUrl:'https://private.example',supplierPhone:'5555555555'});
  const [row]=buildStoneImportRows(s,config,signPublication,validatePublication);
  assert.equal(row.price,'27.75');assert.equal(row.specifications.priceUnit,'sqft');
  assert.match(row.description,/material only/);assert.equal(row.specifications.retailAudience,'US_EXCEPT_PENSACOLA_FL_CITY');
  assert.equal(row.requiresBuyerVerification,false);assert.equal(row.sellerId,config.sellerId);
  assert.doesNotMatch(JSON.stringify(row),/supplierCost|private\.example|5555555555/);
  assert.equal(row.specifications.availability,'confirm_before_purchase');
});
test('plan fingerprint binds retail price, media and seller, not just listing names',()=>{
 const rows=build(), key=stoneImportPlanHash(rows,config.profileId);
 for(const modify of [r=>r.price='28.75',r=>r.sellerId='supplier',r=>r.specifications.retailPublication.assetSha256='b'.repeat(64)]){const next=clone(rows);modify(next[0]);assert.notEqual(stoneImportPlanHash(next,config.profileId),key);}
 assert.notEqual(stoneImportPlanHash(rows,'wrong-profile'),key);
});

/** Real local SQLite commit/rollback; PG isolation, advisory locks and types are adapters. */
function harness() {
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE marketplace_listings(id TEXT PRIMARY KEY,seller_id TEXT,category_id TEXT,title TEXT,description TEXT,price TEXT,price_type TEXT,county TEXT,state TEXT,city TEXT,condition TEXT,brand TEXT,status TEXT,images TEXT,specifications TEXT,requires_buyer_verification INTEGER,is_local_pickup_only INTEGER,will_ship INTEGER,shipping_cost TEXT,primary_image_index INTEGER,expires_at TEXT);
 CREATE TABLE public_media_objects(object_key TEXT PRIMARY KEY,body BLOB,content_type TEXT,etag TEXT,cache_control TEXT,metadata TEXT);`);
 const trace=[];let fail=null,dropCommit=false;
 const client={async query(query,values=[]){trace.push({query,values});
  if(query.startsWith('BEGIN')){db.exec('BEGIN');return {rows:[]};}
  if(query.includes('pg_advisory_xact_lock'))return {rows:[]};
  if(fail && query.includes(fail)){fail=null;throw new Error('injected write failure');}
  if(query==='COMMIT'||query==='ROLLBACK'){db.exec(query);if(query==='COMMIT'&&dropCommit){dropCommit=false;throw new Error('lost commit acknowledgement');}return {rows:[]};}
  const params=[];const sql=query.replace(/::jsonb/g,'').replace(/\$(\d+)/g,(_,n)=>{params.push(values[Number(n)-1]);return '?';});
  const rows=db.prepare(sql).all(...params).map(row=>{row={...row};for(const key of ['requires_buyer_verification','is_local_pickup_only','will_ship'])if(key in row)row[key]=Boolean(row[key]);for(const key of ['images','specifications'])if(key in row)row[key]=JSON.parse(row[key]);if(row.body)row.body=Buffer.from(row.body);return row;});return {rows};
 }};
 const args={client,selected:selected(),assets:new Map([[id,photo]]),resolveConfig:async()=>config,signPublication,validatePublication};
 const counts=()=>[db.prepare('SELECT count(*) AS n FROM marketplace_listings').get().n,db.prepare('SELECT count(*) AS n FROM public_media_objects').get().n];
 return {db,args,trace,counts,fail:value=>fail=value,drop:()=>dropCommit=true};
}
test('dry run is read-only and uploads no photos',async()=>{
 const h=harness();const result=await executeStoneImport(h.args);assert.equal(result.mode,'dry_run');assert.deepEqual(h.counts(),[0,0]);assert.equal(h.trace[0].query,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(h.trace.at(-1).query,'ROLLBACK');assert.equal(h.trace.some(x=>x.query.startsWith('INSERT')),false);
});
test('explicit apply saves matching photo/listing and retry creates neither twice',async()=>{
 const h=harness(),plan=await executeStoneImport(h.args);const args={...h.args,apply:true,expectedPlan:plan.planHash};
 const result=await executeStoneImport(args);assert.equal(result.inserted,1);assert.equal(result.mediaInserted,1);assert.deepEqual(h.counts(),[1,1]);
 const repeated=await executeStoneImport(args);assert.equal(repeated.inserted,0);assert.equal(repeated.mediaInserted,0);assert.equal(repeated.unchanged,1);
});
test('failed listing write rolls its photo back',async()=>{
 const h=harness(),plan=await executeStoneImport(h.args);h.fail('INSERT INTO marketplace_listings');await assert.rejects(executeStoneImport({...h.args,apply:true,expectedPlan:plan.planHash}));assert.deepEqual(h.counts(),[0,0]);
});
test('lost COMMIT acknowledgement is recoverable without a duplicate',async()=>{
 const h=harness(),plan=await executeStoneImport(h.args),args={...h.args,apply:true,expectedPlan:plan.planHash};h.drop();await assert.rejects(executeStoneImport(args));assert.deepEqual(h.counts(),[1,1]);const retry=await executeStoneImport(args);assert.equal(retry.inserted,0);assert.equal(retry.unchanged,1);
});
test('seller configuration failure prevents all inserts',async()=>{
 const h=harness();await assert.rejects(executeStoneImport({...h.args,resolveConfig:async()=>{throw new Error('seller unresolved');}}));assert.deepEqual(h.counts(),[0,0]);
});
test('apply without exact plan is refused',async()=>{
 const h=harness();await assert.rejects(executeStoneImport({...h.args,apply:true,expectedPlan:'a'.repeat(64)}));assert.deepEqual(h.counts(),[0,0]);
});
test('edited existing price is a conflict, not an overwrite',async()=>{
 const h=harness(),plan=await executeStoneImport(h.args),args={...h.args,apply:true,expectedPlan:plan.planHash};await executeStoneImport(args);
 h.db.prepare('UPDATE marketplace_listings SET price=? WHERE id=?').run('99.00',id);
 await assert.rejects(executeStoneImport(args),/no overwrite/);assert.equal(h.db.prepare('SELECT price FROM marketplace_listings').get().price,'99.00');
});
test('same photo key with changed bytes stops instead of replacing the object',async()=>{
 const h=harness(),plan=await executeStoneImport(h.args),args={...h.args,apply:true,expectedPlan:plan.planHash};await executeStoneImport(args);
 h.db.prepare('UPDATE public_media_objects SET body=?').run(Buffer.from('corrupt'));
 await assert.rejects(executeStoneImport(args),/immutable photo differs/);assert.deepEqual(h.counts(),[1,1]);
});
test('import entrypoint binds canonical identities, signer, exposure and full image decode',()=>{
 const code=fs.readFileSync(new URL('./import-exchange-stone.ts',import.meta.url),'utf8');
 for(const needle of ['stoneCatalog','stonePublicationSignature','validStonePublication','exposureAuthoritySqlPredicate','sanitizePublicListingText','securePostgresConnectionString','current_database()','display_name=\'TradeScout\'','await image.raw().toBuffer()','expected-host','expected-database'])assert.ok(code.includes(needle),needle);
 assert.doesNotMatch(code,/getMarketplaceListing|UPDATE site_settings|INSERT INTO site_settings/);
});
