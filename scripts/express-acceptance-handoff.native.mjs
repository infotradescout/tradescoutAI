import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import pg from 'pg';
import {request as playwrightRequest} from 'playwright';
import {startCabinetLoopbackTestDatabase} from './start-cabinet-loopback-test-db.mjs';

// Only a newly created local test database and the repository's unchanged
// synthetic authentication fixture are used. No user credential is edited.
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const out=path.resolve(process.env.HANDOFF_NATIVE_OUTPUT||'test-results/handoff-native');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'handoff-native-'));
const proof={head,startedAt:new Date().toISOString(),steps:[],passed:false,quoteCreated:false,externalEmailDelivery:false,productionWrites:false};
let cluster,database,server,log;
const contexts=[];
function step(name){proof.steps.push({name,passed:true});console.log('HANDOFF_NATIVE_STEP '+name);}
function run(name,args,env={}){
  const result=spawnSync(args[0],args.slice(1),{env:{...process.env,...env},encoding:'utf8',timeout:600000,maxBuffer:40*1024*1024});
  if(result.status!==0)console.error(((result.stdout||'')+(result.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_DATABASE]').slice(-8000));
  assert.equal(result.status,0,name);step(name);
}
try {
  for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SENDGRID_API_KEY','BREVO_API_KEY','RESEND_API_KEY','SMTP_PASS'])assert(!process.env[key],'No inherited production configuration');
  run('Production client build',['npm','run','build']);
  cluster=await startCabinetLoopbackTestDatabase();
  const admin=new pg.Client({connectionString:cluster.url});await admin.connect();
  try{await admin.query('CREATE DATABASE ts_operator_test');}finally{await admin.end();}
  const target=new URL(cluster.url);target.pathname='/ts_operator_test';assert.equal(target.hostname,'127.0.0.1');
  const env={NODE_ENV:'test',TEST_DATABASE_URL:target.href,DATABASE_URL:target.href,ALLOW_INSECURE_TEST_DATABASE:'true',OPERATOR_HTTP_PROOF:'true',OPERATOR_PROOF_BUILT_CLIENT:'true',OPERATOR_PROOF_OUTPUT:path.join(temp,'fixture')};
  run('Fresh native migration',['npm','run','db:migrate'],env);run('Independent required schema',['npm','run','db:verify:required'],env);
  database=new pg.Client({connectionString:target.href});await database.connect();
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name,'ts_operator_test');
  log=await fs.open(path.join(temp,'fixture.private.log'),'w',0o600);
  server=spawn(process.execPath,['--import','tsx','scripts/direct-connect-operator-http-proof.ts'],{env:{...process.env,...env},stdio:['ignore',log.fd,log.fd]});
  const manifest=path.join(temp,'fixture','fixture.private.json');
  for(let i=0;i<180;i++){
    if(await fs.stat(manifest).then(()=>true,()=>false))break;
    assert.equal(server.exitCode,null,'Fixture exited before ready');await new Promise(resolve=>setTimeout(resolve,500));
  }
  const fixture=JSON.parse(await fs.readFile(manifest,'utf8'));
  const base='http://127.0.0.1:5218';assert.equal(fixture.baseUrl,base);assert.match(fixture.profileSlug,/^operator-proof-[0-9a-f]{8}$/);
  async function actor(kind){
    const context=await playwrightRequest.newContext({baseURL:base});contexts.push(context);
    const response=await context.post('/api/auth/login',{data:{email:fixture.identities[kind].email,password:fixture.password}});
    assert.equal(response.status(),200,'Existing synthetic fixture login');return context;
  }
  const customer=await actor('requester'),supplier=await actor('provider'),stranger=await actor('unrelated');
  step('Actual password login and separate sessions for existing synthetic identities');
  async function create(){
    const response=await customer.post(`/api/tradepartner-profiles/${fixture.profileSlug}/express-request`,{data:{name:'Synthetic Requester',email:fixture.identities.requester.email,phone:'2025550147',requestType:'request_service',contactPreference:'platform_message',message:'Synthetic measured kitchen project. Confirm material scope before proposing any estimate.',updatesOptIn:false}});
    const body=await response.json();assert(response.ok(),`${response.status()}: ${body.message||body.code||''}`);assert.equal(typeof body.requestId,'string');
    const rows=(await database.query('SELECT id,status FROM work_request_assignments WHERE work_request_id=$1 AND responder_user_id=$2',[body.requestId,fixture.identities.provider.id])).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].status,'invited');return{requestId:body.requestId,assignmentId:rows[0].id};
  }
  const accept={decision:'accept',availabilityWindow:'Next week',priceBand:'custom_quote',scopeNote:'Synthetic service enquiry, pending measured scope and an independently reviewed estimate.'};
  async function proveAccepted(item){
    const response=await supplier.post(`/api/direct-connect/assignments/${item.assignmentId}/respond`,{data:accept});
    const body=await response.json();assert.equal(response.status(),200,body.message||body.code||'acceptance');
    const parents=(await database.query('SELECT user_id,contact_gate_state FROM direct_connect_dispatch_requests WHERE id=$1',[item.requestId])).rows;
    assert.equal(parents.length,1);assert.equal(parents[0].user_id,fixture.identities.requester.id);assert.equal(parents[0].contact_gate_state,'locked');
    const candidates=(await database.query('SELECT responder_user_id FROM direct_connect_dispatch_candidates WHERE request_id=$1',[item.requestId])).rows;
    assert.equal(candidates.length,1);assert.equal(candidates[0].responder_user_id,fixture.identities.provider.id);
    const replies=(await database.query('SELECT responder_user_id FROM direct_connect_contractor_responses WHERE request_id=$1',[item.requestId])).rows;
    assert.equal(replies.length,1,'Response must persist, not fail the parent foreign key');assert.equal(replies[0].responder_user_id,fixture.identities.provider.id);
    const events=(await database.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='provider_accepted'",[item.requestId])).rows;
    assert.equal(events.length,1);assert(events[0].metadata.conversationId);
  }
  const first=await create();
  const inbox=await supplier.get('/api/direct-connect/inbox');assert.equal(inbox.status(),200);assert((await inbox.text()).includes(first.assignmentId));
  for(const denied of [customer,stranger])assert.equal((await denied.post(`/api/direct-connect/assignments/${first.assignmentId}/respond`,{data:accept})).status(),404);
  assert.equal((await database.query('SELECT status FROM work_request_assignments WHERE id=$1',[first.assignmentId])).rows[0].status,'invited');
  step('Requester-selected supplier inbox; other accounts cannot accept');
  await proveAccepted(first);step('Accepted response, dispatch parent, exact supplier candidate and conversation persist together');
  const second=await create();
  const literal=(await database.query('SELECT quote_literal($1) AS value',[second.requestId])).rows[0].value;
  await database.query('ALTER TABLE direct_connect_dispatch_candidates ADD CONSTRAINT handoff_failure_fixture CHECK (request_id <> '+literal+')');
  try{
    const failed=await supplier.post(`/api/direct-connect/assignments/${second.assignmentId}/respond`,{data:accept});assert.equal(failed.status(),500);
    assert.equal((await database.query('SELECT status FROM work_request_assignments WHERE id=$1',[second.assignmentId])).rows[0].status,'invited');
    assert.equal((await database.query('SELECT id FROM direct_connect_dispatch_requests WHERE id=$1',[second.requestId])).rows.length,0);
    assert.equal((await database.query("SELECT id FROM work_request_events WHERE work_request_id=$1 AND type='provider_accepted'",[second.requestId])).rows.length,0);
    step('Injected native persistence failure rolls back actual HTTP acceptance and parent creation');
  }finally{await database.query('ALTER TABLE direct_connect_dispatch_candidates DROP CONSTRAINT handoff_failure_fixture');}
  await proveAccepted(second);step('Retry succeeds without duplicate acceptance after rollback');
  proof.passed=true;
}catch(error){proof.error=String(error.stack||error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_DATABASE]');console.error('HANDOFF_NATIVE_FAILURE '+proof.error);}
finally{
  for(const context of contexts)await context.dispose();
  if(server&&server.exitCode===null&&!server.signalCode)await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill('SIGKILL');resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});server.kill('SIGTERM');});
  await log?.close();await database?.end();await cluster?.stop();
  proof.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));
  await fs.rm(temp,{recursive:true,force:true});console.log('HANDOFF_NATIVE_SUMMARY '+JSON.stringify(proof));
}
if(!proof.passed)process.exitCode=1;
