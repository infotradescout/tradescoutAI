import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_NAMED_CATALOG } from "../catalog";
import {
  closeJwExpressAccount,
  confirmJwExpressVerification,
  confirmJwExpressPasswordReset,
  getJwExpressSession,
  getOwnJwExpressOffers,
  registerJwExpressAccountAndOffer,
  requestJwExpressPasswordReset,
  resendJwExpressVerification,
  resolveJwStoneOfferTarget,
  reviseJwExpressOffer,
  signInJwExpress,
  signOutJwExpress,
  submitJwExpressOffer,
  withdrawJwExpressOffer,
} from "./api";

function jsonResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestAt(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const [path, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    path,
    init,
    body: init.body ? (JSON.parse(String(init.body)) as unknown) : null,
    headers: init.headers as Record<string, string>,
  };
}

describe("JW Express storefront API contract", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-4333-8444-555555555555" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("resolves named and anonymous stones using only their public locator", async () => {
    const named = JW_STONE_NAMED_CATALOG[0]!;
    const anonymous = JW_STONE_ANONYMOUS_CATALOG[0]!;
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            kind: "stone",
            ref: "jws_named_opaque",
            label: named.displayName,
            imageUrl: named.images[0],
            acceptingOffers: true,
            minimumOffer: null,
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            kind: "stone",
            ref: "jws_anonymous_opaque",
            label: "JW Stone selection",
            imageUrl: anonymous.images[0],
            acceptingOffers: true,
            minimumOffer: null,
          },
        })
      );

    await resolveJwStoneOfferTarget(named);
    await resolveJwStoneOfferTarget(anonymous);

    expect(requestAt(fetchMock, 0)).toMatchObject({
      path: "/api/jw-stone/offer-targets/resolve",
      body: { shareSlug: named.shareSlug },
    });
    expect(requestAt(fetchMock, 1)).toMatchObject({
      path: "/api/jw-stone/offer-targets/resolve",
      body: { imageUrl: anonymous.images[0] },
    });
    expect(JSON.stringify(requestAt(fetchMock, 1).body)).not.toContain(anonymous.id);
  });

  it("posts the exact signup shape with a target object and no TradeScout identity", async () => {
    await registerJwExpressAccountAndOffer({
      legalName: "Jamie Stone",
      email: "jamie@example.com",
      phone: "+1 555 0100",
      isBusiness: true,
      businessName: "Stone Works",
      password: "long-password",
      passwordConfirmation: "long-password",
      offer: { target: { kind: "stone", ref: "jws_opaque" }, amount: "1250.00" },
    });

    const request = requestAt(fetchMock, 0);
    expect(request.path).toBe("/api/jw-stone/express/register");
    expect(request.init.method).toBe("POST");
    expect(request.body).toEqual({
      legalName: "Jamie Stone",
      email: "jamie@example.com",
      phone: "+1 555 0100",
      isBusiness: true,
      businessName: "Stone Works",
      password: "long-password",
      passwordConfirmation: "long-password",
      offer: { target: { kind: "stone", ref: "jws_opaque" }, amount: "1250.00" },
    });
    expect(request.headers["Idempotency-Key"]).toContain("jw-express-register-offer-");
    expect(JSON.stringify(request.body)).not.toMatch(/userId|TradeScout/i);
  });

  it("keeps reset tokens in the confirm POST and matches offer/account mutation bodies", async () => {
    await confirmJwExpressPasswordReset({
      token: "reset-secret-token",
      password: "new-password",
      passwordConfirmation: "new-password",
    });
    await submitJwExpressOffer({
      target: { kind: "container", ref: "jwc_opaque" },
      amount: "2500.00",
      csrfToken: "csrf",
    });
    await reviseJwExpressOffer({ offerId: "offer-1", amount: "2700.00", csrfToken: "csrf" });
    await withdrawJwExpressOffer({ offerId: "offer-1", csrfToken: "csrf" });
    await closeJwExpressAccount({ password: "account-password", csrfToken: "csrf" });

    expect(requestAt(fetchMock, 0)).toMatchObject({
      path: "/api/jw-stone/express/password/reset/confirm",
      body: {
        token: "reset-secret-token",
        password: "new-password",
        passwordConfirmation: "new-password",
      },
    });
    expect(requestAt(fetchMock, 1).body).toEqual({
      target: { kind: "container", ref: "jwc_opaque" },
      amount: "2500.00",
    });
    expect(requestAt(fetchMock, 2).body).toEqual({ amount: "2700.00" });
    expect(requestAt(fetchMock, 3).body).toEqual({});
    expect(requestAt(fetchMock, 4).body).toEqual({ password: "account-password" });
    expect(requestAt(fetchMock, 4).headers["X-CSRF-Token"]).toBe("csrf");
  });

  it("uses the exact session, login, verification, reset-request, logout, and offers routes", async () => {
    fetchMock
      .mockImplementationOnce(async () => jsonResponse({ account: null, csrfToken: null }))
      .mockImplementationOnce(async () => jsonResponse({ offers: [] }));

    await getJwExpressSession();
    await getOwnJwExpressOffers();
    await signInJwExpress({ email: "jamie@example.com", password: "account-password" });
    await resendJwExpressVerification("jamie@example.com");
    await confirmJwExpressVerification("verification-secret");
    await requestJwExpressPasswordReset("jamie@example.com");
    await signOutJwExpress("csrf-token");

    expect(requestAt(fetchMock, 0)).toMatchObject({
      path: "/api/jw-stone/express/session",
      init: { method: "GET" },
    });
    expect(requestAt(fetchMock, 1)).toMatchObject({
      path: "/api/jw-stone/express/offers",
      init: { method: "GET" },
    });
    expect(requestAt(fetchMock, 2)).toMatchObject({
      path: "/api/jw-stone/express/login",
      body: { email: "jamie@example.com", password: "account-password" },
    });
    expect(requestAt(fetchMock, 3)).toMatchObject({
      path: "/api/jw-stone/express/verification/resend",
      body: { email: "jamie@example.com" },
    });
    expect(requestAt(fetchMock, 4)).toMatchObject({
      path: "/api/jw-stone/express/verification/confirm",
      body: { token: "verification-secret" },
    });
    expect(requestAt(fetchMock, 5)).toMatchObject({
      path: "/api/jw-stone/express/password/reset/request",
      body: { email: "jamie@example.com" },
    });
    expect(requestAt(fetchMock, 6)).toMatchObject({
      path: "/api/jw-stone/express/logout",
      body: {},
    });
    expect(requestAt(fetchMock, 6).headers["X-CSRF-Token"]).toBe("csrf-token");
  });

  it("fails closed before sending an idempotent mutation when secure randomness is unavailable", async () => {
    vi.stubGlobal("crypto", {});
    await expect(
      submitJwExpressOffer({
        target: { kind: "stone", ref: "jws_opaque" },
        amount: "500.00",
        csrfToken: "csrf",
      })
    ).rejects.toThrow(/Secure randomness is unavailable/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
