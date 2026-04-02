export type NotarySupportStatus = "live" | "pilot" | "planned";

export interface NotaryStatePolicy {
  stateCode: string;
  stateName: string;
  status: NotarySupportStatus;
  mobileNotaryAvailable: boolean;
  remoteOnlineNotaryAllowed: boolean;
  lastReviewedOn: string;
  serviceSummary: string;
  allowedServiceTypes: string[];
  remoteEligibleServiceTypes: string[];
  restrictedDocumentTypes: string[];
  requiredIntakeFields: string[];
  complianceNotes: string[];
  disclaimer: string;
}

export interface NotaryIntakeRequest {
  stateCode: string;
  deliveryMode?: "mobile" | "remote";
  serviceType: string;
  documentType: string;
  countyFips?: string | null;
  signerCount?: number;
  serviceAddress1?: string;
  serviceCity?: string;
  serviceZipCode?: string;
  preferredArrivalWindow?: string;
}

export interface NotaryIntakeDecision {
  eligible: boolean;
  stateCode: string;
  status: "approved_path" | "manual_review" | "unsupported";
  reason: string;
  nextSteps: string[];
  requiredUploads: string[];
}
