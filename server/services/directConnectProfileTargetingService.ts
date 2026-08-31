import { and, eq, sql } from "drizzle-orm";
import { workRequestAssignments, workRequestEvents, workRequests } from "@shared/schema";
import { db } from "../db";

type DirectConnectProfileInvitationArgs = {
  requestId: string;
  requesterUserId: string;
  targetProfileId: string;
  targetProfileSlug: string;
  targetProfileOwnerUserId: string;
};

export async function ensureDirectConnectProfileInvitation(
  args: DirectConnectProfileInvitationArgs
) {
  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(sql`
      SELECT id
      FROM work_requests
      WHERE id = ${args.requestId}
      FOR UPDATE
    `);
    if (!((lockResult.rows || []) as any[])[0]) {
      throw new Error("Direct Connect request disappeared before profile routing");
    }

    const [request] = await tx
      .select()
      .from(workRequests)
      .where(eq(workRequests.id, args.requestId))
      .limit(1);
    if (
      !request ||
      String(request.createdByUserId || "") !== args.requesterUserId ||
      String(request.source || "") !== "direct_connect" ||
      String(request.sourceRefId || "") !== args.targetProfileId
    ) {
      throw new Error("Direct Connect profile target no longer matches the request");
    }

    const [existingAssignment] = await tx
      .select({
        id: workRequestAssignments.id,
        status: workRequestAssignments.status,
      })
      .from(workRequestAssignments)
      .where(
        and(
          eq(workRequestAssignments.workRequestId, args.requestId),
          eq(workRequestAssignments.responderUserId, args.targetProfileOwnerUserId)
        )
      )
      .limit(1);

    let assignmentCreated = false;
    if (!existingAssignment) {
      const requestStatus = String(request.status || "");
      if (requestStatus !== "open" && requestStatus !== "routed") {
        throw new Error("Direct Connect profile invitation cannot be added after routing closed");
      }
      const now = new Date();
      await tx.insert(workRequestAssignments).values({
        workRequestId: args.requestId,
        contractorId: null,
        responderUserId: args.targetProfileOwnerUserId,
        status: "invited",
        scoreSnapshot: {
          reasons: ["requester_selected_published_profile"],
          routingMode: "profile_direct_connect",
        },
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(workRequestEvents).values({
        workRequestId: args.requestId,
        type: "provider_invited",
        actorUserId: args.requesterUserId,
        metadata: {
          profileId: args.targetProfileId,
          profileSlug: args.targetProfileSlug,
          responderUserId: args.targetProfileOwnerUserId,
          source: "profile_direct_connect",
        },
      });
      assignmentCreated = true;
    }

    const [routedRequest] = await tx
      .update(workRequests)
      .set({ status: "routed", updatedAt: new Date() })
      .where(and(eq(workRequests.id, args.requestId), eq(workRequests.status, "open")))
      .returning();

    return {
      request: routedRequest || request,
      assignmentCreated,
    };
  });
}
