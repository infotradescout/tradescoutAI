import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {startCabinetLoopbackTestDatabase} from './start-cabinet-loopback-test-db.mjs';
import {inspectScoutReceiptSchema, SCOUT_RECEIPT_MIGRATION_HASHES, SCOUT_RECEIPT_MIGRATION_TAG} from './lib/scout-receipt-schema.mjs';

for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STRIPE_SECRET_KEY','GEMINI_API_KEY','OPENAI_API_KEY']) {
  assert(!process.env[key],key+' must not be inherited by disposable schema proof');
}
const proof={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  startedAt:new Date().toISOString(),scope:'Independent read-only catalog verifier against disposable native PostgreSQL and deliberately damaged schema',cases:[],passed:false};
let database,sql;
async function check(name,fn){
  try{await fn();proof.cases.push({name,passed:true});}
  catch(error){proof.cases.push({name,passed:false,error:String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TEST_DATABASE]')});}
  console.log('SCOUT_RECEIPT_SCHEMA_CASE '+JSON.stringify(proof.cases.at(-1)));
}
async function damaged(name,mutation){
  await check(name,async()=>{
    await sql.query('BEGIN');
    try{await sql.query(mutation);const result=await inspectScoutReceiptSchema(sql);assert.equal(result.contract,false);assert(result.missing.length>0);}
    finally{await sql.query('ROLLBACK');}
  });
}
try{
  const journal=JSON.parse(fs.readFileSync('migrations/meta/_journal.json','utf8'));
  await check('0139 is registered once after all existing migration entries',async()=>{
    const entries=journal.entries.filter(entry=>entry.tag===SCOUT_RECEIPT_MIGRATION_TAG);
    assert.equal(entries.length,1);assert.equal(journal.entries.at(-1).tag,SCOUT_RECEIPT_MIGRATION_TAG);
    assert.equal(entries[0].idx,journal.entries.length-1);
    assert(entries[0].when>Math.max(...journal.entries.slice(0,-1).map(entry=>entry.when)));
    assert.equal(new Set(journal.entries.map(entry=>entry.idx)).size,journal.entries.length);
  });
  database=await startCabinetLoopbackTestDatabase();proof.database=database.evidence;
  assert(['127.0.0.1','localhost'].includes(new URL(database.url).hostname));
  sql=new pg.Client({connectionString:database.url});await sql.connect();
  await sql.query('CREATE TABLE users(id varchar PRIMARY KEY); CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(hash text NOT NULL)');
  await sql.query(fs.readFileSync('migrations/0139_scout_execution_receipts.sql','utf8'));
  await sql.query('INSERT INTO drizzle.__drizzle_migrations(hash) VALUES($1)',[SCOUT_RECEIPT_MIGRATION_HASHES[0]]);
  await check('Canonical receipt schema and migration hash pass a read-only transaction',async()=>{
    await sql.query('BEGIN READ ONLY');
    try{const result=await inspectScoutReceiptSchema(sql);assert.deepEqual(result.missing,[]);assert.equal(result.contract,true);}
    finally{await sql.query('ROLLBACK');}
  });
  await damaged('Missing receipt table is rejected','ALTER TABLE scout_execution_receipts RENAME TO absent_scout_receipts');
  await damaged('Missing migration ledger is rejected','ALTER TABLE drizzle.__drizzle_migrations RENAME TO absent_ledger');
  await damaged('Missing canonical migration hash is rejected','DELETE FROM drizzle.__drizzle_migrations');
  await damaged('A successful migration ledger cannot conceal a wrong default',"ALTER TABLE scout_execution_receipts ALTER COLUMN status SET DEFAULT 'completed'");
  await damaged('Changed execution-key width is rejected','ALTER TABLE scout_execution_receipts ALTER COLUMN execution_id TYPE varchar(256)');
  await damaged('Incorrect receipt-result nullability is rejected','ALTER TABLE scout_execution_receipts ALTER COLUMN result SET NOT NULL');
  await damaged('Missing status lookup index is rejected','DROP INDEX scout_execution_receipts_status_created_idx');
  const constraints=(await sql.query("SELECT conname,contype FROM pg_constraint WHERE conrelid='scout_execution_receipts'::regclass ORDER BY conname")).rows;
  for(const constraint of constraints){
    const quoted='"'+constraint.conname.replaceAll('"','""')+'"';
    await damaged('Missing '+constraint.conname+' is rejected','ALTER TABLE scout_execution_receipts DROP CONSTRAINT '+quoted);
  }
  await check('Schema checker has not repaired or changed the database during inspection',async()=>{
    const result=await inspectScoutReceiptSchema(sql);assert.equal(result.contract,true);
    const count=Number((await sql.query('SELECT count(*) AS n FROM scout_execution_receipts')).rows[0].n);assert.equal(count,0);
  });
  proof.passed=proof.cases.every(item=>item.passed);
  if(!proof.passed){
    console.log('SCOUT_RECEIPT_SCHEMA_CATALOG '+JSON.stringify((await sql.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='scout_execution_receipts'::regclass ORDER BY conname")).rows));
  }
}finally{
  await sql?.end();await database?.stop();proof.finishedAt=new Date().toISOString();
  proof.totals={passed:proof.cases.filter(item=>item.passed).length,failed:proof.cases.filter(item=>!item.passed).length};
  console.log('SCOUT_RECEIPT_SCHEMA_SUMMARY '+JSON.stringify(proof));
}
assert.equal(proof.passed,true,'Independent Scout receipt schema proof failed');
