import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

export async function verifyKitchenWorkspace({ browser, local, phase, deployed, working, record }) {
  const key = 'tradescout:steel-home-project-tools:draft:v9';
  const parentHtml = phase === 'preview' ? await fs.readFile('.kitchen-studio-review/cabinet-parent.html','utf8') : null;
  for (const [device, viewport] of [['desktop',{width:1440,height:1000}],['laptop',{width:1366,height:768}],['mobile',{width:390,height:844}]]) {
    const context = await browser.newContext({viewport,isMobile:device==='mobile',hasTouch:device==='mobile',serviceWorkers:'block',acceptDownloads:true,
      userAgent:`Mozilla/5.0 (${device==='mobile'?'Linux; Android 13; Pixel 7':'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device==='mobile'?'Mobile ':''}Safari/537.36`});
    const errors=[],blocked=[];
    await context.route('**/*',route=>{
      const req=route.request(), url=new URL(req.url());
      if(!['GET','HEAD'].includes(req.method())) {blocked.push(url.pathname);return route.abort('blockedbyclient');}
      if(parentHtml && req.isNavigationRequest() && url.origin===local && url.pathname.startsWith('/u/'))return route.fulfill({body:parentHtml,contentType:'text/html'});
      return route.continue();
    });
    const page=await context.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(45000);
    page.on('pageerror',error=>errors.push(error.message));
    const click=async locator=>{await locator.scrollIntoViewIfNeeded();device==='mobile'?await locator.tap():await locator.click();};
    const button=name=>page.getByRole('button',{name,exact:true});
    const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const rect=selector=>page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
    const top=()=>page.locator('.kitchen-designer-studio').evaluate(el=>el.scrollTo(0,0));
    const capture=async name=>{
      await page.waitForTimeout(250);
      const png=await page.screenshot({fullPage:false});await fs.writeFile(path.join(working,name+'.png'),png);
      const image=await sharp(png).resize({width:device==='mobile'?320:600}).webp({quality:20,effort:6}).toBuffer();
      await fs.writeFile(path.join(working,name+'.webp'),image);
      if(name===(process.env.WORKSPACE_EMIT_IMAGE||'after-laptop-library'))console.log('WORKSPACE_AFTER_IMAGE '+JSON.stringify({name,sha256:createHash('sha256').update(image).digest('hex'),base64:image.toString('base64')}));
    };
    try {
      const destination=phase==='production'?'https://www.thetradescout.com/u/steel-home-packages/builders/cabinets':local+'/cabinet-parent.html';
      const initial=await page.goto(destination,{waitUntil:'domcontentloaded'});assert(initial?.ok());
      if(phase==='production')assert.equal(initial.headers()['x-tradescout-build'],deployed);
      await page.getByTestId('steel-home-cabinet-designer').waitFor({state:'visible'});
      await page.waitForFunction(key=>localStorage.getItem(key)!==null,key);
      const sample=await read();
      const m={kind:'base-cabinet',surface:'north',widthIn:30,depthIn:24,heightIn:34.5,elevationIn:0,roomDepthOffsetIn:0};
      sample.cabinets.planner={...sample.cabinets.planner,starter:'kitchen',view:'plan',selectedModuleId:'base-1',shell:{widthIn:180,depthIn:156,heightIn:108,measurementsReviewed:false},shellItems:[],notes:'Synthetic workspace notes',modules:[{...m,id:'base-1',label:'Sink base',widthIn:36,offsetIn:0},{...m,id:'base-2',label:'Drawer bank',offsetIn:36},{...m,id:'upper',label:'Wall cabinet',kind:'wall-cabinet',widthIn:36,depthIn:12,heightIn:30,elevationIn:54,offsetIn:0},{...m,id:'island',label:'Island',kind:'island',surface:'floor',widthIn:60,depthIn:36,offsetIn:72,roomDepthOffsetIn:78}],presentation:{style:'Shaker',finish:'sage',hardware:'Brushed brass',fronts:{'base-1':'sink','base-2':'drawers','upper':'doors','island':'doors'}}};
      sample.countertops={...sample.countertops,room:'Kitchen',layout:'l-shape',wallAIn:180,wallBIn:120,wallDepthIn:25.5,stoneId:'cristallo',roomWidthIn:180,roomDepthIn:156,roomWallHeightIn:108,finishedTopHeightIn:36,topThicknessIn:1.25,island:true,islandLengthIn:64,islandWidthIn:40,islandLeftOffsetIn:70,islandBackOffsetIn:76,measurementsReviewed:false,sink:'Single-bowl undermount',sinkRun:'main',sinkPositionIn:75,sinkFrontPositionIn:12.75,sinkTemplateWidthIn:30,sinkTemplateDepthIn:18};
      await page.evaluate(({key,sample})=>localStorage.setItem(key,JSON.stringify(sample)),{key,sample});
      const response=await page.reload({waitUntil:'domcontentloaded'});
      if(phase==='production')assert.equal(response.headers()['x-tradescout-build'],deployed);
      await page.getByTestId('cabinet-direct-placement').waitFor({state:'visible'});await top();
      const baseline=await read(),studio=await rect('.kitchen-designer-studio'),drawing=await rect('[data-testid="steel-home-cabinet-plan"]');
      await capture('after-'+device+'-cabinets');
      console.log('WORKSPACE_BOUNDS '+JSON.stringify({device,studio,drawing}));
      assert(studio.y>=0 && studio.bottom<=viewport.height+2,`${device}: studio grows outside the viewport`);
      assert(drawing.x>=0 && drawing.right<=viewport.width+1,`${device}: SVG is clipped horizontally inside its parent`);
      assert(drawing.height>=140 && drawing.y>=0 && drawing.bottom<=viewport.height+2,`${device}: drawing is not fully visible on entry`);
      await click(button('Cabinet library'));await page.getByTestId('cabinet-library-panel').waitFor({state:'visible'});
      await click(page.getByTestId('cabinet-library-sink-base'));
      await page.getByTestId('cabinet-library-panel').evaluate(el=>el.scrollTo(0,0));
      await top();
      const panel=await rect('.kitchen-workspace-panel[open]');
      assert(panel.y>=0 && panel.bottom<=viewport.height+2 && panel.right<=viewport.width+1,`${device}: tools panel exceeds the visible screen`);
      if(device!=='mobile') {
        const withLibrary=await rect('[data-testid="steel-home-cabinet-plan"]');
        assert.deepEqual(withLibrary,drawing,`${device}: library moved/resized the drawing`);
        assert(withLibrary.right<=panel.x+2,`${device}: library covers the drawing`);
      }
      const field=page.getByLabel('Library Width in',{exact:true});
      const palette=await field.evaluate(el=>{const s=getComputedStyle(el);return{background:s.backgroundColor,color:s.color};});
      assert.equal(palette.background,'rgb(255, 255, 255)',`${device}: global dark background leaked into a light field`);
      assert.equal(palette.color,'rgb(24, 49, 47)',`${device}: field foreground lost light-theme contrast`);
      assert.deepEqual(await read(),baseline,'Opening library and inspecting it changed the saved design');
      await capture('after-'+device+'-library');
      await page.getByTestId('cabinet-library-panel').locator('h2').focus();await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('.kitchen-workspace-panel[open]'));
      assert.equal(await button('Cabinet library').evaluate(el=>document.activeElement===el),true,'Escape did not return focus to the opener');
      assert.deepEqual(await read(),baseline);
      record(`${device}: visible cabinet workspace`,{studio,drawing,panel,palette,libraryPreservesCanvas:device!=='mobile',escapeReturnsFocus:true,draftUnchanged:true});
      await click(button('Cabinet schedule'));await page.getByTestId('cabinet-library-panel').waitFor({state:'visible'});
      const pending=page.waitForEvent('download');await click(button('Export cabinet schedule'));assert.equal(await (await pending).failure(),null);
      await click(button('Close library and schedule'));await top();
      await click(page.getByTestId('steel-home-cabinet-view-3d'));await page.getByTestId('steel-home-cabinet-three-preview').locator('canvas').waitFor({state:'visible'});
      await page.waitForTimeout(300);
      assert.equal(await page.getByText('3D room unavailable',{exact:true}).count(),0);
      const cabinetCanvas=await rect('[data-testid="steel-home-cabinet-three-preview"] canvas');
      assert(cabinetCanvas.width>100 && cabinetCanvas.height>100 && cabinetCanvas.right<=viewport.width+1,'Cabinet 3D lost usable dimensions');
      await capture('after-'+device+'-cabinet-3d');
      await click(page.getByTestId('steel-home-builder-close'));await click(page.getByTestId('steel-home-builder-open-countertops'));
      await page.getByTestId('steel-home-countertop-designer').waitFor({state:'visible'});
      await page.getByTestId('steel-home-countertop-3d-visualizer').locator('canvas').waitFor({state:'visible'});await top();
      const countertopStudio=await rect('.kitchen-designer-studio');
      const canvas=await rect('[data-testid="steel-home-countertop-3d-visualizer"] canvas');
      await capture('after-'+device+'-countertops');
      console.log('WORKSPACE_COUNTERTOP '+JSON.stringify({device,studio:countertopStudio,canvas}));
      assert(countertopStudio.bottom<=viewport.height+2,'Countertop workbench is clipped by the outer shell');
      assert(canvas.x>=0 && canvas.right<=viewport.width+1 && canvas.height>=200,'Countertop visualizer has unusable geometry');
      if(device!=='mobile')assert(canvas.bottom<=viewport.height+2,'Countertop 3D is cropped below the laptop screen');
      await click(button('Scaled drawing'));await page.getByTestId('countertop-precision-drawing').waitFor({state:'visible'});
      const counterBefore=await read();
      const exportPending=page.waitForEvent('download');await click(button('Export drawing'));assert.equal(await (await exportPending).failure(),null);
      await click(button('Edit design'));assert.deepEqual(await read(),counterBefore,'Opening reviews changed project data');
      assert.deepEqual(errors,[]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      record(`${device}: countertop viewport and recovery`,{countertopStudio,canvas,scheduleExport:true,countertopExport:true,errors,blockedWrites:blocked.length});
    } catch(error) {
      await capture('failure-'+device).catch(()=>{});
      console.error('WORKSPACE_FAILURE_VIEW '+JSON.stringify({device,text:(await page.locator('body').innerText().catch(()=>'' )).slice(0,2500)}));
      throw error;
    } finally {await context.close();}
  }
}
