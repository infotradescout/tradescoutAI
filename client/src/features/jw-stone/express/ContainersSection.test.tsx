// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContainersSection } from "./ContainersSection";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JW Stone containers", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("shows an honest empty state and never fabricates container cards", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ containers: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<ContainersSection onMakeOffer={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jw-stone/containers",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(host.querySelector('[data-testid="jw-containers-empty"]')?.textContent).toContain(
      "No published containers are available right now."
    );
    expect(host.querySelectorAll('[data-testid="jw-container-card"]')).toHaveLength(0);
  });
});
