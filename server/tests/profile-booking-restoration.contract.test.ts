import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile booking restoration", () => {
  it("keeps custom-domain booking authentication on the platform session", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const dialog = read("client/src/components/profile/ProfileBookingRequestDialog.tsx");
    const server = read("server/index.ts");

    expect(profileView).toContain(
      'new URLSearchParams(window.location.search).get("book") !== "1"'
    );
    expect(profileView).toContain("`/u/${profile.slug}?book=1`");
    expect(server).toContain('customDomain && String(req.query.book || "") !== "1"');
    expect(dialog).toContain("if (hasViewerSession && shouldOpenFromReturn()) setOpen(true)");
  });

  it("redacts pre-contact booking text and derives notary verification context on the server", () => {
    const dialog = read("client/src/components/profile/ProfileBookingRequestDialog.tsx");
    const routes = read("server/routes.ts");
    const payment = read("server/services/profileBookingPayment.ts");

    expect(dialog).toContain("City or neighborhood only — no street address");
    expect(dialog).toContain("phone, email, links, and the exact address");
    expect(dialog).toContain("bookingContext: {");
    expect(dialog).toContain("timezone: requesterTimezone");
    expect(payment).toContain("function normalizeOptionalBookingText");
    expect(payment).toContain("function resolveBookingVerificationContext");
    expect(payment).toContain("Boolean(owner?.preferences?.notaryVerification)");
    expect(routes).toContain("const requestMessage = normalizeOptionalBookingText(");
    expect(routes).toContain(
      "const locationNote = normalizeOptionalBookingText((req.body as any)?.locationNote, 120)"
    );
  });

  it("does not turn dashboard query failures or draft profiles into factual zeroes", () => {
    const dashboard = read("client/src/pages/business-owner-dashboard.tsx");

    expect(dashboard).toContain("profilesQuery.isError || profileViewsQuery.isError");
    expect(dashboard).toContain("directConnectInboxQuery.isError");
    expect(dashboard).toContain("jobsQuery.isError");
    expect(dashboard).toContain("accountingQuery.isError");
    expect(dashboard).toContain("!profileIsPublished");
    expect(dashboard).toContain('"Not published"');
  });

  it("keeps booking requests free by default and deposits business-controlled", () => {
    const settings = read("client/src/pages/ProfileSettings.tsx");
    const checkout = read("client/src/pages/checkout.tsx");

    expect(settings).toContain("Booking requests are free by default.");
    expect(settings).toContain("Require a booking deposit");
    expect(settings).toContain("Require a Stripe deposit before confirmation.");
    expect(checkout.match(/enabled: paymentType !== "booking"/g)).toHaveLength(2);
  });
});
