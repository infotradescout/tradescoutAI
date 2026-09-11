import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { prepareCabinetParentFixture } from './prepare-cabinet-parent-proof.mjs';
import { verifyKitchenWorkspace } from './verify-kitchen-workspace-browser.mjs';

const level=process.env.WORKSPACE_VERIFY_LEVEL || 'release';
assert(['inspect','release'].includes(level));
const out='.kitchen-workspace-proof';
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(level==='inspect') {
  // Iterative UI feedback only. This mode cannot attest to release readiness.
  const working=await fs.mkdtemp(path.join(os.tmpdir(),'kitchen-workspace-'));
  const proof={head,mode:'inspection-only',attestable:false,checks:[],passed:false};
  let server,browser;
  try {
    execFileSync(process.execPath,['node_modules/playwright/cli.js','install','chromium'],{stdio:'inherit'});
    await prepareCabinetParentFixture();
    server=spawn(process.execPath,['scripts/serve-kitchen-studio-review.mjs'],{env:{...process.env,PORT:'4179'},stdio:'inherit'});
    for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4179/cabinet-parent.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({channel:'chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']});
    await verifyKitchenWorkspace({browser,local:'http://127.0.0.1:4179',phase:'preview',deployed:null,working,record:(name,detail)=>{proof.checks.push({name,detail,passed:true});console.log('WORKSPACE_CHECK '+JSON.stringify({name,detail}));}});
    proof.passed=true;
  }catch(error){proof.error=String(error.stack||error);console.error('WORKSPACE_INSPECTION_FAILED '+proof.error);}
  finally {
    await browser?.close();server?.kill();await fs.mkdir(out,{recursive:true});await fs.cp(working,out,{recursive:true});
    await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));
    const images=(await fs.readdir(out)).filter(name=>name.endsWith('.png'));
    await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>Inspection only — not release approval</h1><a href="evidence.json">Evidence</a>'+images.map(name=>'<p>'+name+'</p><img style="max-width:100%" src="'+name+'">').join(''));
    console.log('WORKSPACE_INSPECTION_RESULT '+JSON.stringify(proof));await fs.rm(working,{recursive:true,force:true});
  }
} else {
  // The canonical registry checks actual ancestry. Render may omit both remote and history.
  if((process.env.CABINET_LIBRARY_PHASE||'preview')==='preview') {
    const git=args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    const remote=spawnSync('git',['remote','get-url','origin'],{encoding:'utf8'});
    if(remote.status!==0)execFileSync('git',['remote','add','origin','https://github.com/infotradescout/tradescoutAI.git']);
    const shallow=git(['rev-parse','--is-shallow-repository'])==='true';
    execFileSync('git',['fetch','--filter=blob:none','--no-tags',...(shallow?['--unshallow']:[]),'origin','refs/heads/main:refs/remotes/origin/main'],{stdio:'inherit'});
    assert.equal(git(['rev-parse','HEAD']),head);
    execFileSync('node',['scripts/guard-production-readiness-registry.mjs'],{stdio:'inherit'});
  }
  const original=await fs.readFile('scripts/verify-cabinet-library.mjs','utf8');
  const bytes=Buffer.from(original);
  const hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(hash,'81792e9b7b89edddc2184f05cd0c64ec354867d9');
  const anchor='  await browser.close(); browser = null; server.kill(); server = null;';
  assert.equal(original.split(anchor).length,2);
  let source=original
    .replace("from './prepare-cabinet-parent-proof.mjs'","from './scripts/prepare-cabinet-parent-proof.mjs'")
    .replace("from './start-cabinet-loopback-test-db.mjs'","from './scripts/start-cabinet-loopback-test-db.mjs'")
    .replace("const out = '.cabinet-library-proof';","const out = '.kitchen-workspace-proof';")
    .replace(anchor,'  await verifyCabinetAccessories({ browser, local, phase, deployed, working, record });\n  await verifyKitchenWorkspace({ browser, local, phase, deployed, working, record });\n'+anchor)
    .replace('prior cabinet/countertop regressions retained\'','prior cabinet/countertop regressions retained; accessory journeys and desktop/laptop/mobile visible-canvas bounds, non-displacing panels, readable controls, focus recovery and exports passed\'');
  source="import { verifyCabinetAccessories } from './scripts/verify-cabinet-accessories-browser.mjs';\nimport { verifyKitchenWorkspace } from './scripts/verify-kitchen-workspace-browser.mjs';\n"+source;
  console.log('WORKSPACE_RELEASE_BASE '+hash);
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exitCode=result.status??1;
}
