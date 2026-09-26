import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';

const root=process.cwd(),head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'jw-reserved-purchase-'));
const name='jw-reserved-purchase-'+process.pid,entry=path.join(root,'client/src',name+'.tsx'),html=path.join(root,'client',name+'.html');
const output=path.resolve('test-results/jw-reserved-purchase'),base='http://127.0.0.1:5199',viewerId='reserved-browser-fixture';
const reservationId='jwh_'+'a'.repeat(32),expiresAt=new Date(Date.now()+25*60000).toISOString();
const lines=Array.from({length:7},(_,i)=>({inventoryPublicId:'stone_'+String(i+1).padStart(32,'0'),materialName:'Reserved Stone '+(i+1),quantity:1,unitRateCents:200+50*i,oneSlabTotalCents:(200+50*i)*50,lineTotalCents:(200+50*i)*50,pricingTier:'bundle'}));
const priced={reservationId,status:'active',expiresAt,serverTime:new Date().toISOString(),currency:'USD',materialSubtotalCents:122500,paymentStatus:'not_started',readyForCheckout:false,fulfillment:{method:'pickup'},deliveryFeeCents:null,estimatedDeliveryDate:null,lines};
const recovery={viewerId,hold:{reservationId,status:'active',expiresAt,serverTime:new Date().toISOString(),totalSlabs:7,lines:lines.map(({inventoryPublicId,materialName,quantity})=>({inventoryPublicId,materialName,quantity}))}};
const report={head,passed:false,devices:[],productionWrites:false,providerNetworkUsed:false,scope:'Real lazy reservation panel and reserved-purchase controls; API fixtures only. Membership-denial and active-receipt visibility are tested, not real authentication or payment.'};
let vite,browser;
try{
  assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(entry,[
    'import React from "react";import {createRoot} from "react-dom/client";',
    'import {QueryClient,QueryClientProvider} from "@tanstack/react-query";',
    'import {JwStoneReservationStatus} from "./features/jw-stone/JwStoneReservationStatus";',
    'import "./index.css";',
    `createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><JwStoneReservationStatus viewerId="${viewerId}" onContact={()=>{}}/></QueryClientProvider>);`,
  ].join('\n'));
  await fs.writeFile(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/${name}.tsx"></script></body></html>`);
  vite=await createServer({configFile:path.join(root,'vite.config.ts'),cacheDir:path.join(temp,'vite'),server:{host:'127.0.0.1',port:5199,strictPort:true},optimizeDeps:{entries:[entry]}});await vite.listen();
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const[device,viewport]of[['desktop',{width:1440,height:1000}],['touch',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,isMobile:device==='touch',hasTouch:device==='touch'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    let revoked=false,active=true;const posted=[],errors=[],requestId=randomUUID();
    await context.route('**/api/**',async route=>{
      const req=route.request(),p=new URL(req.url()).pathname;let payload;
      if(req.method()==='POST')posted.push({path:p,body:req.postDataJSON()});
      if(p.endsWith('/holds/active'))payload=active?recovery:{viewerId,hold:null};
      else if(p.endsWith('/holds/'+reservationId)){
        if(revoked)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic member pricing revoked'})});
        payload=priced;
      }else if(p==='/api/u/jw-stone/orders/purchases')payload={requestId,role:'buyer',intake:{intent:'purchase'},state:{status:'pending_review'}};
      else return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'Unconfigured fixture'})});
      return route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const click=async locator=>{await locator.scrollIntoViewIfNeeded();if(device==='touch')await locator.tap();else await locator.click();};
    await page.goto(base+'/'+name+'.html');await expect(page.getByTestId('jw-owned-reservation-status')).toContainText(reservationId);
    await click(page.getByRole('button',{name:'Buy these reserved slabs',exact:true}));await expect(page.getByTestId('jw-purchase-start')).toContainText('$1,225.00');
    await expect(page.getByTestId('jw-purchase-submit')).toBeDisabled();assert.equal(posted.length,0);
    await page.getByTestId('jw-purchase-start').getByRole('checkbox').check();await click(page.getByTestId('jw-purchase-submit'));
    await expect(page.getByRole('link',{name:'Open purchase and final quote',exact:true})).toHaveAttribute('href','/jw-stone/orders?request='+requestId);
    assert.equal(posted.length,1);assert.equal(posted[0].path,'/api/u/jw-stone/orders/purchases');assert.equal(posted[0].body.expectedSubtotalCents,122500);assert.deepEqual(posted[0].body.selection.lines,lines.map(({inventoryPublicId,quantity})=>({inventoryPublicId,quantity})));
    await page.reload();await expect(page.getByRole('button',{name:'Buy these reserved slabs',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Release reservation',exact:true})).toBeVisible();
    await page.screenshot({path:path.join(output,device+'-reserved-purchase.png')});
    revoked=true;await page.reload();await expect(page.getByTestId('jw-owned-reservation-status')).toContainText(reservationId);
    await expect(page.getByRole('button',{name:'Release reservation',exact:true})).toBeVisible();
    await expect(page.getByTestId('jw-reserved-purchase')).toHaveCount(0);await expect(page.locator('body')).not.toContainText('$1,225.00');
    active=false;await page.reload();await expect(page.getByTestId('jw-owned-reservation-status')).toHaveCount(0);await expect(page.getByTestId('jw-reserved-purchase')).toHaveCount(0);
    assert.deepEqual(errors,[]);assert.equal(posted.length,1);
    report.devices.push({device,pricedOwnedReceipt:true,sevenReservedSlabsSelected:true,explicitPurchaseConsent:true,noReleaseBeforePurchaseRequest:true,purchaseActionSurvivesReload:true,revocationHidesPurchasePrices:true,revokedOwnerStillCanRelease:true,noCheckoutOrPaymentCalls:true});await context.close();
  }
  report.passed=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{
  await browser?.close();await vite?.close();await fs.rm(entry,{force:true});await fs.rm(html,{force:true});await fs.rm(temp,{recursive:true,force:true});
  report.finalSourceStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();if(report.finalSourceStatus){report.passed=false;process.exitCode=1;}
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(report,null,2)+'\n');console.log('JW_RESERVED_PURCHASE_RESULT '+JSON.stringify(report));
}
