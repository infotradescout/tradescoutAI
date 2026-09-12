import { sql, type SQL } from "drizzle-orm";

type Transaction = { execute: (statement: SQL) => Promise<unknown> };

/**
 * Called only after the existing Express Decision Card and permission checks
 * succeed, in the SAME assignment-acceptance transaction. This creates the
 * missing request-scoped dispatch records; it does not approve contact release,
 * create a job, send a message, publish a profile, or confer general eligibility.
 */
export async function persistAcceptedExpressDispatch(
  tx: Transaction,
  args: {
    request: Record<string, any>;
    requesterUserId: string;
    providerUserId: string;
    businessId: string;
    sourceDecisionCardId: string;
    requestType: string;
  }
): Promise<void> {
  const requestId = String(args.request.id || "");
  if (
    !requestId || !args.requesterUserId || !args.providerUserId || !args.businessId ||
    !args.sourceDecisionCardId || args.requesterUserId === args.providerUserId ||
    args.request.source !== "direct_connect"
  ) throw new Error("Accepted Express request has incomplete dispatch identity");

  const description = String(args.request.description || "");
  const title = String(args.request.title || "Business request");
  const county = args.request.countyFips ?? args.request.county_fips ?? null;
  const requestType = args.requestType || "business_request";
  const answers = {
    what: title, where: county ? String(county) : "", when: "", details: description,
    expressAuthority: {
      sourceDecisionCardId: args.sourceDecisionCardId,
      providerUserId: args.providerUserId,
      businessId: args.businessId,
    },
  };

  // Never overwrite an existing ledger's contact state, owner, or scope. The
  // second statement validates an existing parent before binding a candidate.
  await tx.execute(sql`
    INSERT INTO direct_connect_dispatch_requests (
      id, user_id, intent, request_type, category, county, city_area, urgency,
      description, answers_json, completeness_state, routing_readiness_state,
      visibility_state, contact_gate_state, source_surface, created_at, updated_at
    ) VALUES (
      ${requestId}, ${args.requesterUserId}, 'hire', ${requestType},
      ${String(args.request.category || "business_request")}, ${county}, NULL, NULL,
      ${description}, ${JSON.stringify(answers)}::jsonb,
      'ready_to_share', ${county ? "route_ready" : "needs_location"},
      'review_ready', 'locked', 'tradepartner_profile_express', now(), now()
    ) ON CONFLICT (id) DO NOTHING
  `);

  // A conflicting parent yields NULL for request_id, whose existing NOT NULL
  // constraint aborts the surrounding transaction. A conflicting deterministic
  // candidate fails the same way, rather than replacing someone else's scope.
  // No separate read/commit window can leave an accepted but unlinked request.
  await tx.execute(sql`
    INSERT INTO direct_connect_dispatch_candidates (
      id, request_id, business_id, responder_user_id, eligibility_state,
      eligibility_reasons, ineligibility_reasons, territory_matched,
      category_matched, verification_state, profile_readiness,
      contact_eligibility, trust_state, created_at
    ) VALUES (
      ${`express-accepted:${requestId}`},
      (SELECT id FROM direct_connect_dispatch_requests
       WHERE id = ${requestId}
         AND user_id = ${args.requesterUserId}
         AND source_surface = 'tradepartner_profile_express'
         AND answers_json #>> '{expressAuthority,sourceDecisionCardId}' = ${args.sourceDecisionCardId}
         AND answers_json #>> '{expressAuthority,providerUserId}' = ${args.providerUserId}
         AND answers_json #>> '{expressAuthority,businessId}' = ${args.businessId}),
      ${args.businessId}, ${args.providerUserId}, 'eligible',
      '["requester_selected_business", "scoped_provider_acceptance"]'::jsonb,
      '[]'::jsonb, NULL, NULL, 'unknown', 'unknown', NULL, 'unknown', now()
    ) ON CONFLICT (id) DO UPDATE SET
      request_id = CASE WHEN
        direct_connect_dispatch_candidates.request_id = EXCLUDED.request_id
        AND direct_connect_dispatch_candidates.business_id = EXCLUDED.business_id
        AND direct_connect_dispatch_candidates.responder_user_id = EXCLUDED.responder_user_id
        AND direct_connect_dispatch_candidates.eligibility_state = 'eligible'
        THEN direct_connect_dispatch_candidates.request_id ELSE NULL END
  `);
}
