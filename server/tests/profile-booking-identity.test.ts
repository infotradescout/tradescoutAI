import { describe, expect, it, vi } from "vitest";
import {
  resolveProfileBookingIdentity,
  resolveProfileBookingOwner,
} from "../services/profileBookingIdentity";

describe("profile booking identity", () => {
  it("resolves the owner from a published Profile id", async () => {
    const getProfileById = vi.fn().mockResolvedValue({
      ownerUserId: "owner-1",
      status: "published",
    });

    await expect(
      resolveProfileBookingIdentity({ profileId: "profile-1", getProfileById })
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "owner-1",
      profileId: "profile-1",
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
      source: "legacy_owner",
    });
    expect(getProfileById).not.toHaveBeenCalled();
  });

  it("rejects an ownerUserId that disagrees with the published Profile", async () => {
    const getProfileById = vi.fn().mockResolvedValue({
      ownerUserId: "profile-owner",
      status: "published",
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
    });

    await expect(
      resolveProfileBookingIdentity({
        profileId: "profile-1",
        bookingRequestOwnerUserId: "request-owner",
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
        getProfileById,
      })
    ).resolves.toEqual({
      ok: true,
      ownerUserId: "request-owner",
      profileId: null,
      source: "booking_request",
    });
  });

  it("requires both a published Profile and the owner's public visibility setting", async () => {
    const owner = { id: "owner-1", preferences: { profileVisibility: "private" } };
    const storage = {
      getProfileById: vi.fn().mockResolvedValue({
        ownerUserId: "owner-1",
        status: "published",
      }),
      getUser: vi.fn().mockResolvedValue(owner),
    };

    await expect(resolveProfileBookingOwner(storage, { profileId: "profile-1" })).resolves.toEqual({
      ok: false,
      status: 404,
      message: "Profile not available for booking",
    });
  });

  it("retains the public-visibility gate for legacy ownerUserId callers", async () => {
    const storage = {
      getProfileById: vi.fn(),
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
});
