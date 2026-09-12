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
try{
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SENDGRID_API_KEY','BREVO_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY'])assert(!process.env[key],key+' may not be inherited');
 const testFile=path.join(temp,'tests.json');
 run('Estimate SQL, failures, retries, recipient and contact boundaries',['npm','run','test:run','--','server/tests/estimate-transactions.behavior.test.ts','--maxWorkers=1','--reporter=default','--reporter=json','--outputFile='+testFile]);
 const tests=JSON.parse(await fs.readFile(testFile,'utf8'));proof.tests=Object.fromEntries(['numTotalTests','numPassedTests','numFailedTests','numPendingTests'].map(k=>[k,tests[k]]));
 assert.equal(tests.numPendingTests,0);assert.equal(tests.numFailedTests,0);
 run('TypeScript',['npm','run','check']);
 if(phase!=='focused')throw new Error('Full route integration and native/browser verification must be added before release mode can pass');
 proof.finalSourceStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();assert.equal(proof.finalSourceStatus,'');proof.passed=true;
}catch(error){proof.error=String(error.stack||error);console.error('ESTIMATE_FAILURE '+proof.error);}
finally{
 proof.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));
 await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
 await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>Estimate transaction verification</h1><p>Focused tests are not production release approval.</p><a href="evidence.json">Evidence</a>');
 await fs.rm(temp,{recursive:true,force:true});console.log('ESTIMATE_SUMMARY '+JSON.stringify({...proof,checks:proof.checks.map(({tail,...r})=>r)}));
}
