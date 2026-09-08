import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectResultMock, executeMock, insertMock } = vi.hoisted(() => ({
  selectResultMock: vi.fn(),
  executeMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: selectResultMock,
          })),
        })),
      })),
    })),
    execute: executeMock,
    insert: insertMock,
  },
}));

import { ensureSuperAdminConnectionForUser } from "../utils/superAdminConnection";

describe("super-admin auto-connection behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes mutual discovery follows without writing contact permission", async () => {
    selectResultMock.mockResolvedValue([{ id: "super-1" }]);
    executeMock.mockResolvedValue({});

    const result = await ensureSuperAdminConnectionForUser("user-1");

    expect(result).toEqual({
      ensured: true,
      superAdminUserId: "super-1",
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("fails safe when no true super admin exists", async () => {
    selectResultMock.mockResolvedValue([]);

    const result = await ensureSuperAdminConnectionForUser("user-1");

    expect(result).toEqual({ ensured: false, reason: "missing_super_admin" });
    expect(executeMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("runs a full-sweep backfill when called for the super admin account", async () => {
    selectResultMock.mockResolvedValue([{ id: "super-1" }]);
    executeMock.mockResolvedValue({});

    const result = await ensureSuperAdminConnectionForUser("super-1");

    expect(result).toEqual({
      ensured: true,
      reason: "self_super_admin_full_sweep",
      superAdminUserId: "super-1",
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
