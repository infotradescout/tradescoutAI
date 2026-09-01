import { describe, expect, it, vi } from "vitest";
import { logAdminAction } from "../services/adminAuditLogService";
import { runBestEffortPrivilegedSummaryAudit } from "../utils/privilegedActions";

describe("admin audit transaction boundary", () => {
  it("rethrows a caller-provided transaction failure so the authority mutation can roll back", async () => {
    const failure = new Error("audit insert failed");
    const values = vi.fn().mockRejectedValue(failure);
    const insert = vi.fn(() => ({ values }));

    await expect(
      logAdminAction(
        {
          action: "admin_user_provision",
          actorId: "ops-1",
          targetId: "user-1",
          targetType: "user",
        },
        { database: { insert } }
      )
    ).rejects.toBe(failure);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledTimes(1);
  });

  it("uses the caller-provided transaction for a successful durable audit", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));

    await logAdminAction(
      {
        action: "admin_user_provision",
        actorId: "ops-1",
        targetId: "user-1",
        targetType: "user",
      },
      { database: { insert } }
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin_user_provision",
        adminId: "ops-1",
        targetUserId: "user-1",
      })
    );
  });

  it("surfaces a summary-audit warning without rejecting durable row work", async () => {
    const onError = vi.fn();
    const warning = await runBestEffortPrivilegedSummaryAudit({
      write: vi.fn().mockRejectedValue(new Error("summary insert failed")),
      warningCode: "SUMMARY_AUDIT_FAILED",
      warningMessage: "Rows committed; summary audit needs retry.",
      onError,
    });

    expect(warning).toEqual({
      code: "SUMMARY_AUDIT_FAILED",
      message: "Rows committed; summary audit needs retry.",
      retryRequired: true,
    });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "summary insert failed" }));

    await expect(
      runBestEffortPrivilegedSummaryAudit({
        write: vi.fn().mockResolvedValue(undefined),
        warningCode: "SUMMARY_AUDIT_FAILED",
        warningMessage: "Rows committed; summary audit needs retry.",
      })
    ).resolves.toBeNull();
  });
});
