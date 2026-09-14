// @vitest-environment jsdom

import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_NAMED_CATALOG } from "./catalog";
import { WishlistPanel } from "./WishlistPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function panelRoot(): HTMLElement {
  return document.body;
}

describe("WishlistPanel email copy", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  const stone = JW_STONE_NAMED_CATALOG[0];

  beforeEach(() => {
    window.localStorage.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["/api/auth/user"], null);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ sent: true, stoneCount: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.querySelectorAll("[data-radix-portal], [role='dialog']").forEach((node) => {
      node.parentElement?.removeChild(node);
    });
    vi.unstubAllGlobals();
  });

  it("hides the email control when nothing is saved", () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <WishlistPanel
            open
            items={[]}
            restored
            persisted
            onOpenChange={vi.fn()}
            onRemove={vi.fn()}
            onClear={vi.fn()}
            onOpenStone={vi.fn()}
            onAsk={vi.fn()}
          />
        </QueryClientProvider>
      );
    });

    expect(panelRoot().textContent).toContain("Nothing saved yet");
    expect(panelRoot().textContent).toContain(
      "Save an inventory lot from New Arrivals or bookmark a named catalog stone."
    );
    expect(panelRoot().textContent).toContain("Saving does not notify JW Stone or reserve stock.");
    expect(panelRoot().textContent).not.toContain("Your selection is open");
    expect(
      Array.from(panelRoot().querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Email my saved catalog stones")
      )
    ).toBeUndefined();
    expect(
      Array.from(panelRoot().querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Continue exploring")
      )
    ).toBeTruthy();
  });

  it("requires email before sending and posts only the saved named stones", async () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <WishlistPanel
            open
            items={[stone]}
            restored
            persisted
            onOpenChange={vi.fn()}
            onRemove={vi.fn()}
            onClear={vi.fn()}
            onOpenStone={vi.fn()}
            onAsk={vi.fn()}
          />
        </QueryClientProvider>
      );
    });

    const emailButton = Array.from(panelRoot().querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Email my saved catalog stones")
    );
    expect(emailButton).toBeTruthy();
    expect((emailButton as HTMLButtonElement).disabled).toBe(true);

    const input = panelRoot().querySelector<HTMLInputElement>("#jw-saved-stones-email");
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "collector@example.com");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const enabledButton = Array.from(panelRoot().querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Email my saved catalog stones")
    ) as HTMLButtonElement | undefined;
    expect(enabledButton?.disabled).toBe(false);
    await act(async () => {
      click(enabledButton!);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/jw-stone/saved-stones/email",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("collector@example.com"),
      })
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.stones).toEqual([
      {
        name: stone.displayName || stone.publicLabel,
        shareSlug: stone.shareSlug,
      },
    ]);
    expect(panelRoot().textContent).toContain("Sent. Check your inbox for the catalog list.");
  });

  it("prefills a known account email", () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <WishlistPanel
            open
            items={[stone]}
            restored
            persisted
            knownEmail="member@example.com"
            onOpenChange={vi.fn()}
            onRemove={vi.fn()}
            onClear={vi.fn()}
            onOpenStone={vi.fn()}
            onAsk={vi.fn()}
          />
        </QueryClientProvider>
      );
    });

    const input = panelRoot().querySelector<HTMLInputElement>("#jw-saved-stones-email");
    expect(input?.value).toBe("member@example.com");
    const emailButton = Array.from(panelRoot().querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Email my saved catalog stones")
    );
    expect((emailButton as HTMLButtonElement).disabled).toBe(false);
  });
});
