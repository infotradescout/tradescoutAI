import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const candidate='30efac614a9ec8f2eed934d911802a5cda43ae0f';
assert.equal(process.env.REQUEST_STAGES_CANDIDATE_SHA,candidate);
const base='f22ddff023d24d5ca1938714619f942819afc5ce';
const output=path.resolve(process.env.SEARCH_SURFACE_OUTPUT||'test-results/search-surface');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tradescout-stage-report-')),checkout=path.join(temp,'source'),tools=path.join(temp,'tools');
const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
const report={candidate,base,startedAt:new Date().toISOString(),result:'fail',steps:[],productionWrites:0,productReleaseGateRun:false};
fs.mkdirSync(output,{recursive:true});
function run(label,cmd,args,cwd=checkout){
 const result=spawnSync(cmd,args,{cwd,env,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(output,label+'.log'),(result.stdout||'')+(result.stderr||''));
 console.log(result.stdout||'');console.error(result.stderr||'');
 report.steps.push({label,exit:result.status});assert.equal(result.status,0,label);return result.stdout.trim();
}
try{
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','STRIPE_SECRET_KEY','SESSION_SECRET'])assert(!process.env[key],'No inherited application credentials');
 run('clone','git',['clone','--no-hardlinks','--no-checkout',process.cwd(),checkout],temp);
 run('fetch','git',['fetch','--no-tags','https://github.com/infotradescout/tradescoutAI.git',candidate]);
 run('checkout','git',['checkout','--detach',candidate]);assert.equal(run('identity','git',['rev-parse','HEAD']),candidate);assert.equal(run('initial-clean','git',['status','--porcelain']),'');
 assert.deepEqual(run('two-file-delta','git',['diff','--name-only',base,candidate]).split('\n').sort(),['scripts/report-discovery-request-stages.mjs','scripts/report-discovery-request-stages.test.mjs']);
 fs.mkdirSync(tools);fs.writeFileSync(path.join(tools,'package.json'),'{"private":true,"type":"module"}');
 run('test-only-package','npm',['install','--save-exact','--no-audit','--no-fund','@electric-sql/pglite@0.5.4'],tools);
 const require=createRequire(path.join(tools,'package.json'));env.REQUEST_STAGE_PGLITE_MODULE=pathToFileURL(require.resolve('@electric-sql/pglite')).href;
 run('syntax',process.execPath,['--check','scripts/report-discovery-request-stages.mjs']);
 run('unit-and-actual-sql',process.execPath,['--test','--test-reporter=tap','scripts/report-discovery-request-stages.test.mjs']);
 assert.equal(run('final-clean','git',['status','--porcelain']),'');report.result='pass';
}catch(error){report.error=String(error.stack||error);}
finally{
 report.finishedAt=new Date().toISOString();report.scope='Whole report module, read-only transaction controls and real embedded PostgreSQL SQL over synthetic tables only. Not a production release, native concurrency, real human traffic or qualification proof.';
 fs.writeFileSync(path.join(output,'request-stage-evidence.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');fs.writeFileSync(path.join(output,'index.html'),'<meta name="robots" content="noindex,nofollow"><a href="request-stage-evidence.json">Read-only report checks</a>');
 console.log('REQUEST_STAGE_REPORT_SUMMARY '+JSON.stringify(report));fs.rmSync(temp,{recursive:true,force:true});if(report.result!=='pass')process.exitCode=1;
}
