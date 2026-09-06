// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import JWStoneMarketplace from "./JWStoneMarketplace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@/lib/queryClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/queryClient")>()),
  apiRequest: vi.fn().mockResolvedValue({ items: [] }),
}));

describe("JW Stone hydrated origin metadata", () => {
  it.each(["/u/jw-stone", ""])(
    "preserves Honey Onyx origin on %s stone and collection routes",
    async (base) => {
      window.history.replaceState(null, "", `${base}/stones/honey-onyx`);
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const meta = (name: string, attribute = "name") =>
        document.querySelector(`meta[${attribute}="${name}"]`)?.getAttribute("content");
      try {
        await act(async () => {
          root.render(
            <QueryClientProvider client={client}>
              <JWStoneMarketplace />
            </QueryClientProvider>
          );
        });
        expect(document.title).toContain("Honey Onyx from Iran");
        expect(meta("og:title", "property")).toBe("Honey Onyx from Iran | JW Stone Logistics");
        expect(meta("twitter:title")).toBe("Honey Onyx from Iran | JW Stone Logistics");
        expect(meta("description")).toContain("Country of origin: Iran.");
        expect(meta("description")).toContain("Thickness: 2 cm.");
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
          "Country of originIran"
        );

        await act(async () => {
          window.history.pushState(null, "", `${base}/materials/onyx`);
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
        expect(meta("description")).toContain("Country of origin: Iran.");
        expect(meta("og:title", "property")).toBe("Onyx slabs | JW Stone Logistics");

        await act(async () => {
          window.history.pushState(null, "", `${base}/stones/black-dunes`);
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
        expect(meta("description")).not.toContain("Iran");
        expect(meta("og:title", "property")).not.toContain("Iran");
      } finally {
        await act(async () => root.unmount());
        client.clear();
        container.remove();
      }
    }
  );
});
