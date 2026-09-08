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
    expect(routesSource).toContain(
      "Louisiana remote notary paid bookings require additional verification"
    );
  });

  it("uses Profile identity for booking checkout while retaining the legacy owner fallback", () => {
    const checkoutSource = read("client/src/pages/checkout.tsx");
    const routesSource = read("server/routes.ts");
    const identitySource = read("server/services/profileBookingIdentity.ts");

    expect(checkoutSource).toContain("? { bookingRequestId, amount: baseAmount, description }");
    expect(checkoutSource).not.toContain(
      "{ profileId: paymentId, amount: baseAmount, description }"
    );
    expect(checkoutSource).not.toContain(".then((res) => res.json())");
    expect(checkoutSource).not.toContain(
      "{ ownerUserId: paymentId, amount: baseAmount, description }"
    );
    expect(routesSource).toContain("resolveProfileBookingOwner(storage, req.body)");
    expect(routesSource).toContain("requestRecord.ownerUserId");
    expect(identitySource).toContain("ownerUserId: body?.ownerUserId");
    expect(identitySource).toContain("bookingRequestOwnerUserId");
  });

  it("uses one booking-request lifecycle with an optional business deposit", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const requestDialog = read("client/src/components/profile/ProfileBookingRequestDialog.tsx");
    const routesSource = read("server/routes.ts");

    expect(profileView).toContain("<ProfileBookingRequestDialog");
    expect(profileView).toContain("paidBookings={paidBookings}");
    expect(requestDialog).toContain('apiRequest("POST", "/api/profile-booking/requests"');
    expect(requestDialog).toContain("...(profileId ? { profileId } : { ownerUserId })");
    expect(requestDialog).toContain(
      "const requiresDeposit = paidBookings && Number.isFinite(bookingPriceUsd)"
    );
    expect(requestDialog).toContain("No payment is required to send this booking request.");
    expect(requestDialog).toContain("bookingRequestId=${encodeURIComponent(");
    expect(requestDialog).toContain("Submit and continue to deposit");
    expect(routesSource).toContain("const depositRequired =");
    expect(routesSource).toContain('paymentStatus: depositRequired ? "requires_payment" : "none"');
    expect(routesSource).toContain("Required booking deposit has not been paid");
    expect(read("client/src/pages/business-owner-dashboard.tsx")).toContain("Awaiting deposit");
  });

  it("makes an existing booking request the authoritative idempotent payment record", () => {
    const routesSource = read("server/routes.ts");
    const paymentSource = read("server/services/profileBookingPayment.ts");
    const routeStart = routesSource.indexOf('"/api/payments/profile-booking/create-intent"');
    const routeEnd = routesSource.indexOf(
      "// Pay marketplace transaction using on-platform wallet balance",
      routeStart
    );
    const paymentRoute = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(paymentRoute).toContain("if (!requestRecord)");
    expect(paymentRoute).toContain('message: "Booking request not found"');
    expect(paymentRoute).toContain("validateExistingProfileBookingPayment(");
    expect(paymentRoute).toContain("resolveBookingVerificationContext(");
    expect(paymentRoute).toContain('requestRecord.deliveryMode || "onsite"');
    expect(paymentRoute).toContain("requestRecord.serviceLabel || null");
    expect(paymentRoute).toContain("resolveProfileBookingPaymentIntent({");
    expect(paymentSource).toContain('String(request.status || "").toLowerCase() !== "requested"');
    expect(paymentSource).toContain("request.depositRequired !== true");
    expect(paymentSource).toContain('new Set(["requires_payment", "processing", "failed"])');
    expect(paymentSource).toContain("Number(request.depositAmountUsd)");
    expect(paymentSource).toContain('message: "Booking amount does not match the booking request"');
    expect(paymentSource).toContain("input.stripe.paymentIntents.retrieve(existingId)");
    expect(paymentSource).toContain('existing.status !== "canceled"');
    expect(paymentSource).toContain("return { ok: true, intent: existing, reused: true }");
    expect(paymentSource).toContain("{ idempotencyKey }");
    expect(paymentSource).not.toContain("timestamp: new Date().toISOString()");
  });

  it("mounts both the parameterized checkout and its legacy landing route behind auth", () => {
    const appRoutes = read("client/src/AppRoutes.tsx");
    const parameterizedRoute = appRoutes.indexOf('<Route path="/checkout/:type/:id">');
    const legacyRoute = appRoutes.indexOf('<Route path="/checkout">');

    expect(parameterizedRoute).toBeGreaterThan(-1);
    expect(legacyRoute).toBeGreaterThan(-1);
    expect(appRoutes.slice(parameterizedRoute, parameterizedRoute + 220)).toContain(
      "<ProtectedRoute>"
    );
    expect(appRoutes.slice(legacyRoute, legacyRoute + 220)).toContain("<ProtectedRoute>");
  });

  it("records profile booking payment state updates on Stripe webhook handling", () => {
    const paymentService = read("server/payment-service.ts");
    expect(paymentService).toContain('metadata.type === "profile_booking"');
    expect(paymentService).toContain("transitionProfileBookingPaymentStatus");
    expect(paymentService).toContain('to: "paid"');
    expect(paymentService).toContain('to: "failed"');
    expect(paymentService).toContain('from: ["requires_payment", "processing", "failed"]');
    expect(paymentService).toContain('from: ["requires_payment", "processing"]');
    expect(paymentService).toContain(
      'new Set(["declined", "cancelled", "completed"]).has(bookingStatus)'
    );
    expect(paymentService).toContain("refundTerminalProfileBookingDeposit");
    expect(paymentService).toContain("profile_booking_terminal_refund");
    expect(paymentService).toContain('paymentStatus: "refunded"');
    expect(paymentService).not.toContain(
      '...(bookingRequest.status === "requested" ? { status: "accepted" } : {})'
    );
  });
});
