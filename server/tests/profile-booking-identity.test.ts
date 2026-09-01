import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  resolveProfileBookingIdentity,
  resolveProfileBookingOwner,
  stripImmutableProfileBookingPatch,
} from "../services/profileBookingIdentity";

describe("profile booking identity", () => {
  it("strips immutable authority lineage from post-create patches", () => {
    expect(
      stripImmutableProfileBookingPatch({
        profileId: "sibling-profile",
        lineageKind: "legacy_owner",
        ownerUserId: "other-owner",
        requesterUserId: "other-requester",
        status: "accepted",
      })
    ).toEqual({ status: "accepted" });
  });

  it("resolves the owner from a published Profile id", async () => {
    const getProfileById = vi.fn().mockResolvedValue({
      ownerUserId: "owner-1",
      status: "published",
      publiclyReleased: true,
    });

    await expect(
      resolveProfileBookingIdentity({ profileId: "profile-1", getProfileById })
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "owner-1",
      profileId: "profile-1",
      lineageKind: "exact_profile",
      source: "profile",
    });
    expect(getProfileById).toHaveBeenCalledWith("profile-1");
  });

  it.each([undefined, { ownerUserId: "owner-1", status: "draft" }])(
    "rejects a missing or unpublished Profile",
    async (profile) => {
      const getProfileById = vi.fn().mockResolvedValue(profile);

      await expect(
        resolveProfileBookingIdentity({ profileId: "profile-1", getProfileById })
      ).resolves.toEqual({
        ok: false,
        status: 404,
        message: "Profile not available for booking",
      });
    }
  );

  it("keeps ownerUserId-only callers working without a Profile lookup", async () => {
    const getProfileById = vi.fn();

    await expect(
      resolveProfileBookingIdentity({ ownerUserId: "legacy-owner", getProfileById })
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "legacy-owner",
      profileId: null,
      lineageKind: "legacy_owner",
      source: "legacy_owner",
    });
    expect(getProfileById).not.toHaveBeenCalled();
  });

  it("rejects an ownerUserId that disagrees with the published Profile", async () => {
    const getProfileById = vi.fn().mockResolvedValue({
      ownerUserId: "profile-owner",
      status: "published",
      publiclyReleased: true,
    });

    await expect(
      resolveProfileBookingIdentity({
        profileId: "profile-1",
        ownerUserId: "different-owner",
        getProfileById,
      })
    ).resolves.toEqual({
      ok: false,
      status: 400,
      message: "profileId does not match ownerUserId",
    });
  });

  it("rejects a Profile that disagrees with an existing booking request", async () => {
    const getProfileById = vi.fn().mockResolvedValue({
      ownerUserId: "profile-owner",
      status: "published",
      publiclyReleased: true,
    });

    await expect(
      resolveProfileBookingIdentity({
        profileId: "profile-1",
        bookingRequestOwnerUserId: "request-owner",
        bookingRequestProfileId: "profile-1",
        bookingRequestLineageKind: "exact_profile",
        getProfileById,
      })
    ).resolves.toEqual({
      ok: false,
      status: 400,
      message: "Booking request does not belong to this profile",
    });
  });

  it("uses an existing booking request owner when no identity is resent", async () => {
    const getProfileById = vi.fn();

    await expect(
      resolveProfileBookingIdentity({
        bookingRequestOwnerUserId: "request-owner",
        bookingRequestLineageKind: "legacy_owner",
        getProfileById,
      })
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "request-owner",
      profileId: null,
      lineageKind: "legacy_owner",
      source: "booking_request",
    });
  });

  it("rejects a persisted request whose explicit lineage is missing", async () => {
    await expect(
      resolveProfileBookingIdentity({
        bookingRequestOwnerUserId: "request-owner",
        bookingRequestProfileId: null,
        getProfileById: vi.fn(),
      })
    ).resolves.toEqual({
      ok: false,
      status: 400,
      message: "Booking request lineage is invalid",
    });
  });

  it("uses the booking request's persisted Profile and rejects sibling substitution", async () => {
    const getProfileById = vi.fn().mockResolvedValue({
      ownerUserId: "owner-1",
      status: "published",
      publiclyReleased: true,
    });

    await expect(
      resolveProfileBookingIdentity({
        bookingRequestOwnerUserId: "owner-1",
        bookingRequestProfileId: "profile-original",
        bookingRequestLineageKind: "exact_profile",
        getProfileById,
      })
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "owner-1",
      profileId: "profile-original",
      lineageKind: "exact_profile",
      source: "booking_request",
    });
    expect(getProfileById).toHaveBeenCalledWith("profile-original");

    getProfileById.mockClear();
    await expect(
      resolveProfileBookingIdentity({
        profileId: "same-owner-sibling",
        bookingRequestOwnerUserId: "owner-1",
        bookingRequestProfileId: "profile-original",
        bookingRequestLineageKind: "exact_profile",
        getProfileById,
      })
    ).resolves.toEqual({
      ok: false,
      status: 400,
      message: "profileId does not match booking request",
    });
    expect(getProfileById).not.toHaveBeenCalled();
  });

  it("keeps a legacy null-profile booking bound to its stored owner", async () => {
    const getProfileById = vi.fn();

    await expect(
      resolveProfileBookingIdentity({
        profileId: "caller-supplied-profile",
        bookingRequestOwnerUserId: "legacy-request-owner",
        bookingRequestProfileId: null,
        bookingRequestLineageKind: "legacy_owner",
        getProfileById,
      })
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "legacy-request-owner",
      profileId: null,
      lineageKind: "legacy_owner",
      source: "booking_request",
    });
    expect(getProfileById).not.toHaveBeenCalled();
  });

  it("accepts an exact-public Profile even when the legacy account flag is private", async () => {
    const owner = {
      id: "owner-1",
      preferences: { profileVisibility: "private", publicProfileIds: ["profile-1"] },
    };
    const storage = {
      getProfileById: vi.fn().mockResolvedValue({
        id: "profile-1",
        ownerUserId: "owner-1",
        status: "published",
        publiclyReleased: true,
        slug: "profile-one",
      }),
      getProfileBySlugPublic: vi.fn().mockResolvedValue({ id: "profile-1" }),
      getUser: vi.fn().mockResolvedValue(owner),
    };

    await expect(resolveProfileBookingOwner(storage, { profileId: "profile-1" })).resolves.toEqual({
      ok: true,
      ownerUserId: "owner-1",
      profileId: "profile-1",
      lineageKind: "exact_profile",
      source: "profile",
      owner,
    });
  });

  it("rejects an exact-private sibling even when the legacy account flag is public", async () => {
    const storage = {
      getProfileById: vi.fn().mockResolvedValue({
        id: "private-sibling",
        ownerUserId: "owner-1",
        status: "published",
        publiclyReleased: false,
        slug: "private-sibling",
      }),
      getProfileBySlugPublic: vi.fn(),
      getUser: vi.fn().mockResolvedValue({
        id: "owner-1",
        preferences: { profileVisibility: "public", publicProfileIds: ["public-sibling"] },
      }),
    };

    await expect(
      resolveProfileBookingOwner(storage, { profileId: "private-sibling" })
    ).resolves.toEqual({
      ok: false,
      status: 404,
      message: "Profile not available for booking",
    });
  });

  it("allows an already-authorized booking request to continue without a legacy account flag", async () => {
    const owner = { id: "owner-1", preferences: { profileVisibility: "private" } };
    const storage = {
      getProfileById: vi.fn(),
      getProfileBySlugPublic: vi.fn(),
      getUser: vi.fn().mockResolvedValue(owner),
    };

    await expect(
      resolveProfileBookingOwner(
        storage,
        {},
        {
          ownerUserId: "owner-1",
          profileId: null,
          lineageKind: "legacy_owner",
        }
      )
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "owner-1",
      profileId: null,
      lineageKind: "legacy_owner",
      source: "booking_request",
      owner,
    });
  });

  it("revalidates the stored exact Profile's current release before payment", async () => {
    const storage = {
      getProfileById: vi.fn().mockResolvedValue({
        id: "profile-original",
        ownerUserId: "owner-1",
        status: "published",
        publiclyReleased: false,
        slug: "profile-original",
      }),
      getProfileBySlugPublic: vi.fn(),
      getUser: vi.fn().mockResolvedValue({
        id: "owner-1",
        preferences: { publicProfileIds: ["different-profile"] },
      }),
    };

    await expect(
      resolveProfileBookingOwner(
        storage,
        {},
        {
          ownerUserId: "owner-1",
          profileId: "profile-original",
          lineageKind: "exact_profile",
        }
      )
    ).resolves.toEqual({
      ok: false,
      status: 404,
      message: "Profile not available for booking",
    });
    expect(storage.getProfileById).toHaveBeenCalledWith("profile-original");
  });

  it("retains the public-visibility gate for legacy ownerUserId callers", async () => {
    const storage = {
      getProfileById: vi.fn(),
      getProfileBySlugPublic: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ preferences: { profileVisibility: "private" } }),
    };

    await expect(
      resolveProfileBookingOwner(storage, { ownerUserId: "legacy-owner" })
    ).resolves.toEqual({
      ok: false,
      status: 404,
      message: "Profile not available for booking",
    });
  });

  it("wires request creation and payment to the persisted exact Profile", () => {
    const routes = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const createStart = routes.indexOf('"/api/profile-booking/requests"');
    const paymentStart = routes.indexOf('"/api/payments/profile-booking/create-intent"');
    const creationRoute = routes.slice(createStart, paymentStart);
    const paymentRoute = routes.slice(
      paymentStart,
      routes.indexOf('"/api/payments/marketplace/pay-with-wallet"', paymentStart)
    );

    expect(creationRoute).toContain("profileId: bookingIdentity.profileId");
    expect(creationRoute).toContain("lineageKind: legacyBusinessProfile");
    expect(paymentRoute).toContain("profileId: requestRecord.profileId");
    expect(paymentRoute).toContain("profileId: paymentIdentityRecheck.profileId");
    expect(paymentRoute).toContain("lineageKind: requestRecord.lineageKind");
  });
});
