import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const out=path.resolve(process.env.ESTIMATE_PROOF_OUTPUT||'test-results/estimate-recovery');
const phase=process.env.ESTIMATE_PROOF_PHASE||'focused';
assert(['focused','release','production'].includes(phase));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'estimate-recovery-'));
const proof={head,phase,startedAt:new Date().toISOString(),checks:[],passed:false,liveCustomerWrites:false,externalEmailDelivery:false};
function run(name,args,env={}){
 console.log('ESTIMATE_STEP '+name);
 const r=spawnSync(args[0],args.slice(1),{env:{...process.env,...env},encoding:'utf8',timeout:1500000,maxBuffer:100*1024*1024});
 const log=((r.stdout||'')+(r.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[ISOLATED_DATABASE]');
 console.log(log);proof.checks.push({name,passed:r.status===0,status:r.status,tail:log.slice(-6000)});assert.equal(r.status,0,name);
}
async function live(){
 const expected=process.env.ESTIMATE_EXPECTED_DEPLOYED_SHA||'';assert.match(expected,/^[a-f0-9]{40}$/);proof.deployed=expected;
 const base='https://www.thetradescout.com';
 const health=async()=>{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);assert.equal(r.headers.get('x-tradescout-build'),expected);const h=await r.json();assert.equal(h.commit,expected);assert.equal(h.status,'healthy');assert.equal(h.database,'connected');assert.equal(h.migrations.compatibility,'compatible');assert.equal(h.migrations.requiredSchemaOk,true);return h;};
 proof.healthBefore=await health();
 const probe=await fetch(base+'/api/direct-connect/jobs/synthetic-denied/estimates/synthetic-denied',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(probe.status,401);const denied=await probe.text();assert(!denied.includes('lineItems'));proof.anonymousEstimateStatus=probe.status;
 const preserved=path.join(temp,'live');
 run('Read-only live JW account and price-denial preservation',[process.execPath,'scripts/verify-jw-stone-customer-workflow.mjs'],{JW_WORKFLOW_PHASE:'production',JW_WORKFLOW_OUTPUT:preserved,JW_EXPECTED_DEPLOYED_SHA:expected});
 const check=JSON.parse(await fs.readFile(path.join(preserved,'evidence.json'),'utf8'));assert.equal(check.passed,true);assert.equal(check.deployed,expected);proof.livePreservation=check;
 proof.healthAfter=await health();
 proof.liveScope='Production read-only health, anonymous estimate denial and JW account/request rendering. New authenticated estimates were exercised only in the isolated native/browser proof; no real quote was created or sent.';
}
try{
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SENDGRID_API_KEY','BREVO_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY'])assert(!process.env[key],key+' may not be inherited');
 if(phase==='production')await live();
 else{
  const testFile=path.join(temp,'tests.json');
  run('Estimate SQL, registry, failures, retries and existing contact authority',['npm','run','test:run','--','server/tests/estimate-transactions.behavior.test.ts','server/tests/estimate-route-registration.test.ts','server/tests/tradepartner-express-authority-lifecycle.regression.test.ts','server/tests/tradepartner-express-phone-gate.regression.test.ts','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+testFile]);
  const tests=JSON.parse(await fs.readFile(testFile,'utf8'));proof.tests=Object.fromEntries(['numTotalTests','numPassedTests','numFailedTests','numPendingTests'].map(k=>[k,tests[k]]));assert.equal(tests.numPendingTests,0);assert.equal(tests.numFailedTests,0);
  run('TypeScript',['npm','run','check']);
  const nativeOut=path.join(temp,'native');
  run('Actual request, supplier, estimate, customer, concurrency and desktop/touch UI',[process.execPath,'scripts/estimate-transaction-recovery.native.mjs'],{ESTIMATE_NATIVE_OUTPUT:nativeOut});
  proof.native=JSON.parse(await fs.readFile(path.join(nativeOut,'evidence.json'),'utf8'));assert.equal(proof.native.head,head);assert.equal(proof.native.passed,true);assert.equal(proof.native.browser.length,2);assert(proof.native.browser.every(r=>r.passed));
  if(phase==='release'){
   const startupOut=path.join(temp,'startup');
   run('Unmodified compiled server startup with local TLS PostgreSQL',[process.execPath,'scripts/diagnose-compiled-startup.mjs'],{STARTUP_PHASE:'diagnostic',STARTUP_PROOF_OUTPUT:startupOut});
   proof.startup=JSON.parse(await fs.readFile(path.join(startupOut,'evidence.json'),'utf8'));assert.equal(proof.startup.head,head);assert.equal(proof.startup.passed,true);assert.equal(proof.startup.compiledBoot,true);
   const releaseOut=path.join(temp,'release');
   run('Preserved JW workflows and unchanged strict minimum release',[process.execPath,'scripts/verify-jw-stone-customer-workflow.mjs'],{JW_WORKFLOW_PHASE:'release',JW_WORKFLOW_OUTPUT:releaseOut});
   proof.release=JSON.parse(await fs.readFile(path.join(releaseOut,'evidence.json'),'utf8'));assert.equal(proof.release.head,head);assert.equal(proof.release.passed,true);assert.equal(proof.release.release.commit,head);assert.equal(proof.release.release.attestable,true);
  }
 }
 proof.finalSourceStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();assert.equal(proof.finalSourceStatus,'');proof.passed=true;
}catch(error){proof.error=String(error.stack||error);console.error('ESTIMATE_FAILURE '+proof.error);}
finally{
 try{proof.native=JSON.parse(await fs.readFile(path.join(temp,'native','evidence.json'),'utf8'));}catch{}
 proof.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});
 for(const folder of ['native','live']){try{for(const file of await fs.readdir(path.join(temp,folder)))if(file.endsWith('.png')||file==='browser-evidence.json')await fs.copyFile(path.join(temp,folder,file),path.join(out,file));}catch{}}
 await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
 await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>'+(proof.passed?'Declared estimate checks passed':'FAILED - not approval')+'</h1><p>'+phase+' '+head+'</p><p>No production customer quote or external email was sent.</p><a href="evidence.json">Evidence</a>');
 await fs.rm(temp,{recursive:true,force:true});console.log('ESTIMATE_SUMMARY '+JSON.stringify({...proof,checks:proof.checks.map(({tail,...r})=>r)}));
}
