import { z } from "zod";
import {
  PROFILE_REQUEST_SOURCE,
  ProfileRequestDecisionError,
  profileRequestDecisionService,
  type LockedProfileRequestDecision,
  type ProfileRequestDecisionQueryClient,
} from "./profileRequestDecisionService";
import {
  canExposePublishedProfilePublicly,
  hasTradeScoutPendingOwnerCustody,
} from "./ownerConfirmedDirectProfile";

const requestTypeSchema = z.enum([
  "request_material",
  "match_project",
  "ask_about_bundle",
  "schedule_showroom",
  "request_service",
  "request_quote",
  "ask_question",
  "schedule_service",
  "other",
]);

const stagedProfileRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().min(1).max(40),
    requestType: requestTypeSchema,
    message: z.string().trim().min(1).max(3000),
    stoneName: z.string().trim().max(180).nullable().optional(),
    serviceName: z.string().trim().max(180).nullable().optional(),
    itemId: z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .nullable()
      .optional(),
    stoneSelections: z
      .array(
        z
          .object({
            itemId: z
              .string()
              .trim()
              .max(120)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            stoneName: z.string().trim().min(1).max(180),
          })
          .strict()
      )
      .max(12)
      .default([]),
    updatesOptIn: z.boolean().default(false),
    discoveryEntryRequestId: z.string().trim().min(1).max(255).nullable().optional(),
  })
  .strict();

export type StagedProfileRequestPayload = z.infer<typeof stagedProfileRequestSchema>;

export type ConfirmedAnonymousProfileRequest = {
  workRequestId: string;
  workRequestStatus: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterWasCreated: boolean;
  title: string;
  createdAt: Date;
  body: StagedProfileRequestPayload;
  target: {
    profileId: string;
    profileSlug: string;
    businessId: string;
    businessName: string;
    ownerUserId: string;
    notificationEmail: string;
    deliveryCustody: "business" | "tradescout_pending_owner";
  };
};

type RequesterRow = {
  id: string;
  email: string;
};

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "TradeScout",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function requestTitle(
  requestType: StagedProfileRequestPayload["requestType"],
  businessName: string
) {
  const labels: Record<StagedProfileRequestPayload["requestType"], string> = {
    request_material: "Material request",
    match_project: "Stone selection for a project",
    ask_about_bundle: "Bundle availability request",
    schedule_showroom: "Showroom visit request",
    request_service: "Service request",
    request_quote: "Quote request",
    ask_question: "Business question",
    schedule_service: "Service scheduling request",
    other: "Direct request",
  };
  return `${labels[requestType]} for ${businessName}`.slice(0, 180);
}

function assertTargetAuthority(decision: LockedProfileRequestDecision): void {
  const candidate = {
    profileSlug: decision.target.profileSlug,
    profileStatus: decision.target.profileStatus,
    profileRoleContext: decision.target.profileRoleContext,
    profileOwnerUserId: decision.target.profileOwnerUserId,
    businessStatus: decision.target.businessStatus,
    businessOwnerUserId: decision.target.businessOwnerUserId,
    publicDiscoveryEnabled: decision.target.publicDiscoveryEnabled,
    businessSources: decision.target.businessSources,
    businessClaimStatus: decision.target.businessClaimStatus,
    ownerProvider: decision.target.ownerProvider,
    ownerPreferences: decision.target.ownerPreferences,
  };
  if (
    decision.target.businessStatus !== "active" ||
    !canExposePublishedProfilePublicly({
      profileId: decision.target.profileId,
      businessId: decision.target.businessId,
      ...candidate,
      ownerVerifiedBadge: decision.target.ownerVerifiedBadge,
      ownerVerificationStatus: decision.target.ownerVerificationStatus,
    })
  ) {
    throw new ProfileRequestDecisionError("AUTHORITY_CHANGED");
  }
}

async function resolveRequesterInsideConfirmation(
  client: ProfileRequestDecisionQueryClient,
  payload: StagedProfileRequestPayload,
  profileSlug: string,
  businessId: string
): Promise<RequesterRow & { created: boolean }> {
  const email = normalizeEmail(payload.email);
  const existing = await client.query<RequesterRow>(
    `SELECT id, email
       FROM public.users
      WHERE lower(email) = $1
      ORDER BY id
      LIMIT 1
      FOR UPDATE`,
    [email]
  );
  if (existing.rows[0]) return { ...existing.rows[0], created: false };

  const { firstName, lastName } = splitName(payload.name);
  const preferences = {
    marketingEmails: payload.updatesOptIn,
    provisional: {
      userTypes: ["homeowner"],
      source: "tradepartner_profile_express_request",
      capturedAt: new Date().toISOString(),
    },
    ...(payload.updatesOptIn
      ? {
          marketingConsent: {
            source: "tradepartner_profile_express_request",
            profileSlug,
            businessId,
            topics: ["new_arrivals", "first_cuts", "promotions"],
            optedInAt: new Date().toISOString(),
          },
        }
      : {}),
  };
  const inserted = await client.query<RequesterRow>(
    `INSERT INTO public.users (
       email,
       first_name,
       last_name,
       phone,
       role,
       roles,
       active_role,
       provider,
       email_verified,
       address_verified,
       onboarding_completed,
       preferences,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, 'homeowner', ARRAY['homeowner']::text[], 'homeowner',
       'express_profile', false, false, false, $5::jsonb, NOW(), NOW()
     )
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email`,
    [email, firstName, lastName, payload.phone, JSON.stringify(preferences)]
  );
  if (inserted.rows[0]) return { ...inserted.rows[0], created: true };

  // A concurrent confirmation may have inserted the normalized address while
  // this transaction waited on the unique index. Lock and reuse that account;
  // never mutate its profile fields from an anonymous form.
  const raced = await client.query<RequesterRow>(
    `SELECT id, email
       FROM public.users
      WHERE email = $1
      LIMIT 1
      FOR UPDATE`,
    [email]
  );
  if (!raced.rows[0]) throw new Error("Confirmed profile request requester could not be resolved");
  return { ...raced.rows[0], created: false };
}

export async function finalizeConfirmedAnonymousProfileRequest(
  client: ProfileRequestDecisionQueryClient,
  decision: LockedProfileRequestDecision
): Promise<ConfirmedAnonymousProfileRequest> {
  assertTargetAuthority(decision);
  const parsedPayload = stagedProfileRequestSchema.safeParse(decision.requestPayload);
  if (!parsedPayload.success) {
    throw new ProfileRequestDecisionError("INVALID_PROOF");
  }
  const body = parsedPayload.data;
  const requester = await resolveRequesterInsideConfirmation(
    client,
    body,
    decision.target.profileSlug,
    decision.target.businessId
  );
  const title = requestTitle(body.requestType, decision.target.businessName);
  const deliveryCustody = hasTradeScoutPendingOwnerCustody({
    profileSlug: decision.target.profileSlug,
    profileStatus: decision.target.profileStatus,
    profileOwnerUserId: decision.target.profileOwnerUserId,
    businessStatus: decision.target.businessStatus,
    businessOwnerUserId: decision.target.businessOwnerUserId,
    publicDiscoveryEnabled: decision.target.publicDiscoveryEnabled,
    businessSources: decision.target.businessSources,
    businessClaimStatus: decision.target.businessClaimStatus,
    ownerProvider: decision.target.ownerProvider,
    ownerPreferences: decision.target.ownerPreferences,
  })
    ? "tradescout_pending_owner"
    : "business";
  const profileData = decision.target.profileData || {};
  const notificationEmail = normalizeEmail(
    profileData.notificationEmail || profileData.email || decision.target.ownerEmail
  );
  const now = new Date();

  const createdResult = await client.query<{ id: string; status: string }>(
    `INSERT INTO public.work_requests (
       created_by_user_id,
       title,
       description,
       category,
       scope,
       source,
       source_ref_id,
       status,
       visibility,
       exposure_mode,
       competition_mode,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, 'business_request', 'personal', 'direct_connect', $4,
       'routed', 'private', 'guided', 'none', NOW(), NOW()
     )
     RETURNING id, status`,
    [requester.id, title, body.message, decision.target.profileId]
  );
  const created = createdResult.rows[0];
  if (!created) throw new Error("Confirmed profile request insert failed");

  await client.query(
    `INSERT INTO public.work_request_assignments (
       work_request_id,
       contractor_id,
       responder_user_id,
       status,
       score_snapshot,
       created_at,
       updated_at
     ) VALUES ($1, NULL, $2, 'invited', $3::jsonb, NOW(), NOW())`,
    [
      created.id,
      decision.target.ownerUserId,
      JSON.stringify({
        routingMode: "tradepartner_profile_express",
        reasons: ["Visitor selected this business from its clean profile link."],
      }),
    ]
  );

  const commonMetadata = {
    source: PROFILE_REQUEST_SOURCE,
    connectionMode: "express",
    authorityGate: "decision_card",
    sourceDecisionProofId: decision.decisionId,
    decisionScope: decision.decisionScope,
    profileId: decision.target.profileId,
    businessId: decision.target.businessId,
    businessSlug: decision.target.profileSlug,
    deliveryCustody,
  };
  await client.query(
    `INSERT INTO public.work_request_events (
       work_request_id,
       type,
       actor_user_id,
       metadata,
       created_at
     ) VALUES
       ($1, 'created', $2, $3::jsonb, NOW()),
       ($1, 'provider_invited', $2, $4::jsonb, NOW())`,
    [
      created.id,
      requester.id,
      JSON.stringify({
        ...commonMetadata,
        requestType: body.requestType,
        stoneName: body.stoneName || null,
        ...(body.stoneSelections.length ? { stoneSelections: body.stoneSelections } : {}),
        serviceName: body.serviceName || null,
        itemId: body.itemId || null,
        contactCheck: "phone_required",
        updatesOptIn: body.updatesOptIn,
        ...(body.discoveryEntryRequestId ? { entryRequestId: body.discoveryEntryRequestId } : {}),
        membershipOnboarding: requester.created
          ? "provisional_account_created_after_decision_confirmation"
          : "existing_account_attached_after_decision_confirmation",
      }),
      JSON.stringify({
        ...commonMetadata,
        responderUserId: decision.target.ownerUserId,
      }),
    ]
  );

  return {
    workRequestId: created.id,
    workRequestStatus: created.status,
    requesterUserId: requester.id,
    requesterEmail: requester.email,
    requesterWasCreated: requester.created,
    title,
    createdAt: now,
    body,
    target: {
      profileId: decision.target.profileId,
      profileSlug: decision.target.profileSlug,
      businessId: decision.target.businessId,
      businessName: decision.target.businessName,
      ownerUserId: decision.target.ownerUserId,
      notificationEmail,
      deliveryCustody,
    },
  };
}

export async function confirmAnonymousProfileRequest(args: {
  decisionProof: string;
  sessionBindingHash: string;
  targetProfileSlug: string;
}): Promise<ConfirmedAnonymousProfileRequest> {
  return profileRequestDecisionService.confirm(
    {
      decisionProof: args.decisionProof,
      sessionBindingHash: args.sessionBindingHash,
      source: PROFILE_REQUEST_SOURCE,
      targetProfileSlug: args.targetProfileSlug,
    },
    finalizeConfirmedAnonymousProfileRequest
  );
}
