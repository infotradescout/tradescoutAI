import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Server } from "node:http";
import type { JwStoneCheckoutProvider, JwStonePaymentBinding, JwStoneProviderSession } from "../server/services/jwStoneCheckoutProvider";
import type { JwStonePaymentOutcome } from "../shared/jwStoneCheckout";

assert.equal(process.env.NODE_ENV,"test");assert.equal(process.env.JW_SALES_FIXTURE,"true");
const url=new URL(process.env.TEST_DATABASE_URL||"");assert.equal(url.hostname,"127.0.0.1");assert.equal(url.pathname,"/ts_jw_sales_test");
const out=path.resolve(process.env.JW_SALES_OUTPUT||"test-results/jw-sales");
const keep=new Set(["PATH","HOME","TMPDIR","NODE_ENV","TEST_DATABASE_URL","JW_SALES_FIXTURE","PLAYWRIGHT_BROWSERS_PATH","LD_LIBRARY_PATH"]);
for(const key of Object.keys(process.env))if(!keep.has(key))delete process.env[key];
const {default:dotenv}=await import("dotenv");dotenv.config=dotenv.configDotenv=()=>({parsed:{}});
process.env.DATABASE_URL=url.href;process.env.ALLOW_INSECURE_TEST_DATABASE="true";
const {db,pool}=await import("../server/db");
const schema=await import("../shared/schema");
const {Pool}=await import("pg");const independent=new Pool({connectionString:url.href});
const {JwStoneSales}=await import("../server/services/jwStoneSales");
const {JwStoneCartHolds}=await import("../server/services/jwStoneCartHolds");
const {registerJwStoneSalesRoutes}=await import("../server/routes/jw-stone-sales");
const {getStoneInventoryProfileTarget,upsertCurrentStoneInventory,setStoneInventorySaleReady}=await import("../server/services/stoneInventoryService");
const {getJwStonePricingSnapshot}=await import("../server/services/jwStoneDrivePricing");
const {createJwStoneFeatureStore}=await import("../server/services/jwStoneFeatureStore");
const {JW_STONE_PRICING_DRIVE_FILE_ID,JW_STONE_PRICING_DRIVE_FOLDER_ID}=await import("../shared/jwStoneMemberPricing");
const {default:express}=await import("express");const {chromium,expect}=await import("@playwright/test");
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const report:{head:string;passed:boolean;checks:string[];devices:any[];[key:string]:any}={head,passed:false,checks:[],devices:[],startedAt:new Date().toISOString(),productionWrites:false,providerNetworkUsed:false,scope:"Third process on canonical disposable PostgreSQL. Actual purchase/hold/order code and order-page JavaScript; isolated authentication and simulated payment provider. No real bank debit or card charge."};
const note=(text:string)=>{report.checks.push(text);console.log("JW_PURCHASE_NATIVE_CHECK "+text);};
const reject=(work:()=>Promise<unknown>,code:string)=>assert.rejects(work,(error:any)=>error.code===code,code);
let server:Server|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,faultInstalled=false;
try{
  assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name,"ts_jw_sales_test");
  const sellers=(await pool.query("SELECT p.id AS profile_id,p.business_id,b.owner_user_id FROM profiles p JOIN businesses b ON b.id=p.business_id WHERE p.slug='jw-stone'")).rows;
  assert.equal(sellers.length,1);const {profile_id:profileId,business_id:seller,owner_user_id:owner}=sellers[0];
  const originalOffers=JSON.stringify((await pool.query("SELECT id,metadata FROM work_request_events WHERE type='created' AND metadata->>'requestType'='make_offer' ORDER BY id")).rows);
  const contactCount=Number((await pool.query("SELECT count(*) AS n FROM contact_permissions")).rows[0].n);
  const buyer="jw-purchase-buyer-"+randomUUID(),other="jw-purchase-other-"+randomUUID(),outsider="jw-purchase-outsider-"+randomUUID();
  for(const id of [buyer,other,outsider])await db.insert(schema.users).values({id,email:id+"@example.test",firstName:"Synthetic",lastName:"Purchase",role:"contractor",roles:["contractor"],activeRole:"contractor",profileVisibility:"private",emailVerified:false,onboardingCompleted:false});
  for(const id of [buyer,other]){
    const businessProfile=randomUUID();await pool.query("INSERT INTO user_profiles(id,user_id,user_intent,verification_status,display_name) VALUES($1,$2,'business','pending','Synthetic purchase member')",[businessProfile,id]);
    const account=await pool.query("INSERT INTO profile_accounts(owner_user_id,business_profile_id,target_profile_id,target_business_id,identity_kind,status,verification_status) VALUES($1,$2,$3,$4,'business','active','pending') RETURNING id",[id,businessProfile,profileId,seller]);
    await pool.query("INSERT INTO profile_account_entitlements(profile_account_id,product_key,status) VALUES($1,'jw_stone_member_pricing','pending_verification')",[account.rows[0].id]);
  }
  const target=await getStoneInventoryProfileTarget("jw-stone");assert(target);
  const now=new Date().toISOString(),stock:any[]=[],prices:any[]=[];
  for(let index=0;index<8;index++){
    const materialName="Purchase Fixture Stone "+(index+1);
    const item=await upsertCurrentStoneInventory(target,{materialSlug:"purchase-fixture-stone-"+(index+1),materialName,materialClass:"natural_stone",materialFamily:"Granite",assetKind:"slab",quantity:1,unit:"slabs",dimensions:{length:120,height:60,unit:"in"},finishQuantities:[],imageUrls:[],lastConfirmedAt:now,confirmationExpiresAt:new Date(Date.now()+86400000).toISOString()});
    await setStoneInventorySaleReady({target,publicId:item.id,saleReady:true,actorUserId:owner});stock.push(item);
    prices.push({stoneName:materialName,stoneKey:materialName.toLowerCase(),slabPriceCents:300+75*index,bundlePriceCents:200+50*index,bundleMinSlabs:7,landedCostCents:100});
  }
  process.env.JW_STONE_PRICING_SOURCE="approved_import";
  process.env.JW_STONE_PRICING_APPROVED_IMPORT=JSON.stringify({schemaVersion:1,fileId:JW_STONE_PRICING_DRIVE_FILE_ID,folderId:JW_STONE_PRICING_DRIVE_FOLDER_ID,sourceUpdatedAt:now,sourceRetrievedAt:now,prices});
  const snapshot=await getJwStonePricingSnapshot({forceRefresh:true});
  class Provider implements JwStoneCheckoutProvider {
    sessions=new Map<string,JwStoneProviderSession>();created=0;loseNext=false;enabled=true;
    merchant(){return this.enabled?{accountId:"acct_jwfixture",businessId:seller,live:false,returnOrigin:"https://jwstonelogistics.com"}:null;}
    async methods(){return this.enabled?["ach","card"] as ("ach"|"card")[]:[];}
    async create(binding:JwStonePaymentBinding){let saved=this.sessions.get(binding.attempt.id);if(!saved){saved={id:"cs_test_"+binding.attempt.id.replaceAll("-",""),url:"https://checkout.stripe.com/c/pay/cs_test_"+binding.attempt.id.replaceAll("-",""),outcome:"open"};this.sessions.set(binding.attempt.id,saved);this.created++;}if(this.loseNext){this.loseNext=false;throw new Error("Synthetic response lost after checkout session creation");}return {...saved};}
    async retrieve(binding:JwStonePaymentBinding){const saved=this.sessions.get(binding.attempt.id);assert(saved);assert.equal(saved.id,binding.attempt.sessionId);return {...saved};}
    async webhookRequest(_raw:Buffer,_signature:string):Promise<string|null>{throw new Error("No provider callback is used in this phase");}
    outcome(attempt:string,value:JwStonePaymentOutcome){const saved=this.sessions.get(attempt);assert(saved);saved.outcome=value;if(value!=="open")saved.url=null;}
  }
  const provider=new Provider(),sales=new JwStoneSales(pool,provider),secondSales=new JwStoneSales(independent,provider),holds=new JwStoneCartHolds(pool),secondHolds=new JwStoneCartHolds(independent);
  const selection={lines:stock.slice(0,7).map(item=>({inventoryPublicId:item.id,quantity:1})),fulfillment:{method:"pickup" as const}};
  const input={operationId:randomUUID(),selection,expectedSubtotalCents:122500,termsAcknowledged:true};
  const positions=async()=> (await pool.query("SELECT position.id,position.quantity,position.held_quantity,position.version FROM stone_inventory_positions position JOIN stone_asset_passports passport ON passport.id=position.asset_passport_id WHERE position.holder_business_id=$1 AND passport.public_id=ANY($2::text[]) ORDER BY position.id",[seller,selection.lines.map(line=>line.inventoryPublicId)])).rows;
  const held=async()=> (await positions()).reduce((sum,row)=>sum+Number(row.held_quantity),0);
  const getState=async(request:string,user=buyer)=>(await sales.read(request,user)).state;
  const pay=(state:any,method="ach")=>({action:"checkout",operationId:randomUUID(),expectedRevision:state.revision,quoteId:state.quote.id,totalCents:state.quote.totalCents,method,acceptFinalQuote:true});
  const quote=(intake:any,revision=0)=>({action:"quote",operationId:randomUUID(),expectedRevision:revision,decision:"confirm_purchase",materialCents:intake.listedSubtotalCents,taxCents:500,deliveryCents:0,expiresAt:new Date(Date.now()+86400000).toISOString(),notes:"Explicit synthetic tax; pickup has zero freight"});
  await reject(()=>sales.purchase(outsider,input),"jw_membership_required");
  await reject(()=>sales.purchase(buyer,{...input,expectedSubtotalCents:122499}),"jw_purchase_price_changed");
  const [first,replayed]=await Promise.all([sales.purchase(buyer,input),secondSales.purchase(buyer,input)]);
  assert.equal(first.requestId,replayed.requestId);assert("intent" in first.intake);assert.equal(first.intake.intent,"purchase");assert(!("offeredTotalCents" in first.intake));assert.equal(first.intake.lines.length,7);assert(first.intake.lines.every(line=>line.pricingTier==="bundle"));
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM jw_stone_purchase_requests WHERE buyer_user_id=$1",[buyer])).rows[0].n),1);assert.equal(await held(),0);assert.equal(provider.created,0);
  await reject(()=>sales.purchase(buyer,{...input,expectedSubtotalCents:122501}),"jw_purchase_conflict");
  await reject(()=>sales.read(first.requestId,outsider),"jw_order_not_found");
  await reject(()=>sales.command(first.requestId,buyer,quote(first.intake)),"jw_seller_required");
  await reject(()=>sales.command(first.requestId,owner,{...quote(first.intake),decision:"accept_offer"}),"jw_purchase_amount");
  await reject(()=>sales.command(first.requestId,owner,{...quote(first.intake),materialCents:122501}),"jw_purchase_amount");
  note("one slab each of seven materials creates one retry-safe purchase request at source bundle rates, without an offer, payment or contact grant");
  const competitor=await sales.purchase(other,{...input,operationId:randomUUID()});await sales.command(competitor.requestId,owner,quote(competitor.intake));
  const app=express();app.use(express.json());
  const authenticated=(req:any,res:any,next:any)=>{const user=req.get("x-jw-purchase-fixture");if(![buyer,other,owner,outsider].includes(user)){res.status(401).json({message:"Synthetic sign-in required"});return;}req.user={id:user};next();};
  registerJwStoneSalesRoutes(app,sales,authenticated);
  server=await new Promise<Server>(resolve=>{const listening=app.listen(0,"127.0.0.1",()=>resolve(listening));});
  const address=server.address();assert(address&&typeof address!=="string");const base="http://127.0.0.1:"+address.port;
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const context=async(user:string,touch=false)=>{const value=await browser!.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:1000},isMobile:touch,hasTouch:touch,timezoneId:"UTC",extraHTTPHeaders:{"x-jw-purchase-fixture":user}});await value.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());return value;};
  const sellerContext=await context(owner),sellerPage=await sellerContext.newPage();
  await sellerPage.goto(base+"/jw-stone/orders?request="+first.requestId);await expect(sellerPage.getByRole("heading",{name:"Review purchase request",exact:true})).toBeVisible();
  await expect(sellerPage.getByLabel("Decision",{exact:true})).toHaveValue("confirm_purchase");
  await expect(sellerPage.getByLabel("Material amount ($)",{exact:true})).toHaveValue("1225.00");
  await sellerPage.getByLabel("Confirmed tax ($) — enter 0 if applicable",{exact:true}).fill("5.00");
  await sellerPage.getByLabel("Quote expires",{exact:true}).fill(new Date(Date.now()+86400000).toISOString().slice(0,16));
  await sellerPage.getByRole("button",{name:"Send final quote",exact:true}).click();
  await expect(sellerPage.getByRole("heading",{name:"Final quote · revision 1",exact:true})).toBeVisible();
  await expect(sellerPage.locator("#detail")).not.toContainText("Customer offered:");await sellerContext.close();
  const quoted=await getState(first.requestId);assert.equal(quoted.quote?.totalCents,123000);
  const six={...selection,lines:selection.lines.slice(0,6)};
  const mismatch=await holds.reserve({buyerUserId:buyer,sellerBusinessId:seller,snapshot,request:{idempotencyKey:randomUUID(),lines:six.lines,fulfillment:six.fulfillment,expectedSubtotalCents:146250}});
  await reject(()=>sales.command(first.requestId,buyer,pay(quoted)),"jw_cart_hold_mismatch");assert.equal(await held(),6);assert.equal(provider.created,0);
  await holds.release({buyerUserId:buyer,sellerBusinessId:seller,reservationId:mismatch.reservationId});
  const reserve=()=>holds.reserve({buyerUserId:buyer,sellerBusinessId:seller,snapshot,request:{idempotencyKey:randomUUID(),...selection,expectedSubtotalCents:122500}});
  const reservation=await reserve(),protectedPositions=await positions();assert.equal(await held(),7);
  const fromReserved=await sales.purchase(buyer,{...input,operationId:randomUUID()});assert("intent" in fromReserved.intake);assert.equal(fromReserved.intake.pricingSource,"owned_reservation");assert.equal(fromReserved.intake.reservationId,reservation.reservationId);assert.equal(await held(),7);
  provider.enabled=false;await reject(()=>sales.command(first.requestId,buyer,pay(quoted)),"jw_payment_unavailable");provider.enabled=true;
  await pool.query(`CREATE FUNCTION jw_purchase_fixture_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='${first.requestId}' AND NEW.state->>'status'='checkout' THEN RAISE EXCEPTION 'Synthetic purchase handoff failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER jw_purchase_fixture_fault BEFORE INSERT ON jw_stone_sale_events FOR EACH ROW EXECUTE FUNCTION jw_purchase_fixture_fault();`);faultInstalled=true;
  await assert.rejects(()=>sales.command(first.requestId,buyer,pay(quoted)),/Synthetic purchase handoff failure/);
  assert.equal((await holds.get({buyerUserId:buyer,sellerBusinessId:seller,reservationId:reservation.reservationId})).status,"active");assert.deepEqual(await positions(),protectedPositions);assert.equal(provider.created,0);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM jw_stone_sale_hold_transfers WHERE request_id=$1",[first.requestId])).rows[0].n),0);
  await pool.query("DROP TRIGGER jw_purchase_fixture_fault ON jw_stone_sale_events; DROP FUNCTION jw_purchase_fixture_fault()");faultInstalled=false;
  note("mismatched reservations, unavailable payment setup and an injected post-transfer database fault leave the original hold and every stock counter intact");
  provider.loseNext=true;const payment=pay(quoted);
  const attempts=await Promise.allSettled([sales.command(first.requestId,buyer,payment),secondSales.command(competitor.requestId,other,pay(await getState(competitor.requestId,other)))]);
  assert.equal(attempts[0].status,"rejected");assert.equal(attempts[1].status,"rejected");assert.equal(provider.created,1);assert.deepEqual(await positions(),protectedPositions);
  const checkout=await getState(first.requestId);assert(checkout.attempt);assert.equal(checkout.reservationTransfer?.reservationId,reservation.reservationId);
  assert.equal(checkout.reservationTransfer?.originalExpiresAt,reservation.expiresAt);
  const transferred=(await pool.query("SELECT h.status,h.expires_at,t.transferred_at=h.released_at AS precise FROM jw_stone_sale_hold_transfers t JOIN jw_stone_cart_holds h ON h.id=t.hold_id WHERE t.request_id=$1",[first.requestId])).rows;
  assert.equal(transferred.length,1);assert.equal(transferred[0].status,"released");assert.equal(transferred[0].precise,true);assert.equal(new Date(transferred[0].expires_at).toISOString(),reservation.expiresAt);
  await Promise.all([holds.release({buyerUserId:buyer,sellerBusinessId:seller,reservationId:reservation.reservationId}),secondHolds.expireSeller(seller)]);
  assert.deepEqual(await positions(),protectedPositions);
  await reject(()=>secondHolds.reserve({buyerUserId:other,sellerBusinessId:seller,snapshot,request:{idempotencyKey:randomUUID(),...selection,expectedSubtotalCents:122500}}),"stock_unavailable");
  note("seven held slabs transfer without decrementing or incrementing inventory; a competing checkout, old release and expiry worker cannot acquire or free them");
  const desktop=await context(buyer),page=await desktop.newPage();await page.goto(base+"/jw-stone/orders?request="+first.requestId);
  await page.getByRole("button",{name:"Refresh order/payment status",exact:true}).click();await expect(page.getByRole("link",{name:"Continue secure checkout",exact:true})).toBeVisible();assert.equal(provider.created,1);
  await expect(page.locator("#detail")).toContainText("reserved slabs moved directly into this order");
  provider.outcome(checkout.attempt.id,"processing");await page.getByRole("button",{name:"Refresh order/payment status",exact:true}).click();await expect(page.getByRole("heading",{name:"processing",exact:true})).toBeVisible();assert.equal(await held(),7);
  await page.reload();await expect(page.getByRole("heading",{name:"processing",exact:true})).toBeVisible();
  assert.equal(await page.locator("#detail").evaluate(element=>element.scrollWidth>element.clientWidth+1),false);
  report.devices.push({device:"desktop",purchaseNotOffer:true,sellerQuoteUi:true,existingReservationTransferred:true,lostResponseRecovered:true,processingNotPaid:true,authentication:"fixture",provider:"simulated"});await desktop.close();
  provider.outcome(checkout.attempt.id,"failed");await sales.reconcile(first.requestId,buyer);await sales.reconcile(first.requestId,buyer);assert.equal(await held(),0);
  await holds.release({buyerUserId:buyer,sellerBusinessId:seller,reservationId:reservation.reservationId});assert.equal(await held(),0);
  const secondReservation=await reserve();const touch=await context(buyer,true),phone=await touch.newPage();await phone.goto(base+"/jw-stone/orders?request="+first.requestId);
  await phone.getByRole("button",{name:"Pay by card",exact:true}).tap();await expect(phone.getByRole("alert")).toContainText("accept the final quote");assert.equal(provider.created,1);
  await phone.getByRole("checkbox").check();await phone.getByRole("button",{name:"Pay by card",exact:true}).tap();await expect(phone.getByRole("link",{name:"Continue secure checkout",exact:true})).toBeVisible();
  const second=await getState(first.requestId);assert(second.attempt);assert.notEqual(second.attempt.id,checkout.attempt.id);assert.equal(second.reservationTransfer?.reservationId,secondReservation.reservationId);assert.equal(provider.created,2);assert.equal(await held(),7);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM jw_stone_sale_hold_transfers WHERE request_id=$1",[first.requestId])).rows[0].n),2);
  provider.outcome(second.attempt.id,"paid");await phone.getByRole("button",{name:"Refresh order/payment status",exact:true}).tap();await expect(phone.getByRole("heading",{name:"paid",exact:true})).toBeVisible();await phone.reload();await expect(phone.getByRole("heading",{name:"paid",exact:true})).toBeVisible();
  assert.equal(await phone.locator("#detail").evaluate(element=>element.scrollWidth>element.clientWidth+1),false);
  report.devices.push({device:"touch",purchaseNotOffer:true,explicitFinalTotalConsent:true,method:"card",secondReservationTransferred:true,paidStatusSurvivesReload:true,authentication:"fixture",provider:"simulated"});await touch.close();
  note("failed ACH releases only its transferred allocation once; a separately authorized card retry can transfer a new hold while retaining both immutable receipts");
  const singleInput={operationId:randomUUID(),selection:{lines:[{inventoryPublicId:stock[7].id,quantity:1}],fulfillment:{method:"pickup" as const}},expectedSubtotalCents:41250,termsAcknowledged:true};
  const single=await sales.purchase(other,singleInput);await sales.command(single.requestId,owner,quote(single.intake));await sales.command(single.requestId,other,pay(await getState(single.requestId,other),"card"));
  const singleState=await getState(single.requestId,other);assert(singleState.attempt);assert.equal(singleState.reservationTransfer,null);
  provider.outcome(singleState.attempt.id,"expired");await sales.reconcile(single.requestId,other);assert.equal(await held(),7);
  await assert.rejects(()=>pool.query("UPDATE jw_stone_purchase_requests SET intake=intake WHERE request_id=$1",[first.requestId]),/immutable/);
  await assert.rejects(()=>pool.query("DELETE FROM jw_stone_sale_hold_transfers WHERE request_id=$1",[first.requestId]),/immutable/);
  const flags=createJwStoneFeatureStore(pool);let flag=await flags.read();
  await flags.change(owner,{enabled:false,expectedRevision:flag.revision,operationId:randomUUID(),preserveBaseServices:true,note:"Synthetic purchase admission test"});
  await reject(()=>sales.purchase(other,{...singleInput,operationId:randomUUID()}),"JW_STONE_FEATURE_UNAVAILABLE");
  flag=await flags.read();await flags.change(owner,{enabled:true,expectedRevision:flag.revision,operationId:randomUUID(),preserveBaseServices:true,note:"Restore synthetic feature state"});
  const http=await context(buyer);
  const denied=await http.request.post(base+"/api/u/jw-stone/orders/purchases",{headers:{Origin:"https://attacker.invalid"},data:input});assert.equal(denied.status(),403);
  const recovered=await http.request.post(base+"/api/u/jw-stone/orders/purchases",{headers:{Origin:base},data:input});assert.equal(recovered.status(),201);assert.equal((await recovered.json()).requestId,first.requestId);await http.close();
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM contact_permissions")).rows[0].n),contactCount);
  assert.equal(JSON.stringify((await pool.query("SELECT id,metadata FROM work_request_events WHERE type='created' AND metadata->>'requestType'='make_offer' ORDER BY id")).rows),originalOffers);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM marketplace_transactions")).rows[0].n),0);
  assert.equal((await flags.read()).enabled,true);
  note("ordinary single-slab checkout also works without a hold; origin, membership, source prices, original offers, contact permissions and final ON state remain intact");
  report.passed=true;
}catch(error){report.error=String((error as Error).stack||error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,"[DISPOSABLE_DATABASE]");process.exitCode=1;}
finally{
  if(faultInstalled)await pool.query("DROP TRIGGER IF EXISTS jw_purchase_fixture_fault ON jw_stone_sale_events; DROP FUNCTION IF EXISTS jw_purchase_fixture_fault()").catch(()=>{});
  await browser?.close();await new Promise<void>(resolve=>server?server.close(()=>resolve()):resolve());await independent.end();await pool.end();
  report.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,"purchase-evidence.json"),JSON.stringify(report,null,2)+"\n");console.log("JW_PURCHASE_NATIVE_RESULT "+JSON.stringify(report));
}
