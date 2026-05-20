import { CURRENT_PROFILE_VERSION } from "@shared/profile";

type SetupAwareRecord = {
  onboardingCompleted?: boolean | null;
  profileVersion?: number | null;
  locationCommitted?: boolean | null;
  stateCode?: string | null;
  countyFips?: string | null;
};

export function hasCompletedSetup(record: SetupAwareRecord | null | undefined): boolean {
  if (!record) return false;
  if (record.onboardingCompleted === true) return true;
  if (
    typeof record.profileVersion === "number" &&
    Number.isFinite(record.profileVersion) &&
    record.profileVersion >= CURRENT_PROFILE_VERSION
  ) {
    return true;
  }
  const stateCode =
    typeof record.stateCode === "string" ? record.stateCode.trim().toUpperCase() : "";
  const countyFips = typeof record.countyFips === "string" ? record.countyFips.trim() : "";

  return stateCode.length === 2 && /^\d{5}$/.test(countyFips);
}
