import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import pg from 'pg';
import {request as playwrightRequest} from 'playwright';
import {startCabinetLoopbackTestDatabase} from './start-cabinet-loopback-test-db.mjs';
import {proveEstimateBrowser} from './estimate-transaction-browser.mjs';
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const out=path.resolve(process.env.ESTIMATE_NATIVE_OUTPUT||'test-results/estimate-native');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'estimate-native-'));
const proof={head,startedAt:new Date().toISOString(),steps:[],passed:false,externalEmailDelivery:false,productionWrites:false};
let cluster,database,server,log;
const contexts=[];
const step=(name,details={})=>{proof.steps.push({name,passed:true,...details});console.log('ESTIMATE_NATIVE_STEP '+JSON.stringify(proof.steps.at(-1)));};
function run(name,args,env={}){const r=spawnSync(args[0],args.slice(1),{env:{...process.env,...env},encoding:'utf8',timeout:600000,maxBuffer:40*1024*1024});if(r.status!==0)console.error(((r.stdout||'')+(r.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_DATABASE]').slice(-10000));assert.equal(r.status,0,name);step(name);}
try{
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SENDGRID_API_KEY','BREVO_API_KEY','RESEND_API_KEY','SMTP_PASS'])assert(!process.env[key],'No inherited production configuration');
 run('Production application build',['npm','run','build']);
 cluster=await startCabinetLoopbackTestDatabase();
 const admin=new pg.Client({connectionString:cluster.url});await admin.connect();try{await admin.query('CREATE DATABASE ts_operator_test');}finally{await admin.end();}
 const target=new URL(cluster.url);target.pathname='/ts_operator_test';assert.equal(target.hostname,'127.0.0.1');
 const env={NODE_ENV:'test',TEST_DATABASE_URL:target.href,DATABASE_URL:target.href,ALLOW_INSECURE_TEST_DATABASE:'true',OPERATOR_HTTP_PROOF:'true',OPERATOR_PROOF_BUILT_CLIENT:'true',OPERATOR_PROOF_OUTPUT:path.join(temp,'fixture')};
 run('Fresh migrations',['npm','run','db:migrate'],env);run('Required schema',['npm','run','db:verify:required'],env);
 database=new pg.Client({connectionString:target.href});await database.connect();assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name,'ts_operator_test');
 log=await fs.open(path.join(temp,'fixture.private.log'),'w',0o600);
 server=spawn(process.execPath,['--import','tsx','scripts/direct-connect-operator-http-proof.ts'],{env:{...process.env,...env},stdio:['ignore',log.fd,log.fd]});
 const manifest=path.join(temp,'fixture','fixture.private.json');
 for(let i=0;i<180;i++){if(await fs.stat(manifest).then(()=>true,()=>false))break;assert.equal(server.exitCode,null,'Fixture exited');await new Promise(r=>setTimeout(r,500));}
 const fixture=JSON.parse(await fs.readFile(manifest,'utf8'));const base='http://127.0.0.1:5218';assert.equal(fixture.baseUrl,base);assert.match(fixture.profileSlug,/^operator-proof-[0-9a-f]{8}$/);
 async function api(actor,method,url,data,expected=200,headers){assert(url.startsWith('/api/'));const response=await actor.fetch(url,{method,...(data===undefined?{}:{data}),...(headers?{headers}:{})});const body=await response.json();assert.equal(response.status(),expected,`${method} ${url}: ${body.message||body.code||response.status()}`);return body;}
 async function actor(kind){const c=await playwrightRequest.newContext({baseURL:base});contexts.push(c);await api(c,'POST','/api/auth/login',{email:fixture.identities[kind].email,password:fixture.password});return c;}
 const customer=await actor('requester'),supplier=await actor('provider'),stranger=await actor('unrelated');
 step('Real password login with three separate fixture sessions');
 const request=await api(customer,'POST',`/api/tradepartner-profiles/${fixture.profileSlug}/express-request`,{name:'Synthetic Requester',email:fixture.identities.requester.email,phone:'2025550147',requestType:'request_service',contactPreference:'platform_message',message:'Synthetic measured kitchen project. Confirm material scope before proposing an estimate.',updatesOptIn:false},201);
 const assignment=(await database.query('SELECT id FROM work_request_assignments WHERE work_request_id=$1 AND responder_user_id=$2',[request.requestId,fixture.identities.provider.id])).rows[0];assert(assignment);
 await api(supplier,'POST',`/api/direct-connect/assignments/${assignment.id}/respond`,{decision:'accept',availabilityWindow:'Next week',priceBand:'custom_quote',scopeNote:'Synthetic itemized materials and labor estimate; no real offer.'});
 const event=(await database.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='provider_accepted'",[request.requestId])).rows[0];const conversationId=event.metadata.conversationId;assert(conversationId);
 step('Actual selected-supplier request and acceptance');
 await api(supplier,'POST',`/api/direct-connect/contractor/requests/${request.requestId}/request-contact`,{});
 await api(customer,'POST',`/api/direct-connect/requests/${request.requestId}/contact-gate`,{nextState:'user_approved'});
 await api(customer,'POST',`/api/direct-connect/requests/${request.requestId}/contact-gate`,{nextState:'released'});
 const workspace=(await database.query('SELECT id,requester_user_id FROM direct_connect_job_workspaces WHERE request_id=$1',[request.requestId])).rows[0];assert(workspace);assert.equal(workspace.requester_user_id,fixture.identities.requester.id);
 step('Requester contact approval and job creation through guarded routes');
 const pathRoot=`/api/direct-connect/jobs/${workspace.id}/estimates`;
 const created=await api(supplier,'POST',pathRoot,{title:'Synthetic itemized kitchen estimate',scopeSummary:'Invented materials, labor, pallet and delivery amounts for isolated testing only.'},201);
 const estimatePath=pathRoot+'/'+created.estimateId;
 await api(customer,'GET',estimatePath,undefined,404);await api(stranger,'GET',estimatePath,undefined,403);
 const lines=[['other','Pallet allowance',1,100],['other','Delivery allowance',1,200],['material','Synthetic materials',2,150],['labor','Synthetic labor',2,50]];
 let expectedTotal=0;
 for(let i=0;i<lines.length;i++){const [lineType,name,quantity,unitCost]=lines[i];expectedTotal+=quantity*unitCost;
  const body=await api(supplier,'POST',estimatePath+'/line-items',{lineType,name,quantity,unit:'each',unitCost},201,{'Idempotency-Key':'native-line-'+i+'-key'});assert.equal(body.totals.totalEstimate,expectedTotal);
 }
 const quote=await api(supplier,'GET',estimatePath);assert.equal(quote.totalEstimate,700);assert.equal(quote.lineItems.length,4);
 const replayLine=await api(supplier,'POST',estimatePath+'/line-items',{lineType:'other',name:'Pallet allowance',quantity:1,unit:'each',unitCost:100},201,{'Idempotency-Key':'native-line-0-key'});assert.equal(replayLine.replayed,true);
 step('Itemized total is exactly 700; draft privacy and line retry verified',{subtotalMaterials:300,subtotalLabor:100,subtotalOther:300,total:700});
 const literal=(await database.query('SELECT quote_literal($1) AS value',[request.requestId])).rows[0].value;
 await database.query("ALTER TABLE direct_connect_notifications ADD CONSTRAINT estimate_send_failure_fixture CHECK (NOT (request_id="+literal+" AND notification_type='estimate_sent'))");
 try{
   await api(supplier,'POST',estimatePath+'/send',{},500);
   assert.equal((await database.query('SELECT status FROM job_estimates WHERE id=$1',[created.estimateId])).rows[0].status,'draft');
   assert.equal((await database.query("SELECT count(*)::int AS n FROM direct_connect_dispatch_events WHERE request_id=$1 AND event_type='estimate_sent'",[request.requestId])).rows[0].n,0);
 }finally{await database.query('ALTER TABLE direct_connect_notifications DROP CONSTRAINT estimate_send_failure_fixture');}
 await api(customer,'POST',estimatePath+'/send',{},403);
 await api(supplier,'POST',estimatePath+'/send',{});assert.equal((await api(supplier,'POST',estimatePath+'/send',{})).replayed,true);
 const receipt=await api(customer,'GET',estimatePath);assert.equal(receipt.status,'sent');assert.equal(receipt.totalEstimate,700);assert.equal(receipt.lineItems.length,4);
 await api(stranger,'GET',estimatePath,undefined,403);
 const notices=(await database.query("SELECT recipient_user_id,metadata_json FROM direct_connect_notifications WHERE request_id=$1 AND notification_type='estimate_sent'",[request.requestId])).rows;
 assert.equal(notices.length,1);assert.equal(notices[0].recipient_user_id,fixture.identities.requester.id);assert.equal(notices[0].metadata_json.estimateId,created.estimateId);
 step('Failed send rolls back; retry publishes one readable quote and one receipt to the right customer');
 await api(customer,'POST',estimatePath+'/respond',{decision:'request_changes',note:'Synthetic revision request'});
 await api(supplier,'PATCH',estimatePath,{title:'Synthetic revised kitchen estimate'});await api(supplier,'POST',estimatePath+'/send',{});
 await api(supplier,'POST',estimatePath+'/respond',{decision:'accept'},403);
 await api(customer,'POST',estimatePath+'/respond',{decision:'accept'});
 assert.equal((await api(customer,'POST',estimatePath+'/respond',{decision:'accept'})).replayed,true);
 assert.equal((await database.query('SELECT count(*)::int AS n FROM job_acceptances WHERE estimate_id=$1',[created.estimateId])).rows[0].n,1);
 await api(customer,'POST',estimatePath+'/respond',{decision:'decline'},409);
 step('Customer revision, resend and acceptance persist once; other actors and conflicting decisions denied');
 const concurrent=await api(supplier,'POST',pathRoot,{title:'Synthetic concurrency estimate',scopeSummary:'Parallel additions must not lose totals.',subtotalOther:25},201);
 const cp=pathRoot+'/'+concurrent.estimateId;
 await Promise.all(Array.from({length:8},(_,i)=>api(supplier,'POST',cp+'/line-items',{lineType:'other',name:'Concurrent '+i,quantity:1,unit:'each',unitCost:1.25},201,{'Idempotency-Key':'concurrent-key-'+i})));
 const cq=await api(supplier,'GET',cp);assert.equal(cq.lineItems.length,8);assert.equal(cq.totalEstimate,35);
 await Promise.all(Array.from({length:4},()=>api(supplier,'POST',cp+'/line-items',{lineType:'material',name:'Repeated exact addition',quantity:1,unit:'each',unitCost:2},201,{'Idempotency-Key':'same-concurrent-key'})));
 const rq=await api(supplier,'GET',cp);assert.equal(rq.lineItems.length,9);assert.equal(rq.totalEstimate,37);
 step('Concurrent additions preserve every amount; identical concurrent retry creates one line',{parallelAdds:8,totalAfterAdds:35,totalAfterReplay:37});
 proof.requestToCustomerQuote=true;proof.customerReceipt={title:receipt.title,total:receipt.totalEstimate,lineCount:receipt.lineItems.length};
 proof.browser=await proveEstimateBrowser({database,fixture,workspaceId:workspace.id,customer,supplier,stranger,output:out});
 assert.equal(proof.browser.length,2);assert(proof.browser.every(r=>r.passed));
 step('Actual desktop and touch editors, refresh/retry and customer decisions');
 proof.passed=true;
}catch(error){proof.error=String(error.stack||error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_DATABASE]');console.error('ESTIMATE_NATIVE_FAILURE '+proof.error);
 if(log){const tail=(await fs.readFile(path.join(temp,'fixture.private.log'),'utf8')).slice(-12000).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_DATABASE]');console.error('ESTIMATE_FIXTURE_FAILURE '+tail);}
}
finally{
 for(const c of contexts)await c.dispose();
 if(server&&server.exitCode===null&&!server.signalCode)await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill('SIGKILL');resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});server.kill('SIGTERM');});
 await log?.close();await database?.end();await cluster?.stop();
 proof.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));
 await fs.rm(temp,{recursive:true,force:true});console.log('ESTIMATE_NATIVE_SUMMARY '+JSON.stringify(proof));
}
if(!proof.passed)process.exitCode=1;
