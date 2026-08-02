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

async function submitAudienceRequest(args: {
  root: Root;
  container: HTMLDivElement;
  fetchMock: ReturnType<typeof vi.fn>;
  mode: "materials" | "auto_glass" | "service";
  audienceLabel: string;
  audienceSummary: string;
  stoneName?: string;
}) {
  vi.stubGlobal("fetch", args.fetchMock);
  act(() => {
    args.root.render(
      <ExpressDirectConnectPanel
        open
        onClose={vi.fn()}
        profileSlug="jw-stone"
        businessName="JW Stone"
        hasViewerSession={false}
        allowCall={false}
        requestMode={args.mode}
        initialStoneName={args.stoneName}
        initialAudienceContext={{
          label: args.audienceLabel,
          summary: args.audienceSummary,
        }}
      />
    );
  });

  const choiceContext = args.container.querySelector(
    '[data-testid="express-audience-context"]'
  );
  expect(choiceContext?.textContent).toContain(args.audienceLabel);
  expect(choiceContext?.textContent).toContain(args.audienceSummary);

  const formChoice = Array.from(args.container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("Fill out the form")
  );
  click(formChoice || null);

  const requestContext = args.container.querySelector(
    '[data-testid="express-audience-context"]'
  );
  expect(requestContext?.textContent).toContain(args.audienceLabel);
  expect(requestContext?.textContent).toContain(
    "This context will stay attached to your private request."
  );

  change(
    args.container.querySelector<HTMLInputElement>('input[autocomplete="name"]'),
    "Alex Smith"
  );
  change(
    args.container.querySelector<HTMLInputElement>('input[type="email"]'),
    "alex@example.com"
  );
  change(
    args.container.querySelector<HTMLInputElement>('input[type="tel"]'),
    "555-555-1212"
  );
  change(
    args.container.querySelector<HTMLTextAreaElement>("textarea"),
    "Please help me plan the right stone order."
  );

  await act(async () => {
    args.container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });

  return JSON.parse(String(args.fetchMock.mock.calls[0]?.[1]?.body || "{}"));
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

  it.each([
    ["materials", "Fabricators & Builders", "Bundles and production timing come first."],
    [
      "auto_glass",
      "Architects & Designers",
      "Trending, popular, and rare selections come first.",
    ],
    ["service", "Homeowners", "Color comes first."],
  ] as const)(
    "shows and submits selected audience context through the %s request form",
    async (mode, audienceLabel, audienceSummary) => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          requestId: "request-context",
          onboardingEmailStatus: "skipped",
          deliveryCustody: "business",
        }),
      });

      const requestBody = await submitAudienceRequest({
        root,
        container,
        fetchMock,
        mode,
        audienceLabel,
        audienceSummary,
      });

      expect(requestBody.message).toBe(
        `Project path: ${audienceLabel}\nSelected context: ${audienceSummary}\n\nPlease help me plan the right stone order.`
      );
    }
  );

  it("preserves selected audience context alongside a material-specific request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        requestId: "request-material-context",
        onboardingEmailStatus: "skipped",
        deliveryCustody: "business",
      }),
    });

    const requestBody = await submitAudienceRequest({
      root,
      container,
      fetchMock,
      mode: "materials",
      audienceLabel: "Distributors",
      audienceSummary: "Container orders come first.",
      stoneName: "Silver Travertine",
    });

    expect(requestBody).toMatchObject({
      stoneName: "Silver Travertine",
      requestType: "request_material",
      message:
        "Project path: Distributors\nSelected context: Container orders come first.\n\nPlease help me plan the right stone order.",
    });
  });
});
