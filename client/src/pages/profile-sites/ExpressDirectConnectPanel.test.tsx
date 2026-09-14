// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
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

function pressKey(key: string, shiftKey = false) {
  const event = new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true });
  act(() => (document.activeElement || document.body).dispatchEvent(event));
  return event;
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderBusinessCallPanel({
    profileSlug = "louisiana-stone-solutions",
    allowCall = true,
    open = true,
  } = {}) {
    act(() =>
      root.render(
        <ExpressDirectConnectPanel
          open={open}
          onClose={vi.fn()}
          profileSlug={profileSlug}
          businessName="Louisiana Stone Solutions"
          hasViewerSession={false}
          allowCall={allowCall}
          stayInProfile
        />
      )
    );
  }

  function businessCallButton() {
    return (
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.querySelector("strong")?.textContent === "Call"
      ) || null
    );
  }

  function renderRequestPanel(
    props: Partial<ComponentProps<typeof ExpressDirectConnectPanel>> = {}
  ) {
    act(() =>
      root.render(
        <ExpressDirectConnectPanel
          open
          onClose={vi.fn()}
          profileSlug="louisiana-stone-solutions"
          businessName="Louisiana Stone Solutions"
          hasViewerSession={false}
          allowCall={false}
          initialView="request"
          initialServiceName="Countertops, Tile"
          {...props}
        />
      )
    );
  }

  function fillContactDetails() {
    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-555-1212");
  }

  async function submitForm() {
    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("recovers an unsent draft after closing to review the same business and changing services", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ requestId: "recovered-request" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderRequestPanel({ onClose: () => renderRequestPanel({ open: false }) });
    fillContactDetails();
    change(container.querySelector("textarea"), "Replace our kitchen counters and backsplash.");
    change(container.querySelector("select"), "request_quote");
    click(container.querySelector('input[type="checkbox"]'));
    click(container.querySelector('[aria-label="Close Direct Connect"]'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    renderRequestPanel({ initialServiceName: "Countertops, Flooring" });
    expect(container.querySelector("h3")?.textContent).toBe("Ask about Countertops, Flooring");
    expect(container.querySelector<HTMLInputElement>('input[autocomplete="name"]')?.value).toBe(
      "Alex Smith"
    );
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Replace our kitchen counters and backsplash."
    );
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe("request_quote");
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    await submitForm();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      name: "Alex Smith",
      email: "alex@example.com",
      phone: "555-555-1212",
      message: "Replace our kitchen counters and backsplash.",
      requestType: "request_quote",
      serviceName: "Countertops, Flooring",
      updatesOptIn: true,
    });
  });

  it("refreshes untouched service prefills but preserves details the visitor deliberately cleared", () => {
    renderRequestPanel();
    renderRequestPanel({ initialServiceName: "Flooring", initialRequestType: "request_quote" });
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "I'm interested in Flooring."
    );
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe("request_quote");
    change(container.querySelector("textarea"), "");
    renderRequestPanel({ open: false, initialServiceName: "Flooring" });
    renderRequestPanel({ initialServiceName: "Countertops" });
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(
      false
    );
  });

  it("retains the chosen customer role and edited material draft across a changed stone selection", () => {
    const materialProps = {
      profileSlug: "jw-stone",
      businessName: "JW Stone",
      requestMode: "materials" as const,
      initialServiceName: null,
      initialStoneName: "Steel Gray",
      initialItemId: "steel-gray",
    };
    renderRequestPanel(materialProps);
    selectCustomerRole(container, "designer");
    change(container.querySelector("textarea"), "Please match these slabs to the kitchen plan.");
    renderRequestPanel({ ...materialProps, open: false });
    renderRequestPanel({
      ...materialProps,
      initialStoneName: "Amazonic Green",
      initialItemId: "amazonic-green",
    });
    expect(container.querySelector("h3")?.textContent).toBe("Ask about Amazonic Green");
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe("designer");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Please match these slabs to the kitchen plan."
    );
  });

  it.each(["open", "closed"])(
    "starts an empty draft when another profile replaces an %s panel",
    (state) => {
      renderRequestPanel();
      fillContactDetails();
      change(container.querySelector("textarea"), "Private kitchen project details.");
      click(container.querySelector('input[type="checkbox"]'));
      if (state === "closed") renderRequestPanel({ open: false });
      renderRequestPanel({
        profileSlug: "another-business",
        businessName: "Another Business",
        initialServiceName: "Painting",
      });
      expect(container.querySelector<HTMLInputElement>('input[autocomplete="name"]')?.value).toBe(
        ""
      );
      expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe("");
      expect(container.querySelector<HTMLInputElement>('input[type="tel"]')?.value).toBe("");
      expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
        "I'm interested in Painting."
      );
      expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(
        false
      );
    }
  );

  it("resets a draft when the request mode changes so incompatible selections cannot carry over", () => {
    renderRequestPanel({ requestMode: "materials", initialServiceName: null });
    fillContactDetails();
    selectCustomerRole(container, "builder");
    change(container.querySelector("textarea"), "Find matching slabs for our project.");
    click(container.querySelector('input[type="checkbox"]'));
    renderRequestPanel({ requestMode: "service", initialServiceName: "Countertops" });
    expect(container.querySelectorAll("select")).toHaveLength(1);
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe("request_service");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "I'm interested in Countertops."
    );
    expect(container.querySelector<HTMLInputElement>('input[autocomplete="name"]')?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(
      false
    );
  });

  it("starts a fresh request after success without carrying contact details or consent into the next send", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ requestId: "submitted-request" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderRequestPanel();
    fillContactDetails();
    change(container.querySelector("textarea"), "Details belonging to the submitted request.");
    click(container.querySelector('input[type="checkbox"]'));
    await submitForm();
    expect(container.textContent).toContain("Request sent");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).updatesOptIn).toBe(true);
    renderRequestPanel({ open: false });
    renderRequestPanel();
    expect(container.textContent).not.toContain("Request sent");
    expect(container.querySelector<HTMLInputElement>('input[autocomplete="name"]')?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('input[type="tel"]')?.value).toBe("");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "I'm interested in Countertops, Tile."
    );
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(
      false
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fillContactDetails();
    await submitForm();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      message: "I'm interested in Countertops, Tile.",
      updatesOptIn: false,
    });
  });

  it("ignores a previous profile's pending result after starting a different business draft", async () => {
    let finish: (response: any) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderRequestPanel();
    fillContactDetails();
    await submitForm();
    renderRequestPanel({ profileSlug: "another-business", businessName: "Another Business" });
    change(
      container.querySelector("textarea"),
      "Only the new business should receive these details."
    );
    await act(async () => {
      finish({ ok: true, json: async () => ({ requestId: "old-request" }) });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.textContent).not.toContain("Request sent");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Only the new business should receive these details."
    );
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(
      false
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("contains Tab and Shift+Tab, skips the hidden trap field, and returns focus after Escape", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn(() => renderRequestPanel({ open: false }));
    renderRequestPanel({ onClose });
    const first = container.querySelector<HTMLButtonElement>(
      '[aria-label="Back to contact options"]'
    );
    const last = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(pressKey("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(pressKey("Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(pressKey("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(pressKey("Tab").defaultPrevented).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
    pressKey("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).not.toBe("hidden");
    opener.remove();
  });

  it("keeps focus contained while sending and does not close on Escape until the send settles", async () => {
    let finish: (response: any) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        })
      )
    );
    const onClose = vi.fn();
    renderRequestPanel({ onClose });
    fillContactDetails();
    const first = container.querySelector<HTMLButtonElement>(
      '[aria-label="Back to contact options"]'
    );
    first?.focus();
    await submitForm();
    expect(document.activeElement).toBe(first);
    expect(pressKey("Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('input[type="checkbox"]'));
    pressKey("Escape");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      finish({ ok: false, status: 503, json: async () => ({}) });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "I'm interested in Countertops, Tile."
    );
    pressKey("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens a registered business call only after the server accepts the explicit call decision", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ phone: "2255550198", tel: "tel:+12255550198" }),
    });
    const dialed: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      dialed.push(this.href);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderBusinessCallPanel();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    await act(async () => {
      businessCallButton()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/tradepartner-profiles/louisiana-stone-solutions/express-contact/reveal"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      authorityGate: "profile_direct_connect",
      decision: "call",
    });
    expect(dialed).toEqual(["tel:+12255550198"]);
    expect(container.querySelector('a[href^="tel:"]')?.getAttribute("href")).toBe(
      "tel:+12255550198"
    );
    expect(container.textContent).toContain("Calling Louisiana Stone Solutions");
    expect(container.textContent).toContain("Back to Louisiana Stone Solutions");
  });

  it.each([
    { ok: false, status: 404, body: {} },
    { ok: true, status: 200, body: { phone: "2255550198", tel: "javascript:alert(1)" } },
  ])(
    "keeps the request option available when the server denies or cannot return a call (%#)",
    async ({ ok, status, body }) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status, json: async () => body }));
      const dial = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      renderBusinessCallPanel();
      await act(async () => {
        businessCallButton()?.click();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(dial).not.toHaveBeenCalled();
      expect(container.querySelector('a[href^="tel:"]')).toBeNull();
      expect(container.textContent).toContain(
        "Calling is unavailable right now. You can still send a request."
      );
      click(
        Array.from(container.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("Fill out the form")
        ) || null
      );
      expect(container.querySelector("form")).not.toBeNull();
    }
  );

  it("does not enable a registered call when the public reader withholds call capability", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderBusinessCallPanel({ allowCall: false });
    expect(businessCallButton()).toBeNull();
    const call = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Request a call")
    );
    expect(call?.disabled).toBe(true);
    click(call || null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discards a pending call approval when the panel changes to another profile", async () => {
    let finish: (response: any) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const dial = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    renderBusinessCallPanel();
    click(businessCallButton());
    renderBusinessCallPanel({ profileSlug: "public-profile" });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => {
      finish({ ok: true, json: async () => ({ phone: "2255550198", tel: "tel:+12255550198" }) });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(dial).not.toHaveBeenCalled();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.textContent).toContain("Request a call");
    expect(container.textContent).not.toContain("2255550198");
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
      "Sending this request shares your name and phone with Example TradePartner so they can respond."
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
