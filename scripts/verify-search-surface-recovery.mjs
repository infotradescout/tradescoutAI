import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {chromium} from 'playwright';

const base='https://www.thetradescout.com';
const out=path.resolve(process.env.SEARCH_SURFACE_OUTPUT||'test-results/search-surface');
const phase=process.env.SEARCH_SURFACE_PHASE||'audit';
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={head,phase,startedAt:new Date().toISOString(),pages:[],passed:false,indexingConfirmed:false};
let browser;
function attr(tag,key){return (tag.match(new RegExp('\\b'+key+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'').replace(/&amp;/g,'&');}
function metadata(html){return {
 title:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/&amp;/g,'&'),
 canonical:[...html.matchAll(/<link\b[^>]*>/gi)].filter(m=>attr(m[0],'rel')==='canonical').map(m=>attr(m[0],'href')),
 meta:[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>({name:attr(m[0],'name')||attr(m[0],'property'),content:attr(m[0],'content')})).filter(m=>['robots','description','og:title','og:url'].includes(m.name)),
 };}
try{
 assert.equal(phase,'audit');
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','BREVO_API_KEY','SENDGRID_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY'])assert(!process.env[key]);
 const install=spawnSync(process.execPath,['node_modules/playwright/cli.js','install','chromium'],{encoding:'utf8',timeout:180000});assert.equal(install.status,0,install.stderr);
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',userAgent:`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`});
 await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort('blockedbyclient'));
 const pages=['/about','/pricing','/community','/compare','/contact','/help','/trust-model','/county-directory','/maps','/direct-connect-info'];
 for(const pathname of pages){
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto(base+pathname,{waitUntil:'domcontentloaded',timeout:30000});
   const raw=metadata(await response.text());
   await page.waitForFunction(()=>document.body.innerText.trim().length>120&&!/^Loading TradeScout/.test(document.body.innerText.trim()),{timeout:20000}).catch(()=>{});
   await page.waitForTimeout(1200);
   const rendered=await page.evaluate(()=>({title:document.title,canonical:[...document.querySelectorAll('link[rel="canonical"]')].map(e=>e.href),meta:[...document.querySelectorAll('meta[name="robots"],meta[name="description"],meta[property="og:title"],meta[property="og:url"]')].map(e=>({name:e.name||e.getAttribute('property'),content:e.content})),headings:[...document.querySelectorAll('h1,h2')].map(e=>e.innerText),text:document.body.innerText.slice(0,4200),links:[...document.querySelectorAll('a[href]')].map(e=>({label:e.innerText,href:e.getAttribute('href')})).filter(e=>e.label.trim()).slice(0,20)}));
   const row={path:pathname,finalPath:new URL(page.url()).pathname,status:response.status(),build:response.headers()['x-tradescout-build'],headerRobots:response.headers()['x-robots-tag'],raw,rendered,errors};report.pages.push(row);console.log('SEARCH_SURFACE_PAGE '+JSON.stringify(row));
  }catch(error){const row={path:pathname,error:String(error),errors};report.pages.push(row);console.error('SEARCH_SURFACE_PAGE '+JSON.stringify(row));}
  await page.close();
 }
 const h=await context.request.get(base+'/api/health');report.health=await h.json();assert.equal(h.status(),200);await context.close();
 report.passed=report.pages.every(p=>!p.error); // Completion, not an indexing or SEO-success verdict.
}catch(error){report.error=String(error.stack||error);}
finally{await browser?.close();report.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>Actual public-page metadata audit</h1><p>Completion is not indexing or SEO approval.</p><a href="evidence.json">Evidence</a>');console.log('SEARCH_SURFACE_SUMMARY '+JSON.stringify({...report,pages:report.pages.map(p=>({...p,rendered:p.rendered?{...p.rendered,text:undefined,links:undefined}:undefined}))}));}
