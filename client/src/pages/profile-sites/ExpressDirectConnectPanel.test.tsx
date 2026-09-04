// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";
import { DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY } from "../../lib/discoveryLanding";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

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
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function selectCustomerRole(container: ParentNode, value = "fabricator") {
  const select = Array.from(container.querySelectorAll("select")).find((node) =>
    node.closest("label")?.textContent?.includes("I am a")
  );
  change(select as HTMLSelectElement | null, value);
}

describe("Express Direct Connect anonymous inventory context", () => {
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
    sessionStorage.removeItem(DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY);
    vi.unstubAllGlobals();
  });

  it("keeps the stable item id out of public copy while submitting it for routing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        requestId: "request-1",
        requestWorkspacePath:
          "/direct-connect/engagements?requestId=request-1&itemId=trending-selection-05",
        onboardingEmailStatus: "skipped",
        deliveryCustody: "business",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem(
      DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({
        discoveryAttributionToken: "signed-payload.signed-signature",
        businessSlug: "jw-stone",
      })
    );

    act(() => {
      root.render(
        <ExpressDirectConnectPanel
          open
          onClose={vi.fn()}
          profileSlug="jw-stone"
          businessName="JW Stone"
          hasViewerSession={false}
          allowCall={false}
          requestMode="materials"
          initialStoneName={null}
          initialItemId="trending-selection-05"
          initialRequestType="request_material"
        />
      );
    });

    expect(container.textContent).not.toContain("trending-selection-05");
    expect(container.textContent).not.toContain("Trending Selection 05");
    expect(container.textContent).not.toContain("Unnamed slab");

    const formChoice = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Fill out the form")
    );
    click(formChoice || null);

    expect(container.querySelector("h3")?.textContent).toBe("Ask about this stone selection");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "I'm interested in this stone selection."
    );
    expect(container.textContent).not.toContain("trending-selection-05");

    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-555-1212");
    selectCustomerRole(container, "fabricator");

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
    expect(requestBody).toMatchObject({
      itemId: "trending-selection-05",
      requestType: "request_material",
      contactPreference: "platform_message",
      message: "Customer type: Fabricator.\n\nI'm interested in this stone selection.",
      updatesOptIn: false,
      discoveryAttributionToken: "signed-payload.signed-signature",
    });
    expect(requestBody).not.toHaveProperty("stoneName");
    expect(requestBody).not.toHaveProperty("customerRole");
  });

  it("stages a call request without revealing or navigating to a phone URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        requestId: "call-request-1",
        requestWorkspacePath: "/direct-connect/engagements?requestId=call-request-1",
        contactPreference: "call",
        deliveryCustody: "business",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <ExpressDirectConnectPanel
          open
          onClose={vi.fn()}
          profileSlug="public-profile"
          businessName="Example TradePartner"
          hasViewerSession={false}
          allowCall
          requestMode="service"
        />
      );
    });

    const locationBefore = window.location.href;
    const callChoice = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Request a call")
    );
    click(callChoice || null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe(locationBefore);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector("h3")?.textContent).toBe(
      "Request a call from Example TradePartner"
    );
    expect(container.textContent).toContain(
      "Your contact details stay gated until the business responds in Direct Connect."
    );

    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-555-1212");
    change(
      container.querySelector<HTMLTextAreaElement>("textarea"),
      "Please call about a service estimate."
    );

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/express-request");
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).not.toContain("/express-contact/reveal");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
    expect(requestBody.contactPreference).toBe("call");
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it("defaults update opt-in unchecked and submits JW Stone marketing consent when checked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        requestId: "request-opt-in",
        requestWorkspacePath: "/direct-connect/engagements?requestId=request-opt-in",
        onboardingEmailStatus: "sent",
        deliveryCustody: "business",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <ExpressDirectConnectPanel
          open
          onClose={vi.fn()}
          profileSlug="jw-stone"
          businessName="JW Stone"
          hasViewerSession={false}
          allowCall={false}
          requestMode="materials"
          initialView="request"
          initialRequestType="request_material"
          initialStoneName="Steel Gray"
          initialItemId="steel-gray"
        />
      );
    });

    expect(container.textContent).toContain(
      "Email me about new arrivals, First Cut releases, and other JW Stone updates"
    );
    const optIn = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(optIn).toBeTruthy();
    expect(optIn?.checked).toBe(false);

    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-555-1212");
    selectCustomerRole(container, "designer");
    click(optIn);

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
    expect(requestBody.updatesOptIn).toBe(true);
    expect(String(requestBody.message || "")).toContain("Customer type: Designer.");
  });

  it("keeps a deliberate named-stone selection contact-free until form submission", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        requestId: "request-2",
        requestWorkspacePath: "/direct-connect/engagements?requestId=request-2&selectionCount=2",
        onboardingEmailStatus: "skipped",
        deliveryCustody: "business",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <ExpressDirectConnectPanel
          open
          onClose={vi.fn()}
          profileSlug="jw-stone"
          businessName="JW Stone"
          hasViewerSession={false}
          allowCall={false}
          requestMode="materials"
          initialView="request"
          initialRequestType="request_material"
          initialStoneSelections={[
            { itemId: "amazonic-green", itemName: "Amazonic Green" },
            { itemId: "steel-gray", itemName: "Steel Gray" },
            { itemId: "amazonic-green", itemName: "Amazonic Green" },
            { itemId: "trending-selection-05", itemName: "Trending Selection 05" },
          ]}
        />
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("h3")?.textContent).toBe("Ask about 2 saved stones");
    expect(container.textContent).toContain("Amazonic Green");
    expect(container.textContent).toContain("Steel Gray");
    expect(container.textContent).not.toContain("Trending Selection 05");

    expect(container.textContent).toContain("I am a…");
    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-555-1212");
    selectCustomerRole(container, "architect");

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
    expect(String(requestBody.message || "")).toContain("Customer type: Architect.");
    expect(requestBody.stoneSelections).toEqual([
      { itemId: "amazonic-green", stoneName: "Amazonic Green" },
      { itemId: "steel-gray", stoneName: "Steel Gray" },
    ]);
    expect(requestBody).not.toHaveProperty("stoneName");
    expect(requestBody).not.toHaveProperty("itemId");
  });

  it("blocks submit without a real phone number and shows a clear error", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <ExpressDirectConnectPanel
          open
          onClose={vi.fn()}
          profileSlug="jw-stone"
          businessName="JW Stone"
          hasViewerSession={false}
          allowCall={false}
          requestMode="materials"
          initialView="request"
          initialRequestType="request_material"
          initialStoneName="Steel Gray"
          initialItemId="steel-gray"
        />
      );
    });

    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    selectCustomerRole(container, "fabricator");

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Enter a phone number so they can reach you.");

    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-01");

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Enter a complete phone number so they can reach you.");
  });

  it("shows request success without a signup CTA for anonymous visitors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        requestId: "request-success",
        requestWorkspacePath: "/direct-connect/engagements?requestId=request-success",
        accountCreated: true,
        onboardingPath: "/pre-scout-setup?mode=create",
        onboardingEmailStatus: "sent",
        deliveryCustody: "business",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <ExpressDirectConnectPanel
          open
          onClose={vi.fn()}
          profileSlug="jw-stone"
          businessName="JW Stone"
          hasViewerSession={false}
          allowCall={false}
          stayInProfile
          requestMode="materials"
          initialView="request"
          initialRequestType="request_material"
          initialStoneName="Steel Gray"
          initialItemId="steel-gray"
        />
      );
    });

    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-555-1212");
    selectCustomerRole(container, "fabricator");

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Request sent");
    expect(container.textContent).toContain("JW Stone received your project details.");
    expect(container.textContent).toContain("Back to JW Stone");
    expect(container.textContent).not.toContain("Sign in to manage this request");
    expect(container.textContent).not.toContain("Finish setup and manage this request");
    expect(container.textContent).not.toContain("Sign in and manage it");
    expect(container.textContent).not.toContain("Manage this in TradeScout");
    expect(container.querySelector('a[href*="pre-scout-setup"]')).toBeNull();
  });
});
