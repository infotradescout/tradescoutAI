/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DirectConnectPros from "./DirectConnectPros";
import { readStagedDirectConnectEntryContext } from "./stagedDirectConnectEntryContext";

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
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
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
    return client;
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

  it("shows the matched county once when a public provider has only state context", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) {
        return [{
          id: "provider-local",
          name: "Synthetic Local Business",
          stateCode: "AZ",
          canonicalBusinessProfileUrl: "/u/synthetic-local",
        }];
      }
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() =>
      Boolean(container.querySelector('[data-testid="business-result-provider-local"]'))
    );
    const row = container.querySelector<HTMLButtonElement>(
      '[data-testid="business-result-provider-local"]'
    );
    expect(row?.textContent).toContain("Listed for Maricopa County, AZ");
    expect(row?.textContent?.match(/Listed for Maricopa County, AZ/g)).toHaveLength(1);
    expect(row?.textContent).not.toContain("Local service area");
    await act(async () => row?.click());
    const inspector = container.querySelector('[data-testid="business-workspace-inspector"]');
    const resultsList = container.querySelector('[data-testid="business-results-list"]');
    expect(inspector?.textContent).toContain(
      "Listed for Maricopa County, AZ"
    );
    expect(Array.from(inspector?.querySelectorAll('a[href="/u/synthetic-local"]') || [])
      .some((link) => link.textContent?.includes("View profile"))).toBe(true);
    expect(resultsList?.classList.contains("hidden")).toBe(true);
    expect(resultsList?.classList.contains("lg:block")).toBe(true);
    expect(resultsList?.querySelectorAll("li")).toHaveLength(1);
    const mobileSubtitle = Array.from(
      container.querySelectorAll<HTMLSpanElement>("span")
    ).find((span) => span.textContent === "View this business’s public profile.");
    expect(mobileSubtitle?.classList.contains("lg:hidden")).toBe(true);
    const desktopSubtitle = Array.from(
      container.querySelectorAll<HTMLSpanElement>("span")
    ).find((span) => span.textContent === "Select a business, then view its public profile.");
    expect(desktopSubtitle?.classList.contains("hidden")).toBe(true);
    expect(desktopSubtitle?.classList.contains("lg:inline")).toBe(true);
    expect(mock.api.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  it("keeps the mobile selection list when more than one public business can be chosen", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) {
        return [
          { id: "provider-one", name: "First Business", canonicalBusinessProfileUrl: "/u/first" },
          { id: "provider-two", name: "Second Business", canonicalBusinessProfileUrl: "/u/second" },
        ];
      }
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() => Boolean(container.querySelector('[data-testid="business-result-provider-two"]')));
    const resultsList = container.querySelector('[data-testid="business-results-list"]');
    expect(resultsList?.classList.contains("hidden")).toBe(false);
    expect(resultsList?.querySelectorAll("li")).toHaveLength(2);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-result-provider-one"]')?.click();
    });
    expect(resultsList?.classList.contains("hidden")).toBe(false);
    expect(Array.from(container.querySelectorAll('[data-testid="business-workspace-inspector"] a[href="/u/first"]'))
      .some((link) => link.textContent?.includes("View profile"))).toBe(true);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-result-provider-two"]')?.click();
    });
    expect(resultsList?.classList.contains("hidden")).toBe(false);
    expect(Array.from(container.querySelectorAll('[data-testid="business-workspace-inspector"] a[href="/u/second"]'))
      .some((link) => link.textContent?.includes("View profile"))).toBe(true);
    expect(mock.api.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  it("offers a working area change after a checked zero-result search", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() => Boolean(container.querySelector('[data-testid="businesses-no-results"]')));
    expect(container.textContent).toContain("No public businesses in Maricopa County, AZ yet.");
    expect(container.querySelector('[data-testid="area-selector"]')).toBeNull();
    const changeArea = container.querySelector<HTMLButtonElement>(
      '[data-testid="businesses-empty-change-area"]'
    );
    expect(changeArea?.textContent).toContain("Change area");
    HTMLElement.prototype.scrollIntoView = vi.fn();
    try {
      await act(async () => changeArea?.click());
      expect(container.querySelector('[data-testid="area-selector"]')).not.toBeNull();
      expect(mock.api.mock.calls.some(([method]) => method === "POST")).toBe(false);
    } finally {
      delete (HTMLElement.prototype as any).scrollIntoView;
    }
  });

  it("keeps a selected public profile through a source error and restores it after Retry", async () => {
    window.history.replaceState({}, "", "/contractors?selected=provider-1");
    let providerChecks = 0;
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) {
        providerChecks += 1;
        if (providerChecks === 1) throw new Error("500: provider search unavailable");
        return [{
          id: "provider-1",
          name: "Selected Public Business",
          canonicalBusinessProfileUrl: "/u/selected-public-business",
        }];
      }
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() => Boolean(container.querySelector('[data-testid="businesses-search-error"]')));
    expect(providerChecks).toBe(1);
    expect(new URLSearchParams(window.location.search).get("selected")).toBe("provider-1");
    expect(container.querySelector('[data-testid="business-workspace-inspector"]')).toBeNull();
    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();

    const retry = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry search")
    );
    if (!retry) throw new Error("The failed search has no retry button");
    await act(async () => retry.click());
    await waitFor(() => Boolean(container.querySelector(
      '[data-testid="business-workspace-inspector"] a[href="/u/selected-public-business"]'
    )));
    const inspector = container.querySelector('[data-testid="business-workspace-inspector"]');
    expect(Array.from(inspector?.querySelectorAll('a[href="/u/selected-public-business"]') || [])
      .some((link) => link.textContent?.includes("View profile"))).toBe(true);
    expect(container.querySelector('[data-testid="business-result-provider-1"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-testid="business-results-list"]')?.classList.contains("hidden")).toBe(true);
    expect(new URLSearchParams(window.location.search).get("selected")).toBe("provider-1");
    expect(container.querySelector('[data-testid="businesses-search-error"]')).toBeNull();
    expect(providerChecks).toBe(2);
    expect(mock.api.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  it("clears a saved selection after a successful search no longer includes that provider", async () => {
    window.history.replaceState({}, "", "/contractors?selected=provider-1");
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) {
        return [{
          id: "provider-2",
          name: "Still Public Business",
          canonicalBusinessProfileUrl: "/u/still-public-business",
        }];
      }
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() => Boolean(container.querySelector('[data-testid="business-result-provider-2"]')));
    await waitFor(() => !new URLSearchParams(window.location.search).has("selected"));
    expect(container.querySelector('[data-testid="business-result-provider-2"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('[data-testid="business-workspace-inspector"]')?.textContent).toContain("Choose a business to inspect");
    expect(container.querySelector('[data-testid="business-workspace-inspector"] a[href="/u/still-public-business"]')).toBeNull();
    expect(container.querySelector('[data-testid="business-results-list"]')?.classList.contains("hidden")).toBe(false);
    expect(container.querySelector('[data-testid="businesses-search-error"]')).toBeNull();
    expect(mock.api.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  it("does not leave a previously checked provider actionable after its same-search refresh fails", async () => {
    let providerChecks = 0;
    let failRefresh: (reason: Error) => void = () => {};
    const pendingRefresh = new Promise<never>((_resolve, reject) => {
      failRefresh = reject;
    });
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) {
        providerChecks += 1;
        if (providerChecks === 1) return [{ id: "provider-1", name: "Previously Checked Co" }];
        if (providerChecks === 2) return pendingRefresh;
        return [{ id: "provider-2", name: "Rechecked Co" }];
      }
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    const client = await mount();
    await waitFor(() => Boolean(container.querySelector('[data-testid="business-result-provider-1"]')));
    let refetch: Promise<void> | undefined;
    await act(async () => {
      refetch = client.invalidateQueries({ queryKey: ["/api/business-providers/search"] });
    });
    await waitFor(() => providerChecks === 2);
    expect(container.textContent).toContain("Checking local businesses");
    expect(container.querySelector('[data-testid="business-result-provider-1"]')).toBeNull();

    await act(async () => {
      failRefresh(new Error("provider refresh unavailable"));
      await refetch;
    });
    await waitFor(() => Boolean(container.querySelector('[data-testid="businesses-search-error"]')));

    expect(providerChecks).toBe(2);
    expect(container.querySelector('[data-testid="business-result-provider-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();

    const retry = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry search")
    );
    if (!retry) throw new Error("The failed search has no retry button");
    await act(async () => retry.click());
    await waitFor(() => Boolean(container.querySelector('[data-testid="business-result-provider-2"]')));
    expect(providerChecks).toBe(3);
  });

  it("does not show a cached directory listing after its same-search refresh fails", async () => {
    let directoryChecks = 0;
    let providerChecks = 0;
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) {
        providerChecks += 1;
        return providerChecks === 1 ? [] : [{ id: "provider-3", name: "Fresh Provider Co" }];
      }
      if (path.startsWith("/api/businesses?")) {
        const url = new URL(path, "https://example.test");
        if (!url.searchParams.has("countyFips")) return { items: [] };
        directoryChecks += 1;
        if (directoryChecks === 1)
          return { items: [{ id: "listing-1", name: "Previously Listed Co", slug: "previously-listed" }] };
        throw new Error("directory refresh unavailable");
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const client = await mount();
    await waitFor(() => container.textContent?.includes("Previously Listed Co") || false);
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["/api/businesses", "public-directory-fallback"] });
    });
    await waitFor(() => Boolean(container.querySelector('[data-testid="businesses-search-error"]')));

    expect(directoryChecks).toBe(2);
    expect(container.textContent).not.toContain("Previously Listed Co");
    expect(container.querySelector('[data-testid="businesses-no-results"]')).toBeNull();
    expect(container.querySelector('[data-testid="businesses-state-fallback-loading"]')).toBeNull();
    expect(container.textContent).not.toContain("checking more listings");
    expect(container.textContent).toContain("Local business results are incomplete");
    expect(container.textContent).not.toContain("0 matching public profiles");
    expect(mock.api.mock.calls.some(([_method, path]) =>
      typeof path === "string" && path.startsWith("/api/businesses?") &&
      !new URL(path, "https://example.test").searchParams.has("countyFips")
    )).toBe(false);

    await act(async () => {
      await client.invalidateQueries({ queryKey: ["/api/business-providers/search"] });
    });
    await waitFor(() => Boolean(container.querySelector('[data-testid="business-result-provider-3"]')));
    expect(container.querySelector('[data-testid="businesses-search-error"]')).toBeNull();
  });

  it("opens a county-scoped request draft only after a checked empty result", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() =>
      Boolean(container.querySelector('[data-testid="businesses-empty-request"]'))
    );
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="businesses-empty-request"]')?.click();
    });

    expect(window.location.pathname).toBe("/direct-connect/post");
    const params = new URLSearchParams(window.location.search);
    expect(params.get("source")).toBe("businesses_empty");
    expect(params.get("staged")).toMatch(/^[a-f0-9]{64}$/);
    expect(params.has("county")).toBe(false);
    expect(params.has("countyFips")).toBe(false);
    expect(readStagedDirectConnectEntryContext(window.location.href)).toMatchObject({
      countyFips: "04013",
      stateCode: "AZ",
      source: "businesses_empty",
    });
    expect(mock.api.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  it("keeps the user on Businesses when the county handoff cannot be staged", async () => {
    mock.api.mockImplementation(async (_method: string, path: string) => {
      if (path === "/api/trades") return [];
      if (path.startsWith("/api/business-providers/search")) return [];
      if (path.startsWith("/api/businesses?")) return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    await mount();
    await waitFor(() =>
      Boolean(container.querySelector('[data-testid="businesses-empty-request"]'))
    );
    const storageWrite = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-testid="businesses-empty-request"]')?.click();
      });
    } finally {
      storageWrite.mockRestore();
    }

    expect(window.location.pathname).toBe("/contractors");
    expect(container.querySelector('[data-testid="businesses-draft-handoff-error"]')).not.toBeNull();
    expect(mock.api.mock.calls.some(([method]) => method === "POST")).toBe(false);

    await searchFor("roofing");
    await waitFor(() =>
      Boolean(container.querySelector('[data-testid="businesses-no-results"]'))
    );
    expect(container.querySelector('[data-testid="businesses-draft-handoff-error"]')).toBeNull();
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
    expect(container.textContent).toContain("Checking local businesses");
    expect(container.textContent).not.toContain("0 matching public profiles");

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
