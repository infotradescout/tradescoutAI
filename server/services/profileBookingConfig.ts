import { readProfileBookingConfigBlock } from "../../shared/profileBookingConfig";
import {
  normalizeProfileBookingPrefs,
  type NormalizedProfileBookingPrefs,
} from "./profileBookingService";

type ProfileBookingConfigProfile = {
  contentBlocks?: unknown;
};

type ProfileBookingConfigOwner = {
  preferences?: unknown;
};

export type ResolvedProfileBookingConfig = {
  profileBooking: NormalizedProfileBookingPrefs;
  source: "profile" | "legacy_owner";
};

/**
 * Resolve booking behavior for one Profile. New profile-owned configuration
 * wins; the account preference remains readable only for pre-migration links.
 */
export function resolveProfileBookingConfig(
  profile: ProfileBookingConfigProfile | null | undefined,
  owner: ProfileBookingConfigOwner | null | undefined
): ResolvedProfileBookingConfig {
  const storedForProfile = readProfileBookingConfigBlock(profile?.contentBlocks);
  if (storedForProfile !== undefined) {
    return {
      profileBooking: normalizeProfileBookingPrefs(storedForProfile),
      source: "profile",
    };
  }

  const preferences =
    owner?.preferences && typeof owner.preferences === "object"
      ? (owner.preferences as Record<string, unknown>)
      : {};
  return {
    profileBooking: normalizeProfileBookingPrefs(preferences.profileBooking),
    source: "legacy_owner",
  };
}
