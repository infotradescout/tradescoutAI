import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { initialJwStoneSale, jwStoneSaleCommandSchema, type JwStoneSaleState } from "@shared/jwStoneCheckout";
import { buildJwStoneSaleNotices, queueJwStoneSaleNotifications } from "../services/jwStoneSaleNotifications";

const context = {requestId: randomUUID(), buyerId: "fixture-buyer", sellerUserId: "fixture-seller"};
const pending = initialJwStoneSale();
const quoted: JwStoneSaleState = {...pending, revision: 1, status: "quoted", quote: {
  id: randomUUID(), revision: 1, materialCents: 10000, taxCents: 500, deliveryCents: 2000,
  totalCents: 12500, expiresAt: "2026-10-01T18:00:00.000Z", issuedAt: "2026-09-22T18:00:00.000Z",
  issuedBy: context.sellerUserId, decision: "accept_offer", notes: "Fixture terms",
}};
const confirmed: JwStoneSaleState = {...quoted, revision: 2, quoteAcceptance: {
  quoteId: quoted.quote!.id, quoteRevision: 1, totalCents: 12500,
  acceptedBy: context.buyerId, acceptedAt: "2026-09-22T19:00:00.000Z",
}};
const command = {action: "accept_quote", operationId: randomUUID(), expectedRevision: 1,
  quoteId: quoted.quote!.id, totalCents: 12500, acceptFinalQuote: true};

describe("payment-independent JW quote confirmation", () => {
  it("accepts exact explicit consent without payment method or credentials", () => {
    expect(jwStoneSaleCommandSchema.parse(command)).toEqual(command);
  });
  it.each([
    {...command, acceptFinalQuote: false}, {...command, quoteId: "unbound"},
    {...command, totalCents: 0}, {...command, method: "ach"},
    {...command, paymentAllowed: true}, {...command, expectedRevision: -1},
  ])("rejects incomplete or payment-authorizing fields %j", input => {
    expect(jwStoneSaleCommandSchema.safeParse(input).success).toBe(false);
  });
  it("addresses the buyer with exact final amounts and a private quote link", () => {
    const [notice] = buildJwStoneSaleNotices(context, pending, quoted);
    expect(notice.userId).toBe(context.buyerId);
    expect(notice.message).toContain("Final total: $125.00");
    expect(notice.message).toContain("Materials: $100.00");
    expect(notice.message).toContain("Tax: $5.00");
    expect(notice.message).toContain("Delivery: $20.00");
    expect(notice.actionUrl).toBe("/jw-stone/orders?request=" + context.requestId);
    expect(notice.metadata).toMatchObject({kind: "quote_issued", quoteId: quoted.quote!.id});
    expect(buildJwStoneSaleNotices(context,pending,quoted)[0].id).toBe(notice.id);
  });
  it("notifies only the canonical seller when the buyer confirms", () => {
    const [notice] = buildJwStoneSaleNotices(context,quoted,confirmed);
    expect(notice.userId).toBe(context.sellerUserId);
    expect(notice.metadata.kind).toBe("quote_confirmed");
    expect(notice.message).toContain("not a paid receipt");
    expect(buildJwStoneSaleNotices(context,confirmed,{...confirmed,revision:3})).toEqual([]);
  });
  it("cannot label another user's or mismatched-total consent as confirmation", () => {
    expect(buildJwStoneSaleNotices(context,quoted,{...confirmed,quoteAcceptance:{...confirmed.quoteAcceptance!,acceptedBy:"outsider"}})).toEqual([]);
    expect(buildJwStoneSaleNotices(context,quoted,{...confirmed,quoteAcceptance:{...confirmed.quoteAcceptance!,totalCents:1}})).toEqual([]);
  });
  it("new terms alert the buyer instead of reusing a prior acceptance", () => {
    const revised = {...confirmed,revision:3,quoteAcceptance:null,quote:{...quoted.quote!,id:randomUUID(),revision:3,decision:"counter_offer" as const}};
    const [notice] = buildJwStoneSaleNotices(context,confirmed,revised);
    expect(notice.title).toContain("counteroffer");
    expect(notice.userId).toBe(context.buyerId);
    expect(notice.id).not.toBe(buildJwStoneSaleNotices(context,pending,quoted)[0].id);
  });
  it("requires an exact successor revision before generating any notice", () => {
    expect(() => buildJwStoneSaleNotices(context,pending,{...quoted,revision:2})).toThrow();
  });
  it("uses one supplied transaction connection and parameterized text", async () => {
    const query=vi.fn().mockResolvedValue({rows:[{notifications:1,email_jobs:1,in_app_receipts:1}]});
    await queueJwStoneSaleNotifications({query} as any,context,pending,quoted);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql,args]=query.mock.calls[0];
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(sql).not.toMatch(/DO UPDATE|sendEmail/);
    expect(args[1]).toBe(context.buyerId);
    expect(JSON.parse(args[5]).quoteId).toBe(quoted.quote!.id);
  });
  it("propagates incomplete channel intents so the order transaction can roll back", async () => {
    const query=vi.fn().mockResolvedValue({rows:[{notifications:1,email_jobs:0,in_app_receipts:1}]});
    await expect(queueJwStoneSaleNotifications({query} as any,context,pending,quoted)).rejects.toThrow("incomplete");
  });
  it("accepts a fully deduplicated transition without resetting email jobs", async () => {
    const query=vi.fn().mockResolvedValue({rows:[{notifications:0,email_jobs:0,in_app_receipts:0}]});
    await expect(queueJwStoneSaleNotifications({query} as any,context,pending,quoted)).resolves.toBeUndefined();
  });
});
