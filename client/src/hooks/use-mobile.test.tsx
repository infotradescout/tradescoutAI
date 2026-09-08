// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("canonical mobile viewport hook", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let listeners: Set<() => void>;
  let rendered: boolean[];
  let matchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    listeners = new Set();
    rendered = [];
    matchMedia = vi.fn(() => ({
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }));
    vi.stubGlobal("matchMedia", matchMedia);
  });

  afterEach(() => {
    act(() => root.unmount());
    expect(listeners.size).toBe(0);
    container.remove();
    vi.unstubAllGlobals();
  });

  function Viewport({ breakpoint }: { breakpoint?: number }) {
    const mobile = useIsMobile(breakpoint);
    rendered.push(mobile);
    return <div>{mobile ? "mobile" : "desktop"}</div>;
  }

  it.each([
    [390, true],
    [767, true],
    [768, false],
    [1440, false],
  ])("chooses the correct first render at width %s without a desktop flash", (width, mobile) => {
    vi.stubGlobal("innerWidth", width);
    act(() => root.render(<Viewport />));
    expect(rendered[0]).toBe(mobile);
    expect(container.textContent).toBe(mobile ? "mobile" : "desktop");
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("updates across both sides of the breakpoint and removes its subscription", () => {
    vi.stubGlobal("innerWidth", 1024);
    act(() => root.render(<Viewport />));
    expect(listeners.size).toBe(1);
    vi.stubGlobal("innerWidth", 500);
    act(() => listeners.forEach((listener) => listener()));
    expect(container.textContent).toBe("mobile");
    vi.stubGlobal("innerWidth", 900);
    act(() => listeners.forEach((listener) => listener()));
    expect(container.textContent).toBe("desktop");
  });

  it("retains the optional breakpoint and replaces the subscription when it changes", () => {
    vi.stubGlobal("innerWidth", 900);
    act(() => root.render(<Viewport breakpoint={1000} />));
    expect(container.textContent).toBe("mobile");
    act(() => root.render(<Viewport breakpoint={600} />));
    expect(container.textContent).toBe("desktop");
    expect(listeners.size).toBe(1);
    expect(matchMedia).toHaveBeenLastCalledWith("(max-width: 599px)");
  });
});
