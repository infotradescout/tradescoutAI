import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type {
  NotaryIntakeDecision,
  NotaryIntakeRequest,
  NotaryStatePolicy,
} from "@shared/legalNotary";

const router = Router();

const STATE_POLICIES: Record<string, NotaryStatePolicy> = {
  LA: {
    stateCode: "LA",
    stateName: "Louisiana",
    status: "live",
    mobileNotaryAvailable: true,
    remoteOnlineNotaryAllowed: false,
    lastReviewedOn: "2026-02-27",
    serviceSummary:
      "Louisiana mobile notary support is enabled for in-person travel appointments with policy checks.",
    allowedServiceTypes: [
      "acknowledgment",
      "jurat",
      "affidavit",
      "power_of_attorney",
      "real_estate_closing_package",
      "business_authorization",
    ],
    restrictedDocumentTypes: ["testament", "codicil", "family_law_final_order"],
    requiredIntakeFields: [
      "stateCode",
      "serviceType",
      "documentType",
      "signerCount",
      "serviceAddress1",
      "serviceCity",
      "serviceZipCode",
      "preferredArrivalWindow",
      "government_id_front",
      "government_id_back",
      "unsigned_document_pdf",
    ],
    complianceNotes: [
      "Final notary assignment must use an active Louisiana-commissioned notary.",
      "Identity proofing and credential checks are mandatory before an in-person signing session.",
      "Certain high-risk document classes are routed to manual legal review.",
      "Parish or court-specific filing rules may add document handling requirements.",
    ],
    disclaimer:
      "TradeScout provides workflow support and compliance checks, not legal advice. Confirm legal sufficiency with licensed counsel.",
  },
};

const intakeSchema = z.object({
  stateCode: z.string().length(2),
  serviceType: z.string().min(2).max(100),
  documentType: z.string().min(2).max(120),
  countyFips: z.string().length(5).optional().nullable(),
  signerCount: z.number().int().min(1).max(20).optional(),
  serviceAddress1: z.string().min(5).max(180).optional(),
  serviceCity: z.string().min(2).max(80).optional(),
  serviceZipCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  preferredArrivalWindow: z.string().min(4).max(120).optional(),
});

function evaluateIntake(input: NotaryIntakeRequest): NotaryIntakeDecision {
  const stateCode = input.stateCode.toUpperCase();
  const policy = STATE_POLICIES[stateCode];

  if (!policy || policy.status !== "live") {
    return {
      eligible: false,
      stateCode,
      status: "unsupported",
      reason: "State support is not live yet.",
      nextSteps: [
        "Join the waitlist for this state.",
        "Use a local in-person notary path if immediate service is required.",
      ],
      requiredUploads: [],
    };
  }

  if (!policy.mobileNotaryAvailable) {
    return {
      eligible: false,
      stateCode,
      status: "unsupported",
      reason: "Mobile notary support is not live for this state.",
      nextSteps: [
        "Join the mobile notary waitlist for this state.",
        "Use a local in-person notary office if immediate service is required.",
      ],
      requiredUploads: [],
    };
  }

  const normalizedServiceType = input.serviceType.trim().toLowerCase();
  const normalizedDocumentType = input.documentType.trim().toLowerCase();
  const restricted = policy.restrictedDocumentTypes.includes(normalizedDocumentType);
  const serviceAllowed = policy.allowedServiceTypes.includes(normalizedServiceType);
  const hasMobileLocation =
    Boolean(input.serviceAddress1?.trim()) &&
    Boolean(input.serviceCity?.trim()) &&
    Boolean(input.serviceZipCode?.trim()) &&
    Boolean(input.preferredArrivalWindow?.trim());

  if (!hasMobileLocation) {
    return {
      eligible: false,
      stateCode,
      status: "manual_review",
      reason: "Mobile appointment details are incomplete.",
      nextSteps: [
        "Provide service address, city, zip code, and preferred arrival window.",
        "Resubmit intake for automated path eligibility.",
      ],
      requiredUploads: [],
    };
  }

  if (restricted) {
    return {
      eligible: false,
      stateCode,
      status: "manual_review",
      reason: "Document type requires manual legal/compliance review before scheduling.",
      nextSteps: [
        "Submit intake package for manual legal review.",
        "Await case-level guidance before a mobile appointment is scheduled.",
      ],
      requiredUploads: [
        "government_id_front",
        "government_id_back",
        "unsigned_document_pdf",
        "supporting_case_context",
      ],
    };
  }

  if (!serviceAllowed) {
    return {
      eligible: false,
      stateCode,
      status: "manual_review",
      reason: "Service type is outside the default Louisiana automation profile.",
      nextSteps: [
        "Submit for manual policy review.",
        "A notary operations specialist will confirm allowed handling.",
      ],
      requiredUploads: ["government_id_front", "government_id_back", "unsigned_document_pdf"],
    };
  }

  return {
    eligible: true,
    stateCode,
    status: "approved_path",
    reason: "Eligible for the Louisiana mobile notary path.",
    nextSteps: [
      "Complete signer identity verification.",
      "Upload unsigned document package.",
      "Confirm mobile service address and arrival window.",
      "Schedule in-person mobile notary appointment.",
    ],
    requiredUploads: ["government_id_front", "government_id_back", "unsigned_document_pdf"],
  };
}

router.get("/states", (_req: Request, res: Response) => {
  const states = Object.values(STATE_POLICIES).map((policy) => ({
    stateCode: policy.stateCode,
    stateName: policy.stateName,
    status: policy.status,
    mobileNotaryAvailable: policy.mobileNotaryAvailable,
    remoteOnlineNotaryAllowed: policy.remoteOnlineNotaryAllowed,
    serviceSummary: policy.serviceSummary,
  }));
  res.json(states);
});

router.get("/states/:stateCode", (req: Request, res: Response) => {
  const stateCode = String(req.params.stateCode || "").toUpperCase();
  const policy = STATE_POLICIES[stateCode];
  if (!policy) return res.status(404).json({ message: "State policy not found" });
  res.json(policy);
});

router.post("/intake", (req: Request, res: Response) => {
  try {
    const parsed = intakeSchema.parse(req.body ?? {});
    const decision = evaluateIntake(parsed);
    res.json(decision);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid intake payload", details: error.errors });
    }
    console.error("Notary intake evaluation failed:", error);
    res.status(500).json({ message: "Failed to evaluate intake" });
  }
});

export default router;
