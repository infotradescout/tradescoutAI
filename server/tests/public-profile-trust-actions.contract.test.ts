import fs from "node:fs";
import path from "node:path";
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
      routes.indexOf("const profileSections")
    );

    expect(binding).toContain("eq(contractors.userId, normalizedOwnerUserId)");
    expect(binding).toContain("eq(contractors.businessId, normalizedBusinessId)");
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

    expect(trustContext).toContain(
      "getPublicProfileContractorBinding(ownerUserId, profile.businessId)"
    );
    expect(trustContext).not.toContain("getContractorByUserId");
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
    ].map(read);

    expect(actions).toContain(">Like</span>");
    expect(actions).toContain(">Recommend</span>");
    expect(actions).toContain(">Favorite</span>");
    expect(actions).toContain('label="Share"');
    expect(actions).not.toMatch(/\bStar(s|Icon)?\b/);
    expect(app).toContain('import { Toaster } from "./components/ui/toaster"');
    expect(app).toContain("<Toaster />");
    expect(profileView).toContain('renderProfileTrustActions("light")');
    expect(profileView.match(/renderProfileTrustActions\("dark"\)/g)).toHaveLength(5);
    themes.forEach((theme) => {
      expect(theme).toContain("trustActions: ReactNode");
      expect(theme).toContain("{trustActions}");
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
