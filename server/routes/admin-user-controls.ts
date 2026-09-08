import type { Express, Response } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { carSalesmanProfiles, realtorProfiles, users } from "../../shared/schema";
import { evaluateAdminQuickUserControl } from "../services/adminQuickUserControlPolicy";
import {
  approvedProfessionalRolesFromProfiles,
  type CanonicalApprovedProfessionalRole,
  PROFESSIONAL_VERIFICATION_DECISION_REQUIRED_RESPONSE,
  reconcileUserRolePatchWithApprovedProfessionalRoles,
  requestedProfessionalRole,
} from "../services/professionalRoleAuthority";
import { parseAdminRoleMutationRequest } from "../services/adminRoleMutationPolicy";
import {
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  normalizePrivilegedReason,
  resolvePrivilegedActor,
} from "../utils/privilegedActions";

const sendProfessionalVerificationDecisionRequired = (res: Response) =>
  res.status(409).json(PROFESSIONAL_VERIFICATION_DECISION_REQUIRED_RESPONSE);

export function registerAdminUserControlRoutes(app: Express) {
  type LockedQuickControlResult =
    | { outcome: "updated"; user: any; previousUser: any }
    | { outcome: "target_not_found" }
    | { outcome: "denied"; code: string; message: string }
    | { outcome: "professional_decision_required" };

  const mutateUserThroughLockedQuickControl = async (input: {
    actorId: string;
    targetUserId: string;
    reason: string;
    action: string;
    route: string;
    operationType: string;
    requestedRoles?: readonly unknown[];
    preserveProfessionalRoles?: boolean;
    buildPatch: (target: any) => Record<string, unknown>;
    buildAuditDetails: (target: any, updated: any) => Record<string, unknown>;
  }): Promise<LockedQuickControlResult> =>
    db.transaction(async (tx) => {
      // Professional decisions lock profile authority before the user projection.
      // Match that order when this quick control writes the role projection.
      let approvedProfessionalRoles: CanonicalApprovedProfessionalRole[] = [];
      if (input.preserveProfessionalRoles) {
        const [realtorProfile] = await tx
          .select({
            verificationStatus: realtorProfiles.verificationStatus,
            isActive: realtorProfiles.isActive,
          })
          .from(realtorProfiles)
          .where(eq(realtorProfiles.userId, input.targetUserId))
          .limit(1)
          .for("update");
        const [carSalesmanProfile] = await tx
          .select({
            verificationStatus: carSalesmanProfiles.verificationStatus,
            isActive: carSalesmanProfiles.isActive,
          })
          .from(carSalesmanProfiles)
          .where(eq(carSalesmanProfiles.userId, input.targetUserId))
          .limit(1)
          .for("update");
        approvedProfessionalRoles = approvedProfessionalRolesFromProfiles(
          realtorProfile,
          carSalesmanProfile
        );
      }

      // Lock actor and target in deterministic order so authority cannot change
      // between policy evaluation and the quick-control write.
      const lockedUsers = await tx
        .select()
        .from(users)
        .where(inArray(users.id, Array.from(new Set([input.actorId, input.targetUserId]))))
        .orderBy(asc(users.id))
        .for("update");
      const actor = lockedUsers.find((row) => String(row.id) === input.actorId);
      const target = lockedUsers.find((row) => String(row.id) === input.targetUserId);
      if (!target) return { outcome: "target_not_found" };
      if (!actor) {
        return {
          outcome: "denied",
          code: "QUICK_CONTROL_AUTHORITY_REQUIRED",
          message: "Ops admin or super admin authority is required.",
        };
      }

      const decision = evaluateAdminQuickUserControl({
        actor,
        actorId: input.actorId,
        target,
        targetUserId: input.targetUserId,
        requestedRoles: input.requestedRoles,
      });
      const actorContext = resolvePrivilegedActor(actor);
      if (decision.outcome === "denied") {
        await auditPrivilegedAction({
          action: input.action,
          route: input.route,
          operationType: input.operationType,
          actorId: normalizeImmutableTargetId(input.actorId),
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "user",
          targetId: input.targetUserId,
          resolutionSource: "locked_route_param:user_id",
          reason: input.reason,
          outcome: "denied",
          details: { denialCode: decision.code },
          database: tx,
        });
        return decision;
      }

      let patch = input.buildPatch(target);
      if (input.preserveProfessionalRoles) {
        const reconciled = reconcileUserRolePatchWithApprovedProfessionalRoles({
          currentUser: target,
          patch,
          approvedProfessionalRoles,
          requestedProfessionalRoleValues: input.requestedRoles,
        });
        if (reconciled.outcome === "professional_approval_required") {
          await auditPrivilegedAction({
            action: input.action,
            route: input.route,
            operationType: input.operationType,
            actorId: normalizeImmutableTargetId(input.actorId),
            actorRole: actorContext.actorRole,
            actorRoles: actorContext.actorRoles,
            targetType: "user",
            targetId: input.targetUserId,
            resolutionSource: "locked_route_param:user_id",
            reason: input.reason,
            outcome: "denied",
            details: { denialCode: "PROFESSIONAL_VERIFICATION_DECISION_REQUIRED" },
            database: tx,
          });
          return { outcome: "professional_decision_required" };
        }
        patch = reconciled.patch;
      }

      const [updated] = await tx
        .update(users)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(users.id, input.targetUserId))
        .returning();
      if (!updated) return { outcome: "target_not_found" };

      await auditPrivilegedAction({
        action: input.action,
        route: input.route,
        operationType: input.operationType,
        actorId: normalizeImmutableTargetId(input.actorId),
        actorRole: actorContext.actorRole,
        actorRoles: actorContext.actorRoles,
        targetType: "user",
        targetId: input.targetUserId,
        resolutionSource: "locked_route_param:user_id",
        reason: input.reason,
        outcome: "completed",
        details: {
          ...input.buildAuditDetails(target, updated),
          protectedTarget: decision.targetIsProtected,
        },
        database: tx,
      });
      return { outcome: "updated", user: updated, previousUser: target };
    });

  const sendLockedQuickControlFailure = (res: any, result: LockedQuickControlResult) => {
    if (result.outcome === "target_not_found") {
      return res.status(404).json({ message: "User not found" });
    }
    if (result.outcome === "professional_decision_required") {
      return sendProfessionalVerificationDecisionRequired(res);
    }
    if (result.outcome === "denied") {
      const status = result.code === "SELF_QUICK_CONTROL_FORBIDDEN" ? 400 : 403;
      return res.status(status).json({ message: result.message, code: result.code });
    }
    return null;
  };

  // Super admin user controls (minimal, but real)
  app.post(
    "/api/admin/user-controls/suspend/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        const reason = normalizePrivilegedReason(
          req.body?.reason ?? req.body?.adminSafety?.reason,
          12,
          500
        );

        if (!reason) {
          return res.status(400).json({ message: "reason is required (12-500 chars)" });
        }

        const userId = String(req.params.userId || "").trim();
        const result = await mutateUserThroughLockedQuickControl({
          actorId: adminUserId,
          targetUserId: userId,
          reason,
          action: "admin_user_suspend",
          route: "/api/admin/user-controls/suspend/:userId",
          operationType: "suspend_user",
          buildPatch: () => ({ verificationStatus: "suspended" as any }),
          buildAuditDetails: () => ({ verificationStatus: "suspended" }),
        });
        if (result.outcome !== "updated") return sendLockedQuickControlFailure(res, result);

        return res.json({
          id: result.user.id,
          role: result.user.role,
          verificationStatus: result.user.verificationStatus,
        });
      } catch (error: any) {
        console.error("Error suspending user:", error);
        return res.status(500).json({ message: "Failed to suspend user" });
      }
    }
  );

  app.post(
    "/api/admin/user-controls/unsuspend/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        const reason = normalizePrivilegedReason(
          req.body?.reason ?? req.body?.adminSafety?.reason,
          12,
          500
        );

        if (!reason) {
          return res.status(400).json({ message: "reason is required (12-500 chars)" });
        }

        const userId = String(req.params.userId || "").trim();
        const result = await mutateUserThroughLockedQuickControl({
          actorId: adminUserId,
          targetUserId: userId,
          reason,
          action: "admin_user_unsuspend",
          route: "/api/admin/user-controls/unsuspend/:userId",
          operationType: "unsuspend_user",
          buildPatch: () => ({ verificationStatus: "pending" as any }),
          buildAuditDetails: () => ({ verificationStatus: "pending" }),
        });
        if (result.outcome !== "updated") return sendLockedQuickControlFailure(res, result);

        return res.json({
          id: result.user.id,
          role: result.user.role,
          verificationStatus: result.user.verificationStatus,
        });
      } catch (error: any) {
        console.error("Error unsuspending user:", error);
        return res.status(500).json({ message: "Failed to unsuspend user" });
      }
    }
  );

  app.post(
    "/api/admin/user-controls/verify/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        const reason = normalizePrivilegedReason(
          req.body?.reason ?? req.body?.adminSafety?.reason,
          12,
          500
        );

        if (!reason) {
          return res.status(400).json({ message: "reason is required (12-500 chars)" });
        }

        const userId = String(req.params.userId || "").trim();
        const result = await mutateUserThroughLockedQuickControl({
          actorId: adminUserId,
          targetUserId: userId,
          reason,
          action: "admin_user_verify",
          route: "/api/admin/user-controls/verify/:userId",
          operationType: "verify_user",
          buildPatch: () => ({
            verificationStatus: "approved" as any,
            addressVerified: true,
          }),
          buildAuditDetails: () => ({ verificationStatus: "approved", addressVerified: true }),
        });
        if (result.outcome !== "updated") return sendLockedQuickControlFailure(res, result);

        return res.json({
          id: result.user.id,
          role: result.user.role,
          verificationStatus: result.user.verificationStatus,
          addressVerified: result.user.addressVerified,
        });
      } catch (error: any) {
        console.error("Error verifying user:", error);
        return res.status(500).json({ message: "Failed to verify user" });
      }
    }
  );

  app.post(
    "/api/admin/user-controls/revoke-verify/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        const reason = normalizePrivilegedReason(
          req.body?.reason ?? req.body?.adminSafety?.reason,
          12,
          500
        );

        if (!reason) {
          return res.status(400).json({ message: "reason is required (12-500 chars)" });
        }

        const userId = String(req.params.userId || "").trim();
        const result = await mutateUserThroughLockedQuickControl({
          actorId: adminUserId,
          targetUserId: userId,
          reason,
          action: "admin_user_revoke_verify",
          route: "/api/admin/user-controls/revoke-verify/:userId",
          operationType: "revoke_user_verification",
          buildPatch: () => ({ verificationStatus: "pending" as any }),
          buildAuditDetails: () => ({ verificationStatus: "pending" }),
        });
        if (result.outcome !== "updated") return sendLockedQuickControlFailure(res, result);

        return res.json({
          id: result.user.id,
          role: result.user.role,
          verificationStatus: result.user.verificationStatus,
        });
      } catch (error: any) {
        console.error("Error revoking verification:", error);
        return res.status(500).json({ message: "Failed to revoke verification" });
      }
    }
  );

  app.post("/api/admin/user-controls/role/:userId", isAuthenticated, async (req: any, res: any) => {
    try {
      const adminUserId = String(
        (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
      ).trim();
      const reason = normalizePrivilegedReason(
        req.body?.reason ?? req.body?.adminSafety?.reason,
        12,
        500
      );

      if (!reason) {
        return res.status(400).json({ message: "reason is required (12-500 chars)" });
      }

      const userId = String(req.params.userId || "").trim();
      const body = (req.body ?? {}) as any;
      let newRole = typeof body.newRole === "string" ? body.newRole.trim() : "";

      if (!newRole) {
        return res.status(400).json({ message: "newRole is required" });
      }

      // Map UI helper roles to canonical enum values
      if (newRole === "contractor_user") {
        newRole = "contractor";
      }

      // Generic admin aliases are not accepted by authority writers.
      newRole = newRole.toLowerCase().replace(/[\s-]+/g, "_");

      if (requestedProfessionalRole([newRole])) {
        return sendProfessionalVerificationDecisionRequired(res);
      }

      const parsedRole = parseAdminRoleMutationRequest([newRole], newRole);
      if (parsedRole.outcome !== "allowed") {
        return res.status(400).json({ message: parsedRole.message, code: parsedRole.code });
      }

      const result = await mutateUserThroughLockedQuickControl({
        actorId: adminUserId,
        targetUserId: userId,
        reason,
        action: "admin_user_role_update",
        route: "/api/admin/user-controls/role/:userId",
        operationType: "change_user_role",
        requestedRoles: [parsedRole.activeRole],
        preserveProfessionalRoles: true,
        buildPatch: () => ({
          roles: [parsedRole.activeRole],
          role: parsedRole.activeRole as any,
          activeRole: parsedRole.activeRole,
        }),
        buildAuditDetails: (target) => ({ oldRole: target.role, newRole: parsedRole.activeRole }),
      });
      if (result.outcome !== "updated") return sendLockedQuickControlFailure(res, result);

      return res.json({
        id: result.user.id,
        role: result.user.role,
      });
    } catch (error: any) {
      console.error("Error updating user role via quick control:", error);
      return res.status(500).json({ message: "Failed to update user role" });
    }
  });
}
