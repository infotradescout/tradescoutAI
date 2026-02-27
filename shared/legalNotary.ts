export type NotarySupportStatus = "live" | "pilot" | "planned";

export interface NotaryStatePolicy {
  stateCode: string;
  stateName: string;
  status: NotarySupportStatus;
  remoteOnlineNotaryAllowed: boolean;
  lastReviewedOn: string;
  serviceSummary: string;
  allowedServiceTypes: string[];
  restrictedDocumentTypes: string[];
  requiredIntakeFields: string[];
  complianceNotes: string[];
  disclaimer: string;
}

export interface NotaryIntakeRequest {
  stateCode: string;
  serviceType: string;
  documentType: string;
  countyFips?: string | null;
  signerCount?: number;
}

export interface NotaryIntakeDecision {
  eligible: boolean;
  stateCode: string;
  status: "approved_path" | "manual_review" | "unsupported";
  reason: string;
  nextSteps: string[];
  requiredUploads: string[];
}
