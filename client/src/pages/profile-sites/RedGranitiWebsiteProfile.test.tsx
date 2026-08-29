// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RedGranitiWebsiteProfile from "./RedGranitiWebsiteProfile";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function change(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null,
  value: string
) {
  if (!element) throw new Error("Expected a form control");
  act(() => {
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("R.E.D. Graniti anonymous first-cut request", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("requires proof-only Decision Card confirmation before showing success", async () => {
    const decisionProof = "opaque-red-graniti-session-proof-value-1234567890";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ status: "decision_required", decisionProof }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ requestId: "request-confirmed" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(<RedGranitiWebsiteProfile profileSlug="red-graniti" />);
    });

    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "850-555-0100");
    const selects = container.querySelectorAll<HTMLSelectElement>("select");
    change(selects[0] || null, "Fabricator");
    change(selects[1] || null, "Rough block");
    change(
      container.querySelector<HTMLInputElement>('input[placeholder="City, state, or country"]'),
      "Tallahassee, Florida"
    );

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="red-graniti-request-decision-card"]')
    ).toBeTruthy();
    expect(container.textContent).not.toContain("Request sent.");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="red-graniti-confirm-request"]')
        ?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/tradepartner-profiles/jw-stone/express-request/confirm"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || "{}"))).toEqual({
      authorityGate: "decision_card",
      source: "tradepartner_profile",
      decisionProof,
    });
    expect(container.textContent).toContain("Request sent.");
  });
});
