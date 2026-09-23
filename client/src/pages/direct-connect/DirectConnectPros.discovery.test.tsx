/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DirectConnectPros from "./DirectConnectPros";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mock = vi.hoisted(() => ({
  api: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mock.api(...args) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));
vi.mock("@/hooks/useLocationContext", () => ({
  useLocationContext: () => ({
    stateCode: "AZ",
    countyFips: "04013",
    countyName: "Maricopa County",
  }),
  hasLocalContext: () => true,
  setSessionLocationOverride: vi.fn(),
}));
vi.mock("@/components/state-county-selector", () => ({
  StateCountySelector: () => <div data-testid="area-selector" />,
}));
vi.mock("@/components/contractor-card", () => ({ ProviderCard: () => null }));
vi.mock("./DirectoryListingLink", () => ({
  DirectoryListingLink: ({ businessName }: { businessName: string }) => (
    <span>Open {businessName}</span>
  ),
}));

const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (predicate()) return;
  }
  throw new Error("Timed out waiting for Businesses page state");
};

describe("Businesses discovery states", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mock.api.mockReset();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/contractors");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const mount = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DirectConnectPros />
        </QueryClientProvider>
      );
    });
  };

  const searchFor = async (value: string) => {
    await waitFor(() =>
      Boolean(container.querySelector('[data-testid="businesses-workspace-search"]'))
    );
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="businesses-workspace-search"]'
    );
    if (!input) throw new Error("Businesses search input is missing");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("Input value setter is missing");
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("shows a failed provider request as an error rather than claiming no businesses exist", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search"))
        throw new Error("provider unavailable");
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() =>
      Boolean(container.querySelector('[data-testid="businesses-search-error"]'))
    );

    expect(container.textContent).toContain("We couldn’t finish checking local businesses");
    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();
  });

  it("waits for public directory listings before declaring the county empty", async () => {
    let finishDirectory!: (value: {
      items: Array<{ id: string; name: string; slug: string }>;
    }) => void;
    const directory = new Promise<{ items: Array<{ id: string; name: string; slug: string }> }>(
      (resolve) => {
        finishDirectory = resolve;
      }
    );
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return directory;
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() =>
      mock.api.mock.calls.some(([, path]) => String(path).startsWith("/api/businesses?"))
    );
    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();

    await act(async () =>
      finishDirectory({ items: [{ id: "local-1", name: "Acme Services", slug: "acme-services" }] })
    );
    await waitFor(() => container.textContent?.includes("Acme Services") || false);

    expect(container.textContent).toContain("1 additional local listing");
    expect(container.textContent).not.toContain("Not verified");
    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();
  });

  it("searches plumber as a trade without requiring that word in each business name", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [{ id: "trade-1", name: "Plumbing", slug: "plumbing" }];
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await searchFor("plumber");
    await waitFor(() =>
      mock.api.mock.calls.some(([, path]) => String(path).includes("trade=plumbing"))
    );

    const providerUrl = mock.api.mock.calls
      .map(([, path]) => String(path))
      .find(
        (path) =>
          path.startsWith("/api/business-providers/search") && path.includes("trade=plumbing")
      )!;
    expect(new URL(providerUrl, "https://example.test").searchParams.has("query")).toBe(false);
  });

  it("does not turn a partial trade word into an exclusive trade filter", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades")
        return [{ id: "trade-2", name: "Custom Home Builder", slug: "custom-home-builder" }];
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await searchFor("home");
    await waitFor(() =>
      mock.api.mock.calls.some(([, path]) => String(path).includes("query=home"))
    );

    const providerUrl = mock.api.mock.calls
      .map(([, path]) => String(path))
      .find(
        (path) => path.startsWith("/api/business-providers/search") && path.includes("query=home")
      );
    if (!providerUrl) throw new Error("Name search was not sent");
    expect(new URL(providerUrl, "https://example.test").searchParams.has("trade")).toBe(false);
  });

  it("does not claim an empty trade search when the trade list failed to load", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") throw new Error("trades unavailable");
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await searchFor("plumber");
    await waitFor(
      () => container.textContent?.includes("We couldn’t check trade matches") || false
    );

    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();
  });

  it("keeps the trade search pending until its trade list has loaded", async () => {
    let finishTrades!: (value: Array<{ id: string; name: string; slug: string }>) => void;
    const trades = new Promise<Array<{ id: string; name: string; slug: string }>>((resolve) => {
      finishTrades = resolve;
    });
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return trades;
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await searchFor("plumber");
    await waitFor(() => container.textContent?.includes("Checking trade matches") || false);
    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();

    await act(async () => finishTrades([{ id: "trade-1", name: "Plumbing", slug: "plumbing" }]));
    await waitFor(() =>
      mock.api.mock.calls.some(([, path]) => String(path).includes("trade=plumbing"))
    );
  });

  it("labels the state fallback without claiming it excludes the selected county", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) {
        const url = new URL(path, "https://example.test");
        return url.searchParams.has("countyFips")
          ? { items: [] }
          : { items: [{ id: "state-1", name: "Statewide Services", slug: "statewide-services" }] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() => container.textContent?.includes("Statewide Services") || false);

    expect(container.textContent).toContain("Additional results in AZ");
    expect(container.textContent).not.toContain("elsewhere in the state");
  });
});
