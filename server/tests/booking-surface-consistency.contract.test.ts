import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("booking surface consistency", () => {
  it("describes deposits as an optional business setting instead of paid booking mode", () => {
    const profileEditor = read("client/src/pages/ProfileSiteEditor.tsx");
    const businessView = read("client/src/pages/BusinessProfileView.tsx");

    expect(profileEditor).toContain("Require a booking deposit");
    expect(profileEditor).toContain("Booking requests are free by default.");
    expect(profileEditor).not.toContain("Enable paid bookings");
    expect(businessView).toContain("Send a booking request through TradeScout.");
    expect(businessView).toContain("deposit after the request is created");
    expect(businessView).not.toContain("Paid booking available");
  });

  it("keeps the legacy business editor URL as a handoff with no second booking state", () => {
    const redirect = read("client/src/pages/BusinessProfileEditor.tsx");

    expect(redirect).toContain("Compatibility-only handoff");
    expect(redirect).toContain("selectCanonicalOwnedProfile");
    expect(redirect).not.toContain("paidBookings");
    expect(redirect).not.toContain("bookingPriceUsd");
  });

  it("uses the shared request-first flow on the legacy public profile", () => {
    const profile = read("client/src/pages/PublicProfileView.tsx");
    const businessProfile = read("client/src/pages/BusinessProfileView.tsx");
    const dialog = read("client/src/components/profile/ProfileBookingRequestDialog.tsx");

    expect(profile).toContain("<ProfileBookingRequestDialog");
    expect(profile).toContain("paidBookings={paidBookings}");
    expect(profile).not.toContain("Pay booking deposit");
    expect(profile).not.toContain("handleBookingDeposit");
    expect(businessProfile).toContain("<ProfileBookingRequestDialog");
    expect(businessProfile).toContain("businessProfileSlug={profile.slug}");
    expect(dialog).toContain('apiRequest("POST", "/api/profile-booking/requests"');
    expect(dialog).toContain("...(businessProfileSlug ? { businessProfileSlug } : {})");
    expect(dialog).toContain("bookingRequestId=${encodeURIComponent(");
  });

  it("keeps the dashboard router limited to dashboards it can actually render", () => {
    const router = read("client/src/components/RoleDashboardRouter.tsx");

    expect(router).toContain('const Dashboard = lazy(() => import("@/pages/Dashboard"))');
    expect(router).not.toContain("ContractorDashboard");
    expect(router).not.toContain("RealtorDashboard");
    expect(router).not.toContain("HOADashboard");
    expect(router).not.toContain("HelperDashboard");
    expect(router).not.toContain("BusinessOwnerDashboard");
  });
});
