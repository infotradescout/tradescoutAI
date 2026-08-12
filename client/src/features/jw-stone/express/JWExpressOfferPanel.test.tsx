// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JWExpressOfferPanel } from "./JWExpressOfferPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JW Express customer panel", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ account: null, csrfToken: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("requires the complete JW-only Express signup and avoids public competition language", async () => {
    await act(async () => {
      root.render(
        <JWExpressOfferPanel
          entry={{
            kind: "target",
            target: {
              kind: "container",
              ref: "jwc_opaque",
              label: "Container 12",
              imageUrl: null,
              acceptingOffers: true,
              minimumOffer: null,
            },
          }}
          onClose={vi.fn()}
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = document.querySelector<HTMLElement>('[data-testid="jw-express-offer-panel"]');
    expect(dialog).not.toBeNull();
    for (const id of [
      "jw-express-legal-name",
      "jw-express-signup-email",
      "jw-express-phone",
      "jw-express-signup-password",
      "jw-express-signup-password-confirmation",
      "jw-express-signup-amount",
    ]) {
      expect(dialog?.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(dialog?.textContent).toContain("JW Stone account, separate from any TradeScout account");
    expect(dialog?.textContent).toContain("Other customers cannot see your amount");
    expect(dialog?.textContent).not.toMatch(
      /bid count|rank|outbid|highest bid|competing bids|leaderboard/i
    );
  });

  it("lets a verified customer revise, withdraw, review history, sign out, and close with a password", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account: {
              legalName: "Jamie Stone",
              email: "jamie@example.com",
              phone: "+1 555 0100",
              isBusiness: false,
              businessName: null,
              emailVerified: true,
            },
            csrfToken: "csrf",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            offers: [
              {
                id: "offer-1",
                targetRef: "jws_opaque",
                targetKind: "stone",
                targetLabel: "Blue Dunes",
                amount: "1250.00",
                status: "under_review",
                submittedAt: "2026-08-11T12:00:00.000Z",
                updatedAt: "2026-08-11T12:00:00.000Z",
                versions: [
                  {
                    id: "version-1",
                    amount: "1250.00",
                    status: "under_review",
                    submittedAt: "2026-08-11T12:00:00.000Z",
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <JWExpressOfferPanel
          entry={{
            kind: "target",
            target: {
              kind: "stone",
              ref: "jws_opaque",
              label: "Blue Dunes",
              imageUrl: null,
              acceptingOffers: true,
              minimumOffer: null,
            },
          }}
          onClose={vi.fn()}
        />
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = document.querySelector<HTMLElement>('[data-testid="jw-express-offer-panel"]');
    expect(dialog?.textContent).toContain("Revise offer");
    expect(dialog?.textContent).toContain("Withdraw this offer");
    expect(dialog?.querySelector('[data-testid="jw-express-offer-history"]')).not.toBeNull();
    expect(dialog?.textContent).toContain("Sign out");
    expect(dialog?.textContent).toContain("Close JW Express account");
    expect(dialog?.querySelector("#jw-express-close-password")).not.toBeNull();
  });
});
