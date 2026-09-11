import type { Express, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  adminAuditLog,
  businesses,
  contractors,
  conversations,
  messages,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";
import { db } from "../../db";
import { snapshotDispatchCandidate } from "../../services/directConnectDispatchLedgerService";
import { storage } from "../../storage";
import { redactContactDetails } from "../../utils/workRequestShare";

const operationSchema = z.object({
  operationId: z.string().trim().min(8).max(120),
  reason: z.string().trim().min(10).max(1000),
});
const assignmentSchema = operationSchema
  .extend({ providerId: z.string().trim().min(1).max(120) })
  .strict();
const replySchema = operationSchema
  .extend({
    assignmentId: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

export class OperatorError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Never guess a request binding from the latest conversation between two users. */
export function resolveOperatorReplyBinding(request: any, assignments: any[], events: any[]) {
  if (request.source !== "direct_connect" || request.status !== "in_progress") return null;
  const accepted = assignments.filter(
    (a) => a.workRequestId === request.id && a.status === "accepted"
  );
  if (accepted.length !== 1) return null;
  const assignment = accepted[0];
  const providerKey = assignment.contractorId || assignment.responderUserId;
  if (!providerKey) return null;
  if (
    assignments.some(
      (a) => a.id !== assignment.id && (a.contractorId || a.responderUserId) === providerKey
    )
  )
    return null;
  const matching = events.filter((event) => {
    const metadata = event.metadata || {};
    return (
      event.workRequestId === request.id &&
      event.type === "provider_accepted" &&
      (assignment.contractorId
        ? metadata.contractorId === assignment.contractorId
        : metadata.responderUserId === assignment.responderUserId) &&
      (!metadata.assignmentId || metadata.assignmentId === assignment.id) &&
      new Date(event.createdAt).getTime() >= new Date(assignment.createdAt).getTime() &&
      typeof metadata.conversationId === "string" &&
      metadata.conversationId.length > 0
    );
  });
  if (matching.length !== 1) return null;
  return {
    assignmentId: String(assignment.id),
    providerKey: String(providerKey),
    conversationId: String(matching[0].metadata.conversationId),
    acceptedByUserId: String(matching[0].actorUserId || ""),
  };
}

export function checkOperatorReplay(
  events: any[],
  actorId: string,
  operationId: string,
  fingerprint: string
) {
  const previous = events.filter(
    (e) => e.actorUserId === actorId && e.metadata?.operatorOperationId === operationId
  );
  if (!previous.length) return null;
  if (previous.length !== 1 || previous[0].metadata?.operatorFingerprint !== fingerprint) {
    throw new OperatorError(409, "This operation was already used with different details.");
  }
  return previous[0].metadata.result;
}

type Dependencies = {
  isAuthenticated: RequestHandler;
  isOperator: RequestHandler;
  filterContractors: (rows: any[], request: any) => Promise<{ eligible: any[] }>;
  filterBusinesses: (rows: any[], request: any) => Promise<{ eligible: any[] }>;
  notifyProvider: (userId: string, requestId: string) => Promise<unknown>;
};

async function loadRequestContext(executor: any, requestId: string) {
  const [request] = await executor
    .select()
    .from(workRequests)
    .where(eq(workRequests.id, requestId))
    .limit(1);
  if (!request || request.source !== "direct_connect")
    throw new OperatorError(404, "Direct Connect request not found.");
  const assignments = await executor
    .select()
    .from(workRequestAssignments)
    .where(eq(workRequestAssignments.workRequestId, requestId));
  const events = await executor
    .select()
    .from(workRequestEvents)
    .where(eq(workRequestEvents.workRequestId, requestId))
    .orderBy(asc(workRequestEvents.createdAt));
  return { request, assignments, events };
}

async function loadReplyConversation(
  executor: any,
  context: Awaited<ReturnType<typeof loadRequestContext>>,
  lock = false
) {
  const binding = resolveOperatorReplyBinding(context.request, context.assignments, context.events);
  if (!binding) return null;
  const assignment = context.assignments.find((a: any) => a.id === binding.assignmentId);
  const [contractor] = assignment.contractorId
    ? await executor
        .select()
        .from(contractors)
        .where(eq(contractors.id, assignment.contractorId))
        .limit(1)
    : [];
  if (binding.acceptedByUserId !== String(contractor?.userId || assignment.responderUserId || ""))
    return null;
  const gate = await executor.execute(sql`SELECT id FROM direct_connect_dispatch_requests
    WHERE id = ${context.request.id} AND user_id = ${context.request.createdByUserId}
      AND contact_gate_state = 'released' ${lock ? sql`FOR SHARE` : sql``}`);
  if (gate.rows.length !== 1) return null;
  let conversationQuery = executor
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, binding.conversationId),
        eq(conversations.homeownerId, context.request.createdByUserId),
        eq(conversations.contractorId, binding.providerKey),
        eq(conversations.status, "active")
      )
    )
    .limit(1);
  if (lock) conversationQuery = conversationQuery.for("update");
  const [conversation] = await conversationQuery;
  return conversation ? binding : null;
}

export function registerDirectConnectAdminOperations(app: Express, deps: Dependencies) {
  const middleware = [deps.isAuthenticated, deps.isOperator];
  const handleError = (res: any, error: unknown) => {
    if (error instanceof OperatorError)
      return res.status(error.status).json({ message: error.message });
    console.error("[direct-connect] Operator operation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: (error as any)?.cause?.code || null,
    });
    return res.status(500).json({ message: "Could not complete this request operation." });
  };

  app.get("/api/admin/direct-connect/requests/:id/messages", ...middleware, async (req, res) => {
    try {
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .safeParse(req.query.page ?? 0);
      if (!page.success) return res.status(400).json({ message: "Invalid message page." });
      const context = await loadRequestContext(db, String(req.params.id));
      const binding = await loadReplyConversation(db, context);
      // Unbound historical messages are omitted, never attached by participant or timestamp guesswork.
      const history = await db
        .select()
        .from(messages)
        .where(
          sql`${messages.metadata}->>'workRequestId' = ${context.request.id}
          AND EXISTS (SELECT 1 FROM work_request_assignments a
            JOIN conversations c ON c.id = ${messages.conversationId}
            LEFT JOIN contractors provider ON provider.id = a.contractor_id
            JOIN LATERAL (
              SELECT COUNT(*) AS binding_count, MIN(e.metadata->>'conversationId') AS conversation_id
              FROM work_request_events e
              WHERE e.work_request_id = a.work_request_id AND e.type = 'provider_accepted'
                AND e.actor_user_id = COALESCE(provider.user_id, a.responder_user_id)
                AND e.created_at >= a.created_at
                AND (CASE WHEN a.contractor_id IS NOT NULL
                  THEN e.metadata->>'contractorId' = a.contractor_id
                  ELSE e.metadata->>'responderUserId' = a.responder_user_id END)
                AND (e.metadata->>'assignmentId' = a.id OR (
                  e.metadata->>'assignmentId' IS NULL AND NOT EXISTS (
                    SELECT 1 FROM work_request_assignments duplicate
                    WHERE duplicate.work_request_id = a.work_request_id AND duplicate.id <> a.id
                      AND COALESCE(duplicate.contractor_id, duplicate.responder_user_id) = COALESCE(a.contractor_id, a.responder_user_id)
                  )
                ))
            ) binding ON binding.binding_count = 1 AND binding.conversation_id = c.id
            WHERE a.id = ${messages.metadata}->>'connectionId'
              AND a.work_request_id = ${context.request.id}
              AND c.homeowner_id = ${context.request.createdByUserId}
              AND c.contractor_id = COALESCE(a.contractor_id, a.responder_user_id))`
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .offset(page.data * 50)
        .limit(51);
      return res.json({
        page: page.data,
        hasMore: history.length > 50,
        messages: history
          .slice(0, 50)
          .reverse()
          .map((message) => ({
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            senderType: message.senderType,
            createdAt: message.createdAt,
            assignmentId: (message.metadata as any)?.connectionId || null,
          })),
        replyAssignmentId: binding?.assignmentId || null,
        replyUnavailableReason: binding
          ? null
          : "Staff replies require customer-released contact and one active, accepted provider conversation linked to this request.",
      });
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.post(
    "/api/admin/direct-connect/requests/:id/assignments",
    ...middleware,
    async (req: any, res) => {
      const parsed = assignmentSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          message: "Select a provider and enter an audit reason.",
          issues: parsed.error.flatten(),
        });
      const actorId = String(req.user?.id || req.user?.claims?.sub || "");
      if (!actorId) return res.status(401).json({ message: "Authentication required." });
      const requestId = String(req.params.id);
      const input = parsed.data;
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ operation: "assign", requestId, ...input }))
        .digest("hex");
      try {
        const result = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT id FROM work_requests WHERE id = ${requestId} FOR UPDATE`);
          const context = await loadRequestContext(tx, requestId);
          const replay = checkOperatorReplay(
            context.events,
            actorId,
            input.operationId,
            fingerprint
          );
          if (replay) return { ...replay, idempotentReplay: true };
          if (
            !["open", "routed"].includes(context.request.status) ||
            context.assignments.some((a: any) => a.status === "accepted")
          )
            throw new OperatorError(
              409,
              "Only open or routed requests without an accepted provider can be assigned."
            );
          const requester = await storage.getUser(context.request.createdByUserId);
          if (!requester || (requester.role === "homeowner" && !requester.addressVerified))
            throw new OperatorError(
              428,
              "The requester must complete address verification before staff can invite a provider."
            );
          const [contractor] = await tx
            .select()
            .from(contractors)
            .where(eq(contractors.id, input.providerId))
            .limit(1);
          const [business] = contractor
            ? []
            : await tx
                .select()
                .from(businesses)
                .where(eq(businesses.id, input.providerId))
                .limit(1);
          const provider = contractor || business;
          const eligible = contractor
            ? (await deps.filterContractors([contractor], context.request)).eligible
            : business
              ? (await deps.filterBusinesses([business], context.request)).eligible
              : [];
          if (!provider || !eligible.length)
            throw new OperatorError(
              422,
              "This provider does not meet this request's county, trade, verification, or public trust requirements."
            );
          const providerUserId = contractor?.userId || business?.ownerUserId;
          if (!providerUserId || providerUserId === context.request.createdByUserId)
            throw new OperatorError(422, "Choose an eligible provider other than the requester.");
          const existingContractorIds = context.assignments
            .map((a: any) => a.contractorId)
            .filter(Boolean);
          const existingContractors = existingContractorIds.length
            ? await tx
                .select({ userId: contractors.userId })
                .from(contractors)
                .where(inArray(contractors.id, existingContractorIds))
            : [];
          const duplicate =
            existingContractors.some((c) => c.userId === providerUserId) ||
            context.assignments.some(
              (a: any) =>
                (a.contractorId === contractor?.id && Boolean(contractor)) ||
                a.responderUserId === providerUserId
            );
          if (duplicate)
            throw new OperatorError(
              409,
              "This provider already has an assignment. Existing responses will not be overwritten."
            );
          const [assignment] = await tx
            .insert(workRequestAssignments)
            .values({
              workRequestId: requestId,
              contractorId: contractor?.id || null,
              responderUserId: contractor ? null : providerUserId,
              status: "invited",
              scoreSnapshot: { routingMode: "admin_manual" },
            })
            .returning();
          const dispatch = await tx.execute(sql`SELECT id FROM direct_connect_dispatch_requests
            WHERE id = ${requestId} AND user_id = ${context.request.createdByUserId} FOR SHARE`);
          if (dispatch.rows.length !== 1)
            throw new OperatorError(
              409,
              "This request has no matching requester-owned dispatch record. Resolve its request history before inviting a provider."
            );
          await snapshotDispatchCandidate(
            {
              requestId,
              contractorId: contractor?.id || null,
              businessId: business?.id || contractor?.businessId || null,
              responderUserId: providerUserId,
              eligibility: { status: "eligible", eligible: true },
              eligibilityReasons: ["admin_manual_eligible_provider"],
              territoryMatched: true,
              categoryMatched: null,
              verificationState: "unknown",
              profileReadiness: "unknown",
              contactEligibility: true,
              trustState: "unknown",
            },
            tx
          );
          await tx
            .update(workRequests)
            .set({ status: "routed", updatedAt: new Date() })
            .where(eq(workRequests.id, requestId));
          const response = { assignmentId: assignment.id, providerUserId, idempotentReplay: false };
          const metadata = {
            source: "direct_connect_admin",
            routeMode: "admin_manual",
            providerId: input.providerId,
            contractorId: contractor?.id || null,
            responderUserId: providerUserId,
            assignmentId: assignment.id,
            author: { kind: "staff", userId: actorId },
            reason: input.reason,
            operatorOperationId: input.operationId,
            operatorFingerprint: fingerprint,
            result: response,
          };
          await tx.insert(workRequestEvents).values({
            workRequestId: requestId,
            type: "provider_invited",
            actorUserId: actorId,
            metadata: { ...metadata, reason: undefined },
          });
          await tx.insert(adminAuditLog).values({
            type: "admin_direct_connect_provider_invited",
            adminId: actorId,
            targetUserId: providerUserId,
            metadata: { ...metadata, requestId },
          });
          return response;
        });
        let notificationQueued = false;
        if (!result.idempotentReplay) {
          try {
            await deps.notifyProvider(result.providerUserId, requestId);
            notificationQueued = true;
          } catch (error) {
            console.error("[direct-connect] Assigned provider notification failed", error);
          }
        }
        return res
          .status(result.idempotentReplay ? 200 : 201)
          .json({ ...result, notificationQueued });
      } catch (error) {
        return handleError(res, error);
      }
    }
  );

  app.post(
    "/api/admin/direct-connect/requests/:id/replies",
    ...middleware,
    async (req: any, res) => {
      const parsed = replySchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ message: "Enter a reply and an audit reason.", issues: parsed.error.flatten() });
      const actorId = String(req.user?.id || req.user?.claims?.sub || "");
      if (!actorId) return res.status(401).json({ message: "Authentication required." });
      const requestId = String(req.params.id),
        input = parsed.data;
      // Staff cannot use support tooling to bypass the customer's contact-release decision.
      if (
        redactContactDetails(input.content) !== input.content ||
        /(?:https?:\/\/|www\.|@[a-z0-9_]{2,})/i.test(input.content)
      )
        return res.status(422).json({
          message:
            "Keep contact details and external links out of staff replies. Use the request's customer-controlled contact release.",
        });
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ operation: "reply", requestId, ...input }))
        .digest("hex");
      try {
        const result = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT id FROM work_requests WHERE id = ${requestId} FOR UPDATE`);
          const context = await loadRequestContext(tx, requestId);
          const replay = checkOperatorReplay(
            context.events,
            actorId,
            input.operationId,
            fingerprint
          );
          if (replay) return { ...replay, idempotentReplay: true };
          const binding = await loadReplyConversation(tx, context, true);
          if (!binding || binding.assignmentId !== input.assignmentId)
            throw new OperatorError(
              409,
              "The accepted provider conversation is missing, changed, or ambiguous. Refresh the request before replying."
            );
          const metadata = {
            workRequestId: requestId,
            connectionId: binding.assignmentId,
            author: { kind: "staff", userId: actorId },
            source: "direct_connect_admin",
          };
          const [message] = await tx
            .insert(messages)
            .values({
              conversationId: binding.conversationId,
              senderId: actorId,
              senderType: "staff",
              content: input.content,
              messageType: "text",
              metadata,
            })
            .returning();
          await tx
            .update(conversations)
            .set({ lastMessageAt: new Date(), updatedAt: new Date() })
            .where(eq(conversations.id, binding.conversationId));
          const response = {
            messageId: message.id,
            assignmentId: binding.assignmentId,
            idempotentReplay: false,
          };
          const audit = {
            ...metadata,
            messageId: message.id,
            reason: input.reason,
            operatorOperationId: input.operationId,
            operatorFingerprint: fingerprint,
            result: response,
          };
          await tx.insert(workRequestEvents).values({
            workRequestId: requestId,
            type: "updated",
            actorUserId: actorId,
            metadata: { ...audit, reason: undefined, operation: "staff_reply" },
          });
          await tx.insert(adminAuditLog).values({
            type: "admin_direct_connect_staff_reply",
            adminId: actorId,
            targetUserId: context.request.createdByUserId,
            metadata: audit,
          });
          return response;
        });
        return res.status(result.idempotentReplay ? 200 : 201).json(result);
      } catch (error) {
        return handleError(res, error);
      }
    }
  );
}
