/** Emits a transaction-only PostgreSQL proof. No network, production target or
 * credentials are selected here. Execute sql_statements as ONE transaction.
 * Canonical migrations are applied without rewriting their DDL in pg_temp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { STONE_SCHEMA_QUERY, STONE_TABLES } from './lib/exchange-stone-schema.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['0140_exchange_stone_funnel.sql','0141_exchange_stone_inquiry_receipts.sql'];
const definitions=files.map(name=>fs.readFileSync(path.join(root,'migrations',name),'utf8'));
const ddl=definitions.flatMap(text=>text.split(/;\s*(?:\n|$)/).map(s=>s.trim()).filter(Boolean));
const statements=[
 'SAVEPOINT stone_native_proof',
 'CREATE TEMP TABLE users (id varchar PRIMARY KEY) ON COMMIT DROP',
 "CREATE TEMP TABLE decision_cards (id varchar PRIMARY KEY, status text NOT NULL DEFAULT 'active', decided_at timestamptz) ON COMMIT DROP",
 'CREATE TEMP TABLE marketplace_listings (id varchar PRIMARY KEY) ON COMMIT DROP',
 'CREATE TEMP TABLE marketplace_inquiries (id varchar PRIMARY KEY) ON COMMIT DROP',
 'CREATE TEMP TABLE stone_native_results (name text PRIMARY KEY, passed boolean NOT NULL) ON COMMIT DROP',
 'SET LOCAL search_path = pg_temp, pg_catalog',
 "SET LOCAL statement_timeout = '15000ms'",
 ...ddl,
 `CREATE FUNCTION pg_temp.stone_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
    IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Stone assertion failed: %', label; END IF;
    INSERT INTO stone_native_results VALUES(label,true); END $$`,
 `CREATE FUNCTION pg_temp.stone_expect(statement text, expected_state text, label text) RETURNS void LANGUAGE plpgsql AS $$
   BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
     IF SQLSTATE=expected_state THEN INSERT INTO stone_native_results VALUES(label,true); RETURN; END IF;
     RAISE; END; RAISE EXCEPTION 'Expected rejection missing: %',label; END $$`,
 "INSERT INTO users VALUES ('buyer-test'),('seller-test'),('other-buyer')",
 "INSERT INTO decision_cards(id) VALUES ('card-test'),('card-alias'),('card-other'),('card-rollback')",
 "INSERT INTO marketplace_listings VALUES ('tradescout-stone-synthetic')",
 "INSERT INTO marketplace_inquiries VALUES ('inquiry-test')",
 `INSERT INTO exchange_stone_inquiry_receipts
   (buyer_id,request_key,decision_card_id,listing_id,seller_id,fingerprint,inquiry_id,response)
   VALUES ('buyer-test','request-test','card-test','tradescout-stone-synthetic','seller-test',repeat('a',64),'inquiry-test','{"id":"inquiry-test","synthetic":true}'::jsonb)`,
 `INSERT INTO exchange_stone_funnel_events(event_key,evidence_family,evidence_id,stage,environment,payload,fingerprint)
   VALUES ('event-test','saved_inquiry','inquiry-test','inquiry_submitted','test','{"synthetic":true,"acquisition":{"channel":"facebook_marketplace"}}'::jsonb,repeat('b',64))`,
 "SELECT pg_advisory_xact_lock(hashtextextended('TradeScout-native-fixture',0))",
 "SELECT id FROM decision_cards WHERE id='card-test' FOR UPDATE",
 "SELECT pg_temp.stone_assert((SELECT count(*)=1 AND bool_and(created_at IS NOT NULL) FROM exchange_stone_inquiry_receipts),'receipt_and_timestamp_saved')",
];
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
const reject=(sql,state,name)=>statements.push(`SELECT pg_temp.stone_expect(${lit(sql)},${lit(state)},${lit(name)})`);
const receipt=(overrides={})=>{
 const row={buyer_id:"'buyer-test'",request_key:"'request-new'",decision_card_id:"'card-other'",listing_id:"'tradescout-stone-synthetic'",seller_id:"'seller-test'",fingerprint:"repeat('a',64)",inquiry_id:"'inquiry-test'",response:"'{}'::jsonb",...overrides};
 return `INSERT INTO exchange_stone_inquiry_receipts (${Object.keys(row).join(',')}) VALUES (${Object.values(row).join(',')})`;
};
reject(receipt({request_key:"'request-test'"}),'23505','duplicate_buyer_request_rejected');
reject(receipt({decision_card_id:"'card-test'"}),'23505','reused_decision_rejected');
for(const column of ['buyer_id','seller_id','decision_card_id','listing_id','inquiry_id'])reject(receipt({[column]:"'missing-fixture'"}),'23503',`foreign_key_${column}_enforced`);
reject(receipt({fingerprint:"'not-a-hash'"}),'23514','receipt_fingerprint_enforced');
reject(receipt({response:"'[]'::jsonb"}),'23514','receipt_object_response_enforced');
reject(receipt({request_key:"''"}),'23514','empty_request_key_rejected');
reject(receipt({seller_id:"'buyer-test'"}),'23514','self_inquiry_receipt_rejected');
statements.push(receipt({decision_card_id:"'card-alias'",request_key:"'legacy-alias'"}));
statements.push("SELECT pg_temp.stone_assert((SELECT count(*)=2 AND count(DISTINCT inquiry_id)=1 FROM exchange_stone_inquiry_receipts),'legacy_receipt_alias_preserves_one_inquiry')");
statements.push(receipt({buyer_id:"'other-buyer'",request_key:"'request-test'"}));
statements.push("SELECT pg_temp.stone_assert((SELECT count(*)=2 FROM exchange_stone_inquiry_receipts WHERE request_key='request-test'),'request_identity_scoped_to_buyer')");
statements.push(`INSERT INTO exchange_stone_funnel_events(event_key,evidence_family,evidence_id,stage,environment,payload,fingerprint)
 SELECT 'event-retry',evidence_family,evidence_id,stage,environment,payload,fingerprint FROM exchange_stone_funnel_events
 WHERE event_key='event-test' ON CONFLICT DO NOTHING RETURNING event_key`);
statements.push("SELECT pg_temp.stone_assert((SELECT count(*)=1 FROM exchange_stone_funnel_events),'same_evidence_new_key_not_counted_again')");
const event=(override={})=>{
 const row={event_key:"'invalid-event'",evidence_family:"'saved_inquiry'",evidence_id:"'inquiry-other'",stage:"'inquiry_submitted'",environment:"'test'",payload:"'{}'::jsonb",fingerprint:"repeat('c',64)",...override};
 return `INSERT INTO exchange_stone_funnel_events (${Object.keys(row).join(',')}) VALUES (${Object.values(row).join(',')})`;
};
reject(event({stage:"'call_connected'",evidence_family:"'browser'"}),'23514','browser_click_cannot_be_connected_call');
reject(event({stage:"'call_connected'"}),'23514','saved_inquiry_cannot_be_connected_call');
reject(event({environment:"'preview'"}),'23514','unknown_environment_rejected');
reject(event({payload:"'[]'::jsonb"}),'23514','event_object_payload_enforced');
reject(event({fingerprint:"'not-a-hash'"}),'23514','event_fingerprint_enforced');
statements.push(event({event_key:"'callback-test'",evidence_id:"'inquiry-test'",stage:"'callback_requested'"}));
statements.push("SELECT pg_temp.stone_assert((SELECT count(*) FILTER(WHERE stage='callback_requested')=1 AND count(*) FILTER(WHERE stage='call_connected')=0 FROM exchange_stone_funnel_events),'callback_remains_distinct_from_connected_call')");
statements.push(`DO $$ BEGIN BEGIN
 UPDATE decision_cards SET status='completed',decided_at=now() WHERE id='card-rollback';
 INSERT INTO marketplace_inquiries VALUES ('inquiry-rollback');
 INSERT INTO exchange_stone_funnel_events(event_key,evidence_family,evidence_id,stage,environment,payload,fingerprint)
 VALUES ('event-rollback','saved_inquiry','inquiry-rollback','inquiry_submitted','test','{}',repeat('d',64));
 INSERT INTO exchange_stone_inquiry_receipts(buyer_id,request_key,decision_card_id,listing_id,seller_id,fingerprint,inquiry_id,response)
 VALUES ('buyer-test','rollback-request','card-rollback','tradescout-stone-synthetic','seller-test','invalid','inquiry-rollback','{}');
 RAISE EXCEPTION 'Expected transaction failure missing';
 EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM pg_temp.stone_assert((SELECT status='active' FROM decision_cards WHERE id='card-rollback')
 AND NOT EXISTS(SELECT 1 FROM marketplace_inquiries WHERE id='inquiry-rollback')
 AND NOT EXISTS(SELECT 1 FROM exchange_stone_funnel_events WHERE event_key='event-rollback'), 'failed_receipt_rolls_back_card_inquiry_and_metric'); END $$`);
statements.push(...ddl);
statements.push("SELECT pg_temp.stone_assert((SELECT count(*)=3 FROM exchange_stone_inquiry_receipts) AND (SELECT count(*)=2 FROM exchange_stone_funnel_events),'idempotent_migration_reapply_preserves_records')");
statements.push(STONE_SCHEMA_QUERY.replaceAll('$1','current_schema()').replaceAll('$2::text[]',`ARRAY[${STONE_TABLES.map(lit).join(',')}]::text[]`));
statements.push("SELECT jsonb_agg(jsonb_build_object('name',name,'passed',passed) ORDER BY name) AS assertions, count(*) AS assertion_count, current_setting('server_version') AS postgres_version FROM stone_native_results");
statements.push('ROLLBACK TO SAVEPOINT stone_native_proof');
statements.push("SELECT to_regclass('pg_temp.exchange_stone_funnel_events') IS NULL AND to_regclass('pg_temp.exchange_stone_inquiry_receipts') IS NULL AS temporary_schema_rolled_back, to_regclass('public.exchange_stone_funnel_events') IS NULL AND to_regclass('public.exchange_stone_inquiry_receipts') IS NULL AS public_tables_still_absent");
const output={scope:'Native PostgreSQL schema/query/constraint proof, not multi-process application acceptance',migrations:files.map((file,i)=>({file,sha256:createHash('sha256').update(definitions[i]).digest('hex')})),schemaQuerySha256:createHash('sha256').update(STONE_SCHEMA_QUERY).digest('hex'),sql_statements:statements};
process.stdout.write(JSON.stringify(output,null,2)+'\n');
