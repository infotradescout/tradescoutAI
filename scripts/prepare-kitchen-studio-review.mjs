import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { build } from 'vite';
import { chromium } from 'playwright';

const repo=process.cwd();
const source=await fs.mkdtemp(path.join(repo,'.kitchen-review-source-'));
const out=path.join(repo,'.kitchen-studio-review');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await fs.writeFile(path.join(source,'index.html'),'<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TradeScout Kitchen Design Review</title></head><body style="margin:0"><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
await fs.writeFile(path.join(source,'entry.tsx'),`
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import CabinetDesigner from '@/pages/profile-sites/steel-home-project-tools/CabinetDesigner';
import CountertopDesigner from '@/pages/profile-sites/steel-home-project-tools/CountertopDesigner';
import {createEmptySteelHomeProjectDraft,loadSteelHomeProjectDraft,saveSteelHomeProjectDraft} from '@/pages/profile-sites/steel-home-project-tools/projectModel';
import {createCabinetPlannerModule} from '@/pages/profile-sites/steel-home-project-tools/cabinetPlannerModel';
import '@/index.css';
function App(){
 const [draft,setDraft]=useState(()=>loadSteelHomeProjectDraft(localStorage));
 const [mode,setMode]=useState('cabinets');
 const [saved,setSaved]=useState(true);
 const [message,setMessage]=useState('');
 useEffect(()=>setSaved(saveSteelHomeProjectDraft(localStorage,draft)),[draft]);
 const request=()=>setMessage('Review build: no request was submitted and no provider was contacted.');
 const sample=()=>{
  if(!confirm('Replace this review draft with an illustrative sample kitchen?'))return;
  const d=createEmptySteelHomeProjectDraft();
  d.cabinets.planner={...d.cabinets.planner,starter:'kitchen',shell:{widthIn:180,depthIn:156,heightIn:108,measurementsReviewed:false},modules:[{...createCabinetPlannerModule('base-cabinet','sample-base-1'),offsetIn:0},{...createCabinetPlannerModule('base-cabinet','sample-base-2'),offsetIn:30},{...createCabinetPlannerModule('wall-cabinet','sample-upper'),offsetIn:0}],presentation:{style:'Shaker',finish:'sage',hardware:'Brushed brass',fronts:{'sample-base-1':'drawers'}}};
  d.countertops={...d.countertops,room:'Kitchen',layout:'l-shape',wallAIn:180,wallBIn:120,wallDepthIn:25.5,stoneId:'cristallo',roomWidthIn:180,roomDepthIn:156,roomWallHeightIn:108,finishedTopHeightIn:36,topThicknessIn:1.25,island:false,measurementsReviewed:false,sink:'Single-bowl undermount',sinkRun:'main',sinkPositionIn:75,sinkFrontPositionIn:12.75,sinkTemplateWidthIn:30,sinkTemplateDepthIn:18};
  setDraft(d);setMessage('Illustrative sample loaded. These are not your project measurements.');
 };
 return <div style={{fontFamily:'system-ui',background:'#f6f3ed',color:'#18312f',minHeight:'100vh'}}>
  <header style={{padding:'12px 16px',background:'#18312f',color:'white'}}><h1 style={{fontSize:18,fontWeight:700}}>TradeScout · Kitchen Design Review</h1><p style={{fontSize:12}}>Isolated review build ${commit.slice(0,12)}. Production is unchanged. No live requests or accounts.</p>
   <nav style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{['cabinets','countertops'].map(tool=><button key={tool} style={{padding:'8px 12px',border:'1px solid white',borderRadius:6}} onClick={()=>setMode(tool)}>Open {tool==='cabinets'?'Cabinets':'Countertops'}</button>)}<button style={{padding:'8px 12px',border:'1px solid white',borderRadius:6}} onClick={sample}>Load sample kitchen</button><span role="status" style={{padding:8,fontSize:12}}>{saved?'Saved on this device':'Saving failed — keep this page open'}</span></nav>
  </header>
  {message&&<p role="status" style={{padding:12}}>{message}</p>}
  <main style={{height:'calc(100dvh - 125px)',minHeight:600}}>{mode==='cabinets'?<CabinetDesigner design={draft.cabinets} onChange={cabinets=>setDraft(current=>({...current,cabinets}))} onRequest={request}/>:<CountertopDesigner design={draft.countertops} onChange={countertops=>setDraft(current=>({...current,countertops}))} onRequest={request}/>}</main>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
`);
try{
 await build({configFile:false,root:source,publicDir:path.join(repo,'client/public'),resolve:{alias:{'@':path.join(repo,'client/src'),'@shared':path.join(repo,'shared'),'@assets':path.join(repo,'attached_assets')}},esbuild:{jsx:'automatic'},css:{postcss:repo},build:{outDir:out,emptyOutDir:true},logLevel:'warn'});
}finally{await fs.rm(source,{recursive:true,force:true});}
await fs.mkdir(path.join(out,'proof'),{recursive:true});
const server=spawn(process.execPath,['scripts/serve-kitchen-studio-review.mjs'],{env:{...process.env,PORT:'4179'},stdio:'inherit'});
let browser;
const results={commit,scope:'Actual editor components with their real local draft persistence; isolated host, no production writes',checks:[],passed:false};
try{
 for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4179')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,acceptDownloads:true,serviceWorkers:'block'}),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const clickVisible=async locator=>{await locator.scrollIntoViewIfNeeded();await locator.click();};
  const selectVisible=async(locator,value)=>{await locator.scrollIntoViewIfNeeded();await locator.selectOption(value);};
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tradescout:steel-home-project-tools:draft:v9')));
  const waitSaved=async predicate=>page.waitForFunction(predicate,'tradescout:steel-home-project-tools:draft:v9');
  await page.goto('http://127.0.0.1:4179',{waitUntil:'networkidle'});
  await clickVisible(page.getByTestId('steel-home-cabinet-start-kitchen'));
  for(const [id,value] of [['steel-home-cabinet-primary-wall','180'],['steel-home-cabinet-return-wall','156'],['steel-home-cabinet-ceiling-height','108']]){const field=page.getByTestId(id);await field.scrollIntoViewIfNeeded();await field.fill(value);}
  await clickVisible(page.getByTestId('steel-home-cabinet-add-base-cabinet'));
  await selectVisible(page.getByLabel('Cabinet door style',{exact:true}),'Shaker');
  await selectVisible(page.getByLabel('Cabinet finish',{exact:true}),'sage');
  await selectVisible(page.getByLabel('Cabinet hardware',{exact:true}),'Brushed brass');
  await selectVisible(page.getByLabel('Selected cabinet fronts',{exact:true}),'drawers');
  await clickVisible(page.getByRole('button',{name:'Duplicate selected',exact:true}));
  await waitSaved(key=>{const value=JSON.parse(localStorage.getItem(key)||'null');return value?.cabinets?.planner?.modules?.length===2;});
  let saved=await read();if(saved.cabinets.planner.modules.length!==2)throw Error('Duplication did not persist two modules');
  await clickVisible(page.getByRole('button',{name:'Undo',exact:true}));
  await waitSaved(key=>JSON.parse(localStorage.getItem(key)||'null')?.cabinets?.planner?.modules?.length===1);
  saved=await read();if(saved.cabinets.planner.modules.length!==1)throw Error('Undo did not restore one module');
  await clickVisible(page.getByRole('button',{name:'Redo',exact:true}));
  await waitSaved(key=>JSON.parse(localStorage.getItem(key)||'null')?.cabinets?.planner?.modules?.length===2);
  await clickVisible(page.getByTestId('steel-home-cabinet-view-3d'));
  await page.getByTestId('steel-home-cabinet-three-preview').locator('canvas').waitFor({state:'visible'});
  await page.waitForTimeout(600);
  if(await page.getByText('3D room unavailable',{exact:true}).count())throw Error('Cabinet WebGL did not start');
  await clickVisible(page.getByRole('button',{name:'Orbit left',exact:true}));
  await page.screenshot({path:path.join(out,'proof','cabinets-'+name+'.png'),fullPage:true});
  await page.reload({waitUntil:'networkidle'});
  saved=await read();if(saved.cabinets.planner.presentation?.finish!=='sage'||saved.cabinets.planner.modules.length!==2||!Object.values(saved.cabinets.planner.presentation.fronts).every(value=>value==='drawers'))throw Error('Cabinet appearance or geometry was lost on reload');
  await clickVisible(page.getByRole('button',{name:'Load sample kitchen',exact:true}));
  await clickVisible(page.getByRole('button',{name:'Open Countertops',exact:true}));
  await clickVisible(page.getByRole('button',{name:'Scaled drawing',exact:true}));
  await page.getByTestId('countertop-precision-drawing').waitFor({state:'visible'});
  const points=await page.locator('[data-surface="wall-runs"]').getAttribute('points');
  if(!points.includes('180,0')||!points.includes('25.5,120'))throw Error('Countertop drawing changed dimensional scale');
  const downloadPromise=page.waitForEvent('download');await clickVisible(page.getByRole('button',{name:'Export drawing',exact:true}));const download=await downloadPromise;
  if(!download.suggestedFilename().endsWith('.svg')||await download.failure())throw Error('SVG export failed');
  await page.screenshot({path:path.join(out,'proof','countertops-'+name+'.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  if(overflow)throw Error('Page has horizontal overflow at '+name);
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  results.checks.push({viewport:name,passed:true,cabinetWebGL:true,appearanceReload:true,undoRedo:true,scaledCountertop:true,svgExport:true,horizontalOverflow:false,pageErrors:errors});
  await context.close();
 }
 results.passed=true;
}catch(error){results.error=String(error.stack||error);console.error(results.error);}
finally{await browser?.close();server.kill();await fs.writeFile(path.join(out,'proof/result.json'),JSON.stringify(results,null,2));console.log('KITCHEN_STUDIO_BROWSER_PROOF '+JSON.stringify(results));}
if(!results.passed)process.exitCode=1;
