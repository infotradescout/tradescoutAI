import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Profile booking ownership contracts", () => {
  it("persists booking settings through the selected canonical Profile", () => {
    const routes = read("server/routes/profiles.ts");
    const editor = read("client/src/pages/ProfileSiteEditor.tsx");
    const settings = read("client/src/pages/ProfileSettings.tsx");

    expect(routes).toContain('router.get("/api/profiles/:id/profile-booking"');
    expect(routes).toContain('router.patch("/api/profiles/:id/profile-booking"');
    expect(routes).toContain("upsertProfileBookingConfigBlock(");
    expect(routes).toContain("A booking deposit must be greater than zero");
    expect(routes).toContain("readProfileBookingConfigBlock(existing.contentBlocks)");
    expect(routes).toContain(
      "upsertProfileBookingConfigBlock(updates.contentBlocks, existingProfileBooking)"
    );

    expect(editor).toContain("`/api/profiles/${encodeURIComponent(detail.id)}/profile-booking`");
    expect(editor).toContain("`/api/profiles/${encodeURIComponent(profile.id)}/profile-booking`");
    expect(editor).not.toContain('apiRequest("PATCH", "/api/users/profile-booking"');

    expect(settings).toContain("`/api/profiles/${encodeURIComponent(active.id)}/profile-booking`");
    expect(settings).toContain(
      "`/api/profiles/${encodeURIComponent(bookingProfileId)}/profile-booking`"
    );
    expect(settings).not.toContain('fetch("/api/users/profile-booking"');
  });

  it("resolves Profile configuration before the legacy account fallback for public output", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const resolver = read("server/services/profileBookingConfig.ts");
    const bookingRoutes = read("server/routes.ts");

    expect(repository).toContain("readProfileBookingConfigBlock(publicProfile.contentBlocks)");
    expect(repository).toContain("legacyProfileBooking");
    expect(resolver).toContain('source: "profile"');
    expect(resolver).toContain('source: "legacy_owner"');
    expect(bookingRoutes).toContain("resolveProfileBookingConfig(bookingProfile, owner)");
    expect(bookingRoutes).toContain("legacyBusinessProfile.bookingConfig");
  });
});
