import {
  JW_STONE_PROFILE_SLUG,
  JW_STONE_PUBLIC_IDENTITY,
} from "@shared/jwStonePresentation";

export type PublicProfileSocialIdentity = Readonly<{
  id: string;
  label: string;
  publicHandle: string;
  href: string;
}>;

export type PublicProfileIdentity = Readonly<{
  address?: Readonly<{
    formatted: string;
    mapUrl?: string;
  }>;
  socials?: readonly PublicProfileSocialIdentity[];
}>;

const PUBLIC_PROFILE_IDENTITIES: Readonly<Record<string, PublicProfileIdentity>> = {
  [JW_STONE_PROFILE_SLUG]: {
    address: {
      formatted: JW_STONE_PUBLIC_IDENTITY.address.formatted,
      mapUrl: JW_STONE_PUBLIC_IDENTITY.address.mapUrl,
    },
    socials: JW_STONE_PUBLIC_IDENTITY.socials,
  },
};

/**
 * Public identity stays profile-owned and evidence-backed. Renderers consume
 * this registry without embedding business-specific facts or external URLs.
 */
export function resolvePublicProfileIdentity(profileSlug: string): PublicProfileIdentity | null {
  const normalizedSlug = String(profileSlug || "")
    .trim()
    .toLowerCase();
  return PUBLIC_PROFILE_IDENTITIES[normalizedSlug] || null;
}
