import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("public profile compatibility contracts", () => {
  it("revalidates public profile data when a profile page is opened", () => {
    const source = read("client/src/pages/ProfileSiteView.tsx");

    expect(source).toContain('cache: "no-cache"');
    expect(source).not.toContain('cache: "force-cache"');
  });

  it("legacy public profile API exposes canonical slug when a published profile site exists", () => {
    const source = read("server/routes.ts");

    expect(source).toContain("const canonicalPublicProfile = ownerProfiles.find");
    expect(source).toContain("canonicalProfileSlug: canonicalPublicProfile?.slug || null");
    expect(source).toContain("canonicalProfileUrl: canonicalPublicProfile?.slug");
  });

  it("legacy public profile API resolves profile-id links to owner user ids", () => {
    const source = read("server/routes.ts");

    expect(source).toContain("await storage.getProfileOwnerUserId(resolvedUserId)");
    expect(source).toContain("profile-id fallback resolution failed");
  });

  it("legacy /profile/:userId view redirects into canonical /u/:slug pages", () => {
    const source = read("client/src/pages/PublicProfileView.tsx");

    expect(source).toContain("const [, navigate] = useLocation();");
    expect(source).toContain(
      'if (typeof data?.canonicalProfileSlug === "string" && data.canonicalProfileSlug.trim())'
    );
    expect(source).toContain(
      "navigate(`/u/${encodeURIComponent(data.canonicalProfileSlug.trim())}`"
    );
  });

  it("HomeScout listing prefers canonical public profile URLs when they are available", () => {
    const source = read("client/src/pages/homescout-listing.tsx");

    expect(source).toContain("const contactProfileHref =");
    expect(source).toContain("canonicalProfileUrl");
    expect(source).toContain("<Link href={contactProfileHref}>");
  });

  it("Community profile links prefer canonical public profile URLs when available", () => {
    const source = read("client/src/pages/CommunityProfile.tsx");

    expect(source).toContain("const publicProfileHref =");
    expect(source).toContain("canonicalProfileUrl");
    expect(source).toContain("<Link href={publicProfileHref}>View public profile</Link>");
  });

  it("Connections endpoints and UI prefer canonical public profile URLs when available", () => {
    const routesSource = read("server/social-routes.ts");
    const featuresSource = read("server/social-features.ts");
    const uiSource = read("client/src/pages/connections.tsx");

    expect(routesSource).toContain("canonicalProfileUrl:");
    expect(featuresSource).toContain("canonicalProfileUrl:");
    expect(uiSource).toContain("canonicalProfileUrl?: string | null;");
    expect(uiSource).toContain("const profileHref =");
  });

  it("Admin users view prefers canonical public profile URLs when available", () => {
    const routesSource = read("server/routes.ts");
    const uiSource = read("client/src/pages/admin-users.tsx");

    expect(routesSource).toContain("canonicalProfileUrl:");
    expect(uiSource).toContain("canonicalProfileUrl?: string | null;");
    expect(uiSource).toContain("window.location.assign(");
    expect(uiSource).toContain("target.canonicalProfileUrl");
  });

  it("Provider discovery points prefer canonical public profile URLs when available", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("loadCanonicalPublicMapProfileUrls(providerIds)");
    expect(routesSource).toContain(
      "const canonicalProfileUrl = canonicalProfileUrlByProviderId.get("
    );
    expect(routesSource).toContain("if (!canonicalProfileUrl) continue;");
  });

  it("legacy contractor profile API and page bridge to canonical business profiles", () => {
    const routesSource = read("server/routes.ts");
    const contractorProfile = read("client/src/pages/contractor-profile.tsx");
    const migrationPlan = read("docs/audits/LEGACY_CONTRACTOR_NAMING_MIGRATION_PLAN.md");
    const scoutMatrix = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");

    expect(routesSource).toContain("await storage.getBusinessProfileByUserId(ownerUserId)");
    expect(routesSource).toContain("canonicalBusinessProfileSlug");
    expect(routesSource).toContain("canonicalBusinessProfileUrl:");
    expect(routesSource).toContain(
      "`/business/${encodeURIComponent(canonicalBusinessProfileSlug)}`"
    );

    expect(contractorProfile).toContain("canonicalBusinessProfileUrl?: string | null");
    expect(contractorProfile).toContain("setLocation(canonicalUrl)");
    expect(contractorProfile).toContain("Back to Find Local Help");
    expect(contractorProfile).toContain("Verified Local Provider");
    expect(contractorProfile).not.toContain("Contact stays gated through TradeScout");
    expect(contractorProfile).not.toContain("Back to Find Contractors");
    expect(contractorProfile).not.toContain("Verified Local Contractor");

    expect(migrationPlan).toContain("the API now exposes `/business/:slug`");
    expect(scoutMatrix).toContain(
      "Public contractor profile compatibility now has a first canonical bridge"
    );
  });

  it("provider discovery links prefer canonical business profile URLs when available", () => {
    const routesSource = read("server/routes.ts");
    const findContractors = read("client/src/pages/find-contractors.tsx");
    const contractorCard = read("client/src/components/contractor-card.tsx");
    const scoutTools = read("client/src/agent/tools/scoutTools.ts");
    const scoutMatrix = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");

    expect(routesSource).toContain("await storage.getBusinessProfileByUserId(contractor.userId)");
    expect(routesSource).toContain("canonicalBusinessProfileUrl:");
    expect(findContractors).toContain("canonicalBusinessProfileUrl?: string | null");
    expect(findContractors).toContain("contractor.canonicalBusinessProfileUrl ||");
    expect(contractorCard).toContain("canonicalBusinessProfileUrl?: string | null");
    expect(contractorCard).toContain("const profileHref =");
    expect(contractorCard).toContain("contractor.canonicalBusinessProfileUrl.trim()");
    expect(scoutTools).toContain("c.canonicalBusinessProfileUrl.trim()");
    expect(scoutTools).toContain('c.providerType === "business"');
    expect(scoutMatrix).toContain("Provider discovery links now prefer canonical");
  });

  it("public recommendation directories prefer canonical business profile URLs", () => {
    const profilesRoute = read("server/routes/profiles.ts");
    const profileSiteView = read("client/src/pages/ProfileSiteView.tsx");
    const scoutMatrix = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");

    expect(profilesRoute).toContain("contractorUserId: contractors.userId");
    expect(profilesRoute).toContain(
      "const canonicalBusinessUrlByUserId = new Map<string, string>()"
    );
    expect(profilesRoute).toContain("await storage.getBusinessProfileByUserId(contractorUserId)");
    expect(profilesRoute).toContain("canonicalBusinessProfileUrl:");
    expect(profileSiteView).toContain("canonicalBusinessProfileUrl?: string | null");
    expect(profileSiteView).toContain("entry.contractor.canonicalBusinessProfileUrl ||");
    expect(profileSiteView).toContain(
      "`/contractors/${encodeURIComponent(entry.contractor.slug)}`"
    );
    expect(scoutMatrix).toContain("Public profile recommendation directories now carry");
  });

  it("older SEO helpers support canonical business profile URLs before contractor fallbacks", () => {
    const seoHelmet = read("client/src/components/SEOHelmet.tsx");
    const seoLocalBusiness = read("client/src/components/SEOLocalBusiness.tsx");
    const scoutMatrix = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");

    expect(seoHelmet).toContain("canonicalBusinessProfileUrl?: string | null");
    expect(seoHelmet).toContain("const publicUrl = canonicalBusinessProfileUrl");
    expect(seoHelmet).toContain("`${origin}/contractors/${contractor.id}`");
    expect(seoHelmet).toContain('"@id": publicUrl');
    expect(seoHelmet).toContain("Verified Local Provider");

    expect(seoLocalBusiness).toContain("canonicalBusinessProfileUrl?: string | null");
    expect(seoLocalBusiness).toContain("const publicUrl = canonicalBusinessProfileUrl");
    expect(seoLocalBusiness).toContain("Local provider services");
    expect(seoLocalBusiness).toContain('serviceType: "Local Services"');
    expect(seoLocalBusiness).toContain("TradeScout verification records");
    expect(scoutMatrix).toContain("Older SEO helpers now accept canonical");
  });
});
