import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';

/** Actual built application only; writes are restricted to the existing local fixture. */
export async function proveEstimateBrowser({database,fixture,workspaceId,customer,supplier,stranger,output}) {
 const base='http://127.0.0.1:5218';assert.equal(fixture.baseUrl,base);
 assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name,'ts_operator_test');
 assert.match(fixture.profileSlug,/^operator-proof-[0-9a-f]{8}$/);
 const install=spawnSync(process.execPath,['node_modules/playwright/cli.js','install','chromium'],{encoding:'utf8',timeout:180000});assert.equal(install.status,0,install.stderr);
 const browser=await chromium.launch({channel:'chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 await fs.mkdir(output,{recursive:true});const result=[];
 const baselineCount=async()=>Number((await database.query('SELECT count(*) AS n FROM job_estimates WHERE workspace_id=$1',[workspaceId])).rows[0].n);
 async function waitText(locator,text){await locator.filter({hasText:text}).waitFor({timeout:45000});assert((await locator.innerText()).includes(text));}
 let activePage;
 try{
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['touch',{width:390,height:844}]]) {
   const errors=[],failedAssets=[],screenshots=[],guideClosures=[];const contexts=[];
   async function context(api){const c=await browser.newContext({storageState:await api.storageState(),viewport,isMobile:device==='touch',hasTouch:device==='touch',serviceWorkers:'block',userAgent:`Mozilla/5.0 (${device==='touch'?'Linux; Android 13':'X11; Linux x86_64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`});contexts.push(c);await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));return c;}
   async function page(c){const p=await c.newPage();activePage=p;p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&['script','stylesheet'].includes(r.request().resourceType())&&new URL(r.url()).origin===base)failedAssets.push({path:new URL(r.url()).pathname,status:r.status()});});return p;}
   async function dismissGuide(p){
     const close=p.getByRole('button',{name:'Close Start here guide',exact:true}).last();
     if(await close.isVisible()){if(device==='touch')await close.tap();else await close.click();await close.waitFor({state:'hidden'});guideClosures.push('Closed through the existing visible guide button');}
   }
   const click=async(p,locator)=>{activePage=p;await dismissGuide(p);await locator.scrollIntoViewIfNeeded();return device==='touch'?locator.tap():locator.click();};
   async function screenshot(p,locator,label){await dismissGuide(p);const file=device+'-'+label+'.png';const image=await locator.screenshot({path:path.join(output,file)});screenshots.push({file,sha256:createHash('sha256').update(image).digest('hex')});}
   const sContext=await context(supplier),s=await page(sContext);
   const editUrl=base+'/direct-connect/inbox?jobWorkspaceId='+encodeURIComponent(workspaceId)+'&action=create_estimate';
   const response=await s.goto(editUrl,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);
   const editor=s.getByTestId('estimate-editor');await editor.waitFor();await dismissGuide(s);
   const countBefore=await baselineCount();let dropped=false;let durableId;
   const createUrl=base+`/api/direct-connect/jobs/${workspaceId}/estimates`;
   // Lose a success packet AFTER the actual server commits. No fake success
   // body is supplied; retry must resolve the same persisted quote by its key.
   await sContext.route(createUrl,async route=>{
     if(route.request().method()==='POST'&&!dropped){dropped=true;assert(route.request().headers()['idempotency-key']);const actual=await route.fetch();assert.equal(actual.status(),201);durableId=(await actual.json()).estimateId;return route.abort('failed');}
     return route.continue();
   });
   await editor.getByLabel('Estimate title',{exact:true}).fill('Synthetic '+device+' browser estimate');
   await editor.getByLabel('Scope of work',{exact:true}).fill('Invented materials and labor for isolated browser verification. This is not a real customer quote.');
   await click(s,editor.getByRole('button',{name:'Start estimate',exact:true}));
   await s.getByText('Could not start estimate',{exact:true}).first().waitFor();assert(dropped);assert(durableId);
   await click(s,editor.getByRole('button',{name:'Start estimate',exact:true}));await editor.getByTestId('estimate-saved-total').waitFor();
   assert.equal(new URL(s.url()).searchParams.get('estimateId'),durableId);assert.equal(await baselineCount(),countBefore+1);await sContext.unroute(createUrl);
   const lines=[['other','Pallet allowance',1,100],['other','Delivery allowance',1,200],['material','Measured material allowance',2,150],['labor','Fabrication labor allowance',2,50]];
   let total=0;
   for(const [lineType,name,quantity,unitCost] of lines){
     await editor.getByLabel('Item type',{exact:true}).selectOption(lineType);await editor.getByLabel('Item name',{exact:true}).fill(name);
     await editor.getByLabel('Quantity',{exact:true}).fill(String(quantity));await editor.getByLabel('Unit cost',{exact:true}).fill(String(unitCost));
     const saved=s.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/line-items'));
     await click(s,editor.getByRole('button',{name:'Add line item',exact:true}));const write=await saved;assert.equal(write.status(),201);assert(write.request().headers()['idempotency-key']);
     total+=quantity*unitCost;await waitText(editor.getByTestId('estimate-saved-total'),'$'+total.toFixed(2));
   }
   await s.reload({waitUntil:'domcontentloaded'});await waitText(s.getByTestId('estimate-editor').getByTestId('estimate-saved-total'),'$700.00');await dismissGuide(s);
   assert.equal(new URL(s.url()).searchParams.get('estimateId'),durableId);
   const idLiteral=(await database.query('SELECT quote_literal($1) AS value',[durableId])).rows[0].value;
   await database.query("ALTER TABLE direct_connect_notifications ADD CONSTRAINT browser_send_failure_fixture CHECK (NOT (metadata_json->>'estimateId'="+idLiteral+" AND notification_type='estimate_sent'))");
   try{
    const failure=s.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/send')&&r.request().method()==='POST');
    await click(s,s.getByRole('button',{name:'Send estimate to requester',exact:true}));assert.equal((await failure).status(),500);
    assert.equal((await database.query('SELECT status FROM job_estimates WHERE id=$1',[durableId])).rows[0].status,'draft');
   }finally{await database.query('ALTER TABLE direct_connect_notifications DROP CONSTRAINT browser_send_failure_fixture');}
   await click(s,s.getByRole('button',{name:'Send estimate to requester',exact:true}));await s.getByText('This estimate is available for the requester to review.',{exact:false}).waitFor();
   const sent=await customer.get(`/api/direct-connect/jobs/${workspaceId}/estimates/${durableId}`);assert.equal(sent.status(),200);assert.equal((await sent.json()).totalEstimate,700);
   const notices=(await database.query("SELECT recipient_user_id,action_url FROM direct_connect_notifications WHERE notification_type='estimate_sent' AND metadata_json->>'estimateId'=$1",[durableId])).rows;
   assert.equal(notices.length,1);assert.equal(notices[0].recipient_user_id,fixture.identities.requester.id);
   const destination=new URL(notices[0].action_url,base);assert.equal(destination.origin,base);assert.equal(destination.pathname,'/direct-connect/engagements');assert.equal(destination.searchParams.get('estimateId'),durableId);assert.equal(destination.searchParams.get('jobWorkspaceId'),workspaceId);
   const cContext=await context(customer),c=await page(cContext);
   // Open the link actually committed in this customer's notification, rather
   // than inventing a separate test-only quote page.
   await c.goto(destination.href,{waitUntil:'domcontentloaded',timeout:60000});const review=c.getByTestId('estimate-review');await review.waitFor();await waitText(review.getByTestId('estimate-saved-total'),'$700.00');await dismissGuide(c);
   for(const [,name] of lines)assert((await review.innerText()).includes(name));
   assert.equal(await c.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Customer quote horizontal overflow');
   await screenshot(c,review,'customer-quote');await screenshot(s,s.getByTestId('estimate-editor'),'supplier-quote');
   const decision=device==='desktop'?'Accept':'Decline';
   const answered=c.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/respond')&&r.request().method()==='POST');
   await click(c,review.getByRole('button',{name:decision,exact:true}));assert.equal((await answered).status(),200);
   await c.reload({waitUntil:'domcontentloaded'});await waitText(c.getByTestId('estimate-review'),decision==='Accept'?'Estimate accepted':'Estimate declined');
   const status=(await database.query('SELECT status,total_estimate FROM job_estimates WHERE id=$1',[durableId])).rows[0];assert.equal(status.status,decision==='Accept'?'accepted':'declined');assert.equal(Number(status.total_estimate),700);
   const outsiderContext=await context(stranger),outsider=await page(outsiderContext);
   await outsider.goto(destination.href,{waitUntil:'domcontentloaded',timeout:60000});await outsider.getByTestId('estimate-review').getByRole('alert').waitFor();await dismissGuide(outsider);
   assert.equal(await outsider.getByTestId('estimate-saved-lines').count(),0);assert(!(await outsider.locator('body').innerText()).includes('Synthetic '+device+' browser estimate'));
   assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);
   result.push({device,passed:true,realEditor:true,lostCreateResponseRecovered:true,oneCreatedQuote:true,categories:['other','material','labor'],savedTotal:700,refreshPreservesQuote:true,failedSendRollback:true,retrySent:true,actualNotificationDestination:true,actualCustomerReview:true,customerDecision:status.status,unauthorizedContentDenied:true,guideClosures,screenshots,errors,failedAssets});
   console.log('ESTIMATE_BROWSER_CHECK '+JSON.stringify(result.at(-1)));
   for(const ctx of contexts)await ctx.close();activePage=undefined;
  }
 }catch(error){if(activePage){console.error('ESTIMATE_BROWSER_PAGE '+(await activePage.locator('body').innerText().catch(()=>'' )).slice(0,6000));await activePage.screenshot({path:path.join(output,'browser-failure.png'),fullPage:true}).catch(()=>{});}throw error;}
 finally{await browser.close();await fs.writeFile(path.join(output,'browser-evidence.json'),JSON.stringify(result,null,2));}
 return result;
}
