import { describe, expect, it, vi } from "vitest";
import { registerQueryCacheLowMemoryLifecycle } from "./browserLifecycle";

describe("query cache browser lifecycle", () => {
  it("is inert when imported without a browser target", () => {
    const cache = { clear: vi.fn() };

    expect(() => registerQueryCacheLowMemoryLifecycle(cache, null)).not.toThrow();
    expect(cache.clear).not.toHaveBeenCalled();
  });

  it("clears on low-memory and unregisters the exact listener", () => {
    const listeners = new Map<string, EventListener>();
    const target = {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener);
      }),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        if (listeners.get(type) === listener) listeners.delete(type);
      }),
    };
    const cache = { clear: vi.fn() };

    const unregister = registerQueryCacheLowMemoryLifecycle(cache, target);
    listeners.get("lowMemory")?.(new Event("lowMemory"));
    expect(cache.clear).toHaveBeenCalledTimes(1);

    unregister();
    expect(listeners.has("lowMemory")).toBe(false);
    expect(target.removeEventListener).toHaveBeenCalledWith(
      "lowMemory",
      target.addEventListener.mock.calls[0][1]
    );
  });
});
