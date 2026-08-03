// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";

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

function change(element: HTMLInputElement | HTMLTextAreaElement | null, value: string) {
  if (!element) throw new Error("Expected a form control");
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value"
    );
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
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
      message: "I'm interested in this stone selection.",
    });
    expect(requestBody).not.toHaveProperty("stoneName");
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

    change(container.querySelector<HTMLInputElement>('input[autocomplete="name"]'), "Alex Smith");
    change(container.querySelector<HTMLInputElement>('input[type="email"]'), "alex@example.com");
    change(container.querySelector<HTMLInputElement>('input[type="tel"]'), "555-555-1212");

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
    expect(requestBody.stoneSelections).toEqual([
      { itemId: "amazonic-green", stoneName: "Amazonic Green" },
      { itemId: "steel-gray", stoneName: "Steel Gray" },
    ]);
    expect(requestBody).not.toHaveProperty("stoneName");
    expect(requestBody).not.toHaveProperty("itemId");
  });
});
