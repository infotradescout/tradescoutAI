import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canAuthenticatedViewerPreviewProfile,
  canServeLinkedBusinessProfileToViewer,
} from "../routes/profiles";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("onboarding-created profile trust boundary", () => {
  it("allows only an authenticated owner or profile-managing admin to preview", () => {
    expect(canAuthenticatedViewerPreviewProfile({ user: { id: "owner-1" } }, "owner-1")).toBe(true);
    expect(
      canAuthenticatedViewerPreviewProfile(
        { user: { id: "admin-1", role: "super_admin" } },
        "owner-1"
      )
    ).toBe(true);
    expect(
      canAuthenticatedViewerPreviewProfile(
        { user: { id: "staff-1", roles: ["head_admin"] } },
        "owner-1"
      )
    ).toBe(true);
    expect(canAuthenticatedViewerPreviewProfile({ user: { id: "viewer-1" } }, "owner-1")).toBe(
      false
    );
    expect(canAuthenticatedViewerPreviewProfile({ user: { role: "super_admin" } }, "owner-1")).toBe(
      false
    );
    expect(canAuthenticatedViewerPreviewProfile({}, "owner-1")).toBe(false);
  });

  it("keeps verification and the narrow owner-confirmed exception as public authority", () => {
    const pendingOwner = { verifiedBadge: false, verificationStatus: "pending" };

    expect(
      canServeLinkedBusinessProfileToViewer({
        ownerUser: pendingOwner,
        ownerConfirmedDirectProfile: false,
        authenticatedViewerCanManage: false,
      })
    ).toBe(false);
    expect(
      canServeLinkedBusinessProfileToViewer({
        ownerUser: pendingOwner,
        ownerConfirmedDirectProfile: false,
        authenticatedViewerCanManage: true,
      })
    ).toBe(true);
    expect(
      canServeLinkedBusinessProfileToViewer({
        ownerUser: pendingOwner,
        ownerConfirmedDirectProfile: true,
        authenticatedViewerCanManage: false,
      })
    ).toBe(true);
    expect(
      canServeLinkedBusinessProfileToViewer({
        ownerUser: { verifiedBadge: false, verificationStatus: "approved" },
        ownerConfirmedDirectProfile: false,
        authenticatedViewerCanManage: false,
      })
    ).toBe(true);
    expect(
      canServeLinkedBusinessProfileToViewer({
        ownerUser: { verifiedBadge: true, verificationStatus: "pending" },
        ownerConfirmedDirectProfile: false,
        authenticatedViewerCanManage: false,
      })
    ).toBe(true);
  });

  it("filters public search trust authority before ordering and limiting results", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const routes = read("server/routes/profiles.ts");
    const searchPredicate = repository.slice(
      repository.indexOf("function publicProfileSearchExposurePredicate"),
      repository.indexOf("export class ProfileRepository")
    );
    const searchSelection = repository.slice(
      repository.indexOf("async searchProfilesPublic"),
      repository.indexOf("async createProfileForOwner")
    );
    const publicSearchRoute = routes.slice(
      routes.indexOf('router.get("/api/profiles/public-search"'),
      routes.indexOf('router.get("/api/profiles/:id/profile-booking"')
    );

    expect(searchSelection).toContain(
      ".leftJoin(businesses, eq(profiles.businessId, businesses.id))"
    );
    expect(searchSelection).toContain("publicProfileSearchExposurePredicate()");
    expect(searchSelection.indexOf(".where(")).toBeLessThan(searchSelection.indexOf(".orderBy("));
    expect(searchSelection.indexOf(".orderBy(")).toBeLessThan(
      searchSelection.indexOf(".limit(limit)")
    );
    expect(searchPredicate).toContain("${profiles.businessId} IS NOT NULL");
    expect(searchPredicate).toContain("${profiles.ownerUserId} = ${businesses.ownerUserId}");
    expect(searchPredicate).toContain("${businesses.publicDiscoveryEnabled} = true");
    expect(searchPredicate).toContain("${users.verifiedBadge} = true");
    expect(searchPredicate).toContain("${users.verificationStatus}::text");
    expect(searchPredicate).toContain("'approved'");
    expect(searchPredicate).toContain("durableProfessionalProfileApprovalSql");
    expect(publicSearchRoute).not.toContain("await db");
    expect(publicSearchRoute).not.toContain("ownerUserId");
    expect(publicSearchRoute).not.toContain("businessId");
    expect(publicSearchRoute).toContain("results.map((row) => ({");
  });

  it("gates every linked canonical profile and makes viewer-specific responses uncacheable", () => {
    const routes = read("server/routes/profiles.ts");
    const publicRead = routes.slice(
      routes.indexOf("const sendPublicProfileBySlug"),
      routes.indexOf("const publicProfileTrustActionSchema")
    );

    expect(publicRead).toContain("if (profile.businessId)");
    expect(publicRead).toContain("canAuthenticatedViewerPreviewProfile(req, ownerUserId)");
    expect(publicRead).toContain("canServeLinkedBusinessProfileToViewer({");
    expect(publicRead).toContain(
      "ownerConfirmedDirectProfile: ownerConfirmedDirectProfile || unlistedSteelHomeDirectProfile,"
    );
    expect(
      publicRead.match(/res\.setHeader\("Cache-Control", "private, no-store"\)/g)?.length
    ).toBeGreaterThanOrEqual(3);
    expect(publicRead).toContain(
      'res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120")'
    );
    expect(publicRead).not.toContain(".update(users)");
    expect(publicRead).not.toContain("storage.updateUser(");
    expect(publicRead).not.toContain("verification_started");
  });
});
