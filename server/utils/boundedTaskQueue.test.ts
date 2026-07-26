import { describe, expect, it } from "vitest";
import { BoundedTaskQueue } from "./boundedTaskQueue";

describe("BoundedTaskQueue", () => {
  it("caps outstanding work and never exceeds configured concurrency", async () => {
    const queue = new BoundedTaskQueue({ maxConcurrent: 1, maxOutstanding: 2 });
    let active = 0;
    let peak = 0;
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let markSecondStarted!: () => void;
    const secondStarted = new Promise<void>((resolve) => (markSecondStarted = resolve));
    const firstTask = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => (releaseFirst = resolve));
      active -= 1;
    };
    const secondTask = async () => {
      active += 1;
      peak = Math.max(peak, active);
      markSecondStarted();
      await new Promise<void>((resolve) => (releaseSecond = resolve));
      active -= 1;
    };

    expect(queue.enqueue(firstTask)).toBe(true);
    expect(queue.enqueue(secondTask)).toBe(true);
    expect(queue.enqueue(async () => undefined)).toBe(false);
    expect(queue.snapshot()).toMatchObject({ active: 1, queued: 1, dropped: 1 });

    releaseFirst();
    await secondStarted;
    releaseSecond();
    await queue.whenIdle();

    expect(peak).toBe(1);
    expect(queue.snapshot()).toMatchObject({ completed: 2, failed: 0 });
  });

  it("retries only transient failures with bounded backoff", async () => {
    let attempts = 0;
    const queue = new BoundedTaskQueue({
      maxConcurrent: 1,
      maxOutstanding: 2,
      maxRetries: 2,
      baseBackoffMs: 0,
      shouldRetry: (error) => (error as { code?: string }).code === "ETIMEDOUT",
    });

    queue.enqueue(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("connection timeout"), { code: "ETIMEDOUT" });
      }
    });
    await queue.whenIdle();

    expect(attempts).toBe(2);
    expect(queue.snapshot()).toMatchObject({ retried: 1, completed: 1, failed: 0 });
  });
});
