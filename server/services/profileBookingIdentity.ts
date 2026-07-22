type ProfileBookingIdentityProfile = {
  ownerUserId?: unknown;
  status?: unknown;
};

type ProfileBookingIdentitySuccess = {
  ok: true;
  ownerUserId: string;
  profileId: string | null;
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
  getProfileById: (profileId: string) => Promise<ProfileBookingIdentityProfile | null | undefined>;
};

type ProfileBookingIdentityStore = {
  getProfileById: ResolveProfileBookingIdentityInput["getProfileById"];
  getUser: (ownerUserId: string) => Promise<any | null | undefined>;
};

type ProfileBookingIdentityBody = {
  profileId?: unknown;
  ownerUserId?: unknown;
};

export type ProfileBookingOwnerResult =
  | (ProfileBookingIdentitySuccess & { owner: any })
  | ProfileBookingIdentityFailure;

const normalizedId = (value: unknown): string => String(value || "").trim();

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

  if (profileId) {
    const profile = await input.getProfileById(profileId);
    const profileOwnerUserId = normalizedId(profile?.ownerUserId);
    if (!profile || String(profile.status || "").trim() !== "published" || !profileOwnerUserId) {
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
      profileId,
      source: "profile",
    };
  }

  if (
    legacyOwnerUserId &&
    bookingRequestOwnerUserId &&
    legacyOwnerUserId !== bookingRequestOwnerUserId
  ) {
    return {
      ok: false,
      status: 400,
      message: "ownerUserId does not match booking request",
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
    source: bookingRequestOwnerUserId ? "booking_request" : "legacy_owner",
  };
}

export async function resolveProfileBookingOwner(
  storage: ProfileBookingIdentityStore,
  body: ProfileBookingIdentityBody | null | undefined,
  bookingRequestOwnerUserId?: unknown
): Promise<ProfileBookingOwnerResult> {
  const identity = await resolveProfileBookingIdentity({
    profileId: body?.profileId,
    ownerUserId: body?.ownerUserId,
    bookingRequestOwnerUserId,
    getProfileById: (profileId) => storage.getProfileById(profileId),
  });
  if (!identity.ok) return identity;

  const owner = await storage.getUser(identity.ownerUserId);
  if (!owner) return { ok: false, status: 404, message: "Profile owner not found" };
  if ((owner.preferences?.profileVisibility || "private") !== "public") {
    return { ok: false, status: 404, message: "Profile not available for booking" };
  }

  return { ...identity, owner };
}
