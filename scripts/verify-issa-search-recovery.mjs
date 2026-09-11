import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=process.cwd(),out=path.resolve(process.env.SEO_PROOF_OUTPUT||'test-results/issa-seo-proof');
const phase=process.env.SEO_PROOF_PHASE||'audit';
assert(['audit','release','production'].includes(phase));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'issa-search-proof-'));
const report={head,phase,startedAt:new Date().toISOString(),pages:[],sitemaps:[],checks:[],indexingConfirmed:false,passed:false};
const base='https://www.thetradescout.com';
const expected=process.env.SEO_EXPECTED_DEPLOYED_SHA||'';
const expectedTitle='ISSA Build | Pensacola Kitchens & Bathrooms | TradeScout';
const agents={browser:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',googlebot:'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'};
const visited=new Set();
let browser;
function clean(){return execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();}
function decode(value){return value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function text(html){return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());}
function attr(tag,key){const match=tag.match(new RegExp('\\b'+key+'\\s*=\\s*["\']([^"\']*)["\']','i'));return match?decode(match[1]):null;}
function run(name,args,environment={}){
 const startedAt=new Date().toISOString();console.log('ISSA_CHECK_START '+name);
 const result=spawnSync(args[0],args.slice(1),{cwd:root,env:{...process.env,...environment},encoding:'utf8',timeout:1500000,maxBuffer:70*1024*1024});
 const log=((result.stdout||'')+(result.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[ISOLATED_DATABASE]');console.log(log);
 const check={name,command:args.join(' '),startedAt,finishedAt:new Date().toISOString(),passed:result.status===0,status:result.status,tail:log.slice(-5000)};
 report.checks.push(check);assert.equal(result.status,0,name+' failed');
}
async function read(url,agent='googlebot'){
 const target=new URL(url,base);assert.equal(target.origin,base);
 const r=await fetch(target,{headers:{'User-Agent':agents[agent]},signal:AbortSignal.timeout(20000),redirect:'manual'});
 return {url:target.href,status:r.status,headers:Object.fromEntries(['location','content-type','x-robots-tag','x-tradescout-build','cache-control','vary'].map(k=>[k,r.headers.get(k)])),body:await r.text()};
}
async function page(url,agent,depth=0){
 const key=agent+new URL(url,base).href;if(visited.has(key))return;assert(depth<=4,'Redirect chain too long');visited.add(key);
 const raw=await read(url,agent),html=raw.body;
 const meta=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>({name:attr(m[0],'name')||attr(m[0],'property'),content:attr(m[0],'content')}));
 const canonical=[...html.matchAll(/<link\b[^>]*>/gi)].filter(m=>attr(m[0],'rel')==='canonical').map(m=>attr(m[0],'href'));
 const jsonLd=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>JSON.parse(m[1]));
 const row={url:raw.url,agent,status:raw.status,headers:raw.headers,title:text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),canonical,meta:meta.filter(m=>['robots','googlebot','description','og:title','og:url','og:description'].includes(m.name)),headings:[...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m=>text(m[1])),bodyText:text(html).slice(0,9000),bodyBytes:Buffer.byteLength(html),jsonLd,scriptModules:(html.match(/<script[^>]*type=["']module["']/g)||[]).length};
 report.pages.push(row);console.log('ISSA_SEO_PAGE '+JSON.stringify(row));
 if(raw.headers.location)await page(new URL(raw.headers.location,raw.url).href,agent,depth+1);
}
async function liveBrowser(){
 run('Install Chromium',[process.execPath,'node_modules/playwright/cli.js','install','chromium']);
 const {chromium}=await import('playwright');browser=await chromium.launch({channel:'chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 report.browser=[];
 for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['touch',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,isMobile:device==='touch',hasTouch:device==='touch',serviceWorkers:'block',userAgent:agents.browser});
  const errors=[],failedAssets=[],blockedWrites=[];
  await context.route('**/*',route=>{const req=route.request();if(!['GET','HEAD'].includes(req.method())){blockedWrites.push(new URL(req.url()).pathname);return route.abort('blockedbyclient');}return route.continue();});
  const current=await context.newPage();current.setDefaultTimeout(45000);
  current.on('pageerror',error=>errors.push(error.message));current.on('response',r=>{if(r.status()>=400&&['script','stylesheet'].includes(r.request().resourceType()))failedAssets.push({path:new URL(r.url()).pathname,status:r.status()});});
  const steps=[];
  for(const pathname of ['/business/issa-build','/issa-build/onyx']){
   const response=await current.goto(base+pathname,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);assert.equal(response.headers()['x-tradescout-build'],expected);
   await current.getByRole('heading',{name:/ISSA Build|Onyx/i}).first().waitFor();
   if(pathname==='/business/issa-build'){
    assert.equal(new URL(current.url()).pathname,'/issa-build');
    await current.waitForFunction(title=>document.title===title,expectedTitle);
   }else assert.equal(new URL(current.url()).pathname,'/issa-build/onyx');
   const visibleText=await current.locator('body').innerText();assert(!visibleText.includes('We could not render the app yet'),'Visible startup error');
   assert.equal(await current.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Horizontal overflow');
   const shot=device+(pathname==='/business/issa-build'?'-issa-business.png':'-issa-onyx.png');
   await current.screenshot({path:path.join(out,shot),fullPage:true});
   steps.push({path:new URL(current.url()).pathname,title:await current.title(),passed:true,screenshot:shot});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);report.browser.push({device,steps,errors,failedAssets,blockedWrites,passed:true});await context.close();
 }
}
try{
 assert.equal(clean(),'','Exact-source validation requires a clean checkout');
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY'])assert(!process.env[key],key+' must not be inherited');
 if(phase==='release'){
  const files=execFileSync('git',['ls-files','*.test.ts','*.test.tsx'],{encoding:'utf8'}).trim().split('\n').filter(f=>/issa|canonical-business-profile|canonical-owner-profile|business-profile-public|sitemap|indexnow|public-profile-compat/i.test(f));
  const testReport=path.join(temporary,'issa-tests.json');
  run('Affected ISSA discovery and authority tests',['npm','run','test:run','--',...files,'--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+testReport]);
  const tests=JSON.parse(await fs.readFile(testReport,'utf8'));report.tests=Object.fromEntries(['numTotalTests','numPassedTests','numFailedTests','numPendingTests'].map(k=>[k,tests[k]]));
  assert.equal(tests.numFailedTests,0);assert.equal(tests.numPendingTests,0);
  run('Existing business/product page-separation contracts',[process.execPath,'--test','scripts/tests/issa-build-page-separation.test.mjs','scripts/tests/issa-preview-response.test.mjs']);
  const startupOutput=path.join(temporary,'startup');
  run('Compiled startup and full unchanged customer release sequence',[process.execPath,'scripts/diagnose-compiled-startup.mjs'],{STARTUP_PHASE:'release',STARTUP_PROOF_OUTPUT:startupOutput});
  const proof=JSON.parse(await fs.readFile(path.join(startupOutput,'evidence.json'),'utf8'));
  assert.equal(proof.head,head);assert.equal(proof.passed,true);assert.equal(proof.compiledBoot,true);assert.equal(proof.customerRelease.head,head);assert.equal(proof.customerRelease.releaseAttested,true);assert.equal(proof.customerRelease.minimumRelease.attestable,true);
  report.release={head,passed:true,compiledBoot:true,tests:proof.customerRelease.tests,databaseTests:proof.customerRelease.databaseTests,minimumRelease:proof.customerRelease.minimumRelease};
 }else{
  if(phase==='production')assert.match(expected,/^[a-f0-9]{40}$/);
  const robot=await read('/robots.txt');report.robots={status:robot.status,headers:robot.headers,text:robot.body};assert.equal(robot.status,200);
  const paths=['/u/issa-build','/business/issa-build','/contractors/issa-build','/u/honey-onyx','/issa-build/onyx/inventory/honey-onyx','/issa-build/onyx/inventory/multi-green-onyx','/pensacola'];
  for(let i=0;i<paths.length;i+=3)await Promise.all(paths.slice(i,i+3).map(url=>page(url,'googlebot')));
  await page('/issa-build','browser');
  for(const url of ['/sitemap.xml','/sitemap-index.xml','/sitemap-u-profiles.xml','/sitemap-profile-images.xml']){
   const r=await read(url);const locations=[...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));report.sitemaps.push({url:base+url,status:r.status,locationCount:locations.length,matches:locations.filter(u=>/issa|honey-onyx/i.test(u))});
  }
  const health=await read('/api/health');report.health=JSON.parse(health.body);assert.equal(health.status,200);
  if(phase==='production'){
   assert.equal(report.health.commit,expected);assert.equal(report.health.status,'healthy');assert.equal(report.health.database,'connected');assert.equal(report.health.migrations.compatibility,'compatible');assert.equal(report.health.migrations.requiredSchemaOk,true);
   for(const p of report.pages)assert.equal(p.headers['x-tradescout-build'],expected);
   const business=report.pages.find(p=>p.url===base+'/business/issa-build');assert.equal(business.status,301);assert.equal(new URL(business.headers.location,base).href,base+'/issa-build');
   for(const agent of ['googlebot','browser']){
    const home=report.pages.find(p=>p.url===base+'/issa-build'&&p.agent===agent);assert.equal(home.status,200);assert.equal(home.title,expectedTitle);assert.deepEqual(home.canonical,[base+'/issa-build']);
    assert(!String(home.headers['x-robots-tag']).includes('noindex'));assert(home.meta.some(m=>m.name==='robots'&&m.content.includes('index, follow')&&!m.content.includes('noindex')));assert(home.headings.includes('ISSA Build'));
   }
   assert.equal(report.pages.find(p=>p.url===base+'/contractors/issa-build').status,404,'Inactive legacy record stays unavailable');
   for(const sitemap of report.sitemaps)assert.equal(sitemap.status,200);
   const urls=report.sitemaps.find(s=>s.url===base+'/sitemap-u-profiles.xml').matches;assert(urls.includes(base+'/issa-build'));assert(urls.includes(base+'/issa-build/onyx'));
   await fs.mkdir(out,{recursive:true});await liveBrowser();
  }
 }
 report.finalSourceStatus=clean();assert.equal(report.finalSourceStatus,'');report.passed=true;
}catch(error){report.error=String(error.stack||error);console.error('ISSA_SEO_FAILURE '+report.error);}
finally{
 await browser?.close();report.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
 await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>'+ (report.passed?'Declared technical checks passed':'FAILED — not approval')+'</h1><p>'+phase+' '+head+'</p><p>Technical validation is not Google indexing, ranking or traffic proof.</p><a href="evidence.json">Evidence</a>');
 await fs.rm(temporary,{recursive:true,force:true});
 console.log('ISSA_SEO_SUMMARY '+JSON.stringify({...report,pages:report.pages.map(({bodyText,jsonLd,...page})=>page),robots:undefined,checks:report.checks.map(({tail,...check})=>check)}));
}
