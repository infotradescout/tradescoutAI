import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileRequestDecisionCleanupWorker } from "../services/profileRequestDecisionCleanupWorker";

describe("ProfileRequestDecisionCleanupWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function silentLogger() {
    return {
      info: vi.fn(),
      error: vi.fn(),
    };
  }

  it("drains on startup, on its interval, and stops the interval", async () => {
    const drainExpired = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const worker = new ProfileRequestDecisionCleanupWorker(
      { drainExpired },
      { intervalMs: 1_000, logger: silentLogger() }
    );

    await expect(worker.start()).resolves.toBe(3);
    expect(drainExpired).toHaveBeenCalledWith({ batchSize: 200, maxBatches: 100 });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(drainExpired).toHaveBeenCalledTimes(2);

    await worker.stop({ drain: false });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(drainExpired).toHaveBeenCalledTimes(2);
  });

  it("never overlaps drains and performs a final shutdown drain", async () => {
    let releaseStartup!: (deleted: number) => void;
    const startupDrain = new Promise<number>((resolve) => {
      releaseStartup = resolve;
    });
    const drainExpired = vi.fn().mockReturnValueOnce(startupDrain).mockResolvedValueOnce(1);
    const worker = new ProfileRequestDecisionCleanupWorker(
      { drainExpired },
      { intervalMs: 1_000, logger: silentLogger() }
    );

    const started = worker.start();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(drainExpired).toHaveBeenCalledTimes(1);

    releaseStartup(4);
    await expect(started).resolves.toBe(4);
    await expect(worker.stop()).resolves.toBe(1);
    expect(drainExpired).toHaveBeenCalledTimes(2);
  });

  it("contains cleanup errors so retention maintenance cannot crash the app", async () => {
    const log = silentLogger();
    const worker = new ProfileRequestDecisionCleanupWorker(
      { drainExpired: vi.fn().mockRejectedValue(new Error("database unavailable")) },
      { intervalMs: 1_000, logger: log }
    );

    await expect(worker.start()).resolves.toBe(0);
    expect(log.error).toHaveBeenCalledWith(
      "[profile-request-decision] expired proof cleanup failed",
      expect.objectContaining({ reason: "startup" })
    );
    await worker.stop({ drain: false });
  });
});
