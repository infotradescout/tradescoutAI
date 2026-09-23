import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inspectJwFeatureSchema } from '../lib/jw-feature-schema.mjs';
const columns=['id','key','name','description','category','created_at','updated_at'].map(column_name=>({column_name,data_type:'character varying'}));
columns.push({column_name:'enabled',data_type:'boolean'},{column_name:'config',data_type:'jsonb'});
const client=(rows=columns,unique=true)=>({query:async text=>({rows:text.includes('information_schema')?rows:unique?[{exists:1}]:[]})});
test('existing complete flag storage is accepted without writing or seeding',async()=>{
  assert.deepEqual(await inspectJwFeatureSchema(client()),{contract:true,missing:[]});
});
test('an absent table is a deployment defect, not an empty enabled flag',async()=>{
  const proof=await inspectJwFeatureSchema(client([],false)); assert.equal(proof.contract,false);
  assert(proof.missing.includes('feature_flags.enabled:boolean'));
});
test('malformed config column and missing unique key are rejected',async()=>{
  const proof=await inspectJwFeatureSchema(client(columns.filter(x=>x.column_name!=='config'),false));
  assert.deepEqual(proof.missing,['feature_flags.config:jsonb','feature_flags.key:unique']);
});
test('ordered migration does not switch JW off or overwrite existing feature records',()=>{
  const text=fs.readFileSync(new URL('../../migrations/0140_jw_feature_control_storage.sql',import.meta.url),'utf8');
  assert.match(text,/CREATE TABLE IF NOT EXISTS public\.feature_flags/);
  assert.doesNotMatch(text,/\b(?:INSERT INTO|UPDATE|DELETE FROM|DROP TABLE|TRUNCATE)\b/i);
  const journal=JSON.parse(fs.readFileSync(new URL('../../migrations/meta/_journal.json',import.meta.url),'utf8'));
  const featureTag='0140_jw_feature_control_storage';
  const featureEntries=journal.entries.filter(entry=>entry.tag===featureTag);
  assert.equal(featureEntries.length,1,'JW feature storage must appear exactly once');
  const featurePosition=journal.entries.findIndex(entry=>entry.tag===featureTag);
  for(const retailTag of ['0140_exchange_stone_funnel','0141_exchange_stone_inquiry_receipts']){
    const retailPosition=journal.entries.findIndex(entry=>entry.tag===retailTag);
    assert(retailPosition>=0,`${retailTag} missing from journal`);
    const retail=journal.entries[retailPosition];
    assert(featurePosition>retailPosition,`${featureTag} must follow ${retailTag}`);
    assert(featureEntries[0].idx>retail.idx);
    assert(featureEntries[0].when>retail.when);
  }
});
