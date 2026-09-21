import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { JwStoneCheckoutProvider, JwStonePaymentBinding, JwStoneProviderSession } from "../server/services/jwStoneCheckoutProvider";
import type { JwStonePaymentOutcome } from "../shared/jwStoneCheckout";
assert.equal(process.env.NODE_ENV, "test");assert.equal(process.env.JW_SALES_FIXTURE, "true");
const target = new URL(process.env.TEST_DATABASE_URL || "");assert.equal(target.hostname, "127.0.0.1");assert.equal(target.pathname, "/ts_jw_sales_test");
const out = path.resolve(process.env.JW_SALES_OUTPUT || "test-results/jw-sales");
const keep = new Set(["PATH", "HOME", "TMPDIR", "NODE_ENV", "TEST_DATABASE_URL", "JW_SALES_FIXTURE"]);
for (const key of Object.keys(process.env)) if (!keep.has(key)) delete process.env[key];
const { default: dotenv } = await import("dotenv");dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
process.env.DATABASE_URL = target.href;process.env.ALLOW_INSECURE_TEST_DATABASE = "true";
const { pool } = await import("../server/db");
const { JwStoneSales } = await import("../server/services/jwStoneSales");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const report: { head: string; passed: boolean; checks: string[]; [key: string]: any } = { head, passed: false, checks: [], startedAt: new Date().toISOString(), providerNetworkUsed: false, productionWrites: false, scope: "Second process on the same disposable canonical database; original fixture offer metadata reused, provider responses simulated, actual order transactions and historical-attempt reconciliation." };
const note = (text: string) => { report.checks.push(text);console.log("JW_SALES_RECOVERY_CHECK " + text); };
let triggerInstalled = false;
try {
  const templates = (await pool.query(`SELECT wr.created_by_user_id AS buyer,p.id AS profile_id,p.business_id AS seller,b.owner_user_id AS owner,e.metadata
    FROM work_requests wr JOIN profiles p ON p.id=wr.source_ref_id JOIN businesses b ON b.id=p.business_id
    JOIN work_request_events e ON e.work_request_id=wr.id AND e.type='created'
    WHERE p.slug='jw-stone' AND e.metadata->>'requestType'='make_offer' ORDER BY wr.created_at,wr.id`)).rows;
  const template = templates.find(row => row.metadata.stoneOffer?.scope === "stone");assert(template);
  const { buyer, owner, seller, profile_id: profileId } = template;
  const held = async () => Number((await pool.query("SELECT COALESCE(sum(held_quantity),0) AS n FROM stone_inventory_positions WHERE holder_business_id=$1", [seller])).rows[0].n);
  const baseline = await held();assert(baseline > 0);
  note("a fresh process reads persisted orders and their already-held stock without resetting the first process's records");
  class Provider implements JwStoneCheckoutProvider {
    sessions = new Map<string, JwStoneProviderSession>();created = 0;
    merchant() { return { accountId: "acct_jwfixture", businessId: seller, live: false, returnOrigin: "https://jwstonelogistics.com" }; }
    async methods() { return ["ach", "card"] as ("ach" | "card")[]; }
    async create(binding: JwStonePaymentBinding) { let result = this.sessions.get(binding.attempt.id);if(!result){result={id:"cs_test_"+binding.attempt.id.replaceAll("-",""),url:"https://checkout.stripe.com/c/pay/cs_test_"+binding.attempt.id.replaceAll("-",""),outcome:"open"};this.sessions.set(binding.attempt.id,result);this.created++;}return {...result}; }
    async retrieve(binding: JwStonePaymentBinding) { const result=this.sessions.get(binding.attempt.id);assert(result);assert.equal(result.id,binding.attempt.sessionId);return {...result}; }
    async webhookRequest(_raw: Buffer, _signature: string) { throw new Error("This phase does not exercise webhooks; the first phase verifies signed callbacks."); }
    change(id: string, outcome: JwStonePaymentOutcome) { const result=this.sessions.get(id);assert(result);result.outcome=outcome;if(outcome!=="open")result.url=null; }
  }
  const provider = new Provider(), sales = new JwStoneSales(pool, provider);
  async function cloneOffer(scope: "stone" | "cart" = "stone") {
    const source = templates.find(row => row.buyer === buyer && row.metadata.stoneOffer?.scope === scope);assert(source);
    const id = randomUUID();
    await pool.query(`INSERT INTO work_requests(id,created_by_user_id,title,description,category,scope,source,source_ref_id,status,visibility,exposure_mode,competition_mode)
      VALUES($1,$2,'Synthetic recovery offer','Isolated second-process sale acceptance','business_request','personal','direct_connect',$3,'routed','private','guided','none')`, [id,buyer,profileId]);
    await pool.query("INSERT INTO work_request_events(id,work_request_id,type,actor_user_id,metadata) VALUES($1,$2,'created',$3,$4::jsonb)", [randomUUID(),id,buyer,JSON.stringify(source.metadata)]);
    return { id, intake: source.metadata.stoneOffer };
  }
  const state = async (id: string) => (await sales.read(id,buyer)).state;
  async function quote(offer: {id:string;intake:any}) { await sales.command(offer.id,owner,{action:"quote",operationId:randomUUID(),expectedRevision:0,decision:"accept_offer",materialCents:offer.intake.offeredTotalCents,taxCents:0,deliveryCents:0,expiresAt:new Date(Date.now()+86400000).toISOString(),notes:"Explicit synthetic zero tax and delivery"}); }
  async function pay(id: string) { const value=await state(id);assert(value.quote);return sales.command(id,buyer,{action:"checkout",operationId:randomUUID(),expectedRevision:value.revision,quoteId:value.quote.id,totalCents:value.quote.totalCents,method:"card",acceptFinalQuote:true}); }
  const replaced = await cloneOffer();await quote(replaced);await pay(replaced.id);
  const first = await state(replaced.id);assert(first.attempt);assert.equal(await held(),baseline+1);
  provider.change(first.attempt.id,"failed");await sales.reconcile(replaced.id,buyer);assert.equal(await held(),baseline);
  await pay(replaced.id);const second = await state(replaced.id);assert(second.attempt);assert.notEqual(first.attempt.id,second.attempt.id);assert.equal(provider.created,2);assert.equal(await held(),baseline+1);
  provider.change(first.attempt.id,"paid");await sales.reconcile(replaced.id,buyer);await sales.reconcile(replaced.id,buyer);
  assert.equal((await state(replaced.id)).status,"needs_review");assert.equal(provider.created,2);assert.equal(await held(),baseline+1);
  await assert.rejects(()=>pay(replaced.id),(error:any)=>error.code==="jw_payment_in_progress");
  note("a late success on an older failed attempt is detected after replacement; the new order stays in review with its allocation intact and no third checkout");
  const declined = await cloneOffer();await quote(declined);await pay(declined.id);const beforeDecline=await state(declined.id);assert(beforeDecline.attempt);
  provider.change(beforeDecline.attempt.id,"expired");await sales.reconcile(declined.id,buyer);
  await sales.command(declined.id,owner,{action:"decline",operationId:randomUUID(),expectedRevision:(await state(declined.id)).revision,notes:"Synthetic withdrawal after expired checkout"});
  provider.change(beforeDecline.attempt.id,"paid");await sales.reconcile(declined.id,buyer);
  assert.equal((await state(declined.id)).status,"needs_review");assert.equal(await held(),baseline+1);
  note("a cleared quote cannot hide late payment on its historical attempt; no released inventory is invented");
  const fault = await cloneOffer("cart");await quote(fault);const before=await state(fault.id);const allocationsBefore=await held(),providerBefore=provider.created;
  assert.match(fault.id,/^[a-f0-9-]{36}$/);
  await pool.query(`CREATE FUNCTION jw_sales_fixture_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='${fault.id}' AND NEW.state->>'status'='checkout' THEN RAISE EXCEPTION 'Synthetic event insert failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER jw_sales_fixture_fault BEFORE INSERT ON jw_stone_sale_events FOR EACH ROW EXECUTE FUNCTION jw_sales_fixture_fault();`);
  triggerInstalled=true;
  await assert.rejects(()=>pay(fault.id),/Synthetic event insert failure/);
  assert.equal(await held(),allocationsBefore);assert.equal(provider.created,providerBefore);assert.deepEqual(await state(fault.id),before);
  await pool.query("DROP TRIGGER jw_sales_fixture_fault ON jw_stone_sale_events; DROP FUNCTION jw_sales_fixture_fault()");triggerInstalled=false;
  note("a database fault after seven-slab stock mutation rolls back the complete order and allocation before any provider creation");
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM marketplace_transactions")).rows[0].n),0);
  report.passed=true;
} catch(error) { report.error=String((error as Error).stack||error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,"[DISPOSABLE_DATABASE]");process.exitCode=1; }
finally {
  if(triggerInstalled) await pool.query("DROP TRIGGER IF EXISTS jw_sales_fixture_fault ON jw_stone_sale_events; DROP FUNCTION IF EXISTS jw_sales_fixture_fault()").catch(()=>{});
  await pool.end();report.finishedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,"recovery-evidence.json"),JSON.stringify(report,null,2)+"\n");console.log("JW_SALES_RECOVERY_RESULT "+JSON.stringify(report));
}
