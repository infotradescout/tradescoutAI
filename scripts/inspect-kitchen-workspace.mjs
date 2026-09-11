import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';

const out = '.kitchen-workspace-proof';
await fs.mkdir(out, { recursive: true });
const expected = process.env.WORKSPACE_DEPLOYED_SHA || '26ee79b27323c0af1219931ab5812048cfa559f5';
assert(/^[a-f0-9]{40}$/.test(expected));
const origin = 'https://www.thetradescout.com';
const key = 'tradescout:steel-home-project-tools:draft:v9';
const report = { source: execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim(), expected, capturedAt: new Date().toISOString(), pages: [], passed: false };
execFileSync(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium'], {stdio:'inherit'});
const browser = await chromium.launch({channel:'chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']});
try {
 for (const [device,viewport] of [['desktop',{width:1440,height:1000}],['laptop',{width:1366,height:768}],['mobile',{width:390,height:844}]]) {
  const context = await browser.newContext({viewport,isMobile:device==='mobile',hasTouch:device==='mobile',serviceWorkers:'block',userAgent:`Mozilla/5.0 (${device==='mobile'?'Linux; Android 13; Pixel 7':'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device==='mobile'?'Mobile ':''}Safari/537.36`});
  await context.route('**/*', route => ['GET','HEAD'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const go = async tool => {const r=await page.goto(origin+'/u/steel-home-packages/builders/'+tool,{waitUntil:'domcontentloaded'});assert(r?.ok());assert.equal(r.headers()['x-tradescout-build'],expected);};
  await go('cabinets');
  await page.getByTestId('steel-home-cabinet-start-kitchen').click();
  for(const [id,value] of [['steel-home-cabinet-primary-wall','180'],['steel-home-cabinet-return-wall','156'],['steel-home-cabinet-ceiling-height','108']]) await page.getByTestId(id).fill(value);
  await page.getByTestId('steel-home-cabinet-add-base-cabinet').click();
  let sample = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  const m=sample.cabinets.planner.modules[0];
  sample.cabinets.planner={...sample.cabinets.planner,view:'plan',selectedModuleId:'base-1',shell:{widthIn:180,depthIn:156,heightIn:108,measurementsReviewed:false},modules:[{...m,id:'base-1',label:'Sink base',widthIn:36,offsetIn:0},{...m,id:'base-2',label:'Drawer bank',widthIn:30,offsetIn:36},{...m,id:'upper',label:'Wall cabinet',kind:'wall-cabinet',widthIn:36,depthIn:12,heightIn:30,elevationIn:54,offsetIn:0},{...m,id:'island',label:'Island',kind:'island',surface:'floor',widthIn:60,depthIn:36,offsetIn:72,roomDepthOffsetIn:78}],presentation:{style:'Shaker',finish:'sage',hardware:'Brushed brass',fronts:{'base-1':'sink','base-2':'drawers','upper':'doors','island':'doors'}}};
  sample.countertops={...sample.countertops,room:'Kitchen',layout:'l-shape',wallAIn:180,wallBIn:120,wallDepthIn:25.5,stoneId:'cristallo',roomWidthIn:180,roomDepthIn:156,roomWallHeightIn:108,finishedTopHeightIn:36,topThicknessIn:1.25,island:true,islandLengthIn:64,islandWidthIn:40,islandLeftOffsetIn:70,islandBackOffsetIn:76,measurementsReviewed:false,sink:'Single-bowl undermount',sinkRun:'main',sinkPositionIn:75,sinkFrontPositionIn:12.75,sinkTemplateWidthIn:30,sinkTemplateDepthIn:18};
  await page.evaluate(({key,sample})=>localStorage.setItem(key,JSON.stringify(sample)),{key,sample});
  const capture=async name=>{
   await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(500);
   const png=await page.screenshot({fullPage:false}); await fs.writeFile(path.join(out,name+'.png'),png);
   const small=await sharp(png).resize({width:device==='mobile'?390:960}).webp({quality:35,effort:6}).toBuffer();
   await fs.writeFile(path.join(out,name+'.webp'),small);
   const geometry=await page.evaluate(()=>{
    const selectors=['.kitchen-designer-studio','.kitchen-designer-toolbar','.kitchen-designer-appearance','.kitchen-designer-editor','[data-testid="steel-home-cabinet-plan"]','[data-testid="cabinet-library-panel"]','[data-testid="steel-home-countertop-designer"]','canvas'];
    return {viewport:{width:innerWidth,height:innerHeight},scrollHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+2,elements:selectors.map(selector=>{const el=document.querySelector(selector);if(!el)return{selector,missing:true};const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{selector,x:r.x,y:r.y,width:r.width,height:r.height,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflowY:s.overflowY,display:s.display};})};
   });
   report.pages.push({name,geometry,errors:[...errors],sha256:createHash('sha256').update(small).digest('hex'),bytes:small.length});
   console.log('WORKSPACE_GEOMETRY '+JSON.stringify({name,...geometry}));
   if(name===(process.env.WORKSPACE_EMIT_IMAGE||'laptop-cabinets-library')) console.log('WORKSPACE_IMAGE '+JSON.stringify({name,sha256:createHash('sha256').update(small).digest('hex'),base64:small.toString('base64')}));
  };
  await page.reload({waitUntil:'domcontentloaded'}); await page.getByTestId('cabinet-direct-placement').waitFor({state:'visible'});
  await capture(device+'-cabinets');
  await page.getByRole('button',{name:'Cabinet library',exact:true}).click();
  await page.getByTestId('cabinet-library-sink-base').click();
  await capture(device+'-cabinets-library');
  await go('countertops'); await page.getByTestId('steel-home-countertop-designer').waitFor({state:'visible'});
  await capture(device+'-countertops');
  await context.close();
 }
 report.passed=true;
} catch(error){report.error=String(error.stack||error);console.error('WORKSPACE_ERROR '+report.error);}
finally{await browser.close();await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(out,'index.html'),'<!doctype html><meta name="robots" content="noindex,nofollow"><h1>Kitchen workspace inspection</h1><a href="evidence.json">Measured viewport report</a>'+report.pages.map(p=>`<p>${p.name}</p><img style="max-width:100%" src="${p.name}.png">`).join(''));console.log('WORKSPACE_RESULT '+JSON.stringify(report));}
if(!report.passed)process.exitCode=1;
