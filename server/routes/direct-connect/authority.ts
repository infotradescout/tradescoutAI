import { and, eq, sql } from "drizzle-orm";
import {
  contactPermissionEvents,
  contactPermissions,
  decisionCards,
  workRequestEvents,
} from "@shared/schema";

export class ExpressDirectConnectAuthorityTransitionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ExpressDirectConnectAuthorityTransitionError";
  }
}

export type ExpressDirectConnectAuthorityTransition = {
  sourceDecisionCardId: string;
  contactPermissionId: string;
  contactPreference: "platform_message" | "call";
  fromContactGateState: string;
  contactGateState: "accepted" | "provider_declined";
  contactReleased: boolean;
};

export function authorityRecord(value: unknown): Record<string, any> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

export async function transitionExpressDirectConnectAuthority(
  tx: any,
  params: {
    requestRow: any;
    providerUserId: string;
    decision: "accept" | "decline";
    declineReason?: string | null;
    now: Date;
  }
): Promise<ExpressDirectConnectAuthorityTransition | null> {
  const workRequestId = String(params.requestRow?.id || "");
  const requesterUserId = String(
    params.requestRow?.createdByUserId ?? params.requestRow?.created_by_user_id ?? ""
  );
  const requestProfileId = String(
    params.requestRow?.sourceRefId ?? params.requestRow?.source_ref_id ?? ""
  );
  const requestSource = String(params.requestRow?.source || "");
  const eventResult = await tx.execute(sql`
    SELECT metadata
    FROM work_request_events
    WHERE work_request_id = ${workRequestId}
      AND type = 'created'
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  `);
  const metadata = authorityRecord(eventResult.rows?.[0]?.metadata);
  if (metadata?.source !== "tradepartner_profile" || metadata?.connectionMode !== "express") {
    return null;
  }

  const sourceDecisionCardId = String(metadata.sourceDecisionCardId || "");
  const contactPermissionId = String(metadata.contactPermissionId || "");
  const decisionScope = String(metadata.decisionScope || "");
  const intent = String(metadata.intent || "");
  const contactPreference = String(metadata.contactPreference || "");
  const permissionDisposition = String(metadata.permissionDisposition || "");
  const scope = authorityRecord(decisionScope);
  if (
    metadata.authorityGate !== "decision_card" ||
    !sourceDecisionCardId ||
    !contactPermissionId ||
    intent !== "hire" ||
    (contactPreference !== "call" && contactPreference !== "platform_message") ||
    !scope
  ) {
    throw new ExpressDirectConnectAuthorityTransitionError(
      409,
      "EXPRESS_AUTHORITY_LINK_MISSING",
      "This Express request is missing its durable contact authority."
    );
  }

  const expectedProfileSlug = String(metadata.businessSlug || metadata.profileSlug || "");
  const scopeMatchesRequest =
    requestSource === "direct_connect" &&
    scope.kind === "tradepartner_profile_express" &&
    String(scope.workRequestId || "") === workRequestId &&
    String(scope.requesterUserId || "") === requesterUserId &&
    String(scope.providerUserId || "") === params.providerUserId &&
    String(scope.profileId || "") === requestProfileId &&
    requestProfileId === String(metadata.profileId || "") &&
    String(scope.profileSlug || "") === expectedProfileSlug &&
    String(scope.businessId || "") === String(metadata.businessId || "") &&
    String(scope.contactPreference || "") === contactPreference;
  if (!scopeMatchesRequest) {
    throw new ExpressDirectConnectAuthorityTransitionError(
      409,
      "EXPRESS_AUTHORITY_SCOPE_MISMATCH",
      "The Express contact authority does not match this request and provider."
    );
  }

  const authorityResult = await tx.execute(sql`
    SELECT
      dc.id AS decision_card_id,
      dc.user_id AS decision_card_user_id,
      dc.status AS decision_card_status,
      dc.intent AS decision_card_intent,
      dc.decision_scope AS decision_card_scope,
      cp.id AS contact_permission_id,
      cp.requester_id AS permission_requester_id,
      cp.target_user_id AS permission_target_user_id,
      cp.status AS permission_status,
      cp.authority_gate AS permission_authority_gate,
      cp.source_decision_card_id AS permission_decision_card_id,
      cp.intent AS permission_intent,
      cp.decision_scope AS permission_decision_scope,
      cp.cooldown_until AS permission_cooldown_until
    FROM decision_cards dc
    JOIN contact_permissions cp ON cp.id = ${contactPermissionId}
    WHERE dc.id = ${sourceDecisionCardId}
    FOR UPDATE OF dc, cp
  `);
  const authorityRow = (authorityResult.rows?.[0] as any) || null;
  if (!authorityRow) {
    throw new ExpressDirectConnectAuthorityTransitionError(
      409,
      "EXPRESS_AUTHORITY_ROWS_MISSING",
      "The Express Decision Card or contact permission no longer exists."
    );
  }

  const permissionStatus = String(authorityRow.permission_status || "");
  const cooldownUntil = authorityRow.permission_cooldown_until
    ? new Date(authorityRow.permission_cooldown_until)
    : null;
  if (cooldownUntil && Number.isFinite(cooldownUntil.getTime()) && cooldownUntil > params.now) {
    throw new ExpressDirectConnectAuthorityTransitionError(
      409,
      "EXPRESS_AUTHORITY_COOLDOWN_ACTIVE",
      "The linked contact permission is currently in cooldown."
    );
  }
  if (
    String(authorityRow.decision_card_user_id || "") !== requesterUserId ||
    String(authorityRow.decision_card_status || "") !== "active" ||
    String(authorityRow.decision_card_intent || "") !== intent ||
    String(authorityRow.decision_card_scope || "") !== decisionScope ||
    String(authorityRow.contact_permission_id || "") !== contactPermissionId ||
    String(authorityRow.permission_requester_id || "") !== requesterUserId ||
    String(authorityRow.permission_target_user_id || "") !== params.providerUserId
  ) {
    throw new ExpressDirectConnectAuthorityTransitionError(
      409,
      "EXPRESS_AUTHORITY_ROW_MISMATCH",
      "The linked contact authority does not belong to this request and provider."
    );
  }

  const pendingAuthorityIsExact =
    permissionDisposition === "created_pending" &&
    permissionStatus === "pending" &&
    String(authorityRow.permission_authority_gate || "") === "decision_card" &&
    String(authorityRow.permission_decision_card_id || "") === sourceDecisionCardId &&
    String(authorityRow.permission_intent || "") === intent &&
    String(authorityRow.permission_decision_scope || "") === decisionScope;
  const acceptedAuthorityIsReused =
    permissionDisposition === "accepted_reused" && permissionStatus === "accepted";
  if (!pendingAuthorityIsExact && !acceptedAuthorityIsReused) {
    throw new ExpressDirectConnectAuthorityTransitionError(
      409,
      "EXPRESS_AUTHORITY_STATE_CONFLICT",
      "The linked contact permission changed before the provider response."
    );
  }

  const isAccept = params.decision === "accept";
  const fromContactGateState = String(
    metadata.contactGateState ||
      (acceptedAuthorityIsReused ? "accepted_existing_relationship" : "pending_provider_response")
  );
  const contactGateState = isAccept ? "accepted" : "provider_declined";
  const responseReason = isAccept
    ? "express_assignment_accepted"
    : params.declineReason || "express_assignment_declined";

  if (pendingAuthorityIsExact) {
    const nextPermissionStatus = isAccept ? "accepted" : "declined";
    const [updatedPermission] = await tx
      .update(contactPermissions)
      .set({
        status: nextPermissionStatus,
        respondedAt: params.now,
        respondedBy: params.providerUserId,
        responseReason,
        updatedAt: params.now,
      })
      .where(
        and(
          eq(contactPermissions.id, contactPermissionId),
          eq(contactPermissions.status, "pending")
        )
      )
      .returning({ id: contactPermissions.id });
    if (!updatedPermission?.id) {
      throw new ExpressDirectConnectAuthorityTransitionError(
        409,
        "EXPRESS_AUTHORITY_UPDATE_CONFLICT",
        "The linked contact permission could not be transitioned safely."
      );
    }
  }

  await tx.insert(contactPermissionEvents).values({
    contactPermissionId,
    requesterId: requesterUserId,
    targetUserId: params.providerUserId,
    actorId: params.providerUserId,
    eventType: pendingAuthorityIsExact
      ? isAccept
        ? "accepted"
        : "declined"
      : isAccept
        ? "express_authority_confirmed"
        : "express_scope_declined_existing_relationship",
    fromStatus: pendingAuthorityIsExact ? "pending" : "accepted",
    toStatus: pendingAuthorityIsExact ? (isAccept ? "accepted" : "declined") : "accepted",
    reasonCode: responseReason,
    metadata: {
      workRequestId,
      decision: params.decision,
      fromContactGateState,
      contactGateState,
      contactReleased: isAccept,
      permissionDisposition,
      contactPreference,
    },
    authorityGate: "decision_card",
    sourceDecisionCardId,
    sourceScoutRecommendationId: null,
    intent,
    decisionScope,
  });

  const [updatedDecisionCard] = await tx
    .update(decisionCards)
    .set({
      status: isAccept ? "completed" : "archived",
      decidedAt: params.now,
      updatedAt: params.now,
    })
    .where(
      and(
        eq(decisionCards.id, sourceDecisionCardId),
        eq(decisionCards.userId, requesterUserId),
        eq(decisionCards.status, "active")
      )
    )
    .returning({ id: decisionCards.id });
  if (!updatedDecisionCard?.id) {
    throw new ExpressDirectConnectAuthorityTransitionError(
      409,
      "EXPRESS_DECISION_CARD_UPDATE_CONFLICT",
      "The Express Decision Card could not be completed safely."
    );
  }

  await tx.insert(workRequestEvents).values({
    workRequestId,
    type: "updated",
    actorUserId: params.providerUserId,
    metadata: {
      kind: "contact_authority_transition",
      authorityGate: "decision_card",
      sourceDecisionCardId,
      contactPermissionId,
      intent,
      decisionScope,
      providerUserId: params.providerUserId,
      decision: params.decision,
      fromContactGateState,
      contactGateState,
      contactReleased: isAccept,
      contactPreference,
    },
  });

  return {
    sourceDecisionCardId,
    contactPermissionId,
    contactPreference: contactPreference as "platform_message" | "call",
    fromContactGateState,
    contactGateState,
    contactReleased: isAccept,
  };
}

export class ExpressDirectConnectContactReleaseError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ExpressDirectConnectContactReleaseError";
  }
}

export type ExpressDirectConnectReleasedContact = {
  assignmentId: string;
  workRequestId: string;
  requesterUserId: string;
  contactPreference: "platform_message" | "call";
  contactGateState: "accepted";
  phone: string | null;
};

export async function loadExpressDirectConnectReleasedContact(
  tx: any,
  params: {
    assignmentRow: any;
    requestRow: any;
    providerUserId: string;
  }
): Promise<ExpressDirectConnectReleasedContact> {
  const assignmentId = String(params.assignmentRow?.id || "");
  const assignmentStatus = String(params.assignmentRow?.status || "");
  const assignedProviderUserId = String(
    params.assignmentRow?.responderUserId ?? params.assignmentRow?.responder_user_id ?? ""
  );
  const assignmentWorkRequestId = String(
    params.assignmentRow?.workRequestId ?? params.assignmentRow?.work_request_id ?? ""
  );
  if (
    !assignmentId ||
    !assignedProviderUserId ||
    assignedProviderUserId !== params.providerUserId
  ) {
    throw new ExpressDirectConnectContactReleaseError(
      404,
      "EXPRESS_ASSIGNMENT_NOT_FOUND",
      "Assignment not found."
    );
  }
  if (assignmentStatus !== "accepted") {
    throw new ExpressDirectConnectContactReleaseError(
      409,
      "EXPRESS_CONTACT_NOT_RELEASED",
      "Contact remains gated until this assignment is accepted."
    );
  }

  const workRequestId = String(params.requestRow?.id || "");
  const requesterUserId = String(
    params.requestRow?.createdByUserId ?? params.requestRow?.created_by_user_id ?? ""
  );
  const requestProfileId = String(
    params.requestRow?.sourceRefId ?? params.requestRow?.source_ref_id ?? ""
  );
  if (
    !workRequestId ||
    assignmentWorkRequestId !== workRequestId ||
    String(params.requestRow?.source || "") !== "direct_connect" ||
    !requesterUserId ||
    !requestProfileId
  ) {
    throw new ExpressDirectConnectContactReleaseError(
      404,
      "EXPRESS_ASSIGNMENT_NOT_FOUND",
      "Assignment not found."
    );
  }

  const createdEventResult = await tx.execute(sql`
    SELECT metadata
    FROM work_request_events
    WHERE work_request_id = ${workRequestId}
      AND type = 'created'
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  `);
  const metadata = authorityRecord(createdEventResult.rows?.[0]?.metadata);
  const sourceDecisionCardId = String(metadata?.sourceDecisionCardId || "");
  const contactPermissionId = String(metadata?.contactPermissionId || "");
  const decisionScope = String(metadata?.decisionScope || "");
  const permissionDisposition = String(metadata?.permissionDisposition || "");
  const contactPreference = String(metadata?.contactPreference || "");
  const scope = authorityRecord(decisionScope);
  const scopeMatchesRequest =
    metadata?.source === "tradepartner_profile" &&
    metadata?.connectionMode === "express" &&
    metadata?.authorityGate === "decision_card" &&
    String(metadata?.intent || "") === "hire" &&
    sourceDecisionCardId.length > 0 &&
    contactPermissionId.length > 0 &&
    (contactPreference === "call" || contactPreference === "platform_message") &&
    scope?.kind === "tradepartner_profile_express" &&
    String(scope.workRequestId || "") === workRequestId &&
    String(scope.requesterUserId || "") === requesterUserId &&
    String(scope.providerUserId || "") === params.providerUserId &&
    String(scope.profileId || "") === requestProfileId &&
    requestProfileId === String(metadata?.profileId || "") &&
    String(scope.profileSlug || "") ===
      String(metadata?.businessSlug || metadata?.profileSlug || "") &&
    String(scope.businessId || "") === String(metadata?.businessId || "") &&
    String(scope.contactPreference || "") === contactPreference;
  if (!scopeMatchesRequest) {
    throw new ExpressDirectConnectContactReleaseError(
      409,
      "EXPRESS_CONTACT_AUTHORITY_INVALID",
      "The accepted assignment does not have matching contact authority."
    );
  }

  const authorityResult = await tx.execute(sql`
    SELECT
      dc.user_id AS decision_card_user_id,
      dc.status AS decision_card_status,
      dc.intent AS decision_card_intent,
      dc.decision_scope AS decision_card_scope,
      dc.decided_at AS decision_card_decided_at,
      cp.requester_id AS permission_requester_id,
      cp.target_user_id AS permission_target_user_id,
      cp.status AS permission_status,
      cp.authority_gate AS permission_authority_gate,
      cp.source_decision_card_id AS permission_decision_card_id,
      cp.intent AS permission_intent,
      cp.decision_scope AS permission_decision_scope,
      cp.responded_at AS permission_responded_at,
      cp.responded_by AS permission_responded_by
    FROM decision_cards dc
    JOIN contact_permissions cp ON cp.id = ${contactPermissionId}
    WHERE dc.id = ${sourceDecisionCardId}
    FOR SHARE OF dc, cp
  `);
  const authorityRow = (authorityResult.rows?.[0] as any) || null;
  const pairAndCardMatch =
    authorityRow &&
    String(authorityRow.decision_card_user_id || "") === requesterUserId &&
    String(authorityRow.decision_card_status || "") === "completed" &&
    String(authorityRow.decision_card_intent || "") === "hire" &&
    String(authorityRow.decision_card_scope || "") === decisionScope &&
    Boolean(authorityRow.decision_card_decided_at) &&
    String(authorityRow.permission_requester_id || "") === requesterUserId &&
    String(authorityRow.permission_target_user_id || "") === params.providerUserId &&
    String(authorityRow.permission_status || "") === "accepted";
  const exactCreatedPermission =
    permissionDisposition === "created_pending" &&
    pairAndCardMatch &&
    String(authorityRow.permission_authority_gate || "") === "decision_card" &&
    String(authorityRow.permission_decision_card_id || "") === sourceDecisionCardId &&
    String(authorityRow.permission_intent || "") === "hire" &&
    String(authorityRow.permission_decision_scope || "") === decisionScope &&
    String(authorityRow.permission_responded_by || "") === params.providerUserId &&
    Boolean(authorityRow.permission_responded_at);
  const acceptedPairWasReused = permissionDisposition === "accepted_reused" && pairAndCardMatch;
  if (!exactCreatedPermission && !acceptedPairWasReused) {
    throw new ExpressDirectConnectContactReleaseError(
      409,
      "EXPRESS_CONTACT_AUTHORITY_INVALID",
      "The accepted assignment does not have matching contact authority."
    );
  }

  const gateEventResult = await tx.execute(sql`
    SELECT metadata
    FROM work_request_events
    WHERE work_request_id = ${workRequestId}
      AND type = 'updated'
      AND actor_user_id = ${params.providerUserId}
      AND metadata->>'kind' = 'contact_authority_transition'
      AND metadata->>'sourceDecisionCardId' = ${sourceDecisionCardId}
      AND metadata->>'contactPermissionId' = ${contactPermissionId}
      AND metadata->>'contactGateState' = 'accepted'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);
  const gateMetadata = authorityRecord(gateEventResult.rows?.[0]?.metadata);
  if (
    gateMetadata?.contactReleased !== true ||
    String(gateMetadata?.decisionScope || "") !== decisionScope ||
    String(gateMetadata?.decision || "") !== "accept" ||
    String(gateMetadata?.contactPreference || "") !== contactPreference
  ) {
    throw new ExpressDirectConnectContactReleaseError(
      409,
      "EXPRESS_CONTACT_AUTHORITY_INVALID",
      "The accepted assignment has no completed contact release event."
    );
  }

  if (acceptedPairWasReused) {
    const reuseEventResult = await tx.execute(sql`
      SELECT id
      FROM contact_permission_events
      WHERE contact_permission_id = ${contactPermissionId}
        AND requester_id = ${requesterUserId}
        AND target_user_id = ${params.providerUserId}
        AND actor_id = ${params.providerUserId}
        AND event_type = 'express_authority_confirmed'
        AND source_decision_card_id = ${sourceDecisionCardId}
        AND decision_scope = ${decisionScope}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    if (!reuseEventResult.rows?.[0]?.id) {
      throw new ExpressDirectConnectContactReleaseError(
        409,
        "EXPRESS_CONTACT_AUTHORITY_INVALID",
        "The reused contact authority was not confirmed for this request."
      );
    }
  }

  // Platform-message consent authorizes only the governed conversation. It
  // never authorizes a raw phone or email read, even after provider acceptance.
  if (contactPreference === "platform_message") {
    return {
      assignmentId,
      workRequestId,
      requesterUserId,
      contactPreference,
      contactGateState: "accepted",
      phone: null,
    };
  }

  const requesterContactResult = await tx.execute(sql`
    SELECT phone
    FROM users
    WHERE id = ${requesterUserId}
    LIMIT 1
  `);
  const requesterContact = (requesterContactResult.rows?.[0] as any) || null;
  const phone = String(requesterContact?.phone || "").trim();
  if (!phone) {
    throw new ExpressDirectConnectContactReleaseError(
      409,
      "EXPRESS_CONTACT_DETAILS_UNAVAILABLE",
      "Requester contact details are unavailable."
    );
  }

  return {
    assignmentId,
    workRequestId,
    requesterUserId,
    contactPreference: contactPreference as "platform_message" | "call",
    contactGateState: "accepted",
    phone,
  };
}
