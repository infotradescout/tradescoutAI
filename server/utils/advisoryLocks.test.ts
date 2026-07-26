import { describe, expect, it, vi } from "vitest";
import { withAdvisoryLockOnPool } from "./advisoryLocks";

describe("withAdvisoryLockOnPool", () => {
  it("acquires and unlocks on the exact same checked-out client", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });
    const release = vi.fn();
    const dbPool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    await expect(
      withAdvisoryLockOnPool(dbPool, "job:test", async () => "done")
    ).resolves.toBe("done");

    expect(dbPool.connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain("pg_try_advisory_lock");
    expect(query.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("still unlocks and releases when the job throws", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });
    const release = vi.fn();
    const dbPool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    await expect(
      withAdvisoryLockOnPool(dbPool, "job:test", async () => {
        throw new Error("job failed");
      })
    ).rejects.toThrow("job failed");

    expect(query.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("evicts a client whose unlock failed instead of leaking its session lock", async () => {
    const unlockError = new Error("connection terminated");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockRejectedValueOnce(unlockError);
    const release = vi.fn();
    const dbPool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    await expect(
      withAdvisoryLockOnPool(dbPool, "job:test", async () => "done")
    ).resolves.toBe("done");
    expect(release).toHaveBeenCalledWith(unlockError);
  });
});
