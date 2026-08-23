import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  schedulerLeaderRetryIntervalMs,
  startSchedulerLeadershipRetryLoop,
} from "../services/schedulerLeadership";

describe("scheduler leadership retry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a rolling-deploy miss and starts leader jobs exactly once after acquisition", async () => {
    vi.useFakeTimers();
    const acquire = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const onAcquired = vi.fn();
    const onUnavailable = vi.fn();

    const loop = startSchedulerLeadershipRetryLoop({
      acquire,
      onAcquired,
      onUnavailable,
      retryIntervalMs: 1_000,
    });

    await expect(loop.initialAttempt).resolves.toBe(false);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(onAcquired).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(onAcquired).toHaveBeenCalledTimes(1);
    expect(loop.hasLeadership()).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(onAcquired).toHaveBeenCalledTimes(1);
    loop.stop();
  });

  it("stops an outstanding retry and bounds operator configuration", async () => {
    vi.useFakeTimers();
    const acquire = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
    const loop = startSchedulerLeadershipRetryLoop({
      acquire,
      onAcquired: vi.fn(),
      retryIntervalMs: 1_000,
    });
    await loop.initialAttempt;
    loop.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(acquire).toHaveBeenCalledTimes(1);

    expect(schedulerLeaderRetryIntervalMs("1")).toBe(1_000);
    expect(schedulerLeaderRetryIntervalMs("9999999")).toBe(300_000);
    expect(schedulerLeaderRetryIntervalMs("not-a-number")).toBe(15_000);
  });

  it("wires rolling-deploy reacquisition to the real background-job startup exactly once", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");
    const start = source.indexOf("const schedulerEnabled =");
    const end = source.indexOf("if (process.env.SENTRY_DSN)", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = source.slice(start, end);
    expect(block.match(/startSchedulerLeadershipRetryLoop\(\{/g)).toHaveLength(1);
    expect(block).toContain("acquire: acquireSchedulerLeadership");
    expect(block).toMatch(/onAcquired:\s*\(\)\s*=>\s*\{[\s\S]*?enableBackgroundJobsOnce\(\)/);
    expect(block).toContain("stopSchedulerLeadershipRetry = leadershipRetry.stop");
    expect(block).toContain("await leadershipRetry.initialAttempt");
    expect(block).toContain("retry election remains active on this instance");
    expect(block).not.toContain("await acquireSchedulerLeadership()");

    const enablerStart = block.indexOf("const enableBackgroundJobsOnce = () => {");
    const leaderOnlyStart = block.indexOf("if (schedulerEnabled)", enablerStart);
    expect(enablerStart).toBeGreaterThanOrEqual(0);
    expect(leaderOnlyStart).toBeGreaterThan(enablerStart);
    const enabler = block.slice(enablerStart, leaderOnlyStart);
    expect(enabler).toContain("if (backgroundJobsEnabled) return");
    expect(enabler.match(/startCrawlerScheduler\(\)/g)).toHaveLength(1);
    expect(enabler).toContain("backgroundJobsEnabled = true");
    expect(enabler).toContain("birthdayNotificationTimer = setInterval");
  });
});
