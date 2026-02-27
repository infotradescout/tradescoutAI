import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("profile booking route contracts", () => {
  it("keeps dedicated profile booking settings endpoints", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("/api/users/profile-booking");
    expect(routesSource).toContain("normalizeProfileBookingPrefs");
    expect(routesSource).toContain("profileBooking");
  });

  it("keeps booking intent endpoint with request persistence and notary verification gate", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("/api/payments/profile-booking/create-intent");
    expect(routesSource).toContain("bookingRequestId");
    expect(routesSource).toContain("createProfileBookingRequest");
    expect(routesSource).toContain("evaluateNotaryPaidRemoteGate");
    expect(routesSource).toContain("Louisiana remote notary paid bookings require additional verification");
  });

  it("records profile booking payment state updates on Stripe webhook handling", () => {
    const paymentService = read("server/payment-service.ts");
    expect(paymentService).toContain("metadata.type === \"profile_booking\"");
    expect(paymentService).toContain("updateProfileBookingRequest");
    expect(paymentService).toContain("paymentStatus: \"paid\"");
    expect(paymentService).toContain("paymentStatus: \"failed\"");
  });
});
