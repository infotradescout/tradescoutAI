import { randomUUID } from "node:crypto";
import { isDefaultLookingAffiliateTag } from "./universalAttributionRef";
import { mirrorInfinityConversion } from "../integrations/infinityShadow";

export const SUPPORTED_ATTRIBUTION_CONVERSION_TYPES = [
  "signup_completed",
  "claim_started",
  "request_created",
  "profile_contact_clicked",
  "booking_request_started",
] as const;

export type SupportedAttributionConversionType =
  (typeof SUPPORTED_ATTRIBUTION_CONVERSION_TYPES)[number];

export type AttributionProofType = "session" | "cookie";

export type AttributionConversionFailureCode =
  | "NO_ATTRIBUTION_PROOF"
  | "MISSING_AFFILIATE_TAG"
  | "DISALLOWED_DEFAULT_TAG"
  | "UNSUPPORTED_CONVERSION_TYPE"
  | "FORBIDDEN_PAYOUT_FIELDS";

export type AttributionSessionProof = {
  referralCode?: string;
  source?: string;
  attributedAt?: string;
};

export type RecordAttributionConversionInput = {
  sessionAttribution?: AttributionSessionProof | null;
  cookieAttributionTag?: string | null;
  conversionType: string;
  source?: string | null;
  targetPath?: string | null;
  targetId?: string | null;
  payoutEligible?: boolean;
  payoutCalculated?: boolean;
  paymentTriggered?: boolean;
};

export type AttributionConversionLedgerEvent = {
  conversionEventId: string;
  affiliateTag: string;
  source: string;
  attributionProofType: AttributionProofType;
  attributionProof: string;
  conversionType: SupportedAttributionConversionType;
  targetPath: string | null;
  targetId: string | null;
  occurredAt: string;
  status: "recorded";
  payoutEligible: false;
  payoutCalculated: false;
  paymentTriggered: false;
};

export type RecordAttributionConversionResult =
  | { ok: true; event: AttributionConversionLedgerEvent }
  | {
      ok: false;
      code: AttributionConversionFailureCode;
      message: string;
    };

function normalizeMaybeString(value: unknown): string {
  return String(value || "").trim();
}

function isSupportedConversionType(value: string): value is SupportedAttributionConversionType {
  return SUPPORTED_ATTRIBUTION_CONVERSION_TYPES.includes(
    value as SupportedAttributionConversionType
  );
}

function hasForbiddenPayoutRequest(input: RecordAttributionConversionInput): boolean {
  return (
    input.payoutEligible === true ||
    input.payoutCalculated === true ||
    input.paymentTriggered === true
  );
}

function pickAttributionProof(input: RecordAttributionConversionInput): {
  affiliateTag: string;
  attributionProofType: AttributionProofType;
  attributionProof: string;
  sourceFromProof: string;
} | null {
  const sessionTag = normalizeMaybeString(input.sessionAttribution?.referralCode);
  if (sessionTag) {
    const proof = {
      referralCode: sessionTag,
      source: normalizeMaybeString(input.sessionAttribution?.source) || "universal_ref",
      attributedAt:
        normalizeMaybeString(input.sessionAttribution?.attributedAt) || new Date().toISOString(),
    };
    return {
      affiliateTag: sessionTag,
      attributionProofType: "session",
      attributionProof: JSON.stringify(proof),
      sourceFromProof: proof.source,
    };
  }

  const cookieTag = normalizeMaybeString(input.cookieAttributionTag);
  if (cookieTag) {
    return {
      affiliateTag: cookieTag,
      attributionProofType: "cookie",
      attributionProof: JSON.stringify({ referralCode: cookieTag }),
      sourceFromProof: "cookie_ref",
    };
  }

  return null;
}

export async function recordAttributionConversionEvent(params: {
  input: RecordAttributionConversionInput;
  persist: (event: AttributionConversionLedgerEvent) => Promise<void>;
  now?: () => Date;
}): Promise<RecordAttributionConversionResult> {
  if (hasForbiddenPayoutRequest(params.input)) {
    return {
      ok: false,
      code: "FORBIDDEN_PAYOUT_FIELDS",
      message: "Payout/payment flags are forbidden in attribution conversion recording",
    };
  }

  const proof = pickAttributionProof(params.input);
  if (!proof) {
    return {
      ok: false,
      code: "NO_ATTRIBUTION_PROOF",
      message: "A valid attribution session or cookie proof is required",
    };
  }

  const affiliateTag = normalizeMaybeString(proof.affiliateTag);
  if (!affiliateTag) {
    return {
      ok: false,
      code: "MISSING_AFFILIATE_TAG",
      message: "Affiliate tag is required",
    };
  }

  if (isDefaultLookingAffiliateTag(affiliateTag)) {
    return {
      ok: false,
      code: "DISALLOWED_DEFAULT_TAG",
      message: "Default-looking affiliate tags are not allowed",
    };
  }

  const conversionType = normalizeMaybeString(params.input.conversionType);
  if (!isSupportedConversionType(conversionType)) {
    return {
      ok: false,
      code: "UNSUPPORTED_CONVERSION_TYPE",
      message: "Conversion type is not supported for attribution recording",
    };
  }

  const nowIso = (params.now ? params.now() : new Date()).toISOString();
  const event: AttributionConversionLedgerEvent = {
    conversionEventId: randomUUID(),
    affiliateTag,
    source: normalizeMaybeString(params.input.source) || proof.sourceFromProof,
    attributionProofType: proof.attributionProofType,
    attributionProof: proof.attributionProof,
    conversionType,
    targetPath: normalizeMaybeString(params.input.targetPath) || null,
    targetId: normalizeMaybeString(params.input.targetId) || null,
    occurredAt: nowIso,
    status: "recorded",
    payoutEligible: false,
    payoutCalculated: false,
    paymentTriggered: false,
  };

  await params.persist(event);
  void mirrorInfinityConversion({
    conversionEventId: event.conversionEventId,
    conversionType: event.conversionType,
    targetPath: event.targetPath,
    targetId: event.targetId,
    attributionProofId: event.conversionEventId,
  });
  return { ok: true, event };
}
