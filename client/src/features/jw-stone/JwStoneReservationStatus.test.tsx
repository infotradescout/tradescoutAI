// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JwStoneReservationStatus } from "./JwStoneReservationStatus";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/queryClient")>()),
  apiRequest: api,
}));

const reservationId = `jwh_${"c".repeat(32)}`;
const activeHold = {
  reservationId,
  status: "active" as const,
  expiresAt: "2026-09-17T21:30:00.000Z",
  serverTime: "2026-09-17T21:00:00.000Z",
  totalSlabs: 2,
  lines: [
    {
      inventoryPublicId: `stone_${"d".repeat(32)}`,
      materialName: "Honey Onyx",
      quantity: 2,
    },
  ],
};

async function eventually(check: () => void) {
  let failure: unknown;
  for (let i = 0; i < 60; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      check();
      return;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

function clickByText(text: string) {
  const target = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === text
  );
  if (!target) throw new Error(`Missing button: ${text}`);
  act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("JW Stone owned reservation status", () => {
  let root: Root;
  let host: HTMLDivElement;
  let client: QueryClient;
  let released = false;

  beforeEach(() => {
    released = false;
    api.mockReset();
    api.mockImplementation(async (url: string, options?: any) => {
      if (url.endsWith("/active")) {
        return { viewerId: "member-a", hold: released ? null : activeHold };
      }
      if (url.endsWith(`/${reservationId}/release`)) {
        expect(options).toMatchObject({ method: "POST", data: {} });
        released = true;
        return { reservationId, status: "released" };
      }
      throw new Error("Unexpected API request: " + url);
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <JwStoneReservationStatus viewerId="member-a" onContact={vi.fn()} />
        </QueryClientProvider>
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it("requires explicit confirmation before releasing and sends no payment data", async () => {
    await eventually(() =>
      expect(document.body.textContent).toContain("Your temporary stock reservation")
    );

    clickByText("Release reservation");
    expect(
      api.mock.calls.filter(([url]) => String(url).endsWith("/release"))
    ).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "Release these slabs back to available stock now?"
    );

    clickByText("Confirm release");
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-owned-reservation-status"]')).toBeNull()
    );

    const releaseCalls = api.mock.calls.filter(([url]) => String(url).endsWith("/release"));
    expect(releaseCalls).toHaveLength(1);
    expect(JSON.stringify(releaseCalls[0]?.[1]?.data)).not.toMatch(/payment|card|checkout|price/i);
  });
});
