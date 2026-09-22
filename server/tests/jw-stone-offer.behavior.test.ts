import { beforeEach, describe, expect, it, vi } from "vitest";
import { jwStoneOfferInputSchema, parseJwStoneOfferDollars, type JwStoneOfferInput } from "@shared/jwStoneOffer";
const mocks = vi.hoisted(() => ({ access: vi.fn(), review: vi.fn() }));
vi.mock("../services/jwStonePricingAccess", () => ({ resolveJwStonePricingAccess: mocks.access }));
vi.mock("../routes/jw-stone-member-pricing", () => ({ reviewJwStoneMemberCart: mocks.review }));
import { reviewJwStoneOffer, summarizeJwStoneOffer } from "../services/jwStoneOfferReview";
const stockId = "stone_" + "a".repeat(32);
const selection = { lines: [{ inventoryPublicId: stockId, quantity: 1 }], fulfillment: { method: "pickup" as const } };
const input: JwStoneOfferInput = { scope: "stone", selection, offeredTotalCents: 12000, expectedSubtotalCents: 15000, termsAcknowledged: true };
const snapshot = () => ({ profileSlug: "jw-stone", viewerId: "member", currency: "USD", sourceUpdatedAt: "2026-09-16T00:00:00.000Z", reviewedAt: "2026-09-16T00:00:00.000Z",
  materialReady: true, readyForCheckout: false, inventoryReserved: false, subtotalCents: 15000, fulfillment: selection.fulfillment, deliveryFeeCents: null, estimatedDeliveryDate: null,
  lines: [{ inventoryPublicId: stockId, requestedQuantity: 1, availableQuantity: 7, materialName: "Honey Onyx", materialSlug: "honey-onyx", assetKind: "slab", dimensions: { length: 120, height: 60, unit: "in" }, pricingTier: "slab", unitRateCents: 300, oneSlabTotalCents: 15000, lineTotalCents: 15000, status: "ready", landedCostCents: 1, privateSourceId: "test-private-field" }] });
const send = (overrides: Partial<Parameters<typeof reviewJwStoneOffer>[0]> = {}) => reviewJwStoneOffer({ profileSlug: "jw-stone", viewerId: "member", user: { id: "member" }, input, ...overrides });
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue("member"); mocks.review.mockResolvedValue(snapshot()); });
describe("JW Stone offer amount and strict input", () => {
  it.each([["0.01", 1], ["1.1", 110], ["1234.56", 123456], [" 005.00 ", 500], ["90071992547409.91", Number.MAX_SAFE_INTEGER]])("parses %s exactly", (value, cents) => expect(parseJwStoneOfferDollars(String(value))).toBe(cents));
  it.each(["", "0", "-1", "NaN", "Infinity", "1e3", "1.001", "1,000", "$10", "90071992547409.92", "999999999999999999", "1.2.3"])("rejects invalid amount %s", (value) => expect(parseJwStoneOfferDollars(value)).toBeNull());
  it.each([{ paymentAllowed: true }, { status: "confirmed" }, { confirmedAt: "2026-09-16" }, { finalPayableTotalCents: 1 }, { offeredTotalCents: 0 }, { offeredTotalCents: 1.5 }, { termsAcknowledged: false }])("rejects invalid client-supplied input %j", (override) => expect(jwStoneOfferInputSchema.safeParse({ ...input, ...override }).success).toBe(false));
  it("does not accept multiple selections as a single-stone offer", () => expect(jwStoneOfferInputSchema.safeParse({ ...input, selection: { lines: [...selection.lines, { inventoryPublicId: "stone_" + "b".repeat(32), quantity: 1 }] } }).success).toBe(false));
});
describe("JW Stone authoritative pending-offer intake", () => {
  it("records listed and proposed totals without enabling payment or reserving stock", async () => {
    const offer = await send();
    expect(offer).toMatchObject({ status: "pending_review", offeredTotalCents: 12000, listedSubtotalCents: 15000, paymentAllowed: false, inventoryReserved: false, confirmedAt: null, confirmedByUserId: null, finalPayableTotalCents: null });
    expect(mocks.review).toHaveBeenCalledWith("member", selection);
    expect(JSON.stringify(offer)).not.toMatch(/landedCost|privateSourceId|test-private-field/);
    expect(summarizeJwStoneOffer(offer)).toContain("$120.00");
    expect(summarizeJwStoneOffer(offer)).toContain("No payment is accepted until JW Stone confirms");
  });
  it.each(["none", "internal"])("rejects %s access before reading prices", async (access) => { mocks.access.mockResolvedValue(access); await expect(send()).rejects.toMatchObject({ status: 403 }); expect(mocks.review).not.toHaveBeenCalled(); });
  it("requires sign-in", async () => { await expect(send({ viewerId: "" })).rejects.toMatchObject({ status: 401 }); expect(mocks.access).not.toHaveBeenCalled(); });
  it("cannot submit an offer to another business", async () => { await expect(send({ profileSlug: "another-business" })).rejects.toMatchObject({ status: 400 }); expect(mocks.review).not.toHaveBeenCalled(); });
  it("rejects a changed displayed total", async () => { await expect(send({ input: { ...input, expectedSubtotalCents: 14999 } })).rejects.toMatchObject({ code: "OFFER_PRICE_CHANGED", status: 409 }); });
  it("rejects unavailable stock", async () => { mocks.review.mockResolvedValue({ ...snapshot(), materialReady: false, subtotalCents: null, lines: [{ inventoryPublicId: stockId, requestedQuantity: 1, status: "unavailable" }] }); await expect(send()).rejects.toMatchObject({ code: "OFFER_STOCK_CHANGED" }); });
  it("fails closed when pricing cannot respond", async () => { mocks.review.mockRejectedValue(new Error("Source unavailable")); await expect(send()).rejects.toThrow("Source unavailable"); });
  it("keeps a full-cart offer pending even when it equals the listed total", async () => { expect(await send({ input: { ...input, scope: "cart", offeredTotalCents: 15000 } })).toMatchObject({ scope: "cart", status: "pending_review", paymentAllowed: false }); });
});
