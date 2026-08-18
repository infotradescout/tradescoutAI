import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const app = read("client/src/App.tsx");
const routes = read("client/src/AppRoutes.tsx");
const profileView = read("client/src/pages/ProfileSiteView.tsx");
const profileTheme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
const trustActions = read("client/src/components/profile/PublicProfileTrustActions.tsx");
const identityRegistry = read("client/src/data/publicProfileIdentity.ts");
const contentAdapter = read("client/src/data/profileSiteContentAdapters.ts");
const identity = read("shared/jwStonePresentation.ts");
const expressPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
const expressRoute = read("server/routes/tradepartner-express.ts");
const serverIndex = read("server/index.ts");

describe("JW Stone 2.0 profile contact and discovery contract", () => {
  it("renders JW Stone through the canonical profile surface instead of the marketplace shell", () => {
    expect(app).toContain("isJwStoneProfileRoute");
    expect(app).not.toContain("isJwStoneMarketplaceRoute");
    expect(routes).not.toContain("const JWStoneMarketplace");
    expect(routes).not.toContain("ProfileSiteOrJwMarketplaceRedirect");
    expect(routes).toContain('<Route path="/u/:slug">');
    expect(profileView).toContain("<WholesalerProfileTheme");
    expect(serverIndex).toContain("`${origin}/u/${JW_STONE_PROFILE_SLUG}`");
    expect(serverIndex).not.toContain("serveJwStoneMarketplaceCustomDomainPath");
  });

  it("keeps the verified address and official socials on the visible profile identity", () => {
    expect(identity).toContain('streetAddress: "2103 W Herman Ave"');
    expect(identity).toContain('addressLocality: "Pensacola"');
    expect(identity).toContain('postalCode: "32505"');
    expect(identity).toContain('publicHandle: "@jwstonellc"');
    expect(identity).toContain('publicHandle: "JW Stone Logistics"');
    expect(identity).toContain('publicHandle: "@JWStoneLogistics"');
    expect(identityRegistry).toContain("JW_STONE_PUBLIC_IDENTITY.address.formatted");
    expect(identityRegistry).toContain("JW_STONE_PUBLIC_IDENTITY.socials");
    expect(trustActions).toContain('data-testid="public-profile-identity"');
    expect(trustActions).toContain('data-testid="public-profile-address"');
    expect(trustActions).toContain("public-profile-social-${social.id}");
  });

  it("adds the official YouTube destination to the Phase 2 profile presentation", () => {
    expect(contentAdapter).toContain("withJwStonePresentationDefaults");
    expect(contentAdapter).toContain("youtubeUrl: JW_STONE_YOUTUBE_URL");
    expect(profileTheme).toContain("presentation.social?.youtubeUrl");
    expect(profileTheme).toContain("sanitizeSocialVideoUrl");
    expect(profileTheme).toContain("Watch ${displayName} on YouTube");
  });

  it("keeps Call protected behind the deliberate Direct Connect choice", () => {
    expect(profileView).toContain("allowExpressCall={canExpressCall}");
    expect(profileView).toContain("businessAddress={publicBusinessAddress}");
    expect(profileTheme).toContain("allowCall={allowExpressCall}");
    expect(profileTheme).toContain("businessAddress={businessAddress}");
    expect(expressPanel).toContain("const startCall = async () =>");
    expect(expressPanel).toContain("/express-contact/reveal");
    expect(expressPanel).toContain('decision: "call"');
    expect(expressRoute).toContain('authorityGate: z.literal("profile_direct_connect")');
    expect(expressRoute).toContain('decision: z.literal("call")');
    expect(expressRoute).toContain("normalizeDirectConnectPhone(target.phone)");
    expect(identity).not.toContain("(850) 543-0748");
    expect(identityRegistry).not.toContain("(850) 543-0748");
  });
});
