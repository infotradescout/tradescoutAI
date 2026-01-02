export type PresenceType = 'personal' | 'represent_business';

export interface ProfileDraftServiceArea {
  countyFips: string;
  countyName?: string;
  stateCode?: string;
  primary?: boolean;
}

export interface ProfileDraft {
  presenceType: PresenceType;
  stateCode: string;
  countyFips: string;
  countyName?: string;
  city?: string;
  businessName?: string;
  businessCategory?: string;
  website?: string;
  description?: string;
  serviceAreas?: ProfileDraftServiceArea[];
  capturedAt?: string;
}
