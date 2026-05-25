import { randomUUID } from "crypto";
import { db } from "../db";
import { sql } from "drizzle-orm";
import type {
  CanonicalDirectConnectRequest,
  ContractorEligibilityResult,
} from "@shared/directConnectRoutingSpine";

export type ContactGateState =
  | "locked"
  | "contractor_requested"
  | "user_approved"
  | "released"
  | "denied"
  | "expired";

export async function ensureDirectConnectDispatchLedgerTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_dispatch_requests (
      id text PRIMARY KEY,
      user_id text NULL,
      anonymous_session_id text NULL,
      intent text NOT NULL,
      request_type text NOT NULL,
      category text NOT NULL,
      county text NULL,
      city_area text NULL,
      urgency text NULL,
      description text NOT NULL,
      answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      completeness_state text NOT NULL,
      routing_readiness_state text NOT NULL,
      visibility_state text NOT NULL,
      contact_gate_state text NOT NULL DEFAULT 'locked',
      source_surface text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_dispatch_candidates (
      id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
      business_id text NULL,
      contractor_id text NULL,
      responder_user_id text NULL,
      worker_id text NULL,
      eligibility_state text NOT NULL,
      eligibility_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
      ineligibility_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
      territory_matched boolean NOT NULL DEFAULT false,
      category_matched boolean NOT NULL DEFAULT false,
      verification_state text NOT NULL DEFAULT 'unknown',
      profile_readiness text NOT NULL DEFAULT 'unknown',
      contact_eligibility boolean NOT NULL DEFAULT false,
      trust_state text NOT NULL DEFAULT 'unknown',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_dispatch_events (
      event_id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
      actor_type text NOT NULL,
      actor_id text NULL,
      event_type text NOT NULL,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_contractor_responses (
      id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
      contractor_id text NULL,
      responder_user_id text NULL,
      response_type text NOT NULL,
      message text NULL,
      availability text NULL,
      estimated_timing text NULL,
      contact_request_state text NOT NULL DEFAULT 'locked',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function persistFinalizedDispatchRequest(args: {
  canonical: CanonicalDirectConnectRequest;
  userId?: string | null;
  anonymousSessionId?: string | null;
}) {
  const now = new Date().toISOString();
  await db.execute(sql`
    INSERT INTO direct_connect_dispatch_requests (
      id, user_id, anonymous_session_id, intent, request_type, category, county, city_area, urgency, description,
      answers_json, completeness_state, routing_readiness_state, visibility_state, contact_gate_state, source_surface, created_at, updated_at
    )
    VALUES (
      ${args.canonical.requestId},
      ${args.userId ?? null},
      ${args.anonymousSessionId ?? null},
      ${args.canonical.intent},
      ${args.canonical.requestType},
      ${args.canonical.category},
      ${args.canonical.county},
      ${args.canonical.cityArea},
      ${args.canonical.urgency},
      ${args.canonical.description},
      ${JSON.stringify(args.canonical.answers)}::jsonb,
      ${args.canonical.completenessState},
      ${args.canonical.routingReadiness},
      ${args.canonical.visibilityState},
      ${args.canonical.contactGateState},
      ${args.canonical.sourceSurface},
      ${args.canonical.createdAt || now}::timestamptz,
      ${now}::timestamptz
    )
    ON CONFLICT (id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      anonymous_session_id = EXCLUDED.anonymous_session_id,
      intent = EXCLUDED.intent,
      request_type = EXCLUDED.request_type,
      category = EXCLUDED.category,
      county = EXCLUDED.county,
      city_area = EXCLUDED.city_area,
      urgency = EXCLUDED.urgency,
      description = EXCLUDED.description,
      answers_json = EXCLUDED.answers_json,
      completeness_state = EXCLUDED.completeness_state,
      routing_readiness_state = EXCLUDED.routing_readiness_state,
      visibility_state = EXCLUDED.visibility_state,
      contact_gate_state = EXCLUDED.contact_gate_state,
      source_surface = EXCLUDED.source_surface,
      updated_at = ${now}::timestamptz
  `);
}

export async function appendDispatchEvent(args: {
  requestId: string;
  actorType: "requester" | "contractor" | "system" | "staff";
  actorId?: string | null;
  eventType:
    | "request_finalized"
    | "request_route_ready"
    | "request_route_blocked"
    | "candidate_eligible"
    | "candidate_ineligible"
    | "request_shared"
    | "contact_requested"
    | "contact_released"
    | "contractor_responded"
    | "contractor_viewed_request"
    | "homeowner_viewed_request"
    | "homeowner_viewed_response"
    | "contact_approved"
    | "contact_denied"
    | "request_closed";
  metadata?: Record<string, unknown>;
}) {
  await db.execute(sql`
    INSERT INTO direct_connect_dispatch_events (
      event_id, request_id, actor_type, actor_id, event_type, metadata_json, created_at
    )
    VALUES (
      ${randomUUID()},
      ${args.requestId},
      ${args.actorType},
      ${args.actorId ?? null},
      ${args.eventType},
      ${JSON.stringify(args.metadata || {})}::jsonb,
      now()
    )
  `);
}

export async function snapshotDispatchCandidate(args: {
  requestId: string;
  businessId?: string | null;
  contractorId?: string | null;
  responderUserId?: string | null;
  workerId?: string | null;
  eligibility: ContractorEligibilityResult;
  eligibilityReasons?: string[];
  ineligibilityReasons?: string[];
  territoryMatched: boolean;
  categoryMatched: boolean;
  verificationState: string;
  profileReadiness: string;
  contactEligibility: boolean;
  trustState: string;
}) {
  await db.execute(sql`
    INSERT INTO direct_connect_dispatch_candidates (
      id, request_id, business_id, contractor_id, responder_user_id, worker_id,
      eligibility_state, eligibility_reasons, ineligibility_reasons,
      territory_matched, category_matched, verification_state, profile_readiness, contact_eligibility, trust_state, created_at
    )
    VALUES (
      ${randomUUID()},
      ${args.requestId},
      ${args.businessId ?? null},
      ${args.contractorId ?? null},
      ${args.responderUserId ?? null},
      ${args.workerId ?? null},
      ${args.eligibility.status},
      ${JSON.stringify(args.eligibilityReasons || [])}::jsonb,
      ${JSON.stringify(args.ineligibilityReasons || [])}::jsonb,
      ${args.territoryMatched},
      ${args.categoryMatched},
      ${args.verificationState},
      ${args.profileReadiness},
      ${args.contactEligibility},
      ${args.trustState},
      now()
    )
  `);
}

export async function setDispatchContactGateState(args: {
  requestId: string;
  nextState: ContactGateState;
}) {
  if (args.nextState === "released") {
    const result = await db.execute(sql`
      UPDATE direct_connect_dispatch_requests
      SET contact_gate_state = 'released', updated_at = now()
      WHERE id = ${args.requestId}
        AND contact_gate_state = 'user_approved'
    `);
    const updated = Number((result as any)?.rowCount || 0);
    if (updated < 1) {
      throw new Error("CONTACT_RELEASE_REQUIRES_APPROVAL");
    }
    return;
  }
  await db.execute(sql`
    UPDATE direct_connect_dispatch_requests
    SET contact_gate_state = ${args.nextState}, updated_at = now()
    WHERE id = ${args.requestId}
  `);
}

export async function recordContractorResponse(args: {
  requestId: string;
  contractorId?: string | null;
  responderUserId?: string | null;
  responseType: "interested" | "need_more_info" | "not_a_fit" | "unavailable";
  message?: string | null;
  availability?: string | null;
  estimatedTiming?: string | null;
  contactRequestState: ContactGateState;
}) {
  await db.execute(sql`
    INSERT INTO direct_connect_contractor_responses (
      id, request_id, contractor_id, responder_user_id, response_type, message, availability, estimated_timing, contact_request_state, created_at
    )
    VALUES (
      ${randomUUID()},
      ${args.requestId},
      ${args.contractorId ?? null},
      ${args.responderUserId ?? null},
      ${args.responseType},
      ${args.message ?? null},
      ${args.availability ?? null},
      ${args.estimatedTiming ?? null},
      ${args.contactRequestState},
      now()
    )
  `);
}
