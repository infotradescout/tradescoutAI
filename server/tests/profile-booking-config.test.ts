import { describe, expect, it } from "vitest";
import {
  PROFILE_BOOKING_BLOCK_TYPE,
  readProfileBookingConfigBlock,
  upsertProfileBookingConfigBlock,
} from "../../shared/profileBookingConfig";
import { resolveProfileBookingConfig } from "../services/profileBookingConfig";

describe("Profile-owned booking configuration", () => {
  it("stores one non-visual configuration block without disturbing Profile content", () => {
    const next = upsertProfileBookingConfigBlock(
      [
        { type: "hero", data: { title: "Mobile notary" } },
        { type: PROFILE_BOOKING_BLOCK_TYPE, data: { enabled: false } },
        { type: PROFILE_BOOKING_BLOCK_TYPE, data: { enabled: false } },
      ],
      { enabled: true, paidBookings: true, bookingPriceUsd: 50 }
    );

    expect(next.filter((block) => block.type === PROFILE_BOOKING_BLOCK_TYPE)).toHaveLength(1);
    expect(next[0]).toEqual({ type: "hero", data: { title: "Mobile notary" } });
    expect(readProfileBookingConfigBlock(next)).toMatchObject({
      enabled: true,
      paidBookings: true,
      bookingPriceUsd: 50,
    });
  });

  it("resolves each Profile independently before the legacy owner preference", () => {
    const owner = {
      preferences: {
        profileBooking: { enabled: true, paidBookings: true, bookingPriceUsd: 75 },
      },
    };
    const freeProfile = {
      contentBlocks: upsertProfileBookingConfigBlock([], {
        enabled: true,
        paidBookings: false,
        bookingPriceUsd: 0,
      }),
    };

    expect(resolveProfileBookingConfig(freeProfile, owner)).toMatchObject({
      source: "profile",
      profileBooking: {
        enabled: true,
        paidBookings: false,
        bookingPriceUsd: 0,
      },
    });
  });

  it("keeps the owner preference only as a fallback for unsaved legacy Profiles", () => {
    const resolved = resolveProfileBookingConfig(
      { contentBlocks: [{ type: "hero", data: {} }] },
      {
        preferences: {
          profileBooking: { enabled: true, paidBookings: true, bookingPriceUsd: 35 },
        },
      }
    );

    expect(resolved.source).toBe("legacy_owner");
    expect(resolved.profileBooking).toMatchObject({
      enabled: true,
      paidBookings: true,
      bookingPriceUsd: 35,
    });
  });

  it("treats an explicit empty Profile block as bookings disabled", () => {
    const resolved = resolveProfileBookingConfig(
      { contentBlocks: [{ type: PROFILE_BOOKING_BLOCK_TYPE, data: {} }] },
      {
        preferences: {
          profileBooking: { enabled: true, paidBookings: true, bookingPriceUsd: 99 },
        },
      }
    );

    expect(resolved.source).toBe("profile");
    expect(resolved.profileBooking.enabled).toBe(false);
    expect(resolved.profileBooking.paidBookings).toBe(false);
  });
});
