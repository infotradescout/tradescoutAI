import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
const state = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), notify: vi.fn(), push: vi.fn() }));
vi.mock("../db", () => ({ pool: { connect: state.connect, query: state.query } }));
vi.mock("../auth", () => ({ isAuthenticated: (req: any, res: any, next: any) => req.isAuthenticated() ? next() : res.status(401).json({ message: "Sign in" }) }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({ insert: () => ({ values: state.notify }) }) }));
vi.mock("../notification-service", () => ({ notificationService: { sendNotification: state.push } }));
vi.mock("../services/emailService", () => ({ emailService: { isConfigured: () => false } }));
vi.mock("../utils/publicOrigin", () => ({ CANONICAL_WEB_HOST: "www.thetradescout.com", resolveMappedProfileShareSlug: () => null }));
import { registerExchangeStoneInquiryRoutes } from "../routes/exchange-stone-inquiries";
import { sendStoneInquiryRequest } from "../../client/src/lib/exchangeStoneInquiryRequest";

const listingId = "tradescout-stone-honey-onyx";
describe("Synthetic local client transport through actual protected stone handler and transaction", () => {
 beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto); vi.stubEnv("STONE_METRICS_SECRET", "synthetic-only-metrics-secret-123456"); });
 afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
 function harness(city = "Dallas", stateCode = "TX") {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  let card: any = null;
  const tx = { release: vi.fn(), query: async (text: string, values: unknown[] = []) => {
   statements.push({ text, values });
   if (text.includes("FROM site_settings")) return { rows: [{ value: "synthetic-retail-seller" }] };
   if (text.includes("SELECT l.* FROM marketplace_listings")) {
    expect(values).toContain(listingId); expect(values).toContain("synthetic-retail-seller");
    expect(text).toContain("exposure_user.email_verified = true");
    return { rows: [{ id: listingId, seller_id: "synthetic-retail-seller", title: "Synthetic Honey Onyx", price: "47.25", specifications: { commerceChannel: "tradescout_stone_retail", sellerBrand: "TradeScout", priceUnit: "sqft" } }] };
   }
   if (text.includes("to_jsonb(u)")) return { rows: [{ account: { city, state_code: stateCode, country_code: "US" } }] };
   if (text.includes("FROM decision_cards")) return { rows: card ? [card] : [] };
   if (text.includes("UPDATE decision_cards")) return { rows: [{ id: card.id }] };
   if (text.includes("INSERT INTO marketplace_inquiries")) return { rows: [{ created_at: "2026-09-30T12:00:00Z" }] };
   if (text.includes("INSERT INTO exchange_stone_funnel_events")) return { rows: [{ event_key: values[0] }] };
   return { rows: [] };
  } };
  state.connect.mockResolvedValue(tx); state.notify.mockResolvedValue(undefined);
  let handlers: any[] = [];
  registerExchangeStoneInquiryRoutes({ use: () => {}, post: (_path: string, ...chain: any[]) => { handlers = chain; } } as any);
  let authenticated = false;
  const calls: Array<{ path: string; body: any }> = [];
  const api = async (_method: string, path: string, body: any) => {
   calls.push({ path, body });
   if (path === "/api/decision-cards") { card = { id: "synthetic-card", status: "active", intent: body.intent, decision_scope: body.decisionScope }; return { id: card.id }; }
   let status = 200, result: any;
   const req = { body, headers: { host: "localhost" }, user: { id: "synthetic-buyer" }, isAuthenticated: () => authenticated };
   const res = { setHeader: () => {}, status: (code: number) => { status = code; return res; }, json: (value: any) => { result = value; return res; } };
   let allowed = false; handlers[0](req, res, () => { allowed = true; });
   if (allowed) await handlers[1](req, res);
   if (status >= 400) throw Object.assign(new Error(result.message), { status, code: result.reasonCode });
   return result;
  };
  return { api, calls, statements, authenticate: () => { authenticated = true; } };
 }
 it("requires authentication then explicitly saves one scoped inquiry to the server-owned seller/item", async () => {
  const h = harness();
  const body = { listingId, message: "Synthetic inquiry only", authorityGate: "decision_card", decisionScope: `marketplace_listing:${listingId}` };
  await expect(h.api("POST", "/api/marketplace/inquiries", body)).rejects.toMatchObject({ status: 401 });
  expect(h.statements).toHaveLength(0);
  h.authenticate(); h.calls.length = 0;
  // Explicit invocation represents Confirm & Send; no component render triggers this transport.
  const receipt = await sendStoneInquiryRequest(h.api, null, { actorId: "synthetic-buyer", listingId, title: "Synthetic Honey", message: "Synthetic inquiry only", inquiryIntent: "availability" }, () => true);
  expect(receipt.listingId).toBe(listingId);
  expect(h.calls.map(call => call.path)).toEqual(["/api/decision-cards", "/api/marketplace/inquiries"]);
  const inquiry = h.statements.find(row => row.text.includes("INSERT INTO marketplace_inquiries"))!;
  expect(inquiry.values.slice(1, 5)).toEqual([listingId, "synthetic-buyer", "synthetic-retail-seller", "Synthetic inquiry only"]);
  expect(state.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "synthetic-retail-seller", metadata: expect.objectContaining({ listingId }) }));
  expect(h.statements.at(-1)?.text).toBe("COMMIT");
 });
 it("rejects the server-held Pensacola account even when client transport requests the same public item", async () => {
  const h = harness("Pensacola", "FL"); h.authenticate();
  await expect(sendStoneInquiryRequest(h.api, null, { actorId: "synthetic-buyer", listingId, title: "Synthetic Honey", message: "Synthetic excluded inquiry", inquiryIntent: "availability" }, () => true)).rejects.toMatchObject({ status: 404, code: "LISTING_UNAVAILABLE" });
  expect(h.statements.some(row => row.text.includes("INSERT INTO marketplace_inquiries"))).toBe(false);
  expect(state.notify).not.toHaveBeenCalled(); expect(h.statements.at(-1)?.text).toBe("ROLLBACK");
 });
 it("rejects a mismatched Decision Card scope before persistence", async () => {
  const h = harness(); h.authenticate();
  await expect(h.api("POST", "/api/marketplace/inquiries", { listingId, authorityGate: "decision_card", decisionScope: "marketplace_listing:other", message: "Synthetic" })).rejects.toMatchObject({ status: 400, code: "DECISION_CARD_REQUIRED" });
  expect(h.statements).toHaveLength(0);
 });
});
