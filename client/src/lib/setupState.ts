import { isOutcomeOnboardingComplete } from "@shared/onboardingCompletion";

type SetupAwareRecord = {
  onboardingCompleted?: boolean | null;
  profileVersion?: number | null;
  locationCommitted?: boolean | null;
  stateCode?: string | null;
  countyFips?: string | null;
};

export function hasCompletedSetup(record: SetupAwareRecord | null | undefined): boolean {
  return isOutcomeOnboardingComplete(record);
}
