import { describe, expect, it } from "vitest";
import {
  evaluateNotaryPaidRemoteGate,
  normalizeProfileBookingPrefs,
  toPublicProfileBookingPrefs,
} from "../services/profileBookingService";

describe("profile booking service", () => {
  it("normalizes booking preferences with safe defaults", () => {
    const normalized = normalizeProfileBookingPrefs({});
    expect(normalized.enabled).toBe(false);
    expect(normalized.paidBookings).toBe(false);
    expect(normalized.calendarVisibility).toBe("public");
    expect(normalized.timezone).toBe("America/Chicago");
    expect(Array.isArray(normalized.slots)).toBe(true);
    expect(Array.isArray(normalized.pricingRows)).toBe(true);
  });

  it("hides slots from public payload when calendar visibility is private", () => {
    const payload = toPublicProfileBookingPrefs({
      calendarVisibility: "private",
      slots: [
        {
          id: "slot-1",
          dayOfWeek: 2,
          startTime: "09:00",
          endTime: "11:00",
          active: true,
        },
      ],
    });
    expect(payload.slots).toEqual([]);
  });

  it("blocks paid Louisiana remote legal-notary bookings when verification is missing", () => {
    const gate = evaluateNotaryPaidRemoteGate({
      owner: {
        verificationStatus: "pending",
        addressVerified: false,
        role: "homeowner",
        roles: [],
        preferences: {},
      },
      bookingContext: {
        category: "legal_notary",
        stateCode: "LA",
        serviceType: "jurat",
        deliveryMode: "remote",
      },
      paidBooking: true,
    });

    expect(gate.applied).toBe(true);
    expect(gate.allowed).toBe(false);
    expect(gate.missing).toContain("platform_verification_approved");
    expect(gate.missing).toContain("notary_commission_active");
  });

  it("allows paid Louisiana remote legal-notary bookings when verification passes", () => {
    const gate = evaluateNotaryPaidRemoteGate({
      owner: {
        verificationStatus: "approved",
        addressVerified: true,
        role: "notary",
        roles: ["remote_notary"],
        preferences: {
          notaryVerification: {
            commissionActive: true,
            backgroundScreened: true,
            remoteProviderCertified: true,
          },
        },
      },
      bookingContext: {
        category: "legal_notary",
        stateCode: "LA",
        serviceType: "jurat",
        deliveryMode: "remote",
      },
      paidBooking: true,
    });

    expect(gate.applied).toBe(true);
    expect(gate.allowed).toBe(true);
    expect(gate.missing).toEqual([]);
  });
});
