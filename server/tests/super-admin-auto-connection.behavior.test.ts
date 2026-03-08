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

  it("resolves a real super admin without auto-creating contact access", async () => {
    selectResultMock.mockResolvedValue([{ id: "super-1" }]);

    const result = await ensureSuperAdminConnectionForUser("user-1");

    expect(result).toEqual({
      ensured: false,
      reason: "contact_gated",
      superAdminUserId: "super-1",
    });
    expect(executeMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
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
