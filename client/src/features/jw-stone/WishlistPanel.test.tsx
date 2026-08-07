// @vitest-environment jsdom

import { act } from "react";
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
  const stone = JW_STONE_NAMED_CATALOG[0];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ sent: true, stoneCount: 1 }),
      }))
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.querySelectorAll("[data-radix-portal], [role='dialog']").forEach((node) => {
      node.parentElement?.removeChild(node);
    });
    vi.unstubAllGlobals();
  });

  it("hides the email control when nothing is saved", () => {
    act(() => {
      root.render(
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
      );
    });

    expect(panelRoot().textContent).toContain("Nothing saved yet");
    expect(panelRoot().textContent).toContain(
      "Bookmark any named stone from the collection to see it here."
    );
    expect(panelRoot().textContent).toContain("JW Stone isn’t notified until you Ask.");
    expect(panelRoot().textContent).not.toContain("Your selection is open");
    expect(
      Array.from(panelRoot().querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Email my saved stones")
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
      );
    });

    const emailButton = Array.from(panelRoot().querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Email my saved stones")
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
      button.textContent?.includes("Email my saved stones")
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
    expect(panelRoot().textContent).toContain("Sent. Check your inbox for the list.");
  });

  it("prefills a known account email", () => {
    act(() => {
      root.render(
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
      );
    });

    const input = panelRoot().querySelector<HTMLInputElement>("#jw-saved-stones-email");
    expect(input?.value).toBe("member@example.com");
    const emailButton = Array.from(panelRoot().querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Email my saved stones")
    );
    expect((emailButton as HTMLButtonElement).disabled).toBe(false);
  });
});
