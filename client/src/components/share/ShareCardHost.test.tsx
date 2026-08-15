// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHARE_CARD_EVENT, type ShareCardPayload } from "@/utils/share";
import { ShareCardHost } from "./ShareCardHost";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

describe("ShareCardHost clipboard recovery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.toast.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ShareCardHost />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders the exact URL as selectable text when clipboard access is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("Blocked", "NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const payload: ShareCardPayload = {
      url: "https://www.thetradescout.com/u/steel-home-packages/builders/countertops?studio=abc123",
      title: "Countertop Studio",
      text: "Shared countertop design",
      contextLabel: "Studio link",
      kind: "page",
      sourceName: "TradeScout",
    };

    act(() => {
      window.dispatchEvent(new CustomEvent<ShareCardPayload>(SHARE_CARD_EVENT, { detail: payload }));
    });
    const copy = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Copy"
    );
    if (!copy) throw new Error("Share card copy action missing");

    await act(async () => {
      copy.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(payload.url);
    const recovery = document.body.querySelector<HTMLElement>(
      '[data-testid="share-copy-recovery"]'
    );
    const recoveryUrl = document.body.querySelector<HTMLTextAreaElement>(
      '[data-testid="share-copy-recovery-url"]'
    );
    expect(recovery?.getAttribute("role")).toBe("status");
    expect(recovery?.textContent).toContain("Select and copy this link");
    expect(recoveryUrl?.readOnly).toBe(true);
    expect(recoveryUrl?.value).toBe(payload.url);

    const select = vi.fn();
    if (!recoveryUrl) throw new Error("Manual copy URL missing");
    recoveryUrl.select = select;
    act(() => recoveryUrl.focus());
    expect(select).toHaveBeenCalledOnce();
  });
});
