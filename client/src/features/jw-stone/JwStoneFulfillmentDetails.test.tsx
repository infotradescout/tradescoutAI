// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redactContactDetails } from "../../../../server/utils/workRequestShare";
import { JwStoneMemberCart } from "./JwStoneMemberCart";
import { JwStoneFulfillmentDetailsFields, useJwStoneFulfillmentDetails } from "./JwStoneFulfillmentDetails";
import {
  EMPTY_FULFILLMENT_DETAILS, fulfillmentDetailsError, fulfillmentDetailsKey,
  fulfillmentDetailsSummary, localCalendarDate, parseFulfillmentDetails, requestedDateError,
} from "./fulfillmentDetails";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/queryClient")>(), apiRequest: api }));
vi.mock("@/pages/profile-sites/ExpressDirectConnectPanel", () => ({
  default: ({ initialMessage }: { initialMessage?: string }) => <div data-testid="delivery-quote-draft">{initialMessage}</div>,
}));
const envelope = (details: object, schemaVersion = 1) => JSON.stringify({ schemaVersion, details });
const completeDetails = { ...EMPTY_FULFILLMENT_DETAILS, requestedDate: "2099-06-15", timePreference: "morning" as const,
  destinationType: "jobsite" as const, addressLine: "100 Example Lane", city: "Example City", stateCode: "LA",
  unloading: "needs_arrangement" as const, notes: "Call before arrival; gate closes at 4." };

describe("delivery preference semantics", () => {
  it.each(["", "2026-09-15", "2026-09-16"])("allows flexible or current/future date %s", (date) => {
    expect(requestedDateError(date, "2026-09-15")).toBeNull();
  });
  it.each(["2026-09-14", "2025-12-31"])("rejects a past requested date %s", (date) => {
    expect(requestedDateError(date, "2026-09-15")).toContain("future date");
  });
  it.each(["2026-02-30", "2026-13-01", "tomorrow", "2026-2-01"])("rejects invalid calendar date %s", (date) => {
    expect(requestedDateError(date, "2026-01-01")).toContain("valid requested date");
  });
  it("allows real leap days and uses the local calendar", () => {
    expect(requestedDateError("2028-02-29", "2028-01-01")).toBeNull();
    expect(localCalendarDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("does not require delivery facts for pickup", () => {
    expect(fulfillmentDetailsError({ ...EMPTY_FULFILLMENT_DETAILS, stateCode: "9!" }, "pickup")).toBeNull();
    expect(fulfillmentDetailsError({ ...EMPTY_FULFILLMENT_DETAILS, stateCode: "9!" }, "delivery")).toContain("two-letter");
  });
  it("labels timing, address and unloading as customer preferences rather than a booking", () => {
    const text = fulfillmentDetailsSummary(completeDetails, "delivery").join("\n");
    expect(text).toContain("JW Stone must confirm"); expect(text).toContain("not a scheduled appointment");
    expect(text).toContain("Jobsite"); expect(text).toContain("100 Example Lane");
    expect(text).toContain("Help arranging unloading requested"); expect(text).not.toMatch(/\$|free shipping|guaranteed/i);
  });
  it("preserves the calendar date through the real contact guard while hiding phone and email", () => {
    const text = fulfillmentDetailsSummary({ ...completeDetails, notes: "Phone 2025550147; email person@example.test" }, "delivery").join("\n");
    const guarded = redactContactDetails(text);
    expect(guarded).toContain("June 15, 2099");
    expect(guarded).toContain("JW Stone must confirm");
    expect(guarded).not.toMatch(/2025550147|person@example\.test/);
    expect(guarded.match(/\[hidden\]/g)).toHaveLength(2);
  });
  it("omits retained delivery-only details from a pickup request", () => {
    const text = fulfillmentDetailsSummary(completeDetails, "pickup").join("\n");
    expect(text).toContain("Requested pickup date"); expect(text).not.toMatch(/100 Example Lane|destination type|Unloading/);
  });
  it("keeps unknown equipment and destination unknown", () => {
    const text = fulfillmentDetailsSummary(EMPTY_FULFILLMENT_DETAILS, "delivery").join("\n");
    expect(text).toContain("flexible"); expect(text).toContain("Not specified; please confirm");
    expect(text).not.toContain("Equipment available");
  });
  it.each(["{", "[]", envelope(completeDetails, 2), envelope({ ...completeDetails, notes: "x".repeat(501) }), envelope({ ...completeDetails, unloading: "free" })])("rejects malformed or unsupported storage", (raw) => {
    expect(parseFulfillmentDetails(raw)).toBeNull();
  });
  it("restores only known fields and strips injected price and ETA claims", () => {
    expect(parseFulfillmentDetails(envelope({ ...completeDetails, freightCents: 0, promisedEta: "tomorrow", access: "member" }))).toEqual(completeDetails);
  });
});

function input(label: string, value: string) {
  const field = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (!field) throw new Error("Missing field: " + label);
  act(() => {
    if (field instanceof HTMLSelectElement) field.value = value;
    else Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
async function settle(check: () => void) {
  let last: unknown;
  for (let i = 0; i < 40; i++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    try { check(); return; } catch (error) { last = error; }
  }
  throw last;
}
function Harness({ viewerId }: { viewerId: string }) {
  const state = useJwStoneFulfillmentDetails(viewerId);
  return <JwStoneFulfillmentDetailsFields method="delivery" details={state.details} onChange={state.update} storageError={state.storageError} />;
}

describe("delivery fields in the actual member cart", () => {
  let host: HTMLDivElement, root: Root, client: QueryClient;
  beforeEach(() => {
    window.localStorage.clear(); api.mockReset();
    api.mockResolvedValue({ profileSlug: "jw-stone", items: [] });
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.restoreAllMocks(); });
  const renderCart = (items = [{ id: "honey", stoneName: "Honey Onyx", stoneKey: "honey onyx", quantity: 2 }]) => act(() => root.render(<QueryClientProvider client={client}>
    <JwStoneMemberCart viewerId="delivery-member" items={items}
      onClose={() => {}} onQuantityChange={() => {}} onStockChange={() => {}} />
  </QueryClientProvider>));
  const seedDelivery = () => window.localStorage.setItem("tradescout:jw-stone:cart-fulfillment:v1:delivery-member", JSON.stringify({ method: "delivery", postalCode: "70401", jobReference: "Kitchen A" }));
  it("opens with optional fields collapsed and no guessed delivery date", async () => {
    renderCart();
    await settle(() => expect(document.querySelector('[data-testid="jw-cart-fulfillment-details"]')).not.toBeNull());
    expect((document.querySelector("details") as HTMLDetailsElement).open).toBe(false);
    expect((document.querySelector('[aria-label="Requested pickup date"]') as HTMLInputElement).value).toBe("");
    expect(document.querySelector('[aria-label="Delivery destination"]')).toBeNull();
  });
  it("includes requested date, address and unloading in the editable cart quote draft", async () => {
    seedDelivery(); renderCart();
    await settle(() => expect(document.querySelector('[aria-label="Delivery destination"]')).not.toBeNull());
    input("Requested delivery date", "2099-06-15"); input("Preferred time of day", "morning");
    input("Delivery destination", "jobsite"); input("Delivery street address", "100 Example Lane");
    input("Delivery city", "Example City"); input("Delivery state", "la");
    input("Unloading arrangements", "needs_arrangement"); input("Delivery notes", "Call before arrival.");
    const button = document.querySelector('[data-testid="jw-cart-request-quote"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    act(() => button.click());
    await settle(() => expect(document.querySelector('[data-testid="delivery-quote-draft"]')).not.toBeNull());
    const text = document.querySelector('[data-testid="delivery-quote-draft"]')!.textContent;
    for (const part of ["2 slab(s)", "70401", "Kitchen A", "June 15, 2099", "Jobsite", "100 Example Lane", "LA", "Help arranging unloading", "Call before arrival.", "JW Stone must confirm"]) expect(text).toContain(part);
    expect(api.mock.calls.some(([url]) => String(url).includes("express-request"))).toBe(false);
  });
  it("blocks oversized quote drafts before the form instead of exceeding the server limit", async () => {
    renderCart(Array.from({ length: 30 }, (_, index) => ({ id: `long-${index}`, stoneName: "Stone " + "A".repeat(60), stoneKey: "stone " + "a".repeat(60), quantity: 1 })));
    await settle(() => expect((document.querySelector('[data-testid="jw-cart-request-quote"]') as HTMLButtonElement).disabled).toBe(true));
    expect(document.body.textContent).toContain("Please split this cart into smaller quote requests.");
    expect(document.querySelector('[data-testid="delivery-quote-draft"]')).toBeNull();
  });
  it("blocks an expired saved date until it is cleared or replaced", async () => {
    seedDelivery(); window.localStorage.setItem(fulfillmentDetailsKey("delivery-member"), envelope({ ...completeDetails, requestedDate: "2000-01-01" }));
    renderCart();
    await settle(() => expect((document.querySelector('[data-testid="jw-cart-request-quote"]') as HTMLButtonElement).disabled).toBe(true));
    expect(document.body.textContent).toContain("future date");
    input("Requested delivery date", "");
    expect((document.querySelector('[data-testid="jw-cart-request-quote"]') as HTMLButtonElement).disabled).toBe(false);
  });
  it("restores member details without storing prices", async () => {
    act(() => root.render(<Harness viewerId="member-a" />));
    input("Delivery street address", "101 Private Shop");
    await settle(() => expect(parseFulfillmentDetails(window.localStorage.getItem(fulfillmentDetailsKey("member-a"))!)?.addressLine).toBe("101 Private Shop"));
    act(() => root.render(<Harness key="reload" viewerId="member-a" />));
    expect((document.querySelector('[aria-label="Delivery street address"]') as HTMLInputElement).value).toBe("101 Private Shop");
    expect(window.localStorage.getItem(fulfillmentDetailsKey("member-a"))).not.toMatch(/Cents|Price|Eta/);
  });
  it("does not copy one member's address into another member's cart", async () => {
    window.localStorage.setItem(fulfillmentDetailsKey("member-a"), envelope(completeDetails));
    act(() => root.render(<Harness viewerId="member-a" />));
    act(() => root.render(<Harness viewerId="member-b" />));
    await settle(() => expect((document.querySelector('[aria-label="Delivery street address"]') as HTMLInputElement).value).toBe(""));
    input("Delivery street address", "202 Second Shop");
    await settle(() => expect(window.localStorage.getItem(fulfillmentDetailsKey("member-b"))).toContain("202 Second Shop"));
    expect(window.localStorage.getItem(fulfillmentDetailsKey("member-a"))).toBe(envelope(completeDetails));
  });
  it("preserves an unreadable saved copy and explains in-memory-only edits", async () => {
    const future = envelope(completeDetails, 9);
    window.localStorage.setItem(fulfillmentDetailsKey("member-a"), future);
    act(() => root.render(<Harness viewerId="member-a" />)); input("Delivery street address", "Unsaved edit");
    await settle(() => expect(document.body.textContent).toContain("saved copy is unchanged"));
    expect(window.localStorage.getItem(fulfillmentDetailsKey("member-a"))).toBe(future);
  });
  it("reports a save failure without discarding the entered address", async () => {
    act(() => root.render(<Harness viewerId="member-a" />));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    input("Delivery street address", "Keep this address");
    await settle(() => expect(document.body.textContent).toContain("could not be saved"));
    expect((document.querySelector('[aria-label="Delivery street address"]') as HTMLInputElement).value).toBe("Keep this address");
  });
});