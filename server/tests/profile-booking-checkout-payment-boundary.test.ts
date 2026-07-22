import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("profile booking checkout payment boundary", () => {
  it("does not downgrade a booking deposit to generic off-platform payment", () => {
    const checkoutSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/checkout.tsx"),
      "utf-8"
    );
    const bookingGuardStart = checkoutSource.indexOf(
      'if (paymentType === "booking" && (isOffPlatform || !stripePromise))'
    );
    const genericFallbackStart = checkoutSource.indexOf(
      "// Render without Stripe Elements for off-platform payments",
      bookingGuardStart
    );
    const bookingGuard = checkoutSource
      .slice(bookingGuardStart, genericFallbackStart)
      .replace(/\s+/g, " ");

    expect(bookingGuardStart).toBeGreaterThan(-1);
    expect(genericFallbackStart).toBeGreaterThan(bookingGuardStart);
    expect(bookingGuard).toContain("Booking deposits must be paid securely through Stripe");
    expect(bookingGuard).toContain("no off-platform payment has been recorded");
    expect(checkoutSource).toContain("? { bookingRequestId, amount: baseAmount, description }");
    expect(checkoutSource).toContain('paymentType === "booking" && !bookingRequestId');
    expect(checkoutSource).not.toContain(
      "{ profileId: paymentId, amount: baseAmount, description }"
    );
  });
});
