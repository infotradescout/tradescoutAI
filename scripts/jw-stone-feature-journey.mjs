import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { expect } from '@playwright/test';
const base='http://127.0.0.1:5228', endpoint='/api/admin/jw-stone/features';
export async function proveJwStoneFeatureJourney({page,context,database,fixture,device,output,browser,run,env,userId,offerRequestId}) {
  assert.equal(fixture.base,base);
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name,'ts_jw_workflow_test');
  assert(fixture.featureAccounts?.admin && fixture.ownerPassword);
  const controls=[];
  async function signIn(identity) {
    const ctx=await browser.newContext({serviceWorkers:'block',viewport:device==='touch'?{width:390,height:844}:{width:1440,height:1000}});
    controls.push(ctx);
    await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
    const response=await ctx.request.post(base+'/api/auth/login',{data:{email:identity.email,password:identity.password}});
    assert.equal(response.status(),200,'Controller/owner native login');
    return ctx;
  }
  const admin=await signIn(fixture.featureAccounts.admin);
  const owner=await signIn({email:fixture.ownerId+'@example.test',password:fixture.ownerPassword});
  const beforeStock=(await database.query('SELECT * FROM stone_inventory_positions WHERE holder_business_id=$1 ORDER BY id',[fixture.businessId])).rows;
  const beforeOffer=(await database.query("SELECT metadata->'stoneOffer' offer FROM work_request_events WHERE work_request_id=$1 AND type='created'",[offerRequestId])).rows;
  const beforeCart=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.includes('member-cart:v2:')));
  const beforeTransactions=Number((await database.query('SELECT count(*) n FROM marketplace_transactions')).rows[0].n);
  let disabled=false, originalCommand, controller;
  try {
    const guest=await browser.newContext(); controls.push(guest);
    assert.equal((await guest.request.get(base+endpoint)).status(),401,'Guest cannot control access');
    assert.equal((await context.request.get(base+endpoint)).status(),403,'Member cannot control access');
    assert.equal((await owner.request.get(base+endpoint)).status(),403,'JW owner cannot control TradeScout entitlement');
    const initial=await admin.request.get(base+endpoint); assert.equal(initial.status(),200);
    const state=await initial.json(); assert.equal(state.enabled,true,'Start ON as instructed');
    originalCommand={enabled:false,expectedRevision:state.revision,operationId:randomUUID(),preserveBaseServices:true,note:'Isolated acceptance only; production remains ON'};
    assert.equal((await owner.request.put(base+endpoint,{headers:{Origin:base},data:originalCommand})).status(),403);
    assert.equal((await context.request.put(base+endpoint,{headers:{Origin:base},data:originalCommand})).status(),403);
    assert.equal((await admin.request.put(base+endpoint,{headers:{Origin:'https://unrelated.invalid'},data:originalCommand})).status(),403);
    controller=await admin.newPage();
    const document=await controller.goto(base+'/admin/jw-stone-features'); assert.equal(document.status(),200);
    await controller.getByLabel('Base site only',{exact:false}).check();
    await controller.getByLabel('Private reason for this change').fill(originalCommand.note);
    await controller.locator('input[name="preserveBaseServices"]').check();
    originalCommand.operationId=await controller.locator('input[name="operationId"]').inputValue();
    const saved=controller.waitForResponse(r=>new URL(r.url()).pathname===endpoint+'/form' && r.request().method()==='POST');
    await controller.getByRole('button',{name:'Save JW Stone access'}).click();
    assert.equal((await saved).status(),303,'Actual administrator form persisted the setting'); disabled=true;
    const manifestResponse=await context.request.get(base+'/api/u/jw-stone/features');
    assert.equal(manifestResponse.status(),200); const manifest=await manifestResponse.json();
    assert.equal(manifest.enabled,false); assert(Object.values(manifest.base).every(v=>v===true));
    assert(!JSON.stringify(manifest).includes(originalCommand.note));
    assert(!JSON.stringify(manifest).includes(fixture.featureAccounts.admin.id));
    const stored=(await database.query("SELECT enabled,config FROM feature_flags WHERE key='jw_stone_sales_enhancements'")).rows;
    assert.equal(stored.length,1); assert.equal(stored[0].enabled,false);
    assert.equal(stored[0].config.revision,state.revision+1);
    const audit=stored[0].config.audit.at(-1); assert.equal(audit.operationId,originalCommand.operationId);
    assert.equal(audit.actorUserId,fixture.featureAccounts.admin.id);
    // The still-open buyer tab receives the new state without being signed out or losing its cart.
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(page.getByTestId('jw-stone-member-cart-button')).toHaveCount(0,{timeout:20000});
    await expect(page.getByTestId('jw-stone-make-offer-detail')).toHaveCount(0);
    const blocked=[
      ['GET','/api/u/jw-stone/member-pricing'],
      ['POST','/api/u/jw-stone/member-pricing/cart-review',{lines:[{inventoryPublicId:fixture.cartStockId,quantity:1}]}],
      ['POST','/api/tradepartner-profiles/jw-stone/express-request',{requestType:'make_offer'}],
      ['POST','/api/jw-stone/saved-stones/email',{email:'unused@example.invalid',stones:[{name:'Honey Onyx',shareSlug:'honey-onyx'}]}],
      ['PATCH','/api/u/jw-stone/stone-inventory/current/'+fixture.cartStockId+'/publication',{saleReady:true}],
    ];
    for(const [method,url,data] of blocked) {
      const response=await context.request.fetch(base+url,{method,...(data?{data}:{})});
      assert.equal(response.status(),403,'Paused action '+url); assert.equal((await response.json()).code,'JW_STONE_FEATURE_UNAVAILABLE');
    }
    const jwListing=(await database.query('SELECT public_id FROM bidrock_listings WHERE seller_business_id=$1 LIMIT 1',[fixture.businessId])).rows[0];
    assert(jwListing);
    const bidOffer=await context.request.post(base+'/api/bidrock/listings/'+jwListing.public_id+'/offers',{data:{quantity:1,totalAmount:'1.00',message:'Isolated check',idempotencyKey:randomUUID()}});
    assert.equal(bidOffer.status(),403); assert.equal((await bidOffer.json()).code,'JW_STONE_FEATURE_UNAVAILABLE');
    const catalog=await context.request.get(base+'/api/bidrock/catalog'); assert.equal(catalog.status(),200);
    const listings=(await catalog.json()).listings;
    assert(!listings.some(item=>item.sourceProfileSlug==='jw-stone'));
    assert(listings.some(item=>item.sourceProfileSlug==='jw-feature-other'),'Unrelated supplier stays available');
    const supplierInventory=await owner.request.get(base+'/api/bidrock/seller/inventory');
    assert.equal(supplierInventory.status(),200); const rows=await supplierInventory.json();
    const inventoryRows=Array.isArray(rows)?rows:rows.items??rows.listings;
    assert(inventoryRows?.length>0); assert(inventoryRows.every(row=>!row.sellerCapabilities.write&&!row.sellerCapabilities.publish));
    for(const url of ['/api/auth/user','/api/direct-connect/requests?scope=all','/api/direct-connect/inbox','/api/u/jw-stone/stone-inventory/current']) {
      assert.equal((await context.request.get(base+url)).status(),200,'Preserved base route '+url);
    }
    const reservedId=(await database.query("SELECT id FROM feature_flags WHERE key='jw_stone_sales_enhancements'")).rows[0].id;
    assert.equal((await admin.request.patch(base+'/api/admin/feature-flags/'+reservedId,{data:{enabled:true}})).status(),409,'Generic editor cannot override dedicated state');
    const ordinary=await signIn(fixture.featureAccounts.otherOwner);
    if(device==='desktop') {
      const visitor=await ordinary.newPage(); await visitor.goto(base+'/u/jw-stone?request=collection');
      const dialog=visitor.getByRole('dialog',{name:'JW Stone Logistics',exact:true});
      await dialog.getByLabel('Name',{exact:true}).fill('Synthetic base customer');
      await dialog.getByLabel('Email',{exact:true}).fill(fixture.featureAccounts.otherOwner.email);
      await dialog.locator('input[name="phone"]').fill('2025550147');
      await dialog.getByRole('combobox',{name:/^I am a/}).selectOption('fabricator');
      await dialog.getByRole('combobox',{name:/^What do you need/}).selectOption('request_material');
      await dialog.getByLabel('Details',{exact:true}).fill('Ordinary stone inquiry while additional sales tools are paused. Please confirm supply.');
      const pending=visitor.waitForResponse(r=>new URL(r.url()).pathname==='/api/tradepartner-profiles/jw-stone/express-request'&&r.request().method()==='POST');
      await dialog.getByRole('button',{name:'Make A Request',exact:true}).click();
      const sent=await pending; assert.equal(sent.status(),201,'Paid base contact form must still submit');
      const receipt=await sent.json();
      const record=(await database.query('SELECT source_ref_id,created_by_user_id FROM work_requests WHERE id=$1',[receipt.requestId])).rows[0];
      assert.equal(record.source_ref_id,fixture.profileId); assert.equal(record.created_by_user_id,fixture.featureAccounts.otherOwner.id);
      await expect(dialog.getByRole('heading',{name:'Request sent',exact:true})).toBeVisible();
      await visitor.screenshot({path:path.join(output,'base-request-while-paused.png')});
    }
    run('Native service-level bypass and other-business checks',[process.execPath,'--import','tsx','scripts/jw-stone-feature-services.native.ts'],{...env,JW_FEATURE_OTHER_BUSINESS_ID:fixture.featureAccounts.otherBusinessId});
    await controller.reload();
    await controller.getByLabel('Sales enhancements on',{exact:false}).check();
    await controller.getByLabel('Private reason for this change').fill('Restore isolated test to ON; owner default preserved');
    await controller.locator('input[name="preserveBaseServices"]').check();
    const restored=controller.waitForResponse(r=>new URL(r.url()).pathname===endpoint+'/form'&&r.request().method()==='POST');
    await controller.getByRole('button',{name:'Save JW Stone access'}).click();
    assert.equal((await restored).status(),303); disabled=false;
    const replay=await admin.request.put(base+endpoint,{headers:{Origin:base},data:originalCommand});
    assert.equal(replay.status(),200); const replayed=await replay.json();
    assert.equal(replayed.replayed,true); assert.equal(replayed.state.enabled,true,'Old OFF replay cannot undo later ON');
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(page.getByTestId('jw-stone-member-cart-button')).toBeVisible({timeout:20000});
    assert.deepEqual(await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.includes('member-cart:v2:'))),beforeCart);
    assert.deepEqual((await database.query('SELECT * FROM stone_inventory_positions WHERE holder_business_id=$1 ORDER BY id',[fixture.businessId])).rows,beforeStock);
    assert.deepEqual((await database.query("SELECT metadata->'stoneOffer' offer FROM work_request_events WHERE work_request_id=$1 AND type='created'",[offerRequestId])).rows,beforeOffer);
    assert.equal(Number((await database.query('SELECT count(*) n FROM marketplace_transactions')).rows[0].n),beforeTransactions);
    assert.equal((await (await context.request.get(base+'/api/u/jw-stone/features')).json()).enabled,true);
    assert.equal(await controller.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await controller.screenshot({path:path.join(output,device+'-control-restored-on.png')});
    return {actualAdministratorForm:true,realPostgresSetting:true,guestAndMemberCannotControl:true,jwOwnerCannotControl:true,
      sameOriginRequired:true,baseServicesIndependent:true,actualBaseRequestSubmitted:device==='desktop',
      directConnectReadable:true,serverNewPremiumActionsBlocked:true,otherSupplierCatalogPreserved:true,
      canonicalServiceGuards:true,oldTabUpdates:true,storedCartAndOfferPreserved:true,stockUnchanged:true,
      noNewTransactions:true,replayedOldOffCannotUndoOn:true,finalEnabled:true,productionChanged:false};
  } catch(error) {
    if(controller) {
      console.error('JW_FEATURE_CONTROL_PAGE '+(await controller.locator('body').innerText().catch(()=>'' )).slice(0,2000));
      await controller.screenshot({path:path.join(output,device+'-control-failure.png')}).catch(()=>{});
    }
    throw error;
  } finally {
    if(disabled) {
      const current=await (await admin.request.get(base+endpoint)).json();
      await admin.request.put(base+endpoint,{headers:{Origin:base},data:{enabled:true,expectedRevision:current.revision,
        operationId:randomUUID(),preserveBaseServices:true,note:'Isolated failed-test cleanup; preserve ON'}}).catch(()=>{});
    }
    for(const ctx of controls) await ctx.close();
  }
}
