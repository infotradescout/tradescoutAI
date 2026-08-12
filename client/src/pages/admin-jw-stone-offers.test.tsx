// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminJwStoneOffersPage from "./admin-jw-stone-offers";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const queueOffer = {
  id: "offer-1",
  status: "submitted",
  amountDisplay: "$12,500.00",
  submittedAt: "2026-08-12T01:00:00.000Z",
  target: {
    id: "container-1",
    type: "container",
    label: "Verified container",
  },
  maskedContact: {
    email: "p***@example.com",
    phone: "(***) ***-0199",
  },
  containerPriority: {
    position: 1,
    eligibleCount: 3,
  },
  notifications: [
    {
      id: "outbox-1",
      purpose: "offer_confirmation",
      status: "failed",
      attemptCount: 5,
      lastAttemptAt: "2026-08-12T01:20:00.000Z",
      failureSummary: "Provider rejected the redacted destination.",
    },
  ],
  // The queue UI must ignore accidental unmasked fields and use only maskedContact.
  email: "private.person@example.com",
  phone: "+1 555 555 0199",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function flushUi() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

async function waitForAssertion(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }
  }
  throw lastError;
}

describe("restricted JW Stone offer operator UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method || "GET";

      if (url.startsWith("/api/admin/jw-stone/offers?") && method === "GET") {
        return jsonResponse({
          offers: [
            queueOffer,
            {
              ...queueOffer,
              id: "pending-offer",
              status: "pending_verification",
              target: { ...queueOffer.target, label: "Unverified offer" },
            },
          ],
        });
      }
      if (url === "/api/admin/jw-stone/offers/offer-1/review/reveal-contact" && method === "POST") {
        return jsonResponse({
          contact: {
            email: "private.person@example.com",
            phone: "+1 555 555 0199",
          },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AdminJwStoneOffersPage />
        </QueryClientProvider>
      );
    });
  }

  it("renders masked queue data and keeps unverified offers out of operator view", async () => {
    renderPage();
    await waitForAssertion(() => expect(container.textContent).toContain("p***@example.com"));

    expect(container.textContent).toContain("p***@example.com");
    expect(container.textContent).toContain("(***) ***-0199");
    expect(container.textContent).not.toContain("private.person@example.com");
    expect(container.textContent).not.toContain("+1 555 555 0199");
    expect(container.textContent).not.toContain("Unverified offer");
    expect(container.textContent).toContain("Staff-only priority 1 of 3");
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => (init as RequestInit | undefined)?.credentials === "include"
      )
    ).toBe(true);
  });

  it("keeps reveal separate from accept and displays full contact only after reveal succeeds", async () => {
    renderPage();
    await waitForAssertion(() => {
      expect(
        container.querySelector<HTMLButtonElement>('[data-testid="reveal-offer-offer-1"]')
      ).not.toBeNull();
    });

    const reveal = container.querySelector<HTMLButtonElement>(
      '[data-testid="reveal-offer-offer-1"]'
    );
    const accept = container.querySelector<HTMLButtonElement>(
      '[data-testid="accept-offer-offer-1"]'
    );
    expect(reveal).not.toBeNull();
    expect(accept).not.toBeNull();
    expect(reveal).not.toBe(accept);
    expect(container.textContent).not.toContain("private.person@example.com");

    act(() => reveal?.click());
    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-testid="confirm-reveal-offer-offer-1"]'
    );
    expect(confirm).not.toBeNull();
    act(() => confirm?.click());
    await flushUi();

    expect(container.textContent).toContain("private.person@example.com");
    expect(container.textContent).toContain("+1 555 555 0199");
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          requestUrl(input as RequestInfo | URL) ===
            "/api/admin/jw-stone/offers/offer-1/review/reveal-contact" &&
          (init as RequestInit | undefined)?.method === "POST"
      )
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        requestUrl(input as RequestInfo | URL).endsWith("/offer-1/accept")
      )
    ).toBe(false);
  });

  it("keeps competitive language private and exposes the required container controls", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/admin-jw-stone-offers.tsx"),
      "utf8"
    );
    const lowerSource = source.toLowerCase();

    expect(source).toContain("Staff-only priority");
    expect(lowerSource).not.toContain("outbid");
    expect(lowerSource).not.toContain("leaderboard");
    expect(lowerSource).not.toContain("public rank");
    expect(lowerSource).not.toContain("bidder position");
    expect(source).toContain("Create draft container");
    expect(source).toContain("Edit container");
    expect(source).toContain("Publish container");
    expect(source).toContain("Close container");
    expect(source).toContain("Optional public minimum (USD)");
    expect(source).toContain("Accepting offers");
    expect(source).toContain('credentials: "include"');
  });

  it("registers one lazy restricted Admin OS route without moderator visibility", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/admin/adminTools.tsx"),
      "utf8"
    );
    const toolBlock = source.match(
      /id: "jw-stone-offers"[\s\S]*?render: \(\) => <AdminJwStoneOffers \/>/
    )?.[0];

    expect(source).toContain(
      'const AdminJwStoneOffers = React.lazy(() => import("@/pages/admin-jw-stone-offers"));'
    );
    expect(toolBlock).toContain('path: "/admin/jw-stone-offers"');
    expect(toolBlock).toContain('roles: ["ops_admin", "super_admin"]');
    expect(toolBlock).not.toContain("moderator");
  });

  it("keeps the exact JW profile owner route reachable without exposing the broader Admin OS", () => {
    const routes = fs.readFileSync(path.resolve(process.cwd(), "client/src/AppRoutes.tsx"), "utf8");
    const adminShell = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/admin.tsx"),
      "utf8"
    );
    const operatorApi = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/admin-jw-stone-offers.ts"),
      "utf8"
    );
    const ownerRoute = routes.match(
      /<Route path="\/admin\/jw-stone-offers">[\s\S]*?<\/Route>/
    )?.[0];

    expect(ownerRoute).toContain("<ProtectedRoute>");
    expect(ownerRoute).not.toContain("adminOnly");
    expect(adminShell).toContain('["/api/admin/jw-stone/offers/access"]');
    expect(adminShell).toContain(
      "!data?.ok && isJwStoneOfferWorkspace && jwStoneAccess?.authorized"
    );
    expect(adminShell).toContain("<AdminJwStoneOffers />");
    expect(operatorApi).toContain("`${base}/access`");
    expect(operatorApi).toContain('role: "jw_stone_owner"');
  });
});
