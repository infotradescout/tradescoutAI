import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { getJwStoneBundleProgress, priceJwStoneBundleLine } from '../shared/jwStoneBundle.ts';

const root = process.cwd(), head = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-storefront-'));
const name = 'jw-storefront-' + process.pid, entry = path.join(root,'client/src',name+'.tsx'), html = path.join(root,'client',name+'.html');
const origin = 'http://127.0.0.1:5198', output = path.resolve('test-results/jw-storefront-entrypoints');
const id = index => 'stone_' + index.toString(16).padStart(32,'0');
const stock = Array.from({length:9}, (_,i) => ({ id:id(i+1), materialName:i===0?'Honey Onyx':'Test Stone '+String(i+1).padStart(2,'0'), materialSlug:i===0?'honey-onyx':'test-stone-'+(i+1), materialFamily:'Granite', quantity:1, unit:'slabs', assetKind:'slab', dimensions:{length:120,height:60,unit:'in'}, imageUrls:[], finishQuantities:[], lastConfirmedAt:'2026-09-22T00:00:00.000Z' }));
const prices = stock.map((s,i) => ({stoneName:s.materialName,stoneKey:s.materialName.toLowerCase(),slabPriceCents:300+75*i,bundlePriceCents:200+50*i,bundleMinSlabs:7}));
function reviewed(body,viewerId) {
  const candidates = body.lines.map(selection => {
    const i = stock.findIndex(s=>s.id===selection.inventoryPublicId); assert(i>=0); const s=stock[i],p=prices[i];
    return {inventoryPublicId:s.id,requestedQuantity:selection.quantity,availableQuantity:1,materialName:s.materialName,materialSlug:s.materialSlug,assetKind:'slab',dimensions:s.dimensions,status:'ready',bundlePricing:{slabRateCents:p.slabPriceCents,bundleRateCents:p.bundlePriceCents,minimumSlabs:7,regularOneSlabCents:p.slabPriceCents*50,bundleOneSlabCents:p.bundlePriceCents*50}};
  });
  const progress=getJwStoneBundleProgress(candidates),lines=candidates.map(line=>({...line,...priceJwStoneBundleLine(line.bundlePricing,line.requestedQuantity,progress.unlocked)}));
  const subtotalCents=lines.reduce((sum,line)=>sum+line.lineTotalCents,0),regularSubtotalCents=lines.reduce((sum,line)=>sum+line.bundlePricing.regularOneSlabCents*line.requestedQuantity,0);
  return {profileSlug:'jw-stone',viewerId,currency:'USD',sourceUpdatedAt:new Date().toISOString(),reviewedAt:new Date().toISOString(),materialReady:true,readyForCheckout:false,inventoryReserved:false,fulfillment:body.fulfillment||{method:'pickup'},subtotalCents,deliveryFeeCents:null,estimatedDeliveryDate:null,lines,bundle:{...progress,regularSubtotalCents,savingsCents:regularSubtotalCents-subtotalCents}};
}
const report={head,passed:false,scope:'Actual storefront components and canonical request serialization with isolated API/session fixtures. Native application authentication/offer submission is tested separately.',devices:[],productionWrites:false};
let vite,browser,page;
try {
  assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(entry,[
    'import React, {useState} from "react"; import {createRoot} from "react-dom/client";',
    'import {QueryClient,QueryClientProvider} from "@tanstack/react-query";',
    'import {JwStoneMemberPricingProvider} from "./features/jw-stone/JwStoneMemberPricing";',
    'import {MarketplaceHeader} from "./features/jw-stone/MarketplaceHeader";',
    'import {StoneCard} from "./features/jw-stone/StoneCard"; import {StoneDetailDialog} from "./features/jw-stone/StoneDetailDialog";',
    'import {NewArrivalsSection} from "./features/jw-stone/CurrentInventorySection"; import {JW_STONE_CATALOG} from "./features/jw-stone/catalog";',
    'import {JW_STONE_BRAND_STYLE} from "./features/jw-stone/brand"; import "./index.css";',
    // Eagerly discover dependencies used by lazy panels before browser interaction.
    // Otherwise Vite may reload the document while the first bundle is being built.
    'import "./features/jw-stone/JwStoneBundleWorkspace"; import "./features/jw-stone/JwStoneShoppingAccess"; import "./pages/profile-sites/ExpressDirectConnectPanel";',
    'const query = new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async ({queryKey})=>{const r=await fetch(String(queryKey[0]));return r.ok?r.json():null;}}}});',
    'const stone=JW_STONE_CATALOG.find(s=>s.id==="honey-onyx")!; (window as any).askCount=0;',
    'function Fixture(){ const [viewer,setViewer]=useState<string|null>("member-a"),[detail,setDetail]=useState(false); (window as any).setFixtureViewer=(v:string|null)=>{setViewer(v);query.clear();}; const ask=()=>{(window as any).askCount++};',
    'return <QueryClientProvider client={query}><JwStoneMemberPricingProvider viewerId={viewer} onOpenCart={()=>setDetail(false)}><main style={JW_STONE_BRAND_STYLE}>',
    '<MarketplaceHeader wishlistCount={0} hasAccount={!!viewer} onOpenWishlist={()=>{}} onOpenAccount={()=>{}} onStartRequest={ask}/>',
    '<StoneCard stone={stone} saved={false} onToggleSaved={()=>{}} onOpen={()=>setDetail(true)} onAsk={ask}/>',
    '<NewArrivalsSection onAsk={ask} onStartRequest={ask}/><StoneDetailDialog stone={detail?stone:null} saved={false} onOpenChange={setDetail} onToggleSaved={()=>{}} onAsk={ask}/>',
    '</main></JwStoneMemberPricingProvider></QueryClientProvider>;} createRoot(document.getElementById("root")!).render(<Fixture/>);',
  ].join('\n'));
  await fs.writeFile(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/${name}.tsx"></script></body></html>`);
  vite=await createServer({configFile:path.join(root,'vite.config.ts'),cacheDir:path.join(temp,'cache'),server:{host:'127.0.0.1',port:5198,strictPort:true},optimizeDeps:{entries:[entry],include:['@radix-ui/react-toast','class-variance-authority','@radix-ui/react-slot']}});await vite.listen();
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const[device,viewport]of[['desktop',{width:1440,height:1000}],['touch',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,isMobile:device==='touch',hasTouch:device==='touch'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    let viewer='member-a',failReview=false,failInventory=false;const posts=[],errors=[];
    await context.route('**/api/**',async route=>{
      const request=route.request(),pathname=new URL(request.url()).pathname;
      if(request.method()==='POST')posts.push(pathname);
      const send=(payload,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
      if(pathname==='/api/auth/user')return send(viewer?{id:viewer,email:'member@example.test',firstName:'Test',lastName:'Member',emailVerified:true}:null);
      if(pathname.endsWith('/member-pricing'))return viewer?send({profileSlug:'jw-stone',viewerId:viewer,access:'member',currency:'USD',unit:'square_foot',sourceUpdatedAt:new Date().toISOString(),prices}):send({message:'Sign in'},401);
      if(pathname.endsWith('/new-arrivals'))return send({profileSlug:'jw-stone',items:[stock[0]]});
      if(pathname.endsWith('/current'))return failInventory?send({message:'Fixture inventory unavailable'},503):send({profileSlug:'jw-stone',items:stock});
      if(pathname.endsWith('/cart-review')) {
        assert.match(request.headers()['content-type'],/application\/json/,'Actual helper must send JSON, not text/plain');
        return failReview?send({message:'Fixture review unavailable'},503):send(reviewed(request.postDataJSON(),viewer));
      }
      if(pathname.endsWith('/account'))return send({policy:{enabled:true,requiredIdentity:'business',profileSlug:'jw-stone',profileName:'JW Stone',includesBidRock:false},viewerBusiness:null,requiresBusinessSetup:true,account:null});
      if(pathname.endsWith('/holds/active'))return send({viewerId:viewer,hold:null});
      return send({message:'Unconfigured fixture'},404);
    });
    page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
    const click=async locator=>{await locator.scrollIntoViewIfNeeded();return device==='touch'?locator.tap():locator.click();};
    await page.goto(origin+'/'+name+'.html');
    await expect(page.getByTestId('jw-stone-member-cart-button')).toBeVisible();
    const entryButton=page.getByTestId('jw-marketplace-header').getByRole('button',{name:'Build a Bundle',exact:true});
    await expect(entryButton).toBeVisible();await expect(page.getByTestId('jw-stone-member-cart')).toHaveCount(0);
    await click(entryButton);const builder=page.getByTestId('jw-standalone-bundle-builder');await expect(builder).toBeVisible();
    await expect(page.getByTestId('jw-stone-member-cart')).toHaveCount(0);await expect(builder.getByRole('heading',{name:'Build a Bundle',exact:true})).toBeVisible();
    const picker=builder.getByTestId('jw-bundle-stock-picker');await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(7);
    await click(picker.getByRole('button',{name:'Show more slab lots',exact:true}));await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(9);
    const search=picker.getByRole('searchbox',{name:'Find stone for your bundle'});await search.fill('Test Stone 09');await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(1);await search.fill('');
    for(let index=1;index<=7;index++) {
      const option=picker.locator(`[data-stock-id="${id(index)}"]`);await click(option.getByRole('button',{name:'Add to bundle',exact:true}));
      await expect(builder.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(index));
      await expect(option.getByRole('button',{name:'Add to bundle',exact:true})).toBeDisabled();
      await expect(page.getByTestId('jw-stone-member-cart')).toHaveCount(0);
    }
    await expect(builder.getByTestId('jw-standalone-bundle-subtotal')).toHaveText('$1,225.00');await expect(builder.getByTestId('jw-standalone-bundle-savings')).toHaveText('$612.50');
    assert.equal(await builder.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    failInventory=true;await click(picker.getByRole('button',{name:'Refresh slab list',exact:true}));await expect(picker.getByRole('alert')).toBeVisible();
    await expect(builder.getByTestId('jw-standalone-bundle-line')).toHaveCount(7);
    failInventory=false;await click(picker.getByRole('button',{name:'Retry slab list',exact:true}));await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(7);
    await page.screenshot({path:path.join(output,device+'-standalone-builder.png')});
    await page.reload();await click(page.getByTestId('jw-storefront-build-bundle'));await expect(builder.getByTestId('jw-standalone-bundle-line')).toHaveCount(7);
    await expect(builder.getByTestId('jw-standalone-bundle-subtotal')).toHaveText('$1,225.00');
    failReview=true;await click(builder.getByRole('button',{name:'Remove Test Stone 07 from bundle',exact:true}));
    await expect(builder.getByTestId('jw-standalone-bundle-progress')).toContainText('Bundle total unavailable');await expect(builder.getByTestId('jw-standalone-bundle-subtotal')).toHaveCount(0);
    failReview=false;await click(builder.getByRole('button',{name:'Retry bundle total',exact:true}));await expect(builder.getByTestId('jw-standalone-bundle-progress')).toContainText('Add 1 more');
    await expect(builder.getByTestId('jw-standalone-bundle-savings')).toHaveCount(0);
    await click(builder.getByTestId('jw-standalone-bundle-review-cart'));await expect(builder).toHaveCount(0);await expect(page.getByTestId('jw-stone-member-cart')).toBeVisible();await expect(page.getByTestId('jw-cart-line')).toHaveCount(6);
    await click(page.getByRole('button',{name:'Close cart',exact:true}));
    // These are the existing primary locations, not extra buttons below pricing.
    const card=page.locator('[data-stone-card]').first();await expect(card.getByRole('button',{name:'Make an Offer',exact:true})).toHaveCount(1);await expect(card.getByRole('button',{name:/^Ask\b/})).toHaveCount(0);
    await click(card.getByRole('button',{name:'Make an Offer',exact:true}));await expect(page.getByLabel('Your total offer (USD)',{exact:true})).toBeVisible();await click(page.getByRole('button',{name:'Close Direct Connect',exact:true}));
    await click(card.getByRole('button',{name:'View stone',exact:true}));const actions=page.getByTestId('jw-stone-detail-actions');await expect(actions.getByRole('button',{name:'Make an Offer',exact:true})).toHaveCount(1);await expect(actions.getByRole('button',{name:/^Ask\b/})).toHaveCount(0);
    await click(actions.getByRole('button',{name:'Make an Offer',exact:true}));await expect(page.getByLabel('Your total offer (USD)',{exact:true})).toBeVisible();await expect(actions).toHaveCount(0);await click(page.getByRole('button',{name:'Close Direct Connect',exact:true}));
    const arrival=page.getByTestId('jw-new-arrivals');await expect(arrival.getByRole('button',{name:'Make an Offer',exact:true})).toHaveCount(1);await expect(arrival.getByRole('button',{name:/^Ask\b/})).toHaveCount(0);
    await click(arrival.getByRole('button',{name:'Make an Offer',exact:true}));await expect(page.getByLabel('Offer stock selection',{exact:true})).toHaveValue(id(1));await click(page.getByRole('button',{name:'Close Direct Connect',exact:true}));
    assert.equal(await page.evaluate(()=>window.askCount),0);
    // No previous member's selection or offer crosses a fixture identity switch.
    viewer='member-b';await page.evaluate(v=>window.setFixtureViewer(v),viewer);await click(page.getByTestId('jw-storefront-build-bundle'));await expect(builder).toBeVisible();await expect(builder.getByTestId('jw-standalone-bundle-line')).toHaveCount(0);await click(builder.getByRole('button',{name:'Continue browsing',exact:true}));
    viewer=null;await page.evaluate(()=>window.setFixtureViewer(null));await click(card.getByRole('button',{name:'Make an Offer',exact:true}));await expect(page.getByTestId('profile-account-business-name')).toBeVisible();await expect(page.getByLabel('Your total offer (USD)',{exact:true})).toHaveCount(0);assert.equal(await page.evaluate(()=>window.askCount),0);
    assert(!posts.some(p=>/checkout|payment|stripe|express-request|\/holds(?:\/|$)/.test(p)));assert.deepEqual(errors,[]);
    report.devices.push({device,headerEntryFromEmptyCart:true,standaloneNotCart:true,sevenDifferentMaterials:true,exactRatesAndSavings:true,inventoryAndReviewRecovery:true,reloadPreservesSelections:true,repricesBelowSeven:true,explicitCartHandoff:true,primaryCardDetailArrivalOffers:true,arrivalStockPreserved:true,noAskCallback:true,guestMembershipGate:true,identityIsolation:true,noPaymentOrOfferSubmission:true});
    console.log('JW_STOREFRONT_DEVICE '+JSON.stringify(report.devices.at(-1)));await context.close();page=null;
  }
  report.passed=true;
} catch(error) {
  report.error=String(error.stack||error);process.exitCode=1;
  if(page) { report.failureText=(await page.locator('body').innerText().catch(()=>'' )).slice(0,8000);await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{}); }
} finally {
  await browser?.close();await vite?.close();await fs.rm(entry,{force:true});await fs.rm(html,{force:true});await fs.rm(temp,{recursive:true,force:true});
  report.finalSourceStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();if(report.finalSourceStatus){report.passed=false;process.exitCode=1;}
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(report,null,2)+'\n');console.log('JW_STOREFRONT_RESULT '+JSON.stringify(report));
}
