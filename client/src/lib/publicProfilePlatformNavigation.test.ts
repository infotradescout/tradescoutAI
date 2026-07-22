import { describe, expect, it } from "vitest";
import {
  qualifyPublicProfileItemDestination,
  requiresDocumentNavigation,
} from "@/lib/publicProfileItemDestination";

const PLATFORM_ORIGIN = "https://www.thetradescout.com";

describe("public Profile platform navigation", () => {
  it.each([
    "/direct-connect?profile=jw-stone",
    "/checkout/booking/profile-1?amount=250",
    "/contractors/example-contractor",
    "/u/jw-stone/edit",
  ])("moves platform route %s off a customer domain", (path) => {
    const destination = qualifyPublicProfileItemDestination(path, PLATFORM_ORIGIN);

    expect(destination).toBe(`${PLATFORM_ORIGIN}${path}`);
    expect(requiresDocumentNavigation(destination)).toBe(true);
  });

  it("keeps the onboarding return path platform-relative inside the qualified URL", () => {
    const requestPath = "/direct-connect?profile=jw-stone&source=profile_site";
    const destination = qualifyPublicProfileItemDestination(
      `/pre-scout-setup?mode=create&next=${encodeURIComponent(requestPath)}`,
      PLATFORM_ORIGIN
    );
    const parsed = new URL(destination);

    expect(parsed.origin).toBe(PLATFORM_ORIGIN);
    expect(parsed.pathname).toBe("/pre-scout-setup");
    expect(parsed.searchParams.get("next")).toBe(requestPath);
  });

  it("leaves Profile-owned inventory and gallery selectors on the customer domain", () => {
    expect(qualifyPublicProfileItemDestination("?stone=blue-dunes", PLATFORM_ORIGIN)).toBe(
      "?stone=blue-dunes"
    );
    expect(qualifyPublicProfileItemDestination("?gallery=recent-work", PLATFORM_ORIGIN)).toBe(
      "?gallery=recent-work"
    );
  });
});
