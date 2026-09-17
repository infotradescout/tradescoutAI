import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";
import express from "express";
import request from "supertest";
import { JwStoneCartHolds } from "../server/services/jwStoneCartHolds";
import { registerJwStoneCartHoldRoutes } from "../server/routes/jw-stone-cart-holds";
import { JW_STONE_CART_HOLD_PATH } from "../shared/jwStoneCartHolds";
import type { JwStonePricingSnapshot } from "../server/services/jwStoneDrivePricing";

assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.JW_HOLD_NATIVE_FIXTURE, "true");
const target = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.pathname, "/ts_jw_hold_test");
const pool = new pg.Pool({ connectionString: target.href, max: 12, application_name: "jw_hold_native" });
assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "ts_jw_hold_test");
const holds = new JwStoneCartHolds(pool);
const seller = "synthetic-jw-seller", sellerOther = "synthetic-other-seller";
const snapshot = { sourceUpdatedAt: new Date().toISOString(), prices: [{
  stoneName: "Test Stone", stoneKey: "test stone", slabPriceCents: 300, bundlePriceCents: 200, bundleMinSlabs: 2, landedCostCents: 100,
}] } as JwStonePricingSnapshot;
const checks: string[] = [];
async function test(name: string, action: () => Promise<void>) {
  await action(); checks.push(name); console.log("JW_HOLD_NATIVE_CHECK " + JSON.stringify({ name, passed: true }));
}
const rejectCode = async (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error.code === code);
async function buyer(entitled = true) {
  const id = "fixture-buyer-" + randomUUID(), business = "fixture-business-" + randomUUID(), account = randomUUID();
  await pool.query("INSERT INTO users(id) VALUES($1)", [id]);
  await pool.query("INSERT INTO user_profiles VALUES($1,$2,'business','pending')", [business, id]);
  await pool.query("INSERT INTO profile_accounts VALUES($1,$2,'jw-profile',$3,$4,'business','active','pending')", [account, id, seller, business]);
  if (entitled) await pool.query("INSERT INTO profile_account_entitlements VALUES($1,'jw_stone_member_pricing','pending_verification')", [account]);
  return { id, account, business };
}
async function lot(quantity = 3, held = 0) {
  const material = randomUUID(), passport = randomUUID(), position = randomUUID(), id = "stone_" + randomUUID().replaceAll("-", "");
  await pool.query("INSERT INTO stone_materials VALUES($1,'Test Stone')", [material]);
  await pool.query("INSERT INTO stone_asset_passports VALUES($1,$2,$3,'slab','verified',$4::jsonb,$5::jsonb)", [passport, material, id,
    JSON.stringify({ length: 120, height: 60, unit: "in" }),
    JSON.stringify({ lastConfirmedAt: new Date(Date.now()-60000).toISOString(), confirmationExpiresAt: new Date(Date.now()+86400000).toISOString() })]);
  await pool.query(`INSERT INTO stone_inventory_positions(id,asset_passport_id,holder_business_id,quantity,held_quantity,unit,lifecycle_status,public_availability_status,published_at,publication_evidence)
    VALUES($1,$2,$3,$4,$5,'slabs','available','published_current',NOW(),'{"fixture":true}')`, [position, passport, seller, quantity, held]);
  return { id, position, passport };
}
const command = (stock: { id: string }, quantity = 1) => ({ idempotencyKey: randomUUID(),
  lines: [{ inventoryPublicId: stock.id, quantity }], expectedSubtotalCents: (quantity >= 2 ? 10000 : 15000) * quantity,
  fulfillment: { method: "pickup" as const } });
const reserve = (owner: { id: string }, input: unknown) => holds.reserve({ buyerUserId: owner.id, sellerBusinessId: seller, snapshot, request: input });
const actor = (owner: { id: string }, id: string) => ({ buyerUserId: owner.id, sellerBusinessId: seller, reservationId: id });
const heldCount = async (stock: { position: string }) => Number((await pool.query("SELECT held_quantity FROM stone_inventory_positions WHERE id=$1", [stock.position])).rows[0].held_quantity);
const ledgerCount = async (owner: { id: string }) => Number((await pool.query("SELECT count(*) AS n FROM jw_stone_cart_holds WHERE buyer_user_id=$1", [owner.id])).rows[0].n);

try {
  // Narrow native fixture: real PostgreSQL transactions and proposed ledger DDL,
  // not a claim of full migration-chain or real-session/browser integration.
  await pool.query(`CREATE TABLE users(id text PRIMARY KEY);
    CREATE TABLE businesses(id text PRIMARY KEY);
    CREATE TABLE user_profiles(id text PRIMARY KEY,user_id text REFERENCES users(id),user_intent text,verification_status text);
    CREATE TABLE profiles(id text PRIMARY KEY,slug text,business_id text REFERENCES businesses(id));
    CREATE TABLE profile_accounts(id uuid PRIMARY KEY,owner_user_id text REFERENCES users(id),target_profile_id text REFERENCES profiles(id),target_business_id text,business_profile_id text REFERENCES user_profiles(id),identity_kind text,status text,verification_status text);
    CREATE TABLE profile_account_entitlements(profile_account_id uuid REFERENCES profile_accounts(id),product_key text,status text,PRIMARY KEY(profile_account_id,product_key));
    CREATE TABLE stone_materials(id uuid PRIMARY KEY,canonical_name text);
    CREATE TABLE stone_asset_passports(id uuid PRIMARY KEY,material_id uuid REFERENCES stone_materials(id),public_id text UNIQUE NOT NULL,asset_kind text,passport_status text,dimensions_json jsonb,condition_json jsonb);
    CREATE TABLE stone_inventory_positions(id uuid PRIMARY KEY,asset_passport_id uuid REFERENCES stone_asset_passports(id),holder_business_id text REFERENCES businesses(id),quantity numeric NOT NULL,held_quantity numeric NOT NULL DEFAULT 0,unit text,lifecycle_status text,public_availability_status text,published_at timestamptz,publication_evidence jsonb,version bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT NOW(),CHECK(held_quantity>=0 AND held_quantity<=quantity));
    CREATE TABLE bidrock_listings(id uuid PRIMARY KEY,inventory_position_id uuid REFERENCES stone_inventory_positions(id));
    CREATE TABLE bidrock_auctions(id uuid PRIMARY KEY,listing_id uuid REFERENCES bidrock_listings(id),status text);`);
  await pool.query("INSERT INTO businesses VALUES($1),($2)", [seller,sellerOther]);
  await pool.query("INSERT INTO profiles VALUES('jw-profile','jw-stone',$1)", [seller]);
  await pool.query(await fs.readFile("migrations/0139_jw_stone_cart_holds.sql", "utf8"));

  await test("create a real cart hold with server prices, 30-minute database deadline and no payment", async () => {
    const owner = await buyer(), stock = await lot(), result = await reserve(owner, command(stock));
    assert.match(result.reservationId,/^jwh_[a-f0-9]{32}$/); assert.equal(result.status,"active");
    assert.equal(result.materialSubtotalCents,15000); assert.equal(result.paymentStatus,"not_started"); assert.equal(result.readyForCheckout,false);
    assert.equal(result.deliveryFeeCents,null); assert.equal(result.estimatedDeliveryDate,null); assert.equal(await heldCount(stock),1);
    const ttl = Date.parse(result.expiresAt)-Date.parse(result.serverTime); assert(ttl>1700000 && ttl<=1800000);
    assert(!/landed|position|buyer_user|membership|fingerprint|fileId/.test(JSON.stringify(result)));
  });
  await test("same-key retries keep one reservation, one stock hold and the original deadline", async () => {
    const owner=await buyer(), stock=await lot(), input=command(stock);
    const results=await Promise.all(Array.from({length:6},()=>reserve(owner,input)));
    assert.equal(new Set(results.map(item=>item.reservationId)).size,1); assert.equal(new Set(results.map(item=>item.expiresAt)).size,1);
    assert.equal(await heldCount(stock),1); assert.equal(await ledgerCount(owner),1);
  });
  await test("a reused request key cannot change quantities or fulfillment", async () => {
    const owner=await buyer(), stock=await lot(), input=command(stock); await reserve(owner,input);
    await rejectCode(reserve(owner,{...input,lines:[{inventoryPublicId:stock.id,quantity:2}],expectedSubtotalCents:20000}),"idempotency_conflict");
    await rejectCode(reserve(owner,{...input,fulfillment:{method:"delivery",postalCode:"70401"}}),"idempotency_conflict");
    assert.equal(await heldCount(stock),1);
  });
  await test("duplicate stock lines combine before quantity-tier pricing and replay comparison", async () => {
    const owner=await buyer(), stock=await lot(), input=command(stock,2);
    const first=await reserve(owner,{...input,lines:[{inventoryPublicId:stock.id,quantity:1},{inventoryPublicId:stock.id,quantity:1}]});
    const replay=await reserve(owner,input); assert.equal(replay.reservationId,first.reservationId);
    assert.equal(first.lines.length,1); assert.equal(first.lines[0].pricingTier,"bundle"); assert.equal(await heldCount(stock),2);
  });
  await test("two independent business members cannot reserve the last slab twice (12 races)", async () => {
    for(let iteration=0;iteration<12;iteration++) {
      const a=await buyer(),b=await buyer(),stock=await lot(1);
      const results=await Promise.allSettled([reserve(a,command(stock)),reserve(b,command(stock))]);
      assert.equal(results.filter(item=>item.status==="fulfilled").length,1);
      const failed=results.find(item=>item.status==="rejected") as PromiseRejectedResult;
      assert.equal(failed.reason.code,"stock_unavailable"); assert.equal(await heldCount(stock),1);
    }
  });
  await test("an independent canonical-counter allocator and a cart hold share the same final slab (12 races)", async () => {
    for(let iteration=0;iteration<12;iteration++) {
      const owner=await buyer(),stock=await lot(1);
      const [cart,other]=await Promise.allSettled([reserve(owner,command(stock)),pool.query("UPDATE stone_inventory_positions SET held_quantity=held_quantity+1,version=version+1 WHERE id=$1 AND quantity-held_quantity>=1 RETURNING id",[stock.position])]);
      assert.equal(other.status,"fulfilled");
      const otherWon=(other as PromiseFulfilledResult<pg.QueryResult>).value.rowCount===1;
      assert.equal(Number(cart.status==="fulfilled")+Number(otherWon),1); assert.equal(await heldCount(stock),1);
    }
  });
  await test("release removes only this cart's allocation and is idempotent under simultaneous retries", async () => {
    const owner=await buyer(),stock=await lot(3,1),result=await reserve(owner,command(stock)); assert.equal(await heldCount(stock),2);
    const released=await Promise.all(Array.from({length:4},()=>holds.release(actor(owner,result.reservationId))));
    assert(released.every(item=>item.status==="released")); assert.equal(await heldCount(stock),1);
    assert.equal((await reserve(owner,command(stock))).status,"active");
  });
  await test("replaying a released reservation does not silently reserve it again", async () => {
    const owner=await buyer(),stock=await lot(),input=command(stock),result=await reserve(owner,input);
    await holds.release(actor(owner,result.reservationId)); const replay=await reserve(owner,input);
    assert.equal(replay.status,"released"); assert.equal(await heldCount(stock),0); assert.equal(await ledgerCount(owner),1);
  });
  await test("one buyer cannot accumulate multiple active carts by rotating request keys", async () => {
    const owner=await buyer(),a=await lot(),b=await lot(); await reserve(owner,command(a));
    await rejectCode(reserve(owner,command(b)),"active_hold_exists"); assert.equal(await heldCount(b),0);
  });
  await test("multi-lot reservation is all-or-nothing when any selected stock is unavailable", async () => {
    const owner=await buyer(),a=await lot(1),b=await lot(1,1),input={...command(a),lines:[{inventoryPublicId:a.id,quantity:1},{inventoryPublicId:b.id,quantity:1}],expectedSubtotalCents:30000};
    await rejectCode(reserve(owner,input),"stock_unavailable"); assert.equal(await heldCount(a),0); assert.equal(await heldCount(b),1); assert.equal(await ledgerCount(owner),0);
  });
  await test("an actual database error after stock mutation rolls back the complete cart", async () => {
    const owner=await buyer(),a=await lot(),b=await lot();
    await pool.query(`CREATE FUNCTION fixture_reject_hold_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.inventory_public_id='${b.id}' THEN RAISE EXCEPTION 'Synthetic write failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_fail BEFORE INSERT ON jw_stone_cart_hold_items FOR EACH ROW EXECUTE FUNCTION fixture_reject_hold_item()`);
    try {
      await assert.rejects(reserve(owner,{...command(a),lines:[{inventoryPublicId:a.id,quantity:1},{inventoryPublicId:b.id,quantity:1}],expectedSubtotalCents:30000}),/Synthetic write failure/);
      assert.equal(await heldCount(a),0); assert.equal(await heldCount(b),0); assert.equal(await ledgerCount(owner),0);
    } finally { await pool.query("DROP TRIGGER fixture_fail ON jw_stone_cart_hold_items; DROP FUNCTION fixture_reject_hold_item()"); }
  });
  await test("changed or forged material totals create neither holds nor allocations", async () => {
    const owner=await buyer(),stock=await lot(); await rejectCode(reserve(owner,{...command(stock),expectedSubtotalCents:1}),"price_changed");
    await rejectCode(reserve(owner,{...command(stock),heldQuantity:0}),"invalid_hold"); assert.equal(await heldCount(stock),0); assert.equal(await ledgerCount(owner),0);
  });
  await test("missing price or dimensions cannot become a reserved priced cart", async () => {
    const owner=await buyer(),stock=await lot();
    await rejectCode(holds.reserve({buyerUserId:owner.id,sellerBusinessId:seller,request:command(stock),snapshot:{...snapshot,prices:[]}}),"price_unavailable");
    await pool.query("UPDATE stone_asset_passports SET dimensions_json='{}' WHERE id=$1",[stock.passport]);
    await rejectCode(reserve(owner,command(stock)),"dimensions_required"); assert.equal(await heldCount(stock),0);
  });
  for(const sql of ["UPDATE stone_inventory_positions SET public_availability_status='not_published' WHERE id=$1",
    "UPDATE stone_inventory_positions SET lifecycle_status='sold' WHERE id=$1",
    "UPDATE stone_inventory_positions SET publication_evidence='[]' WHERE id=$1",
    "UPDATE stone_inventory_positions SET unit='bundles' WHERE id=$1",
    "UPDATE stone_inventory_positions SET held_quantity=0.5 WHERE id=$1"]) {
    await test("reject incompatible stock: "+sql.split(" SET ")[1].split(" WHERE ")[0],async()=>{
      const owner=await buyer(),stock=await lot(); await pool.query(sql,[stock.position]);
      await rejectCode(reserve(owner,command(stock)),"stock_unavailable"); assert.equal(await ledgerCount(owner),0);
    });
  }
  await test("stock committed to an active auction is not available for a cart hold",async()=>{
    const owner=await buyer(),stock=await lot(),listing=randomUUID();
    await pool.query("INSERT INTO bidrock_listings VALUES($1,$2)",[listing,stock.position]);
    await pool.query("INSERT INTO bidrock_auctions VALUES($1,$2,'scheduled')",[randomUUID(),listing]);
    await rejectCode(reserve(owner,command(stock)),"stock_in_auction"); assert.equal(await heldCount(stock),0);
  });
  await test("ordinary business accounts without a JW entitlement are denied",async()=>{
    const owner=await buyer(false),stock=await lot(); await rejectCode(reserve(owner,command(stock)),"jw_membership_required"); assert.equal(await heldCount(stock),0);
  });
  for(const status of ["revoked","suspended"]) await test("deny "+status+" membership authority",async()=>{
    const owner=await buyer(),stock=await lot();
    if(status==="revoked") await pool.query("UPDATE profile_account_entitlements SET status='revoked' WHERE profile_account_id=$1",[owner.account]);
    else await pool.query("UPDATE profile_accounts SET status='suspended' WHERE id=$1",[owner.account]);
    await rejectCode(reserve(owner,command(stock)),"jw_membership_required"); assert.equal(await heldCount(stock),0);
  });
  await test("another buyer or seller cannot read or release an owned hold",async()=>{
    const a=await buyer(),b=await buyer(),stock=await lot(),result=await reserve(a,command(stock));
    await rejectCode(holds.get(actor(b,result.reservationId)),"hold_not_found");
    await rejectCode(holds.release(actor(b,result.reservationId)),"hold_not_found");
    await rejectCode(holds.release({...actor(a,result.reservationId),sellerBusinessId:sellerOther}),"hold_not_found"); assert.equal(await heldCount(stock),1);
  });
  await test("revoked owners can give stock back but cannot read private prices or make a new hold",async()=>{
    const owner=await buyer(),stock=await lot(),result=await reserve(owner,command(stock));
    await pool.query("UPDATE profile_account_entitlements SET status='revoked' WHERE profile_account_id=$1",[owner.account]);
    await rejectCode(holds.get(actor(owner,result.reservationId)),"jw_membership_required");
    await rejectCode(reserve(owner,command(stock)),"jw_membership_required");
    assert.deepEqual(await holds.release(actor(owner,result.reservationId)),{reservationId:result.reservationId,status:"released"}); assert.equal(await heldCount(stock),0);
  });
  await test("database receipt guards prevent changing the deadline, quantities or terminal status",async()=>{
    const owner=await buyer(),stock=await lot(),result=await reserve(owner,command(stock));
    await assert.rejects(pool.query("UPDATE jw_stone_cart_holds SET expires_at=expires_at+INTERVAL '1 minute' WHERE public_id=$1",[result.reservationId]),/immutable/);
    await assert.rejects(pool.query("UPDATE jw_stone_cart_hold_items SET quantity=2 WHERE inventory_public_id=$1",[stock.id]),/immutable/);
    await holds.release(actor(owner,result.reservationId));
    await assert.rejects(pool.query("UPDATE jw_stone_cart_holds SET status='active',released_at=NULL WHERE public_id=$1",[result.reservationId]),/reactivated/);
  });
  await test("inconsistent counters fail release without clamping or decrementing someone else's stock",async()=>{
    const owner=await buyer(),stock=await lot(),result=await reserve(owner,command(stock));
    await pool.query("UPDATE stone_inventory_positions SET held_quantity=0 WHERE id=$1",[stock.position]);
    await rejectCode(holds.release(actor(owner,result.reservationId)),"hold_reconciliation_required");
    assert.equal(await heldCount(stock),0); assert.equal((await holds.get(actor(owner,result.reservationId))).status,"active");
    await pool.query("UPDATE stone_inventory_positions SET held_quantity=1 WHERE id=$1",[stock.position]); await holds.release(actor(owner,result.reservationId));
  });
  await test("expired fixture holds release once and same-key replay cannot revive them",async()=>{
    const owner=await buyer(),stock=await lot(3,1),input=command(stock),digest=createHash("sha256").update(JSON.stringify({lines:input.lines,expectedSubtotalCents:input.expectedSubtotalCents,fulfillment:input.fulfillment})).digest("hex");
    const fixture=await pool.query(`INSERT INTO jw_stone_cart_holds(buyer_user_id,buyer_business_profile_id,seller_business_id,membership_id,idempotency_key,request_fingerprint,subtotal_cents,fulfillment,created_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,15000,'{"method":"pickup"}',clock_timestamp()-INTERVAL '31 minutes',clock_timestamp()-INTERVAL '2 minutes') RETURNING id,public_id`,[owner.id,owner.business,seller,owner.account,input.idempotencyKey,digest]);
    await pool.query("INSERT INTO jw_stone_cart_hold_items VALUES($1,$2,$3,'Test Stone',1,300,15000,15000,'slab')",[fixture.rows[0].id,stock.position,stock.id]);
    assert.equal(await holds.expireSeller(seller),1); assert.equal(await heldCount(stock),0);
    assert.equal(await holds.expireSeller(seller),0);
    const replay=await reserve(owner,input); assert.equal(replay.reservationId,fixture.rows[0].public_id); assert.equal(replay.status,"expired"); assert.equal(await heldCount(stock),0);
  });

  const app=express(); app.use(express.json());
  const internalIds=new Set<string>();
  registerJwStoneCartHoldRoutes(app,{
    holds, authenticate:(req,res,next)=>{const id=req.get("x-fixture-buyer");if(!id){res.status(401).json({message:"Authentication required"});return;}req.user={id} as any;next();},
    requireSchema:(_req,_res,next)=>next(),
    requireWriteIntent:(req,res,next)=>{if(req.get("x-fixture-intent")!=="hold"){res.status(403).json({message:"Explicit write intent required"});return;}next();},
    mutationLimiter:(_req,_res,next)=>next(),target:async()=>({businessId:seller}),
    access:async req=>internalIds.has((req.user as any).id)?"internal":"member",pricing:async()=>snapshot,
  });
  await test("HTTP commands require authentication and the injected explicit write guard",async()=>{
    const owner=await buyer(),stock=await lot();
    assert.equal((await request(app).post(JW_STONE_CART_HOLD_PATH).send(command(stock))).status,401);
    assert.equal((await request(app).post(JW_STONE_CART_HOLD_PATH).set("x-fixture-buyer",owner.id).send(command(stock))).status,403);
    internalIds.add(owner.id);
    assert.equal((await request(app).post(JW_STONE_CART_HOLD_PATH).set("x-fixture-buyer",owner.id).set("x-fixture-intent","hold").send(command(stock))).status,403);
    assert.equal(await heldCount(stock),0);
  });
  await test("HTTP reserve/read/release return private receipts and reject replacement release quantities",async()=>{
    const owner=await buyer(),stock=await lot(),input=command(stock);
    const created=await request(app).post(JW_STONE_CART_HOLD_PATH).set("x-fixture-buyer",owner.id).set("x-fixture-intent","hold").send(input);
    assert.equal(created.status,200); assert.equal(created.headers["cache-control"],"private, no-store");
    const url=JW_STONE_CART_HOLD_PATH+"/"+created.body.reservationId;
    assert.equal((await request(app).get(url).set("x-fixture-buyer",owner.id)).body.status,"active");
    assert.equal((await request(app).post(url+"/release").set("x-fixture-buyer",owner.id).set("x-fixture-intent","hold").send({quantity:999})).status,400);
    assert.equal((await request(app).post(url+"/release").set("x-fixture-buyer",owner.id).set("x-fixture-intent","hold").send({})).body.status,"released");
    assert.equal(await heldCount(stock),0);
  });
  console.log("JW_HOLD_NATIVE_SUMMARY "+JSON.stringify({passed:true,checks:checks.length,names:checks,nativePostgres:true,concurrentRaces:24,productionDataUsed:false,
    proofScope:"New service and HTTP registrar; narrow native schema fixture with actual proposed ledger DDL. Auth/schema/write/rate middleware are fixture dependencies. Not full-app/browser or release approval."}));
} finally { await pool.end(); }
