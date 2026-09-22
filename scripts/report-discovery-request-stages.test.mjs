import assert from 'node:assert/strict';
import test from 'node:test';
import { REQUEST_STAGES_SQL,reportRequestStages,validateWindow } from './report-discovery-request-stages.mjs';

const FROM='2026-08-24T05:00:00Z',TO='2026-09-21T05:00:00Z';
test('strict UTC windows reject invalid dates, offsets and overlong ranges before querying',()=>{
 assert.deepEqual(validateWindow(FROM,TO),{from:'2026-08-24T05:00:00.000Z',to:'2026-09-21T05:00:00.000Z'});
 for(const [from,to] of [[undefined,TO],[FROM,FROM],[TO,FROM],['2026-02-30T00:00:00Z',TO],['2026-08-24',TO],['2026-08-24T05:00:00+00:00',TO],['2026-01-01T00:00:00Z',TO]])assert.throws(()=>validateWindow(from,to));
});
test('the client uses bounded repeatable-read read-only SQL and bound parameters',async()=>{
 const calls=[];const result=await reportRequestStages({query:async(sql,args)=>{calls.push({sql,args});return sql===REQUEST_STAGES_SQL?{rows:[{report:{created_requests:0,qualified_requests:null}}]}:{rows:[]};}},FROM,TO);
 assert.equal(calls[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert(calls.some(c=>c.sql==="SET LOCAL statement_timeout='8s'"));
 assert(calls.some(c=>c.sql==="SET LOCAL TIME ZONE 'UTC'"));
 assert.deepEqual(calls.find(c=>c.sql===REQUEST_STAGES_SQL).args,[FROM.replace('Z','.000Z'),TO.replace('Z','.000Z')]);
 assert.equal(calls.at(-1).sql,'COMMIT');assert.equal(result.qualified_requests,null);
});
test('query failures roll back and invalid windows never contact the database',async()=>{
 const calls=[];await assert.rejects(()=>reportRequestStages({query:async sql=>{calls.push(sql);if(sql===REQUEST_STAGES_SQL)throw new Error('fixture failure');return{rows:[]};}},FROM,TO));
 assert.equal(calls.at(-1),'ROLLBACK');assert(!calls.includes('COMMIT'));
 let count=0;await assert.rejects(()=>reportRequestStages({query:async()=>{count++;}},'invalid',TO));assert.equal(count,0);
});

test('actual isolated SQL keeps duplicate entries, missing evidence and false outcomes distinct',async()=>{
 // The verifier installs the pinned test-only package in a disposable tools folder.
 // No application dependency or external database is required or modified.
 const {PGlite}=await import(process.env.REQUEST_STAGE_PGLITE_MODULE||'@electric-sql/pglite');
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE events(id text PRIMARY KEY,event_type text,data jsonb,created_at timestamp);
   CREATE TABLE work_requests(id text PRIMARY KEY,created_at timestamp);
   CREATE TABLE work_request_events(id text PRIMARY KEY,work_request_id text,type text,metadata jsonb,created_at timestamp);`);
  let sequence=0;
  const event=async(type,data,time='2026-09-10T12:01:00Z')=>db.query('INSERT INTO events VALUES($1,$2,$3,$4)',[`e${++sequence}`,type,JSON.stringify(data),time]);
  const request=async(id,entry='entry-shared',business='fixture-business')=>{
   await db.query('INSERT INTO work_requests VALUES($1,$2)',[id,'2026-09-10T12:00:00Z']);
   await db.query('INSERT INTO work_request_events VALUES($1,$2,$3,$4,$5)',[`w${++sequence}`,id,'created',JSON.stringify({entryRequestId:entry,businessSlug:business}),'2026-09-10T12:00:00Z']);
  };
  const landing=async(entry,business='fixture-business',time='2026-09-09T12:00:00Z',source='google')=>event('discovery_landing',{entryRequestId:entry,businessSlug:business,sourceHint:source},time);
  const action=async(id,entry='entry-shared')=>event('discovery_action',{stage:'request_submitted',workRequestId:id,journeyId:'dc:'+id,entryRequestId:entry,entity:{type:'business',slug:'fixture-business'},entityKey:'business:fixture-business',evidenceStrength:'direct_server_observed',entryLinkage:'server_observed_match'});
  const outcome=async(id,extra={},time='2026-09-10T12:02:00Z')=>event('discovery_outcome',{workRequestId:id,journeyId:'dc:'+id,entity:{type:'business',slug:'fixture-business'},entityKey:'business:fixture-business',evidenceStrength:'direct_server_observed',entryLinkage:'server_observed_match',outcomeKind:'requester_verified_complete',outcomeState:'completed',actorAuthority:'authenticated_requester',...extra},time);
  const read=async()=>reportRequestStages(db,FROM,TO);
  const empty=await read();assert.equal(empty.created_requests,0);assert.equal(empty.qualified_requests,null);assert.equal(empty.verified_unique_people,null);
  await landing('entry-shared');
  await request('good');await action('good');await request('shared');await action('shared');
  assert.equal((await read()).linked_created_requests,2,'Two requests from one entry must both count');
  await request('wrong-business','entry-shared','other-business');
  await request('future','entry-future');await landing('entry-future','fixture-business','2026-09-11T12:00:00Z');
  await request('stale','entry-stale');await landing('entry-stale','fixture-business','2026-08-01T12:00:00Z');
  await request('conflict');await db.query('INSERT INTO work_request_events VALUES($1,$2,$3,$4,$5)',['conflict-2','conflict','created',JSON.stringify({entryRequestId:'entry-other',businessSlug:'fixture-business'}),'2026-09-10T12:00:00Z']);
  await request('no-action','entry-ai');await landing('entry-ai','fixture-business','2026-09-09T12:00:00Z','chatgpt');await outcome('no-action');
  await request('spoof');await action('spoof');await outcome('spoof',{actorAuthority:'server_delivery_system'});await outcome('spoof',{evidenceStrength:'client_correlated_unverified'});
  await request('wrong-entity');await action('wrong-entity');await outcome('wrong-entity',{entity:{type:'business',slug:'someone-else'}});
  await outcome('wrong-entity',{},'2026-09-10T11:00:00Z');
  await outcome('wrong-entity',{journeyId:'dc:good'});
  await outcome('wrong-entity',{},TO);
  await event('discovery_delivery',{workRequestId:'spoof',deliveryState:'delivered',actorAuthority:'server_delivery_system'});
  let report=await read();
  assert.equal(report.created_requests,9);assert.equal(report.linked_created_requests,5);assert.equal(report.unlinked_created_requests,4);assert.equal(report.linked_submitted_requests,4);assert.equal(report.requests_with_conflicting_creation_attribution,1);
  assert.equal(report.requests_with_provider_response,0);assert.equal(report.requester_confirmed_completions,0,'Absent actions, wrong authority, wrong entity/journey and impossible times cannot imply completion');
  await outcome('good',{outcomeKind:'provider_response',outcomeState:'declined',actorAuthority:'authenticated_assigned_provider'});
  await outcome('good',{outcomeKind:'provider_response',outcomeState:'declined',actorAuthority:'authenticated_assigned_provider'});
  await outcome('shared');await outcome('shared');
  report=await read();assert.equal(report.requests_with_provider_response,1,'Duplicate responses do not multiply requests');assert.equal(report.requester_confirmed_completions,1,'Duplicate completed outcomes do not multiply requests');
  assert.equal(report.qualified_requests,null);assert.equal(report.search_console_clicks,null);
  const search=report.source_groups.find(s=>s.source_group==='search_labeled');assert.equal(search.linked_created_requests,4);assert.equal(search.requests_with_provider_response,1);assert.equal(search.requester_confirmed_completions,1);
  assert.equal(report.source_groups.find(s=>s.source_group==='ai_labeled').linked_created_requests,1);
  assert(!JSON.stringify(report).includes('fixture-business'));assert(!JSON.stringify(report).includes('entry-shared'));
  // Negative SQL controls: removing business/time/authority constraints changes the result.
  const unsafe=REQUEST_STAGES_SQL.replace('l.business_slug=k.business_slug','true').replace('l.created_at <= w.created_at','true').replace("o.authority='authenticated_requester'","true");
  const weakened=(await db.query(unsafe,[FROM,TO])).rows[0].report;
  assert(weakened.linked_created_requests>report.linked_created_requests);
  assert(weakened.requester_confirmed_completions>report.requester_confirmed_completions);
  console.log('REQUEST_STAGE_SQL_FIXTURE '+JSON.stringify({passed:true,created:report.created_requests,linked:report.linked_created_requests,responses:report.requests_with_provider_response,completions:report.requester_confirmed_completions,negativeControlsDetected:true}));
 }finally{await db.close();}
});
