import { describe, expect, it, vi } from "vitest";
import { withPoolTransaction } from "./poolTransaction";

describe("withPoolTransaction", () => {
  it("runs BEGIN, work, and COMMIT on one checked-out client", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ value: 1 }] })
      .mockResolvedValueOnce({});
    const release = vi.fn();
    const dbPool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    const result = await withPoolTransaction(dbPool, async (client) => {
      return client.query("select 1 as value");
    });

    expect(result).toEqual({ rows: [{ value: 1 }] });
    expect(dbPool.connect).toHaveBeenCalledTimes(1);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "select 1 as value",
      "COMMIT",
    ]);
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("rolls back on the same client when work fails", async () => {
    const workError = new Error("write failed");
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(workError)
      .mockResolvedValueOnce({});
    const release = vi.fn();
    const dbPool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    await expect(
      withPoolTransaction(dbPool, async (client) => {
        await client.query("insert into example values (1)");
      })
    ).rejects.toThrow("write failed");

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "insert into example values (1)",
      "ROLLBACK",
    ]);
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("evicts a client when rollback cannot restore a known session state", async () => {
    const workError = new Error("write failed");
    const rollbackError = new Error("connection terminated");
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(workError)
      .mockRejectedValueOnce(rollbackError);
    const release = vi.fn();
    const dbPool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    await expect(
      withPoolTransaction(dbPool, async (client) => {
        await client.query("insert into example values (1)");
      })
    ).rejects.toThrow("write failed");
    expect(release).toHaveBeenCalledWith(rollbackError);
  });
});
