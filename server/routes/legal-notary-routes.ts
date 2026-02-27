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
    remoteOnlineNotaryAllowed: true,
    lastReviewedOn: "2026-02-27",
    serviceSummary:
      "Louisiana remote notary support is enabled for core civil/commercial document flows with policy checks.",
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
      "government_id_front",
      "government_id_back",
      "signer_selfie",
      "unsigned_document_pdf",
    ],
    complianceNotes: [
      "Final notary assignment must use an active Louisiana-commissioned notary.",
      "Identity proofing and credential checks are mandatory before a live session.",
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

  const normalizedServiceType = input.serviceType.trim().toLowerCase();
  const normalizedDocumentType = input.documentType.trim().toLowerCase();
  const restricted = policy.restrictedDocumentTypes.includes(normalizedDocumentType);
  const serviceAllowed = policy.allowedServiceTypes.includes(normalizedServiceType);

  if (restricted) {
    return {
      eligible: false,
      stateCode,
      status: "manual_review",
      reason: "Document type requires manual legal/compliance review before scheduling.",
      nextSteps: [
        "Submit intake package for manual legal review.",
        "Await case-level guidance before a remote session is scheduled.",
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
    reason: "Eligible for the Louisiana remote notary path.",
    nextSteps: [
      "Complete signer identity verification.",
      "Upload unsigned document package.",
      "Schedule remote session with Louisiana notary coverage.",
    ],
    requiredUploads: [
      "government_id_front",
      "government_id_back",
      "signer_selfie",
      "unsigned_document_pdf",
    ],
  };
}

router.get("/states", (_req: Request, res: Response) => {
  const states = Object.values(STATE_POLICIES).map((policy) => ({
    stateCode: policy.stateCode,
    stateName: policy.stateName,
    status: policy.status,
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
