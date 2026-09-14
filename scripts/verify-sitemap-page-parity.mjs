import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
const root=process.cwd(),out=path.resolve(process.env.SITEMAP_PROOF_OUTPUT||'test-results/sitemap-page-parity');
const phase=process.env.SITEMAP_PROOF_PHASE||'release';
assert(['release','production'].includes(phase));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sitemap-parity-proof-'));
const report={head,phase,startedAt:new Date().toISOString(),checks:[],passed:false,indexingConfirmed:false};
function run(name,args,extra={}){
 console.log('SITEMAP_PARITY_START '+name);const r=spawnSync(args[0],args.slice(1),{cwd:root,env:{...process.env,...extra},encoding:'utf8',timeout:1800000,maxBuffer:90*1024*1024});
 const log=((r.stdout||'')+(r.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[ISOLATED_DATABASE]');console.log(log);
 report.checks.push({name,passed:r.status===0,status:r.status,tail:log.slice(-5000)});assert.equal(r.status,0,name);
}
const base='https://www.thetradescout.com';
async function read(input){const url=new URL(input,base);assert.equal(url.origin,base);const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html; TradeScoutReadOnlyAudit/1.0)'},redirect:'manual',signal:AbortSignal.timeout(15000)});return{url:url.href,status:r.status,build:r.headers.get('x-tradescout-build'),location:r.headers.get('location'),robots:r.headers.get('x-robots-tag'),body:await r.text()};}
function attr(tag,name){return(tag.match(new RegExp('\\b'+name+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'').replace(/&amp;/g,'&');}
try{
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY'])assert(!process.env[key],key+' must not be inherited');
 if(phase==='release'){
  run('Actual SQL sitemap eligibility and existing contracts',['npm','run','test:run','--','server/tests/sitemap-page-parity.behavior.test.ts','server/tests/sitemap-contracts.test.ts','server/tests/sitemap-url-set-limit.test.ts','server/tests/sitemap-landing-indexability.test.ts','server/tests/core-sitemap-response.test.ts','server/tests/exposure-authority-sql-parity.test.ts','server/tests/exposure-authority-startup.behavior.test.ts','server/tests/canonical-business-profile-trust.behavior.test.ts','server/tests/issa-search-recovery.behavior.test.ts','--maxWorkers=2']);
  const isa=path.join(temp,'complete-release');
  run('ISSA preservation, compiled startup and strict full customer release',[process.execPath,'scripts/verify-issa-search-recovery.mjs'],{SEO_PROOF_PHASE:'release',SEO_PROOF_OUTPUT:isa});
  const evidence=JSON.parse(await fs.readFile(path.join(isa,'evidence.json'),'utf8'));
  assert.equal(evidence.head,head);assert.equal(evidence.passed,true);assert.equal(evidence.release.compiledBoot,true);assert.equal(evidence.release.minimumRelease.attestable,true);assert.equal(evidence.release.minimumRelease.commit,head);
  report.release=evidence.release;report.discoveryTests=evidence.tests;
 }else{
  const expected=process.env.SITEMAP_EXPECTED_DEPLOYED_SHA;assert.match(expected||'',/^[a-f0-9]{40}$/);
  report.deployed=expected;
  const health=await read('/api/health');report.health=JSON.parse(health.body);assert.equal(health.status,200);assert.equal(health.build,expected);assert.equal(report.health.commit,expected);assert.equal(report.health.status,'healthy');assert.equal(report.health.migrations.requiredSchemaOk,true);
  report.sitemaps=[];report.pages=[];
  for(const pathname of ['/sitemap-directory-counties.xml','/sitemap-homescout-listings.xml']){
   const map=await read(pathname);assert.equal(map.status,200);assert.equal(map.build,expected);
   assert(!/<sitemapindex\b/.test(map.body),'Unexpected pagination; all emitted children must be inspected');
   const urls=[...map.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
   assert(urls.length>0,'Previously present eligible destinations must remain');assert(urls.length<=500,'Audit window exceeded; not claiming full sitemap parity');assert.equal(new Set(urls).size,urls.length);
   report.sitemaps.push({path:pathname,count:urls.length,urls});
   for(let i=0;i<urls.length;i+=3)await Promise.all(urls.slice(i,i+3).map(async url=>{
    const response=await read(url);const canon=[...response.body.matchAll(/<link\b[^>]*>/gi)].filter(m=>attr(m[0],'rel')==='canonical').map(m=>attr(m[0],'href'));
    const robots=[...response.body.matchAll(/<meta\b[^>]*>/gi)].filter(m=>['robots','googlebot'].includes(attr(m[0],'name'))).map(m=>attr(m[0],'content')).join(';');
    const row={url,status:response.status,build:response.build,canonical:canon,robots,headerRobots:response.robots};report.pages.push(row);
    assert.equal(response.status,200,url+' is advertised but unavailable');assert.equal(response.build,expected);assert.deepEqual(canon,[url]);assert(!/\bnoindex\b/i.test(robots+';'+response.robots),url+' is advertised but noindex');
   }));
  }
  const negative=['/county/al/autauga','/homescout/listings/1e53e73c-3413-49f5-be3f-4f38929f0251'];report.negativeControls=[];
  for(const url of negative){assert(!report.sitemaps.some(map=>map.urls.includes(base+url)),'Known rejected page remains advertised');const r=await read(url);assert.equal(r.status,404,'Existing public rejection must not be weakened');report.negativeControls.push({url,status:r.status});}
  const isa=path.join(temp,'live-issa');
  run('Actual live ISSA desktop and mobile preservation',[process.execPath,'scripts/verify-issa-search-recovery.mjs'],{SEO_PROOF_PHASE:'production',SEO_EXPECTED_DEPLOYED_SHA:expected,SEO_PROOF_OUTPUT:isa});
  const e=JSON.parse(await fs.readFile(path.join(isa,'evidence.json'),'utf8'));assert.equal(e.passed,true);report.issa={passed:true,browser:e.browser,health:e.health};
  await fs.mkdir(out,{recursive:true});for(const name of await fs.readdir(isa))if(name.endsWith('.png'))await fs.copyFile(path.join(isa,name),path.join(out,name));
 }
 report.finalSourceStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();assert.equal(report.finalSourceStatus,'');report.passed=true;
}catch(error){report.error=String(error.stack||error);console.error('SITEMAP_PARITY_FAILURE '+report.error);}
finally{report.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>'+(report.passed?'Declared sitemap parity checks passed':'FAILED — not approval')+'</h1><p>'+phase+' '+head+'</p><p>Not Google indexing or whole-site SEO certification.</p><a href="evidence.json">Evidence</a>');await fs.rm(temp,{recursive:true,force:true});console.log('SITEMAP_PARITY_SUMMARY '+JSON.stringify({...report,checks:report.checks.map(({tail,...check})=>check)}));}
