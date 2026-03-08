import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectResultMock, executeMock, insertMock, valuesMock, onConflictDoUpdateMock } =
  vi.hoisted(() => ({
    selectResultMock: vi.fn(),
    executeMock: vi.fn(),
    insertMock: vi.fn(),
    valuesMock: vi.fn(),
    onConflictDoUpdateMock: vi.fn(),
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
    onConflictDoUpdateMock.mockResolvedValue(undefined);
    valuesMock.mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
    insertMock.mockReturnValue({ values: valuesMock });
  });

  it("creates mutual follow edges and accepted contact permission for a real super admin", async () => {
    selectResultMock.mockResolvedValue([{ id: "super-1" }]);

    const result = await ensureSuperAdminConnectionForUser("user-1");

    expect(result).toEqual({ ensured: true, superAdminUserId: "super-1" });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: "super-1",
        targetUserId: "user-1",
        status: "accepted",
        authorityGate: "system_super_admin_auto_connection",
        intent: "platform_support",
        respondedBy: "super-1",
      })
    );
    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("fails safe when no true super admin exists", async () => {
    selectResultMock.mockResolvedValue([]);

    const result = await ensureSuperAdminConnectionForUser("user-1");

    expect(result).toEqual({ ensured: false, reason: "missing_super_admin" });
    expect(executeMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("does not auto-link a super admin account to itself", async () => {
    selectResultMock.mockResolvedValue([{ id: "super-1" }]);

    const result = await ensureSuperAdminConnectionForUser("super-1");

    expect(result).toEqual({
      ensured: false,
      reason: "self_super_admin",
      superAdminUserId: "super-1",
    });
    expect(executeMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });
});
