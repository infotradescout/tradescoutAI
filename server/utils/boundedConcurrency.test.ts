import { describe, expect, it } from "vitest";
import { BoundedConcurrencyGate } from "./boundedConcurrency";

describe("BoundedConcurrencyGate", () => {
  it("bounds active work and rejects work beyond the queue limit", async () => {
    const gate = new BoundedConcurrencyGate({ maxConcurrent: 1, maxQueued: 1 });
    const started: number[] = [];
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let markFirstStarted!: () => void;
    let markSecondStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => (markFirstStarted = resolve));
    const secondStarted = new Promise<void>((resolve) => (markSecondStarted = resolve));

    const first = gate.run(async () => {
      started.push(1);
      markFirstStarted();
      await new Promise<void>((resolve) => (releaseFirst = resolve));
      return 1;
    });
    await firstStarted;
    const second = gate.run(async () => {
      started.push(2);
      markSecondStarted();
      await new Promise<void>((resolve) => (releaseSecond = resolve));
      return 2;
    });
    const third = await gate.run(async () => 3);

    expect(third).toEqual({ accepted: false });
    expect(started).toEqual([1]);
    expect(gate.snapshot()).toMatchObject({ active: 1, queued: 1 });

    releaseFirst();
    await secondStarted;
    expect(started).toEqual([1, 2]);
    releaseSecond();

    await expect(first).resolves.toEqual({ accepted: true, value: 1 });
    await expect(second).resolves.toEqual({ accepted: true, value: 2 });
    expect(gate.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });
});
