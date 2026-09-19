import { afterEach, describe, expect, it, vi } from "vitest";
import { startJwStoneCartHoldExpiry } from "../services/jwStoneCartHoldWorker";

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("JW Stone cart hold expiry worker", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs immediately, repeats on the interval, and stops cleanly", async () => {
    vi.useFakeTimers();
    const expireDueSellers = vi.fn(async () => ({ expired: 0, failedSellers: 0 }));
    const stop = startJwStoneCartHoldExpiry({ expireDueSellers } as any, 1_000);

    await flush();
    expect(expireDueSellers).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(expireDueSellers).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();
    expect(expireDueSellers).toHaveBeenCalledTimes(2);
  });

  it("never overlaps seller expiry passes", async () => {
    vi.useFakeTimers();
    let finishFirst!: (value: { expired: number; failedSellers: number }) => void;
    const first = new Promise<{ expired: number; failedSellers: number }>((resolve) => {
      finishFirst = resolve;
    });
    const expireDueSellers = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue({ expired: 0, failedSellers: 0 });
    const stop = startJwStoneCartHoldExpiry({ expireDueSellers } as any, 1_000);

    await flush();
    expect(expireDueSellers).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(expireDueSellers).toHaveBeenCalledTimes(1);

    finishFirst({ expired: 0, failedSellers: 0 });
    await flush();
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(expireDueSellers).toHaveBeenCalledTimes(2);

    stop();
  });
});
