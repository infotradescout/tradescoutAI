import type { Express, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { workRequestAssignments, workRequests } from "@shared/schema";

type AdminRescueRequest = Request & {
  user?: { id?: string; claims?: { sub?: string } };
};

type RescueSnapshot = {
  source: unknown;
  status: unknown;
  contactGateState: unknown;
  assignmentStatuses: unknown[];
};

type RescueBlock = {
  status: 400 | 409;
  code:
    | "DIRECT_CONNECT_RESCUE_SOURCE_REQUIRED"
    | "DIRECT_CONNECT_RESCUE_LIFECYCLE_LOCKED"
    | "DIRECT_CONNECT_RESCUE_CONTACT_SEQUENCE_ACTIVE"
    | "DIRECT_CONNECT_RESCUE_PROVIDER_SELECTED";
  message: string;
};

export function evaluateDirectConnectAdminRescue(
  snapshot: RescueSnapshot
): RescueBlock | null {
  if (String(snapshot.source || "") !== "direct_connect") {
    return {
      status: 400,
      code: "DIRECT_CONNECT_RESCUE_SOURCE_REQUIRED",
      message: "Only Direct Connect requests can use this rescue action.",
    };
  }

  const status = String(snapshot.status || "");
  if (status !== "open" && status !== "routed") {
    return {
      status: 409,
      code: "DIRECT_CONNECT_RESCUE_LIFECYCLE_LOCKED",
      message: "This request has already moved beyond eligible routing.",
    };
  }

  if (String(snapshot.contactGateState || "locked") !== "locked") {
    return {
      status: 409,
      code: "DIRECT_CONNECT_RESCUE_CONTACT_SEQUENCE_ACTIVE",
      message: "Contact review has already started; routing rescue is locked.",
    };
  }

  if (
    snapshot.assignmentStatuses.some((value) =>
      ["accepted", "completed"].includes(String(value || ""))
    )
  ) {
    return {
      status: 409,
      code: "DIRECT_CONNECT_RESCUE_PROVIDER_SELECTED",
      message: "A provider is already selected for this request.",
    };
  }

  return null;
}

const adminRescueSchema = z
  .object({
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

type AdminRescueDependencies = {
  isAuthenticated: any;
  isStaff: any;
  db: any;
  routeRequestToTopContractors: (args: {
    requestRow: any;
    actorUserId: string;
    expandReach: boolean;
    bypassVerificationGate: boolean;
  }) => Promise<{ assignments: any[]; routed: boolean }>;
  logAdminAction: (event: {
    action: string;
    actorId: string;
    targetType: "work_request";
    targetId: string;
    targetUserId: string;
    [key: string]: unknown;
  }) => Promise<void>;
  appendDispatchEvent: (event: {
    requestId: string;
    actorType: "staff";
    actorId: string;
    eventType: "request_route_ready" | "request_route_blocked";
    metadata: Record<string, unknown>;
  }) => Promise<void>;
};

export function registerDirectConnectAdminRescueRoute(
  app: Express,
  dependencies: AdminRescueDependencies
) {
  const {
    isAuthenticated,
    isStaff,
    db,
    routeRequestToTopContractors,
    logAdminAction,
    appendDispatchEvent,
  } = dependencies;

  app.post(
    "/api/admin/direct-connect/requests/:id/rescue",
    isAuthenticated,
    isStaff,
    async (req: AdminRescueRequest, res: Response) => {
      const actorUserId = String(req.user?.id || req.user?.claims?.sub || "").trim();
      const requestId = String(req.params.id || "").trim();

      try {
        if (!actorUserId) return res.status(401).json({ message: "Unauthorized" });
        if (!requestId) return res.status(400).json({ message: "Request id is required" });

        const parsed = adminRescueSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({
            message: "A staff rescue reason of at least 10 characters is required.",
            issues: parsed.error.flatten(),
          });
        }

        const [requestRow] = await db
          .select()
          .from(workRequests)
          .where(eq(workRequests.id, requestId))
          .limit(1);
        if (!requestRow) return res.status(404).json({ message: "Request not found" });

        const assignments = await db
          .select({ status: workRequestAssignments.status })
          .from(workRequestAssignments)
          .where(eq(workRequestAssignments.workRequestId, requestId));

        const dispatchResult = await db.execute(sql`
          SELECT contact_gate_state
          FROM direct_connect_dispatch_requests
          WHERE id = ${requestId}
          LIMIT 1
        `);
        const contactGateState = String(
          ((dispatchResult.rows || []) as any[])[0]?.contact_gate_state || "locked"
        );

        const blocked = evaluateDirectConnectAdminRescue({
          source: requestRow.source,
          status: requestRow.status,
          contactGateState,
          assignmentStatuses: assignments.map((assignment: any) => assignment.status),
        });
        if (blocked) {
          await logAdminAction({
            action: "admin_direct_connect_routing_rescue_blocked",
            actorId: actorUserId,
            targetType: "work_request",
            targetId: requestId,
            targetUserId: String(requestRow.createdByUserId || ""),
            reason: parsed.data.reason,
            previousStatus: String(requestRow.status || ""),
            contactGateState,
            blockCode: blocked.code,
            verificationBypass: false,
          });
          return res.status(blocked.status).json({
            code: blocked.code,
            message: blocked.message,
          });
        }

        const routeResult = await routeRequestToTopContractors({
          requestRow,
          actorUserId,
          expandReach: true,
          bypassVerificationGate: false,
        });
        const assignmentsAdded = Array.isArray(routeResult.assignments)
          ? routeResult.assignments.length
          : 0;

        await logAdminAction({
          action: "admin_direct_connect_routing_rescue",
          actorId: actorUserId,
          targetType: "work_request",
          targetId: requestId,
          targetUserId: String(requestRow.createdByUserId || ""),
          reason: parsed.data.reason,
          previousStatus: String(requestRow.status || ""),
          contactGateState,
          assignmentsAdded,
          verificationBypass: false,
        });

        try {
          await appendDispatchEvent({
            requestId,
            actorType: "staff",
            actorId: actorUserId,
            eventType: assignmentsAdded > 0 ? "request_route_ready" : "request_route_blocked",
            metadata: {
              source: "admin_rescue",
              action: "expand_eligible_routing",
              assignmentsAdded,
              verificationBypass: false,
            },
          });
        } catch (eventError) {
          console.warn("[direct-connect] Failed to append admin rescue dispatch event", eventError);
        }

        return res.status(200).json({
          requestId,
          action: "expand_eligible_routing",
          routed: Boolean(routeResult.routed),
          assignmentsAdded,
          contactGateState,
          contactGateUnchanged: true,
          verificationBypass: false,
        });
      } catch (error) {
        console.error("[direct-connect] Admin routing rescue failed", error);
        return res.status(500).json({
          message: "Failed to rescue Direct Connect routing.",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );
}
