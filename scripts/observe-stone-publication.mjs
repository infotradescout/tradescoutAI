import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const expected=process.env.EXCHANGE_STONE_OBSERVE_COMMIT;
assert.match(expected||'',/^[a-f0-9]{40}$/);
const origin='https://www.thetradescout.com';
const output=path.resolve(process.env.EXCHANGE_BATCH_OUTPUT);
const report={expected,scope:'Read-only live public HTTP and real browser checks. No account creation, message, call, quote, payment or test buyer records.',startedAt:new Date().toISOString(),passed:false,checks:[]};
let browser;
const record=(name,data={})=>{report.checks.push({name,passed:true,...data});console.log('STONE_PUBLIC_CHECK '+JSON.stringify(report.checks.at(-1)));};
async function health(){
 const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(20000),headers:{'cache-control':'no-cache'}});
 assert.equal(response.status,200);const h=await response.json();assert.equal(h.commit,expected);assert.equal(h.status,'healthy');assert.equal(h.database,'connected');assert.equal(h.migrations.requiredSchemaOk,true);assert.equal(h.migrations.compatibility,'compatible');return {commit:h.commit,status:h.status,migrations:h.migrations.appliedCount};
}
try{
 report.healthBefore=await health();
 const pricesResponse=await fetch(`https://raw.githubusercontent.com/infotradescout/tradescoutAI/${expected}/scripts/data/exchange-stone-homeowner-approval-20260921.json`,{signal:AbortSignal.timeout(15000)});
 assert.equal(pricesResponse.status,200);const source=await pricesResponse.json();const prices=new Map(source.prices.map(row=>[row.id,row.priceCents]));
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const userAgent=`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`;
 const context=await browser.newContext({userAgent,serviceWorkers:'block'});
 const rows=[];
 for(const offset of [0,50]){
  const response=await context.request.get(origin+`/api/exchange/stone?audienceState=TX&limit=50&offset=${offset}`);
  assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);
  const data=await response.json();assert.equal(data.total,96);assert.equal(data.audience,'eligible');rows.push(...data.items);
 }
 assert.equal(rows.length,96);assert.equal(new Set(rows.map(row=>row.id)).size,96);
 for(const row of rows){
  assert.equal(Math.round(row.price*100),prices.get(row.id));assert.equal(row.priceUnit,'sqft');assert.equal(row.businessName,'TradeScout');assert.equal(row.requiresBuyerVerification,false);
  assert.doesNotMatch(JSON.stringify(row),/fabricatorPrice|supplierCost|landedCost|jwstonelogistics|sourceImageId/);
 }
 record('96 public offers exactly match approved Drive rates without supplier fields or membership locks',{count:rows.length});
 const id='tradescout-stone-matrix-basalt';
 const detail=await context.request.get(origin+'/api/marketplace/listings/'+id);assert.equal(detail.status(),200);assert((await detail.text()).includes('TradeScout'));
 const feed=await context.request.get(origin+'/api/exchange/items?audienceState=TX&q=Matrix%20Basalt');assert.equal(feed.status(),200);assert((await feed.text()).includes(id));
 const photo=await context.request.get(origin+'/api/exchange/stone-media/'+id);assert.equal(photo.status(),200);assert.equal(photo.headers()['content-type'].split(';')[0],'image/webp');
 record('Actual Exchange feed, detail and neutral photo endpoint resolve');
 for(const [query,total] of [['audienceState=FL&audienceCity=Pensacola',0],['audienceState=FL&audienceCity=Gulf%20Breeze',96],['audienceState=AK',96],['audienceState=HI',96]]){
  const response=await context.request.get(origin+'/api/exchange/stone?'+query);assert.equal(response.status(),200);assert.equal((await response.json()).total,total);
  if(total===0)assert.equal((await context.request.get(origin+'/api/exchange/stone-media/'+id)).status(),404);
 }
 record('Pensacola exclusion is enforced; adjacent city, Alaska and Hawaii retain national offers');
 await context.close();
 for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport,userAgent,isMobile:device==='phone',hasTouch:device==='phone',serviceWorkers:'block'});
  let blockedWrites=0;
  await ctx.route('**/*',route=>{
   if(!['GET','HEAD'].includes(route.request().method())){blockedWrites++;return route.abort('blockedbyclient');}
   return route.continue();
  });
  const page=await ctx.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(origin+'/exchange/stone?audienceState=TX',{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);
  assert.equal(await page.locator('article.stone-card').count(),96);
  for(let step=0;step<50;step++){
   await page.evaluate(()=>window.scrollBy(0,innerHeight));
   await page.waitForTimeout(80);
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('article.stone-card img')].every(image=>image.complete&&image.naturalWidth>0),null,{timeout:45000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  const card=page.locator('article.stone-card').filter({hasText:'Matrix Basalt'});await card.scrollIntoViewIfNeeded();
  await card.getByRole('link',{name:'Check availability',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.match(await dialog.locator('textarea').inputValue(),/\$36\.00 \/ sq ft/);
  const button=dialog.getByRole('button',{name:'Sign in to send',exact:true});assert(await button.isEnabled());
  await button.click();await page.waitForURL('**/pre-scout-setup?**');
  assert(new URL(page.url()).searchParams.get('next')?.includes(id));
  assert.deepEqual(errors,[]);
  record(device+': all 96 photos load and the real inquiry/sign-in entry responds',{loadedPhotos:96,accountOrInquirySubmitted:false,blockedWrites});
  await ctx.close();
 }
 report.healthAfter=await health();report.passed=true;
}catch(error){report.error=String(error.stack||error);}
finally{
 await browser?.close();report.finishedAt=new Date().toISOString();await fs.mkdir(output,{recursive:true});
 // Do not create an unscoped mirror of the retail catalogue in public test artifacts.
 await fs.writeFile(path.join(output,'production-report.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
 await fs.writeFile(path.join(output,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>Read-only stone release verification</h1><a href="production-report.json">Checks and scope</a>');
 console.log('STONE_PUBLIC_RESULT '+JSON.stringify(report));process.exitCode=report.passed?0:1;
}
