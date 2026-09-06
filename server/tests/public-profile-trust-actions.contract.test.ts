import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("canonical public-profile trust actions", () => {
  it("persists only Like and Favorite with one action per viewer and profile", () => {
    const migration = read("migrations/0104_public_profile_engagements.sql");
    const schema = read("shared/schema.ts");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public_profile_engagements");
    expect(migration).toContain("CHECK (action IN ('like', 'favorite'))");
    expect(migration).toContain("public_profile_engagements_profile_user_action_uidx");
    expect(schema).toContain("export const publicProfileEngagements = pgTable(");
    expect(schema).toContain('"public_profile_engagements_action_check"');
  });

  it("provides authenticated idempotent mutations without writing to CVS or exposure", () => {
    const routes = read("server/routes/profiles.ts");
    const actionRoutes = routes.slice(
      routes.indexOf("// Public-profile actions never write"),
      routes.indexOf("// Legacy alias for backward compatibility.")
    );

    expect(actionRoutes).toContain('router.get("/api/u/:slug/trust-actions"');
    expect(actionRoutes).toMatch(
      /router\.post\(\s*"\/api\/u\/:slug\/trust-actions\/:action",\s*isAuthenticated/
    );
    expect(actionRoutes).toMatch(
      /router\.delete\(\s*"\/api\/u\/:slug\/trust-actions\/:action",\s*isAuthenticated/
    );
    expect(actionRoutes).toContain(".onConflictDoNothing()");
    expect(actionRoutes).not.toMatch(/\.(insert|update)\(trustSnapshots\)/);
    expect(actionRoutes).not.toMatch(/\.(insert|update)\([^)]*exposure/i);
  });

  it("shows recommendations received by the provider with moderated customer attribution", () => {
    const routes = read("server/routes/profiles.ts");
    const binding = routes.slice(
      routes.indexOf("async function getPublicProfileContractorBinding"),
      routes.indexOf("const sendPublicProfileBySlug")
    );
    const directory = routes.slice(
      routes.indexOf("let recommendationsDirectory"),
      routes.indexOf("let publicProfileOffers")
    );

    expect(binding).toContain("eq(profiles.id, normalizedProfileId)");
    expect(binding).toContain("eq(profiles.slug, normalizedProfileSlug)");
    expect(binding).toContain("eq(profiles.ownerUserId, normalizedOwnerUserId)");
    expect(binding).toContain("eq(profiles.businessId, normalizedBusinessId)");
    expect(binding).toContain('eq(profiles.status, "published")');
    expect(binding).toContain("eq(businesses.ownerUserId, normalizedOwnerUserId)");
    expect(binding).toContain('eq(businesses.status, "active")');
    expect(binding).toContain("eq(contractors.businessId, normalizedBusinessId)");
    expect(binding).toContain("eq(contractors.slug, normalizedProfileSlug)");
    expect(binding).toContain("isNull(contractors.userId)");
    expect(binding).toContain("eq(contractors.userId, normalizedOwnerUserId)");
    expect(binding).toContain("JW_STONE_RECOMMENDATION_COMPATIBILITY.contractorId");
    expect(binding).toContain("eq(contractors.isActive, false)");
    expect(binding).toContain("eq(contractors.verifiedLicensed, false)");
    expect(binding).toContain("eq(contractors.verifiedInsured, false)");
    expect(binding).toContain("eq(contractors.isGeneralContractor, false)");
    expect(binding).toContain("eq(contractors.isResidentialContractor, false)");
    expect(binding).toContain("eq(contractors.acceptsSubcontractWork, false)");
    expect(binding).toContain("isExactPublicProfileContractorBindingCandidate");
    expect(binding).toContain("return matches.length === 1 ? matches[0] : null");
    expect(directory).toContain("getPublicProfileContractorBinding(");
    expect(directory).toContain("eq(recommendations.contractorId, ownerContractor.id)");
    expect(directory).toContain("eq(recommendations.userId, ownerUserId)");
    expect(directory).toContain(
      'recommendationDirectoryMode = hasLinkedBusiness ? "received" : "authored"'
    );
    expect(directory).toContain("ownerContractor || !hasLinkedBusiness");
    expect(directory).not.toContain("getContractorByUserId");
    expect(directory).toContain('eq(recommendations.moderationStatus, "approved")');
    expect(directory).toContain("customerName: recommendations.customerName");
  });

  it("binds Recommend to the exact linked business and fails closed on ambiguity", () => {
    const routes = read("server/routes/profiles.ts");
    const trustContext = routes.slice(
      routes.indexOf("async function getPublicProfileTrustContext"),
      routes.indexOf("async function readPublicProfileTrustActions")
    );

    expect(trustContext).toContain("profile.id,");
    expect(trustContext).toContain("profile.slug,");
    expect(trustContext).toContain("ownerUserId,");
    expect(trustContext).toContain("profile.businessId");
    expect(trustContext).not.toContain("getContractorByUserId");

    expect(
      fs.existsSync(path.join(repoRoot, "migrations/0112_jw_stone_contractor_business_binding.sql"))
    ).toBe(false);

    const jwCompatibilityMigration = read(
      "migrations/0113_jw_stone_recommendation_compatibility_target.sql"
    );
    const migrationJournal = read("migrations/meta/_journal.json");
    expect(jwCompatibilityMigration).toContain("p.id = '8802a941-f082-45c6-b0d3-da6c484d79da'");
    expect(jwCompatibilityMigration).toContain(
      "p.owner_user_id = 'd61a5be3-d0ba-402b-afe3-47f994787c00'"
    );
    expect(jwCompatibilityMigration).toContain(
      "p.business_id = '3cbfd44b-59c5-4d08-8106-1a58b7746966'"
    );
    expect(jwCompatibilityMigration).toContain("b.owner_user_id = p.owner_user_id");
    expect(jwCompatibilityMigration).toContain("p.status = 'published'");
    expect(jwCompatibilityMigration).toContain("b.status = 'active'");
    expect(jwCompatibilityMigration).toContain("'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'");
    expect(jwCompatibilityMigration).toContain(
      "WHERE c.id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'"
    );
    expect(jwCompatibilityMigration).toContain("OR c.slug = jw.slug");
    expect(jwCompatibilityMigration).toContain("OR c.business_id = jw.business_id");
    expect(jwCompatibilityMigration).not.toMatch(/INSERT INTO contractors \(\s*user_id,/);
    expect(jwCompatibilityMigration).toContain("is_general_contractor");
    expect(jwCompatibilityMigration).toContain("is_residential_contractor");
    expect(jwCompatibilityMigration).toContain("accepts_subcontract_work");
    expect(jwCompatibilityMigration).toMatch(/FALSE,\s+FALSE,\s+FALSE,\s+FALSE,\s+FALSE,\s+FALSE,/);
    expect(jwCompatibilityMigration).toContain("ON CONFLICT (slug) DO NOTHING");
    expect(jwCompatibilityMigration).not.toMatch(
      /\b(?:insert\s+into|update)\s+(?:trust_snapshots|county_entities|county_metrics)\b/i
    );
    expect(migrationJournal).toContain(
      '"tag": "0113_jw_stone_recommendation_compatibility_target"'
    );
    const scheduledMigrationHashes = new Set(
      readMigrationFiles({ migrationsFolder: path.join(repoRoot, "migrations") }).map(
        (migration) => migration.hash
      )
    );
    const compatibilityMigrationHash = createHash("sha256")
      .update(jwCompatibilityMigration)
      .digest("hex");
    expect(scheduledMigrationHashes.has(compatibilityMigrationHash)).toBe(true);
  });

  it("renders Like, Recommend, Favorite, and Share in every canonical profile theme", () => {
    const actions = read("client/src/components/profile/PublicProfileTrustActions.tsx");
    const app = read("client/src/App.tsx");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const themes = [
      "client/src/pages/profile-sites/WholesalerProfileTheme.tsx",
      "client/src/pages/profile-sites/LocalServiceProfileTheme.tsx",
      "client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx",
      "client/src/pages/profile-sites/ProFabProfileTheme.tsx",
      "client/src/pages/profile-sites/VideographerProfileTheme.tsx",
      "client/src/pages/profile-sites/DefaultProfileTheme.tsx",
    ].map(read);

    expect(actions).toContain(">Like</span>");
    expect(actions).toContain(">Recommend</span>");
    expect(actions).toContain(">Favorite</span>");
    expect(actions).toContain('label="Share"');
    expect(actions).toContain("trustAction=${action}");
    expect(actions).toContain('requestedAction === "favorite"');
    expect(profileView).toContain("platformBaseHref={platformBaseHref}");
    expect(actions).not.toMatch(/\bStar(s|Icon)?\b/);
    expect(app).toContain('import { Toaster } from "./components/ui/toaster"');
    expect(app).toContain("<Toaster />");
    expect(profileView).toContain('renderProfileTrustActions("light")');
    expect(profileView.match(/renderProfileTrustActions\(\s*"dark"/g)).toHaveLength(4);
    const localServiceTheme = profileView.slice(
      profileView.indexOf("<LocalServiceProfileBoundary>"),
      profileView.indexOf("</LocalServiceProfileBoundary>")
    );
    expect(localServiceTheme).toMatch(
      /trustActions=\{renderProfileTrustActions\(\s*resolvedLocalServicePresentation\.layout === "project-profile" \? "light" : "dark",\s*resolvedLocalServicePresentation\.layout === "project-profile" \? "compact" : "default"\s*\)\}/
    );
    const trustRenderer = profileView.slice(
      profileView.indexOf("const renderProfileTrustActions ="),
      profileView.indexOf("const readProfileBlockText =")
    );
    expect(trustRenderer).toContain("<PublicProfileTrustActions");
    expect(trustRenderer).toContain("tone={tone}");
    expect(trustRenderer).toContain("density={density}");
    themes.forEach((theme) => {
      expect(theme).toContain("trustActions: ReactNode");
      expect(theme).toMatch(/\{(?:resolvedTrustActions|trustActions)\}/);
    });
  });

  it("credits Codex contributions in the repository README", () => {
    const readme = read("README.md");

    expect(readme).toContain("## Codex Contributions");
    expect(readme).toContain("active engineering collaborator on TradeScout");
    expect(readme).toContain("reviewable through the same source-control");
  });

  it("keeps the Express Direct Connect form legible inside themed profile pages", () => {
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(panel.match(/!bg-white/g)?.length).toBeGreaterThanOrEqual(5);
    expect(panel.match(/!text-neutral-900/g)?.length).toBeGreaterThanOrEqual(5);
    expect(panel.match(/placeholder:!text-stone-400/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
