import type { Express, Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  contractors,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";
import { db } from "../../db";
import { notificationService } from "../../notification-service";
import { recordOutcomeEvent, updateUserConfidenceStateFromOutcome } from "../../scout/outcomeTracker";
import { appendDispatchEvent } from "../../services/directConnectDispatchLedgerService";
import { recordTrustLedgerEvent } from "../../services/trustLedgerService";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string } };
};

type CompletionCallbacks = {
  appendHomeIdTimelineEventFromDirectConnect: (params: {
    requestId: string;
    eventType: "direct_connect_completed";
    title: string;
    summary?: string | null;
  }) => Promise<void>;
  appendHomeIdCompletedWorkEnrichmentFromDirectConnect: (params: {
    requestId: string;
    completedAt?: string;
    workSummary?: string | null;
  }) => Promise<void>;
  recordDiscoveryOutcome: (requestId: string) => Promise<void>;
};

type CompletionDecision =
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      body: { code?: string; message: string };
    }
  | {
      ok: true;
      completedNow: boolean;
      request: {
        id: string;
        title: string;
        description: string;
        ownerUserId: string;
        fromStatus: string;
      };
    };

async function claimDirectConnectCompletion(args: {
  requestId: string;
  actorUserId: string;
}): Promise<CompletionDecision> {
  return db.transaction(async (tx): Promise<CompletionDecision> => {
    const requestResult = await tx.execute(sql`
      SELECT id, created_by_user_id, title, description, source, status
      FROM work_requests
      WHERE id = ${args.requestId}
      FOR UPDATE
    `);
    const requestRow = ((requestResult.rows || []) as any[])[0] || null;
    if (!requestRow) {
      return { ok: false, status: 404, body: { message: "Work request not found" } };
    }

    const ownerUserId = String(requestRow.created_by_user_id || "");
    if (ownerUserId !== args.actorUserId) {
      return {
        ok: false,
        status: 403,
        body: { message: "You can only complete your own requests" },
      };
    }
    if (String(requestRow.source || "") !== "direct_connect") {
      return {
        ok: false,
        status: 400,
        body: { message: "Only Direct Connect requests can be completed here" },
      };
    }

    const currentStatus = String(requestRow.status || "");
    const request = {
      id: String(requestRow.id),
      title: String(requestRow.title || "Direct Connect request"),
      description: String(requestRow.description || ""),
      ownerUserId,
      fromStatus: currentStatus,
    };
    if (currentStatus === "completed") {
      return { ok: true, completedNow: false, request };
    }
    if (currentStatus !== "in_progress" && currentStatus !== "pending_outcome") {
      return {
        ok: false,
        status: 400,
        body: {
          message: "Only in-progress or pending-outcome requests can be marked complete",
        },
      };
    }

    const workspaceResult = await tx.execute(sql`
      SELECT
        workspace.id,
        workspace.requester_user_id,
        workspace.provider_user_id,
        workspace.contractor_id,
        dispatch.contact_gate_state
      FROM direct_connect_job_workspaces workspace
      INNER JOIN direct_connect_dispatch_requests dispatch
        ON dispatch.id = workspace.request_id
      WHERE workspace.request_id = ${args.requestId}
      LIMIT 1
      FOR UPDATE OF workspace, dispatch
    `);
    const workspace = ((workspaceResult.rows || []) as any[])[0] || null;
    const contactGateState = String(workspace?.contact_gate_state || "locked");
    const providerUserId = String(workspace?.provider_user_id || "");
    if (
      !workspace ||
      String(workspace.requester_user_id || "") !== ownerUserId ||
      !providerUserId ||
      contactGateState !== "released"
    ) {
      return {
        ok: false,
        status: 409,
        body: {
          code: "DIRECT_CONNECT_COMPLETION_REQUIRES_RELEASED_PROVIDER",
          message: "Completion requires the accepted provider and released contact.",
        },
      };
    }

    const acceptedResult = await tx.execute(sql`
      SELECT assignment.id
      FROM work_request_assignments assignment
      LEFT JOIN contractors contractor ON contractor.id = assignment.contractor_id
      WHERE assignment.work_request_id = ${args.requestId}
        AND assignment.status = 'accepted'
        AND (
          assignment.responder_user_id = ${providerUserId}
          OR contractor.user_id = ${providerUserId}
        )
      LIMIT 1
      FOR UPDATE OF assignment
    `);
    if (!((acceptedResult.rows || []) as any[])[0]) {
      return {
        ok: false,
        status: 409,
        body: {
          code: "DIRECT_CONNECT_COMPLETION_REQUIRES_RELEASED_PROVIDER",
          message: "Completion requires the accepted provider and released contact.",
        },
      };
    }

    const now = new Date();
    await tx
      .update(workRequests)
      .set({ status: "completed", updatedAt: now })
      .where(eq(workRequests.id, args.requestId));
    await tx.execute(sql`
      UPDATE direct_connect_job_workspaces
      SET status = 'completed', active_stage = 'completed', updated_at = now()
      WHERE id = ${String(workspace.id)}
    `);
    await tx.insert(workRequestEvents).values({
      workRequestId: args.requestId,
      type: "status_changed",
      actorUserId: args.actorUserId,
      fromStatus: currentStatus,
      toStatus: "completed",
      metadata: { source: "direct_connect", reason: "mark_complete" },
    });

    return { ok: true, completedNow: true, request };
  });
}

async function runDirectConnectCompletionEffects(
  decision: Extract<CompletionDecision, { ok: true }>,
  callbacks: CompletionCallbacks
) {
  const { request } = decision;
  const completedAt = new Date().toISOString();

  try {
    await recordTrustLedgerEvent({
      actorUserId: request.ownerUserId,
      entityType: "work_request",
      entityId: request.id,
      eventType: "direct_connect_completed",
      sourceSurface: "direct_connect",
      metadata: {
        source: "direct_connect",
        fromStatus: request.fromStatus,
        toStatus: "completed",
      },
    });
  } catch (error) {
    console.warn("[direct-connect] Failed to write completion trust event", error);
  }

  try {
    const scope = "direct_connect";
    const outcomeEvent = {
      userId: request.ownerUserId,
      contextType: "direct_connect" as const,
      contextId: request.id,
      action: "completed_flow" as const,
      scope,
    };
    await recordOutcomeEvent(outcomeEvent);
    await updateUserConfidenceStateFromOutcome(request.ownerUserId, outcomeEvent, scope);
  } catch (error) {
    console.warn("[direct-connect] Failed to write completion outcome event", error);
  }

  try {
    await callbacks.recordDiscoveryOutcome(request.id);
  } catch (error) {
    console.warn("[direct-connect] Failed to write completion discovery outcome", error);
  }

  try {
    await appendDispatchEvent({
      requestId: request.id,
      actorType: "system",
      actorId: null,
      eventType: "job_completed",
      metadata: { source: "requester_completion" },
    });
  } catch (error) {
    console.warn("[direct-connect] Failed to append job-completed dispatch event", error);
  }

  try {
    const acceptedAssignments = await db
      .select()
      .from(workRequestAssignments)
      .where(
        and(
          eq(workRequestAssignments.workRequestId, request.id),
          eq(workRequestAssignments.status, "accepted" as any)
        )
      );
    const providerUserIds = new Set<string>();
    for (const assignment of acceptedAssignments as any[]) {
      if (assignment.responderUserId) {
        providerUserIds.add(String(assignment.responderUserId));
      }
      if (assignment.contractorId) {
        const [contractor] = await db
          .select({ userId: contractors.userId })
          .from(contractors)
          .where(eq(contractors.id, String(assignment.contractorId)))
          .limit(1);
        if (contractor?.userId) providerUserIds.add(String(contractor.userId));
      }
    }
    await Promise.all(
      Array.from(providerUserIds).map((providerUserId) =>
        notificationService.createNotification({
          userId: providerUserId,
          type: "dc_request_completed",
          title: "Job marked complete",
          message: `The requester marked "${request.title}" as complete.`,
          actionUrl: "/direct-connect/inbox",
          actionText: "View in inbox",
          iconName: "check-circle",
          iconColor: "green",
          deliveryMethods: ["in_app", "push"],
        })
      )
    );
  } catch (error) {
    console.warn("[direct-connect] Failed to notify provider of completion", error);
  }

  try {
    await callbacks.appendHomeIdTimelineEventFromDirectConnect({
      requestId: request.id,
      eventType: "direct_connect_completed",
      title: "Direct Connect request completed",
      summary: "The linked Direct Connect request was marked complete.",
    });
    await callbacks.appendHomeIdCompletedWorkEnrichmentFromDirectConnect({
      requestId: request.id,
      completedAt,
      workSummary: request.description.trim() || request.title,
    });
  } catch (error) {
    console.warn("[direct-connect] Failed to enrich HomeID after completion", error);
  }
}

export function registerDirectConnectCompletionRoute(
  app: Express,
  dependencies: CompletionCallbacks & { isAuthenticated: any }
) {
  const { isAuthenticated, ...callbacks } = dependencies;

  app.post(
    "/api/direct-connect/requests/:id/complete",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      const actorUserId = String(req.user?.id || req.user?.claims?.sub || "").trim();
      if (!actorUserId) return res.status(401).json({ message: "Unauthorized" });

      try {
        const decision = await claimDirectConnectCompletion({
          requestId: String(req.params.id || "").trim(),
          actorUserId,
        });
        if (!decision.ok) return res.status(decision.status).json(decision.body);
        if (!decision.completedNow) {
          return res.status(200).json({
            status: "completed",
            idempotencyReplayed: true,
          });
        }

        await runDirectConnectCompletionEffects(decision, callbacks);
        return res.status(200).json({
          status: "completed",
          idempotencyReplayed: false,
        });
      } catch (error) {
        console.error("[direct-connect] Failed to complete request", error);
        return res.status(500).json({
          message: "Failed to complete request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );
}
