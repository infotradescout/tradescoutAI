import { describe, expect, it } from "vitest";
import { BoundedConcurrencyGate } from "../utils/boundedConcurrency";
import { BoundedTaskQueue } from "../utils/boundedTaskQueue";

describe("production incident concurrency model", () => {
  it("holds a 20-job scheduler burst to two active jobs without dropping distinct jobs", async () => {
    const gate = new BoundedConcurrencyGate({ maxConcurrent: 2, maxQueued: 32 });
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        gate.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 1));
          active -= 1;
          return index;
        })
      )
    );

    expect(peak).toBe(2);
    expect(results.every((result) => result.accepted)).toBe(true);
    expect(gate.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });

  it("serializes a 100-event crawler burst into one low-priority database lane", async () => {
    const queue = new BoundedTaskQueue({
      maxConcurrent: 1,
      maxOutstanding: 100,
      maxRetries: 2,
    });
    let active = 0;
    let peak = 0;
    for (let index = 0; index < 100; index += 1) {
      expect(
        queue.enqueue(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await Promise.resolve();
          active -= 1;
        })
      ).toBe(true);
    }
    await queue.whenIdle();

    expect(peak).toBe(1);
    expect(queue.snapshot()).toMatchObject({
      completed: 100,
      failed: 0,
      dropped: 0,
      active: 0,
      queued: 0,
    });
  });
});
