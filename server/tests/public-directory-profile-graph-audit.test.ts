import { describe, expect, it } from "vitest";
import {
  collectDirectoryProfileGraphAuditTargets,
  evaluateDirectoryProfileGraphHtml,
  fingerprintDirectoryProfileGraphAuditTargets,
  runPublicDirectoryProfileGraphAudit,
  type DirectoryProfileGraphAuditTarget,
} from "../services/publicDirectoryProfileGraphAudit";

const profileRow = {
  business_slug: "la-plumbing-solutions",
  business_name: "LA Plumbing Solutions",
  business_id: "business-1",
  business_status: "active",
  business_owner_user_id: "owner-1",
  public_discovery_enabled: true,
  business_sources: [],
  business_claim_status: "claimed",
  profile_data: {
    category: "Plumbing",
    services: ["Plumbing repairs", "Water heaters"],
    city: "Hammond",
    stateCode: "LA",
  },
  profile_id: "profile-1",
  profile_slug: "la-plumbing-solutions",
  profile_display_name: "LA Plumbing Solutions",
  profile_role_context: "specialty_tradesperson",
  profile_headline: "Residential and commercial plumbing",
  profile_content_blocks: [
    {
      type: "localServiceProfile",
      data: {
        serviceAreas: ["Hammond", "Ponchatoula"],
        serviceAreaDescription:
          "Based in Hammond and serving residential and commercial projects across southeast Louisiana.",
        services: [
          {
            title: "Repairs, leaks & replacements",
            description:
              "Leaks, damaged piping, fixtures, and full system replacements with the problem and options explained first.",
          },
          {
            title: "Water heaters & gas",
            description:
              "Tank and tankless repair, installation, replacement, conversion, gas lines, and related equipment.",
          },
        ],
      },
    },
  ],
  profile_owner_user_id: "owner-1",
  profile_seo_meta: {},
  owner_role: "specialty_tradesperson",
  owner_roles: ["specialty_tradesperson"],
  owner_verified_badge: true,
  owner_verification_status: "approved",
  owner_provider: "email",
  owner_preferences: { publicProfileIds: ["profile-1"] },
  county_name: "Tangipahoa Parish",
  state_code: "LA",
};

const activeScopes = [
  {
    trade_slug: "plumbing",
    state_code: "LA",
    county_slug: "tangipahoa-parish",
  },
];

function targetHtml(target: DirectoryProfileGraphAuditTarget): string {
  const profile = target.expectedProfiles[0];
  return `<!doctype html><html><head>
<script type="application/ld+json" data-ts-directory-profile-services="true">{"@type":"ItemList"}</script>
</head><body>
<div data-seo-directory-profile-service-graph="true" hidden></div>
<main><article><ul><li>
<a href="${profile.profileUrl}">${profile.profileName}</a>
<div data-seo-directory-provider-services="${profile.businessSlug}"><ul>
${profile.serviceUrls.map((url) => `<li><a href="${url}">Service</a></li>`).join("")}
${profile.serviceAreaUrl ? `<li><a href="${profile.serviceAreaUrl}">Service areas</a></li>` : ""}
</ul></div>
</li></ul></article></main>
</body></html>`;
}

describe("public directory profile graph production audit", () => {
  it("targets only active trade/county scopes with an eligible linked public profile", () => {
    const targets = collectDirectoryProfileGraphAuditTargets({
      profileRows: [profileRow],
      activeScopes,
    });

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.url)).toEqual([
      "https://www.thetradescout.com/county/la/tangipahoa-parish",
      "https://www.thetradescout.com/trade/plumbing/la/tangipahoa-parish",
    ]);
    expect(targets.every((target) => target.expectedProfiles.length === 1)).toBe(true);
    expect(targets[0].expectedProfiles[0].serviceUrls).toEqual([
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/repairs-leaks-replacements",
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas",
    ]);
    expect(targets[0].expectedProfiles[0].serviceAreaUrl).toBe(
      "https://www.thetradescout.com/u/la-plumbing-solutions/service-areas"
    );
    expect(fingerprintDirectoryProfileGraphAuditTargets(targets)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not manufacture targets outside the active snapshot", () => {
    expect(
      collectDirectoryProfileGraphAuditTargets({
        profileRows: [profileRow],
        activeScopes: [],
      })
    ).toEqual([]);
  });

  it("verifies the canonical profile, exact services, service-area hub, and structured graph", () => {
    const target = collectDirectoryProfileGraphAuditTargets({
      profileRows: [profileRow],
      activeScopes,
    })[1];
    const result = evaluateDirectoryProfileGraphHtml({
      target,
      httpStatus: 200,
      finalUrl: target.url,
      contentType: "text/html; charset=utf-8",
      html: targetHtml(target),
    });

    expect(result.checks).toEqual({
      httpOk: true,
      finalUrlMatches: true,
      htmlContentType: true,
      enrichmentMarkerPresent: true,
      expectedProfileLinksPresent: true,
      legacyBusinessAliasesRetired: true,
      expectedServiceLinksPresent: true,
      expectedServiceAreaLinksPresent: true,
      structuredServiceDataPresent: true,
      httpsCanonicalLinksOnly: true,
    });
    expect(result.missingProfileUrls).toEqual([]);
    expect(result.missingServiceUrls).toEqual([]);
    expect(result.missingServiceAreaUrls).toEqual([]);
    expect(result.legacyBusinessAliases).toEqual([]);
  });

  it("reports an old business alias and missing service link as exact failed evidence", () => {
    const target = collectDirectoryProfileGraphAuditTargets({
      profileRows: [profileRow],
      activeScopes,
    })[1];
    const profile = target.expectedProfiles[0];
    const html = targetHtml(target)
      .replace(profile.serviceUrls[0], "/missing-service")
      .replace(
        "</main>",
        `<a href="https://www.thetradescout.com/business/${profile.businessSlug}">Old alias</a></main>`
      );
    const result = evaluateDirectoryProfileGraphHtml({
      target,
      httpStatus: 200,
      finalUrl: target.url,
      contentType: "text/html",
      html,
    });

    expect(result.checks.legacyBusinessAliasesRetired).toBe(false);
    expect(result.checks.expectedServiceLinksPresent).toBe(false);
    expect(result.missingServiceUrls).toEqual([profile.serviceUrls[0]]);
    expect(result.legacyBusinessAliases).toEqual([
      `https://www.thetradescout.com/business/${profile.businessSlug}`,
    ]);
  });

  it("keeps fetch failures unavailable instead of converting them into a failed page", async () => {
    const target = collectDirectoryProfileGraphAuditTargets({
      profileRows: [profileRow],
      activeScopes,
    })[0];
    const result = await runPublicDirectoryProfileGraphAudit({
      targets: [target],
      fetchImpl: async () => {
        throw new Error("network unavailable");
      },
      persist: false,
      now: () => new Date("2026-08-25T20:30:00.000Z"),
    });

    expect(result.status).toBe("completed");
    expect(result.verifiedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.unavailableCount).toBe(1);
    expect(result.results[0].status).toBe("unavailable");
  });
});
