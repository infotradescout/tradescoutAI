import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync,execFileSync} from 'node:child_process';

const phase=process.env.EXPRESS_HANDOFF_PHASE||'release';
assert(['release','production'].includes(phase));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const out=path.resolve(process.env.EXPRESS_HANDOFF_OUTPUT||'test-results/express-handoff');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'express-handoff-'));
const nativeOut=path.join(temp,'native');
const evidence={head,phase,startedAt:new Date().toISOString(),checks:[],passed:false,quoteVerified:false,externalEmailVerified:false,liveCustomerWrites:false};
function run(name,args,extra={}) {
  console.log('HANDOFF_STEP_START '+name);
  const result=spawnSync(args[0],args.slice(1),{env:{...process.env,...extra},encoding:'utf8',timeout:1500000,maxBuffer:100*1024*1024});
  const log=((result.stdout||'')+(result.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TEST_DATABASE]');
  console.log(log);evidence.checks.push({name,passed:result.status===0,status:result.status,tail:log.slice(-6000)});
  assert.equal(result.status,0,name+' failed');
}
try {
  assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
  for(const name of ['DATABASE_URL','TEST_DATABASE_URL','SENDGRID_API_KEY','RESEND_API_KEY','BREVO_API_KEY','SMTP_PASS','JW_STONE_PRICING_APPROVED_IMPORT'])assert(!process.env[name],name+' must not be inherited');
  if(phase==='release') {
    const tests=path.join(temp,'focused.json');
    run('SQL handoff and unchanged authority regressions',['npm','run','test:run','--','server/tests/express-dispatch-handoff.behavior.test.ts','server/tests/tradepartner-express-authority-lifecycle.regression.test.ts','server/tests/tradepartner-express-phone-gate.regression.test.ts','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+tests]);
    const parsed=JSON.parse(await fs.readFile(tests,'utf8'));
    evidence.focused=Object.fromEntries(['numTotalTests','numPassedTests','numFailedTests','numPendingTests'].map(key=>[key,parsed[key]]));
    assert.equal(parsed.numPendingTests,0);
    run('TypeScript',['npm','run','check']);
    run('Native supplier acceptance and transactional rollback',[process.execPath,'scripts/express-acceptance-handoff.native.mjs'],{HANDOFF_NATIVE_OUTPUT:nativeOut});
    evidence.native=JSON.parse(await fs.readFile(path.join(nativeOut,'evidence.json'),'utf8'));
    assert.equal(evidence.native.head,head);assert.equal(evidence.native.passed,true);
  }
  const customerOut=path.join(temp,'customer');
  run('Preserved JW customer workflow and unchanged release contract',[process.execPath,'scripts/verify-jw-stone-customer-workflow.mjs'],{JW_WORKFLOW_PHASE:phase,JW_WORKFLOW_OUTPUT:customerOut});
  const customer=JSON.parse(await fs.readFile(path.join(customerOut,'evidence.json'),'utf8'));
  assert.equal(customer.head,head);assert.equal(customer.passed,true);
  if(phase==='release') {assert.equal(customer.release.commit,head);assert.equal(customer.release.attestable,true);assert.equal(customer.release.result,'pass');}
  evidence.customer=customer;
  await fs.mkdir(out,{recursive:true});
  for(const file of await fs.readdir(customerOut))if(file.endsWith('.png'))await fs.copyFile(path.join(customerOut,file),path.join(out,file));
  evidence.finalSourceStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();assert.equal(evidence.finalSourceStatus,'');
  evidence.passed=true;
}catch(error){evidence.error=String(error.stack||error);console.error('HANDOFF_FAILURE '+evidence.error);}
finally {
  try{evidence.native=JSON.parse(await fs.readFile(path.join(nativeOut,'evidence.json'),'utf8'));}catch{}
  evidence.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>'+(evidence.passed?'Declared acceptance handoff checks passed':'FAILED - not release approval')+'</h1><p>'+phase+' '+head+'</p><p>Not a completed quote, external email, or customer acquisition claim.</p><a href="evidence.json">Evidence</a>');
  await fs.rm(temp,{recursive:true,force:true});
  console.log('HANDOFF_SUMMARY '+JSON.stringify({...evidence,checks:evidence.checks.map(({tail,...row})=>row)}));
}
