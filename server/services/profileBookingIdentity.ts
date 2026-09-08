type ProfileBookingIdentityProfile = {
  id?: unknown;
  ownerUserId?: unknown;
  status?: unknown;
  publiclyReleased?: unknown;
  slug?: unknown;
};

export type ProfileBookingLineageKind =
  | "legacy_owner"
  | "legacy_business_profile"
  | "exact_profile";

type ProfileBookingIdentitySuccess = {
  ok: true;
  ownerUserId: string;
  profileId: string | null;
  lineageKind: ProfileBookingLineageKind;
  source: "profile" | "legacy_owner" | "booking_request";
};

type ProfileBookingIdentityFailure = {
  ok: false;
  status: 400 | 404;
  message: string;
};

export type ProfileBookingIdentityResult =
  | ProfileBookingIdentitySuccess
  | ProfileBookingIdentityFailure;

export type ResolveProfileBookingIdentityInput = {
  profileId?: unknown;
  ownerUserId?: unknown;
  bookingRequestOwnerUserId?: unknown;
  bookingRequestProfileId?: unknown;
  bookingRequestLineageKind?: unknown;
  getProfileById: (profileId: string) => Promise<ProfileBookingIdentityProfile | null | undefined>;
};

type ProfileBookingIdentityStore = {
  getProfileById: ResolveProfileBookingIdentityInput["getProfileById"];
  getProfileBySlugPublic: (
    slug: string
  ) => Promise<ProfileBookingIdentityProfile | null | undefined>;
  getUser: (ownerUserId: string) => Promise<any | null | undefined>;
};

type ProfileBookingIdentityBody = {
  profileId?: unknown;
  ownerUserId?: unknown;
};

export type ExistingProfileBookingIdentity = {
  ownerUserId?: unknown;
  profileId?: unknown;
  lineageKind?: unknown;
};

export type ProfileBookingOwnerResult =
  | (ProfileBookingIdentitySuccess & { owner: any })
  | ProfileBookingIdentityFailure;

const normalizedId = (value: unknown): string => String(value || "").trim();

export function stripImmutableProfileBookingPatch(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const {
    id: _id,
    ownerUserId: _ownerUserId,
    requesterUserId: _requesterUserId,
    profileId: _profileId,
    lineageKind: _lineageKind,
    createdAt: _createdAt,
    ...mutablePatch
  } = patch;
  return mutablePatch;
}

/**
 * Resolve the account that owns a public booking target.
 *
 * New links identify the published Profile. ownerUserId remains accepted for
 * older clients and existing booking requests, but it can never override or
 * disagree with the Profile/account already attached to the request.
 */
export async function resolveProfileBookingIdentity(
  input: ResolveProfileBookingIdentityInput
): Promise<ProfileBookingIdentityResult> {
  const profileId = normalizedId(input.profileId);
  const legacyOwnerUserId = normalizedId(input.ownerUserId);
  const bookingRequestOwnerUserId = normalizedId(input.bookingRequestOwnerUserId);
  const bookingRequestProfileId = normalizedId(input.bookingRequestProfileId);
  const bookingRequestLineageKind = normalizedId(input.bookingRequestLineageKind);
  const hasPersistedRequest = Boolean(bookingRequestOwnerUserId);

  if (
    hasPersistedRequest &&
    !new Set(["legacy_owner", "legacy_business_profile", "exact_profile"]).has(
      bookingRequestLineageKind
    )
  ) {
    return { ok: false, status: 400, message: "Booking request lineage is invalid" };
  }
  if (
    hasPersistedRequest &&
    ((bookingRequestLineageKind === "exact_profile" && !bookingRequestProfileId) ||
      (bookingRequestLineageKind !== "exact_profile" && Boolean(bookingRequestProfileId)))
  ) {
    return { ok: false, status: 400, message: "Booking request lineage is inconsistent" };
  }

  if (
    bookingRequestOwnerUserId &&
    legacyOwnerUserId &&
    legacyOwnerUserId !== bookingRequestOwnerUserId
  ) {
    return {
      ok: false,
      status: 400,
      message: "ownerUserId does not match booking request",
    };
  }

  if (bookingRequestProfileId && profileId && bookingRequestProfileId !== profileId) {
    return {
      ok: false,
      status: 400,
      message: "profileId does not match booking request",
    };
  }

  // A persisted exact Profile is the only Profile identity trusted after a
  // booking request exists. Legacy rows intentionally retain null and remain
  // bound to their stored owner without adopting a caller-supplied sibling.
  if (hasPersistedRequest && bookingRequestLineageKind !== "exact_profile") {
    return {
      ok: true,
      ownerUserId: bookingRequestOwnerUserId,
      profileId: null,
      lineageKind: bookingRequestLineageKind as ProfileBookingLineageKind,
      source: "booking_request",
    };
  }

  const authoritativeProfileId = bookingRequestProfileId || profileId;

  if (authoritativeProfileId) {
    const profile = await input.getProfileById(authoritativeProfileId);
    const profileOwnerUserId = normalizedId(profile?.ownerUserId);
    if (
      !profile ||
      String(profile.status || "").trim() !== "published" ||
      profile.publiclyReleased !== true ||
      !profileOwnerUserId
    ) {
      return { ok: false, status: 404, message: "Profile not available for booking" };
    }

    if (legacyOwnerUserId && legacyOwnerUserId !== profileOwnerUserId) {
      return {
        ok: false,
        status: 400,
        message: "profileId does not match ownerUserId",
      };
    }
    if (bookingRequestOwnerUserId && bookingRequestOwnerUserId !== profileOwnerUserId) {
      return {
        ok: false,
        status: 400,
        message: "Booking request does not belong to this profile",
      };
    }

    return {
      ok: true,
      ownerUserId: profileOwnerUserId,
      profileId: authoritativeProfileId,
      lineageKind: "exact_profile",
      source: bookingRequestOwnerUserId ? "booking_request" : "profile",
    };
  }

  const ownerUserId = bookingRequestOwnerUserId || legacyOwnerUserId;
  if (!ownerUserId) {
    return {
      ok: false,
      status: 400,
      message: "profileId or ownerUserId is required",
    };
  }

  return {
    ok: true,
    ownerUserId,
    profileId: null,
    lineageKind: "legacy_owner",
    source: bookingRequestOwnerUserId ? "booking_request" : "legacy_owner",
  };
}

export async function resolveProfileBookingOwner(
  storage: ProfileBookingIdentityStore,
  body: ProfileBookingIdentityBody | null | undefined,
  bookingRequest?: ExistingProfileBookingIdentity | null
): Promise<ProfileBookingOwnerResult> {
  const identity = await resolveProfileBookingIdentity({
    profileId: body?.profileId,
    ownerUserId: body?.ownerUserId,
    bookingRequestOwnerUserId: bookingRequest?.ownerUserId,
    bookingRequestProfileId: bookingRequest?.profileId,
    bookingRequestLineageKind: bookingRequest?.lineageKind,
    getProfileById: (profileId) => storage.getProfileById(profileId),
  });
  if (!identity.ok) return identity;

  const owner = await storage.getUser(identity.ownerUserId);
  if (!owner) return { ok: false, status: 404, message: "Profile owner not found" };

  if (identity.profileId) {
    const exactProfile = await storage.getProfileById(identity.profileId);
    const slug = normalizedId(exactProfile?.slug);
    if (
      !exactProfile ||
      String(exactProfile.status || "").trim() !== "published" ||
      exactProfile.publiclyReleased !== true ||
      !slug
    ) {
      return { ok: false, status: 404, message: "Profile not available for booking" };
    }
    const canonicalProfile = await storage.getProfileBySlugPublic(slug);
    if (normalizedId(canonicalProfile?.id) !== identity.profileId) {
      return { ok: false, status: 404, message: "Profile not available for booking" };
    }
  }

  // Legacy null-profile booking rows remain bound to the owner authorized when
  // they were created. New exact-profile rows revalidate their stored Profile
  // above. The ownerUserId-only entry point retains its former compatibility
  // gate because it has no exact Profile authority to inspect.
  if (
    identity.source === "legacy_owner" &&
    (owner.preferences?.profileVisibility || "private") !== "public"
  ) {
    return { ok: false, status: 404, message: "Profile not available for booking" };
  }

  return { ...identity, owner };
}
